#!/usr/bin/env python3
"""스모크: 방치 리포트 알림의 중복 억제 서명이 시간이 흘러도 안정적인지 검증한다.

배경 (2026-07-03 → 2026-08-18 확인): 자동 수리 에이전트가 중복 판정을 위해
watchdog 출력의 `.message` 를 통째로 해시했다. 그런데 그 메시지에는 현재 시각(분 단위)과
각 리포트의 경과시간("3h 42m")이 들어 있어 **실행할 때마다 서명이 달라졌다.**
그 결과 24시간 재알림 억제가 한 번도 발동하지 못하고 하루 91~92회 실행 + 텔레그램 발송이
반복됐고, 7/3에 타이머가 꺼진 뒤 46일간 자동 수리가 멈춰 있었다.

핵심 계약: **같은 리포트 집합이면 시간이 흘러도 서명이 같아야 한다.**
watchdog 이 리포트/티켓 id 로 만든 안정 서명을 JSON 으로 노출하고, 수리 에이전트가 그걸 쓴다.

실행: python3 scripts/smoke_repair_agent_dedup_signature.py
"""

from __future__ import annotations

import json
import pathlib
import subprocess
import sys
import tempfile
from datetime import UTC, datetime, timedelta

REPO = pathlib.Path(__file__).resolve().parents[1]
FAILURES: list[str] = []


def check(label: str, actual, expected) -> None:
    if actual == expected:
        print(f"  PASS {label}")
        return
    FAILURES.append(f"{label}: expected={expected!r} actual={actual!r}")
    print(f"  FAIL {label}: expected={expected!r} actual={actual!r}")


def run_watchdog(data_dir: pathlib.Path) -> dict:
    proc = subprocess.run(
        [
            sys.executable,
            "scripts/aimax_report_watchdog.py",
            "--data-dir", str(data_dir),
            "--stale-minutes", "1",
            "--lookback-days", "3650",
            "--limit", "20",
        ],
        cwd=REPO,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise SystemExit(f"watchdog 실행 실패: {proc.stderr[-600:]}")
    return json.loads(proc.stdout)


def write_fixture(data_dir: pathlib.Path, ages_hours: list[float]) -> None:
    rows = []
    for index, hours in enumerate(ages_hours):
        stored = (datetime.now(UTC) - timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        rows.append({
            "report_id": f"AIMAX-RPT-SMOKE-{index}",
            "stored_at": stored,
            "status": "new",
            "product": "bundle",
            "os": "Windows",
            "work_context": "스모크 픽스처",
            "visible_error": "스모크 픽스처",
        })
    (data_dir / "reports-index.jsonl").write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n", encoding="utf-8"
    )
    (data_dir / "automation-tickets.jsonl").write_text("", encoding="utf-8")


with tempfile.TemporaryDirectory() as tmp:
    data_dir = pathlib.Path(tmp)

    print("[1] watchdog 이 안정 서명을 JSON 으로 내보낸다")
    write_fixture(data_dir, [5.0])
    first = run_watchdog(data_dir)
    check("signature 키 존재", bool(first.get("signature")), True)
    check("리포트 1건 집계", first.get("stale_report_count"), 1)

    print("[2] 경과시간이 달라져도 같은 리포트면 서명이 같다 (핵심 회귀)")
    # 실제로 1분을 기다리는 대신 픽스처의 경과시간을 늘려 같은 상황을 만든다.
    write_fixture(data_dir, [9.0])
    later = run_watchdog(data_dir)
    check("메시지는 달라졌다", first.get("message") != later.get("message"), True)
    check("서명은 그대로다", first.get("signature"), later.get("signature"))

    print("[3] 리포트 집합이 실제로 바뀌면 서명도 바뀐다 (억제가 과하지 않다)")
    write_fixture(data_dir, [9.0, 3.0])
    changed = run_watchdog(data_dir)
    check("리포트 2건 집계", changed.get("stale_report_count"), 2)
    check("서명 변경됨", changed.get("signature") != later.get("signature"), True)

    print("[4] 대상이 없으면 조용하다")
    write_fixture(data_dir, [])
    empty = run_watchdog(data_dir)
    check("리포트 0건", empty.get("stale_report_count"), 0)
    check("발송 허용 안 함", empty.get("send_allowed"), False)

print()
if FAILURES:
    print(f"FAIL {len(FAILURES)}건")
    for line in FAILURES:
        print(f" - {line}")
    sys.exit(1)
print("REPAIR_AGENT_DEDUP_SIGNATURE_SMOKE_OK")
