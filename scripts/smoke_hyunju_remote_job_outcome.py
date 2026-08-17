#!/usr/bin/env python3
"""스모크: 현주(서이추) 원격 잡이 실제 실패를 서버에 실패로 보고하는지 검증한다.

배경 (2026-08-18): `_worker_remote_job` 의 hyunju_find 분기가 워커 결과를 버리고 무조건
`done` 으로 보고했다. `_worker_neighbor` 는 내부에서 모든 예외를 삼키므로, 네이버 로그인
실패 같은 진짜 실패도 서버에는 "성공"으로 기록됐다(8/17 현주 서이추 오류 보고에 연결된
잡 3건이 전부 done). 그 결과 사용자는 실패를 겪는데 오류 보고에 자동 분류가 붙지 않았다.

실행: .venv/bin/python scripts/smoke_hyunju_remote_job_outcome.py
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from app import HeadlessNaverBlogAgent  # noqa: E402

FAILURES: list[str] = []


def check(label: str, actual: Any, expected: Any) -> None:
    if actual == expected:
        print(f"  PASS {label}")
        return
    FAILURES.append(f"{label}: expected={expected!r} actual={actual!r}")
    print(f"  FAIL {label}: expected={expected!r} actual={actual!r}")


class FakeClient:
    def __init__(self) -> None:
        self.updates: list[dict[str, Any]] = []

    def update_job(self, job_id, status, message, level="info", result=None):
        self.updates.append({"job_id": job_id, "status": status, "message": message, "level": level, "result": result})


def make_agent() -> HeadlessNaverBlogAgent:
    agent = HeadlessNaverBlogAgent()
    agent.naver_id_var.set("naver-smoke")
    agent.naver_pw_var.set("naver-password-smoke")
    agent._fetch_web_secret_statuses = lambda: {}  # type: ignore[method-assign]
    return agent


HYUNJU_JOB = {
    "id": "job-hyunju-smoke",
    "kind": "hyunju_find",
    "payload": {
        "keywords": ["홈베이킹"],
        "max_per_keyword": 3,
        "messages": ["안녕하세요, 서로이웃해요."],
        "speed_mode": "normal",
        "target_mode": "keyword",
    },
}


def run_remote_job(worker_result: Any) -> list[dict[str, Any]]:
    agent = make_agent()
    client = FakeClient()

    def fake_neighbor(**_kwargs: Any) -> Any:
        agent.queue.put(("done", None))
        return worker_result

    agent._worker_neighbor = fake_neighbor  # type: ignore[method-assign]
    agent._worker_remote_job(client, dict(HYUNJU_JOB))
    return client.updates


def terminal_update(updates: list[dict[str, Any]]) -> dict[str, Any]:
    # 마지막 업데이트가 종료 보고다(running 진행 보고 뒤).
    return updates[-1] if updates else {}


print("[1] 워커가 실패를 반환하면 서버에도 failed 로 보고한다")
NAVER_LOGIN_ERROR = "로그인 버튼을 찾을 수 없습니다. 네이버 페이지 구조가 변경되었을 수 있습니다."
updates = run_remote_job({"ok": False, "stage": "neighbor_request", "error": NAVER_LOGIN_ERROR})
final = terminal_update(updates)
check("종료 상태", final.get("status"), "failed")
check("실패 사유 전달", final.get("message"), NAVER_LOGIN_ERROR)
check("로그 레벨", final.get("level"), "error")
check("정형 result 동봉", (final.get("result") or {}).get("stage"), "neighbor_request")

print("[2] 성공이면 그대로 done + 결과 동봉")
updates = run_remote_job({"ok": True, "stage": "neighbor_request", "total": 7})
final = terminal_update(updates)
check("종료 상태", final.get("status"), "done")
check("신청 건수 전달", (final.get("result") or {}).get("total"), 7)

print("[3] 이웃 목록 비공개처럼 예외 없이 끝난 실패도 failed 로 잡힌다")
updates = run_remote_job({"ok": False, "stage": "follower_scrape", "error": "기준 블로거의 이웃 목록이 비공개입니다."})
check("종료 상태", terminal_update(updates).get("status"), "failed")

print("[4] 구버전처럼 결과가 없으면(None) 기존 동작대로 done — 회귀 방지")
updates = run_remote_job(None)
final = terminal_update(updates)
check("종료 상태", final.get("status"), "done")
check("result 미동봉", final.get("result"), None)

print("[5] _worker_neighbor 자체가 실패 결과를 돌려주는지 (예외를 삼켜도 ok=False)")
agent = make_agent()


def boom(*_args: Any, **_kwargs: Any):
    raise RuntimeError(NAVER_LOGIN_ERROR)


# 브라우저 기동 단계에서 바로 터지게 해 예외 삼킴 경로를 그대로 통과시킨다.
sys.modules.setdefault("browser", __import__("browser"))
import browser.stealth_driver as stealth  # noqa: E402

original_create = stealth.create_stealth_driver
stealth.create_stealth_driver = boom  # type: ignore[assignment]
try:
    outcome = agent._worker_neighbor(["홈베이킹"], 3, messages=["안녕하세요, 서로이웃해요."], speed_mode="normal")
finally:
    stealth.create_stealth_driver = original_create  # type: ignore[assignment]

check("예외를 삼켜도 ok=False 반환", (outcome or {}).get("ok"), False)
check("오류 문구 보존", NAVER_LOGIN_ERROR in str((outcome or {}).get("error")), True)

print()
if FAILURES:
    print(f"FAIL {len(FAILURES)}건")
    for line in FAILURES:
        print(f" - {line}")
    sys.exit(1)
print("HYUNJU_REMOTE_JOB_OUTCOME_SMOKE_OK")
