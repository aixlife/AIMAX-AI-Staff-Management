#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
from datetime import UTC, datetime, timedelta
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"failed to load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


watchdog = load_module("aimax_report_watchdog", ROOT / "scripts" / "aimax_report_watchdog.py")
guidance = load_module("aimax_report_auto_guidance", ROOT / "scripts" / "aimax_report_auto_guidance.py")


now = datetime(2026, 6, 19, 12, 40, tzinfo=UTC)
old = "2026-06-19T11:20:10.235Z"
ticket = {
    "ticket_id": "AIMAX-AUTO-20260618122443-f7699a80",
    "status": "open",
    "report_id": "AIMAX-RPT-20260618122443-d8ccac1e",
    "created_at": "2026-06-18T12:24:43.547Z",
    "updated_at": old,
}

open_without_report_status = watchdog.open_tickets([ticket], now, timedelta(minutes=60), timedelta(days=14))
assert len(open_without_report_status) == 1

open_with_waiting_report = watchdog.open_tickets(
    [ticket],
    now,
    timedelta(minutes=60),
    timedelta(days=14),
    {"AIMAX-RPT-20260618122443-d8ccac1e": "waiting_user"},
)
assert open_with_waiting_report == []

approval_report = {
    "report_id": "AIMAX-RPT-SMOKE-DEPLOY-APPROVAL",
    "status": "working",
    "stored_at": old,
    "status_updated_at": old,
    "public_message": "서버 후처리 보강을 완료했습니다. 운영 배포 전 승인 대기 중입니다.",
    "next_update_message": "배포가 승인되어 반영되면 이후 새 글 생성부터 개선됩니다.",
}
approval_ticket = {
    "ticket_id": "AIMAX-AUTO-SMOKE-DEPLOY-APPROVAL",
    "status": "working",
    "report_id": approval_report["report_id"],
    "created_at": old,
    "updated_at": old,
    "suggested_next_action": "민수님 배포 승인 후 운영 반영 및 사용자 확인 안내",
}
assert watchdog.stale_reports([approval_report], now, timedelta(minutes=60), timedelta(days=14)) == []
assert watchdog.open_tickets(
    [approval_ticket],
    now,
    timedelta(minutes=60),
    timedelta(days=14),
    {approval_report["report_id"]: "working"},
) == []

with tempfile.TemporaryDirectory(prefix="aimax-report-ticket-sync-") as tmp:
    data_dir = Path(tmp)
    (data_dir / "automation-tickets.jsonl").write_text(f"{json.dumps(ticket)}\n", encoding="utf-8")
    assert guidance.latest_ticket_statuses(data_dir)[ticket["ticket_id"]] == "open"
    guidance.append_ticket_status_update(
        data_dir,
        ticket["ticket_id"],
        ticket["report_id"],
        "waiting_user",
        "2026-06-19T12:40:00.000Z",
        False,
    )
    assert guidance.latest_ticket_statuses(data_dir)[ticket["ticket_id"]] == "waiting_user"

print("REPORT_WATCHDOG_TICKET_SYNC_SMOKE_OK")
