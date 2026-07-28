#!/usr/bin/env python3
"""후기 리워드 승인 대기 방치 알림.

donggyu-review-reward는 제출이 pending_review로 쌓이고 운영자가 승인해야 발송된다.
승인 담당이 큐를 보지 않으면 고객은 "메일이 안 온다"고 문의하게 되고, 실제로
2026-07-28에 21건이 최대 32일간 방치된 채 발견됐다. 이 워치독은 그 큐를 대신
지켜보며 일정 시간 이상 묵은 건이 있으면 텔레그램으로 알린다.

배포 위치: /home/ubuntu/aimax-reward-watchdog/reward_pending_watchdog.py
크론: 0 0,9 * * * (UTC) = 매일 09:00 / 18:00 KST
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

DEFAULT_REQUESTS_FILE = Path("/home/ubuntu/donggyu-review-reward/data/staff-rewards/requests.json")
DEFAULT_ENV_FILE = Path("/home/ubuntu/aimax-reports-api/.env")
DEFAULT_STATE_FILE = Path("/home/ubuntu/aimax-reward-watchdog/state.json")
ADMIN_CONSOLE_URL = "https://api.aimax.ai.kr/admin/staff-rewards"


def utc_now() -> datetime:
    return datetime.now(UTC)


def parse_time(value: str) -> datetime | None:
    if not value:
        return None
    text = str(value).strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def age_label(age: timedelta) -> str:
    hours = max(0, int(age.total_seconds() // 3600))
    if hours >= 24:
        return f"{hours // 24}일"
    return f"{hours}시간"


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if key and key not in os.environ:
            os.environ[key] = value.strip().strip('"').strip("'")


def read_json(path: Path) -> Any:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8", errors="replace"))
    except json.JSONDecodeError:
        return None


def pending_requests(rows: list[dict[str, Any]], now: datetime, stale_after: timedelta) -> list[dict[str, Any]]:
    stale = []
    for row in rows:
        if row.get("status") != "pending_review":
            continue
        created = parse_time(row.get("createdAt", ""))
        if created is None:
            continue
        age = now - created
        if age >= stale_after:
            stale.append({"row": row, "age": age})
    stale.sort(key=lambda item: item["age"], reverse=True)
    return stale


def build_message(stale: list[dict[str, Any]], now: datetime) -> str:
    kst = now + timedelta(hours=9)
    lines = [
        "[후기 리워드 승인 대기]",
        f"기준: {kst:%Y-%m-%d %H:%M} KST",
        "",
        f"승인해야 발송되는 리워드가 {len(stale)}건 대기 중입니다.",
        "",
    ]
    for item in stale[:10]:
        row = item["row"]
        name = str(row.get("name") or "이름없음")
        staff = str(row.get("staffLabel") or row.get("staffProduct") or "-")
        lines.append(f"- {name} · {staff} · {age_label(item['age'])} 경과")
    if len(stale) > 10:
        lines.append(f"- 외 {len(stale) - 10}건")
    lines.extend(["", f"승인: {ADMIN_CONSOLE_URL}"])
    return "\n".join(lines)


def telegram_send(token: str, chat_id: str, text: str, thread_id: str = "") -> dict[str, Any]:
    payload = {"chat_id": chat_id, "text": text, "disable_web_page_preview": True}
    if thread_id:
        payload["message_thread_id"] = thread_id
    data = urllib.parse.urlencode(payload).encode("utf-8")
    request = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8", errors="replace"))


def should_send(state: dict[str, Any], signature: str, now: datetime, repeat_after: timedelta) -> bool:
    """같은 대기 목록으로 하루에 몇 번씩 울리지 않게 한다.

    목록이 바뀌면(새 건 유입/처리 완료) 서명이 달라져 즉시 다시 알린다.
    """
    if state.get("last_signature") != signature:
        return True
    last_sent = parse_time(state.get("last_sent_at", ""))
    if last_sent is None:
        return True
    return (now - last_sent) >= repeat_after


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="후기 리워드 승인 대기 방치 알림")
    parser.add_argument("--requests-file", type=Path, default=DEFAULT_REQUESTS_FILE)
    parser.add_argument("--env-file", type=Path, default=DEFAULT_ENV_FILE)
    parser.add_argument("--state-file", type=Path, default=DEFAULT_STATE_FILE)
    parser.add_argument("--stale-hours", type=int, default=24)
    parser.add_argument("--repeat-hours", type=int, default=24)
    parser.add_argument("--send", action="store_true", help="실제 텔레그램 발송")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    load_env_file(args.env_file)
    now = utc_now()

    raw = read_json(args.requests_file)
    if raw is None:
        print(json.dumps({"ok": False, "error": "requests_file_unreadable", "path": str(args.requests_file)}, ensure_ascii=False))
        return 1
    rows = raw if isinstance(raw, list) else raw.get("requests", [])

    stale = pending_requests(rows, now, timedelta(hours=max(1, args.stale_hours)))
    signature = "|".join(sorted(item["row"].get("id", "") for item in stale))
    state = read_json(args.state_file) or {}
    send_allowed = bool(stale) and should_send(state, signature, now, timedelta(hours=max(1, args.repeat_hours)))

    result = {
        "ok": True,
        "checked_at": now.isoformat(),
        "pending_count": len(stale),
        "send_allowed": send_allowed,
    }

    if args.send and send_allowed:
        token = os.environ.get("AIMAX_TELEGRAM_BOT_TOKEN", "").strip()
        chat_id = os.environ.get("AIMAX_TELEGRAM_CHAT_ID", "").strip()
        thread_id = os.environ.get("AIMAX_TELEGRAM_MESSAGE_THREAD_ID", "").strip()
        if not token or not chat_id:
            result["ok"] = False
            result["error"] = "telegram_env_missing"
            print(json.dumps(result, ensure_ascii=False))
            return 1
        response = telegram_send(token, chat_id, build_message(stale, now), thread_id)
        result["telegram_ok"] = bool(response.get("ok"))
        state["last_signature"] = signature
        state["last_sent_at"] = now.isoformat()
        args.state_file.parent.mkdir(parents=True, exist_ok=True)
        args.state_file.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    elif not stale:
        result["message"] = "대기 중인 리워드 없음"

    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
