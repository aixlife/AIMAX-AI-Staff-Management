#!/usr/bin/env python3
"""이미 안내 메일이 나간 보고 행에 "무엇을 보냈는지"(user_notified_category)를 기록한다.

배경: sweepWaitingUserReportMail 은 user_notified_at 이 찍힌 행을 영구 스킵한다.
안내 분류가 나중에 교정돼도 사용자에게는 전달되지 않는다(2026-08-23 건 실측).
분류가 바뀌었을 때만 1회 재발송하도록 바꾸려면, 먼저 "이미 보낸 분류"를 기록해야 한다.
이 백필을 하지 않고 재발송 규칙만 켜면 과거 보고 전체에 메일이 나갈 수 있다.

- user_notified_at 이 있고 user_notified_category 가 없는 행만 채운다.
- 값은 그 행의 현재 auto_guidance_category. 비어 있으면(운영자 수동 안내) 건드리지 않는다.
- 멱등: 재실행해도 이미 채워진 행은 그대로 둔다.

실행: python3 scripts/backfill_report_notified_category.py [--data-dir DIR] [--apply]
기본은 dry-run 이다.
"""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import UTC, datetime
from pathlib import Path

DEFAULT_DATA_DIR = Path("/home/ubuntu/aimax-reports/data")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR))
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    index_path = data_dir / "reports-index.jsonl"
    rows = [json.loads(line) for line in index_path.read_text(encoding="utf-8").splitlines() if line.strip()]

    filled, already, skipped_no_category, not_notified = [], 0, [], 0
    for row in rows:
        if not str(row.get("user_notified_at") or ""):
            not_notified += 1
            continue
        if str(row.get("user_notified_category") or ""):
            already += 1
            continue
        category = str(row.get("auto_guidance_category") or "")
        if not category:
            skipped_no_category.append(str(row.get("report_id") or ""))
            continue
        row["user_notified_category"] = category
        filled.append((str(row.get("report_id") or ""), category))

    if args.apply and filled:
        stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
        shutil.copy2(index_path, index_path.with_name(f"{index_path.name}.bak-{stamp}-notified-category"))
        tmp = index_path.with_suffix(".jsonl.tmp")
        tmp.write_text("".join(f"{json.dumps(row, ensure_ascii=False)}\n" for row in rows), encoding="utf-8")
        tmp.replace(index_path)

    print(json.dumps({
        "ok": True,
        "applied": bool(args.apply),
        "total_rows": len(rows),
        "not_notified": not_notified,
        "already_marked": already,
        "filled_count": len(filled),
        "filled": filled,
        "skipped_no_auto_category": skipped_no_category,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
