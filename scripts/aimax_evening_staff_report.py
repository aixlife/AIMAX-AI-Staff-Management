#!/usr/bin/env python3
"""Build the AIMAX evening staff status report.

Default behavior is safe: print a dry-run report only. Telegram delivery is
enabled only when --send is passed.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

try:
    from secret_loader import load_makefamily_script_secrets
except ModuleNotFoundError:
    load_makefamily_script_secrets = None


SCHEDULE_DB = "0ff4a88c-67c0-455c-ae04-a4502257860b"
GROUP_ID = "-1003525610702"
KST = ZoneInfo("Asia/Seoul")
STAFF = ("송이", "윤미", "나경", "회사비서")
DEFAULT_DELAY_REASON = "공통 설정, 실행기 안정화, 보고 자동화 확인이 먼저 필요했습니다."


@dataclass(frozen=True)
class ScheduleItem:
    title: str
    day: date | None
    done: bool
    url: str
    last_edited_time: str


def load_secrets() -> dict[str, str]:
    if load_makefamily_script_secrets is None:
        raise RuntimeError(
            "secret_loader.py is required. Run this script next to the existing "
            "MakeFamily server scripts or provide the same loader."
        )
    return load_makefamily_script_secrets()


def notion_request(key: str, method: str, url: str, payload: dict | None = None) -> dict:
    data = None
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {key}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


def telegram_send(token: str, text: str) -> dict:
    payload = urllib.parse.urlencode({"chat_id": GROUP_ID, "text": text}).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=payload,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


def title_prop(page: dict, key: str) -> str:
    parts = page.get("properties", {}).get(key, {}).get("title", [])
    return "".join(part.get("plain_text", "") for part in parts).strip()


def parse_day(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value[:10]).date()
    except ValueError:
        return None


def format_day(day: date | None) -> str:
    if day is None:
        return "날짜 없음"
    return f"{day.month}/{day.day}"


def clean_staff_title(title: str, staff: str | None = None) -> str:
    title = title.removeprefix("이전 일정 - ").strip()
    if staff and title.startswith(f"{staff} - "):
        return title[len(staff) + 3 :].strip()
    return title


def query_aimax_items(notion_key: str) -> list[ScheduleItem]:
    payload = {
        "filter": {"property": "분류", "select": {"equals": "AI"}},
        "sorts": [{"property": "날짜", "direction": "ascending"}],
        "page_size": 100,
    }
    data = notion_request(
        notion_key,
        "POST",
        f"https://api.notion.com/v1/databases/{SCHEDULE_DB}/query",
        payload,
    )
    items: list[ScheduleItem] = []
    for page in data.get("results", []):
        props = page.get("properties", {})
        title = title_prop(page, "일정 메모") or title_prop(page, "Name")
        date_value = (props.get("날짜", {}).get("date") or {}).get("start")
        items.append(
            ScheduleItem(
                title=title or "(제목 없음)",
                day=parse_day(date_value),
                done=bool(props.get("done", {}).get("checkbox")),
                url=page.get("url", ""),
                last_edited_time=page.get("last_edited_time", ""),
            )
        )
    return items


def item_staff(item: ScheduleItem) -> str | None:
    for staff in STAFF:
        if item.title.startswith(f"{staff} - ") or item.title.startswith(f"이전 일정 - {staff}"):
            return staff
    return None


def build_staff_line(staff: str, items: list[ScheduleItem], today: date) -> str:
    own = [item for item in items if item_staff(item) == staff and not item.done]
    overdue = [item for item in own if item.day and item.day < today]
    today_items = [item for item in own if item.day == today]
    future = [item for item in own if item.day and item.day > today]

    parts: list[str] = []
    if today_items:
        text = " / ".join(clean_staff_title(item.title, staff) for item in today_items[:2])
        parts.append(f"오늘 - {text}")
    if overdue:
        text = " / ".join(
            f"{clean_staff_title(item.title, staff)}({format_day(item.day)})"
            for item in overdue[:2]
        )
        parts.append(f"지연 - {text}")
    if not parts and future:
        first = future[0]
        parts.append(f"다음 - {clean_staff_title(first.title, staff)}({format_day(first.day)})")
    if not parts:
        parts.append("대기 - 연결된 미완료 일정 없음")
    return f"- {staff}: {'; '.join(parts)}"


def build_report(items: list[ScheduleItem], today: date, reason: str) -> str:
    return build_schedule_report(items, today, reason)


def build_status_report(status: dict, today: date) -> str:
    label = f"{today.month}월 {today.day}일"
    lines = [f"[AIMAX 오늘 진행 공유 / {label}]", ""]

    summary = status.get("summary")
    progress = status.get("today_progress") or []
    lines.append("한 줄 요약:")
    if summary:
        lines.append(f"- {summary}")
    elif progress:
        lines.append(f"- {progress[0]}")
    else:
        lines.append("- 오늘 진행 기록을 정리 중입니다.")

    staff_status = status.get("staff_status") or {}
    lines += ["", "직원별 현황:"]
    for staff in STAFF:
        text = staff_status.get(staff)
        if text:
            lines.append(f"- {staff}: {text}")

    delays = status.get("delays") or []
    lines += ["", "늦어진 부분:"]
    if delays:
        for item in delays[:2]:
            lines.append(f"- {item}")
    else:
        lines.append("- 현재 별도 지연 기록은 없습니다.")

    lines += ["", "이유:"]
    lines.append(f"- {status.get('reason') or DEFAULT_DELAY_REASON}")

    lines += ["", "다음 목표:"]
    lines.append(f"- {status.get('next_goal') or '다음 직원별 세부 일정을 정리하겠습니다.'}")
    return "\n".join(lines)


def build_schedule_report(items: list[ScheduleItem], today: date, reason: str) -> str:
    active = [item for item in items if not item.done and not item.title.startswith("이전 일정 -")]
    today_items = [item for item in active if item.day == today]
    overdue = [item for item in active if item.day and item.day < today]
    future = [item for item in active if item.day and item.day > today]

    label = f"{today.month}월 {today.day}일"
    lines = [f"[AIMAX 오늘 진행 공유 / {label}]", ""]

    lines.append("오늘 진행:")
    if today_items:
        today_text = ", ".join(clean_staff_title(item.title, item_staff(item)) for item in today_items[:3])
        lines.append(f"- {today_text} 확인일입니다.")
    else:
        lines.append("- 오늘 날짜로 잡힌 AIMAX 직원 일정은 없습니다.")

    lines += ["", "직원별 현황:"]
    for staff in STAFF:
        lines.append(build_staff_line(staff, active, today))

    lines += ["", "늦어진 부분:"]
    visible_overdue = [item for item in overdue if item_staff(item)]
    if visible_overdue:
        staff_names = sorted({item_staff(item) for item in visible_overdue if item_staff(item)})
        lines.append(f"- {', '.join(staff_names)} 항목 {len(visible_overdue)}개가 일정 대비 밀렸습니다.")
    else:
        lines.append("- 현재 일정표 기준 지연 항목은 없습니다.")

    lines += ["", "이유:"]
    if overdue:
        lines.append(f"- {reason}")
    else:
        lines.append("- 오늘은 예정 항목 확인 중심입니다.")

    lines += ["", "다음 목표:"]
    if today_items:
        lines.append("- 오늘 항목을 확인하고, 밀린 항목은 사유를 남긴 뒤 다음 일정으로 넘기겠습니다.")
    elif future:
        next_item = future[0]
        lines.append(f"- 다음 일정은 {format_day(next_item.day)} {clean_staff_title(next_item.title, item_staff(next_item))}입니다.")
    else:
        lines.append("- 다음 직원별 세부 일정을 다시 정리하겠습니다.")

    return "\n".join(lines)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build AIMAX evening staff report")
    parser.add_argument("--date", help="KST report date in YYYY-MM-DD format")
    parser.add_argument("--reason", default=DEFAULT_DELAY_REASON, help="Delay reason to show when items are overdue")
    parser.add_argument("--status-file", help="Optional JSON status file to use before schedule-derived text")
    parser.add_argument("--send", action="store_true", help="Send to Telegram. Omitted means dry-run only.")
    parser.add_argument("--json", action="store_true", help="Print a JSON status line after the report")
    return parser.parse_args(argv)


def load_status_file(path: str | None) -> dict | None:
    candidates: list[Path] = []
    if path:
        candidates.append(Path(path))
    candidates.append(Path(__file__).with_name("aimax_staff_status_current.json"))
    candidates.append(Path.cwd() / "docs/operations/aimax_staff_status_current.json")

    for candidate in candidates:
        if candidate.exists():
            return json.loads(candidate.read_text(encoding="utf-8"))
    return None


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    today = parse_day(args.date) if args.date else datetime.now(KST).date()
    if today is None:
        raise SystemExit("--date must be YYYY-MM-DD")

    status = load_status_file(args.status_file)
    items: list[ScheduleItem] = []
    secrets: dict[str, str] = {}

    if not status or args.send:
        secrets = load_secrets()
    if not status:
        items = query_aimax_items(secrets["NOTION_API_KEY"])

    report = build_status_report(status, today) if status else build_report(items, today, args.reason)

    print(report)
    sent = False
    if args.send:
        telegram_send(secrets["MAKEFAMILY_TELEGRAM_BOT_TOKEN"], report)
        sent = True

    if args.json:
        print(
            json.dumps(
                {
                    "ok": True,
                    "sent": sent,
                    "items": len(items),
                    "status_file": bool(status),
                    "script": str(Path(__file__).name),
                },
                ensure_ascii=False,
            )
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
