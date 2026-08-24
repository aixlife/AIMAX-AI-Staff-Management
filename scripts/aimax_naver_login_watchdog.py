#!/usr/bin/env python3
"""네이버 로그인 회귀 감시.

왜 있나: 네이버는 로그인 화면 구조를 예고 없이 바꾼다. 2026-08-17에 바뀌었을 때
예리가 로그인 버튼을 못 찾아 전 사용자의 글쓰기가 막혔는데, 아무도 그 사실을
알려주지 않아 사용자 신고가 올라올 때까지 방치됐다.

테스트 계정으로는 이걸 미리 잡을 수 없다(네이버 계정을 더 만들 수 없다).
그래서 실제 작업 실패에서 그 신호를 직접 읽어 알린다.

판정: 최근 창(기본 24시간) 안의 예리 작업 실패 중 로그인 계열 신호가
임계치 이상이면 알린다. 사용자 한 명의 비밀번호 오류와 구분하기 위해
서로 다른 사용자 2명 이상 또는 같은 신호 3건 이상일 때만 올린다.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DATA_FILE = Path("/home/ubuntu/aimax-reports/data/jobs.json")
ENV_FILE = Path("/home/ubuntu/aimax-reports-api/.env")
STATE_FILE = Path("/home/ubuntu/aimax-naver-login-watchdog/state.json")

# 네이버 화면 변경 계열 — 우리 쪽 코드가 못 따라간 신호
STRUCTURE_PATTERNS = [
    ("로그인 버튼을 찾을 수 없", "로그인 버튼을 못 찾음"),
    ("네이버 페이지 구조가 변경", "페이지 구조 변경 감지"),
    ("자동 로그인이 막혀", "자동 로그인 차단"),
    ("invalid session id", "브라우저 세션 끊김"),
]
# 네이버가 사람인지 확인하는 계열 — 우리 코드 문제는 아니지만 몰리면 차단 신호
CHALLENGE_PATTERNS = [
    ("CAPTCHA", "캡차 발생"),
]


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def parse_iso(value: str) -> float:
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except Exception:
        return 0.0


def failure_text(job: dict) -> str:
    result = job.get("result") or {}
    parts = [
        str(result.get("error") or ""),
        str(result.get("detail_code") or ""),
        str(result.get("visible_error") or ""),
        str(job.get("failed_reason") or ""),
    ]
    for post in result.get("posts") or []:
        parts.append(str(post.get("error") or ""))
    return " ".join(p for p in parts if p)


def scan(jobs: list, window_hours: float) -> dict:
    cutoff = time.time() - window_hours * 3600
    hits: list[dict] = []
    total_failed = 0
    for job in jobs:
        if job.get("kind") != "yeri_write" or job.get("status") != "failed":
            continue
        created = parse_iso(job.get("created_at") or "")
        if created < cutoff:
            continue
        total_failed += 1
        text = failure_text(job)
        for needle, label in STRUCTURE_PATTERNS:
            if needle.lower() in text.lower():
                hits.append({
                    "kind": "structure",
                    "label": label,
                    "user": str(job.get("user_id") or "?"),
                    "at": str(job.get("created_at") or ""),
                    "platform": str(job.get("target_platform") or ""),
                })
                break
        else:
            for needle, label in CHALLENGE_PATTERNS:
                if needle.lower() in text.lower():
                    hits.append({
                        "kind": "challenge",
                        "label": label,
                        "user": str(job.get("user_id") or "?"),
                        "at": str(job.get("created_at") or ""),
                        "platform": str(job.get("target_platform") or ""),
                    })
                    break
    structure = [h for h in hits if h["kind"] == "structure"]
    users = {h["user"] for h in structure}
    return {
        "window_hours": window_hours,
        "failed_total": total_failed,
        "hits": hits,
        "structure_count": len(structure),
        "structure_users": len(users),
        "alert": len(users) >= 2 or len(structure) >= 3,
    }


def build_message(report: dict) -> str:
    labels: dict[str, int] = {}
    for hit in report["hits"]:
        labels[hit["label"]] = labels.get(hit["label"], 0) + 1
    lines = [
        "예리 네이버 로그인 이상 신호",
        "",
        f"최근 {int(report['window_hours'])}시간 안에 로그인 단계 실패가 몰렸습니다.",
        f"- 로그인 계열 실패 {report['structure_count']}건 / 서로 다른 사용자 {report['structure_users']}명",
        f"- 같은 기간 예리 전체 실패 {report['failed_total']}건",
        "",
        "신호별:",
    ]
    for label, count in sorted(labels.items(), key=lambda x: -x[1]):
        lines.append(f"- {label} {count}건")
    lines += [
        "",
        "네이버가 로그인 화면을 또 바꿨을 가능성이 높습니다.",
        "실행기의 로그인 단계 선택자를 확인해주세요.",
    ]
    return "\n".join(lines)


def telegram_send(text: str) -> dict:
    token = os.environ.get("AIMAX_TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.environ.get("AIMAX_TELEGRAM_CHAT_ID", "").strip()
    thread_id = os.environ.get("AIMAX_TELEGRAM_MESSAGE_THREAD_ID", "").strip()
    if not token or not chat_id:
        return {"ok": False, "error": "telegram_not_configured"}
    payload = {"chat_id": chat_id, "text": text}
    if thread_id:
        payload["message_thread_id"] = thread_id
    data = urllib.parse.urlencode(payload).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=data,
        headers={"content-type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return {"ok": True, "status": resp.status}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)[:200]}


def load_state() -> dict:
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return {}


def save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--window-hours", type=float, default=24.0)
    parser.add_argument("--repeat-after-hours", type=float, default=12.0)
    parser.add_argument("--send", action="store_true")
    parser.add_argument("--jobs-file", default=str(DATA_FILE))
    args = parser.parse_args()

    load_env(ENV_FILE)
    try:
        raw = json.loads(Path(args.jobs_file).read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": f"jobs_read_failed: {exc}"}, ensure_ascii=False))
        return 1
    jobs = raw.get("jobs") if isinstance(raw, dict) else raw
    if not isinstance(jobs, list):
        print(json.dumps({"ok": False, "error": "jobs_shape_unexpected"}, ensure_ascii=False))
        return 1

    report = scan(jobs, args.window_hours)
    state = load_state()
    now = time.time()
    last_sent = float(state.get("last_sent_at") or 0)
    cooled = (now - last_sent) >= args.repeat_after_hours * 3600
    will_send = bool(args.send and report["alert"] and cooled)

    if will_send:
        result = telegram_send(build_message(report))
        report["telegram"] = result
        if result.get("ok"):
            state["last_sent_at"] = now
            state["last_signature"] = f"{report['structure_count']}/{report['structure_users']}"
            save_state(state)
    report["sent"] = will_send
    report["cooled"] = cooled
    print(json.dumps(report, ensure_ascii=False, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
