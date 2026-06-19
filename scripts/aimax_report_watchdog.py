#!/usr/bin/env python3
"""Escalate AIMAX reports/tickets that are likely being ignored.

The reports API creates Telegram alerts and automation tickets when reports
arrive. This watchdog is the missing second pass: it scans durable storage and
re-alerts when open tickets or new reports have not moved for too long.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any


DEFAULT_DATA_DIR = Path("/home/ubuntu/aimax-reports/data")
DEFAULT_ENV_FILE = Path("/home/ubuntu/aimax-reports-api/.env")
DEFAULT_PUBLIC_BASE_URL = "https://api.aimax.ai.kr"
KST_LABEL = "KST"


def utc_now() -> datetime:
    return datetime.now(UTC)


def parse_time(value: str) -> datetime | None:
    if not value:
        return None
    text = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def age_label(age: timedelta) -> str:
    seconds = max(0, int(age.total_seconds()))
    hours, rem = divmod(seconds, 3600)
    minutes = rem // 60
    if hours:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"


def compact(value: Any, limit: int = 160) -> str:
    text = " ".join(str(value or "").split())
    if len(text) <= limit:
        return text or "-"
    return f"{text[: limit - 3]}..."


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            rows.append(value)
    return rows


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8", errors="replace"))
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_name(f"{path.name}.tmp-{os.getpid()}")
    tmp_path.write_text(f"{json.dumps(value, ensure_ascii=False, indent=2)}\n", encoding="utf-8")
    tmp_path.replace(path)


def latest_rows_by_id(rows: list[dict[str, Any]], key: str) -> dict[str, dict[str, Any]]:
    latest: dict[str, dict[str, Any]] = {}
    for row in rows:
        row_id = str(row.get(key) or "")
        if row_id:
            latest[row_id] = row
    return latest


def stale_reports(
    rows: list[dict[str, Any]],
    now: datetime,
    stale_after: timedelta,
    lookback: timedelta,
) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for row in rows:
        status = str(row.get("status") or "new")
        if status not in {"new", "reviewing", "working"}:
            continue
        updated_at = parse_time(str(row.get("status_updated_at") or row.get("stored_at") or ""))
        if not updated_at:
            continue
        age = now - updated_at
        stored_at = parse_time(str(row.get("stored_at") or ""))
        if stored_at and now - stored_at > lookback:
            continue
        if age >= stale_after:
            candidates.append({**row, "_age": age})
    return sorted(candidates, key=lambda item: item["_age"], reverse=True)


def open_tickets(
    rows: list[dict[str, Any]],
    now: datetime,
    stale_after: timedelta,
    lookback: timedelta,
    report_status_by_id: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    latest = latest_rows_by_id(rows, "ticket_id").values()
    candidates: list[dict[str, Any]] = []
    for row in latest:
        if str(row.get("status") or "open") not in {"open", "new", "working"}:
            continue
        linked_report_id = str(row.get("report_id") or "")
        linked_report_status = (report_status_by_id or {}).get(linked_report_id, "")
        if linked_report_status in {"done", "waiting_user"}:
            continue
        updated_at = parse_time(str(row.get("updated_at") or row.get("created_at") or ""))
        if not updated_at:
            continue
        age = now - updated_at
        created_at = parse_time(str(row.get("created_at") or ""))
        if created_at and now - created_at > lookback:
            continue
        if age >= stale_after:
            candidates.append({**row, "_age": age})
    return sorted(candidates, key=lambda item: item["_age"], reverse=True)


def build_message(
    reports: list[dict[str, Any]],
    tickets: list[dict[str, Any]],
    *,
    public_base_url: str,
    now: datetime,
    limit: int,
) -> str:
    lines = [
        "[AIMAX 오류 자동체킹]",
        f"기준: {now.strftime('%Y-%m-%d %H:%M UTC')} / 자동 재알림",
        f"방치 의심 리포트: {len(reports)}건",
        f"열린 자동화 티켓: {len(tickets)}건",
    ]
    if reports:
        lines += ["", "리포트 우선 확인:"]
        for row in reports[:limit]:
            lines.append(
                "- "
                f"{row.get('report_id', '-')} "
                f"({row.get('status', '-')}, {age_label(row['_age'])}) "
                f"{compact(row.get('product'), 40)} / {compact(row.get('os'), 40)} / "
                f"{compact(row.get('work_context') or row.get('visible_error'), 120)}"
            )
    if tickets:
        lines += ["", "자동화 티켓:"]
        for row in tickets[:limit]:
            lines.append(
                "- "
                f"{row.get('ticket_id', '-')} "
                f"({row.get('category', '-')}, {row.get('priority', '-')}, {age_label(row['_age'])}) "
                f"{compact(row.get('visible_error') or row.get('work_context'), 140)}"
            )
    lines += ["", f"관리: {public_base_url.rstrip('/')}/admin#reports"]
    return "\n".join(lines)


def telegram_send(token: str, chat_id: str, text: str, thread_id: str = "") -> dict[str, Any]:
    payload = {
        "chat_id": chat_id,
        "text": text[:3900],
        "disable_web_page_preview": "true",
    }
    if thread_id:
        payload["message_thread_id"] = thread_id
    data = urllib.parse.urlencode(payload).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=data,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as response:
        return json.load(response)


def alert_signature(reports: list[dict[str, Any]], tickets: list[dict[str, Any]]) -> str:
    ids = [
        *(str(row.get("report_id") or "") for row in reports),
        *(str(row.get("ticket_id") or "") for row in tickets),
    ]
    payload = "\n".join(sorted(item for item in ids if item))
    return hashlib.sha256(payload.encode()).hexdigest()


def should_send(state: dict[str, Any], signature: str, now: datetime, repeat_after: timedelta) -> bool:
    if state.get("last_signature") != signature:
        return True
    last_sent = parse_time(str(state.get("last_sent_at") or ""))
    if not last_sent:
        return True
    return now - last_sent >= repeat_after


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="AIMAX report/ticket watchdog")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--env-file", type=Path, default=DEFAULT_ENV_FILE)
    parser.add_argument("--stale-minutes", type=int, default=60)
    parser.add_argument("--lookback-days", type=int, default=7)
    parser.add_argument("--repeat-hours", type=int, default=6)
    parser.add_argument("--state-file", type=Path)
    parser.add_argument("--limit", type=int, default=6)
    parser.add_argument("--send", action="store_true", help="Send Telegram alert. Default only prints JSON.")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    load_env_file(args.env_file)
    now = utc_now()
    stale_after = timedelta(minutes=max(1, args.stale_minutes))
    lookback = timedelta(days=max(1, args.lookback_days))
    repeat_after = timedelta(hours=max(1, args.repeat_hours))
    data_dir = args.data_dir
    report_rows = read_jsonl(data_dir / "reports-index.jsonl")
    report_status_by_id = {
        str(row.get("report_id") or ""): str(row.get("status") or "new")
        for row in latest_rows_by_id(report_rows, "report_id").values()
    }
    reports = stale_reports(report_rows, now, stale_after, lookback)
    tickets = open_tickets(
        read_jsonl(data_dir / "automation-tickets.jsonl"),
        now,
        stale_after,
        lookback,
        report_status_by_id,
    )
    public_base_url = os.environ.get("AIMAX_PUBLIC_BASE_URL", DEFAULT_PUBLIC_BASE_URL)
    message = build_message(reports, tickets, public_base_url=public_base_url, now=now, limit=args.limit)
    state_file = args.state_file or data_dir / "report-watchdog-state.json"
    state = read_json(state_file)
    signature = alert_signature(reports, tickets)
    send_allowed = bool(reports or tickets) and should_send(state, signature, now, repeat_after)

    result: dict[str, Any] = {
        "ok": True,
        "send": args.send,
        "stale_minutes": args.stale_minutes,
        "lookback_days": args.lookback_days,
        "repeat_hours": args.repeat_hours,
        "send_allowed": send_allowed,
        "stale_report_count": len(reports),
        "open_ticket_count": len(tickets),
        "message": message,
    }
    if args.send and send_allowed:
        token = os.environ.get("AIMAX_TELEGRAM_BOT_TOKEN", "").strip()
        chat_id = os.environ.get("AIMAX_TELEGRAM_CHAT_ID", "").strip()
        thread_id = os.environ.get("AIMAX_TELEGRAM_MESSAGE_THREAD_ID", "").strip()
        if not token or not chat_id:
            result.update({"ok": False, "error": "telegram_not_configured"})
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 2
        sent = telegram_send(token, chat_id, message, thread_id)
        result["telegram_ok"] = bool(sent.get("ok"))
        write_json(state_file, {
            "last_signature": signature,
            "last_sent_at": now.isoformat(),
            "stale_report_count": len(reports),
            "open_ticket_count": len(tickets),
        })
    elif args.send:
        result["skipped_reason"] = "no_stale_items_or_repeat_window"
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
