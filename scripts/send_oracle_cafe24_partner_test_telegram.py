#!/usr/bin/env python3
"""Send one Cafe24 partner-attribution test Telegram message via n8n bot config."""

from __future__ import annotations

import json
import re
import sqlite3
import urllib.request


WORKFLOW_ID = "eXVG8GAQdtx8q8gm"
DB_PATH = "/home/ubuntu/.n8n/database.sqlite"


def extract_required(pattern: str, text: str, label: str) -> str:
    match = re.search(pattern, text, re.S)
    if not match:
        raise RuntimeError(f"missing {label}")
    return match.group(1)


def main() -> int:
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute("select nodes from workflow_entity where id=?", (WORKFLOW_ID,)).fetchone()
    if not row:
        raise RuntimeError("workflow not found")
    nodes = json.loads(row[0])
    telegram_node = next((node for node in nodes if node.get("name") == "텔레그램 알림"), None)
    payload_node = next((node for node in nodes if node.get("name") == "노션 페이로드 빌드"), None)
    if not telegram_node or not payload_node:
        raise RuntimeError("required Telegram/payload nodes not found")

    url = str((telegram_node.get("parameters") or {}).get("url") or "").strip()
    if not url.startswith("https://api.telegram.org/bot") or not url.endswith("/sendMessage"):
        raise RuntimeError("telegram sendMessage url not found")

    code = (payload_node.get("parameters") or {}).get("jsCode") or ""
    chat_id = extract_required(r"chat_id:\s*['\"]([^'\"]+)['\"]", code, "telegram chat id")
    thread_expr = extract_required(r"const\s+PAYMENT_THREAD_ID\s*=\s*([^;]+);", code, "payment thread id").strip()
    thread_id = None if thread_expr == "null" else int(thread_expr)

    body = {
        "chat_id": chat_id,
        "text": (
            "💰 새 주문 접수\n\n"
            "상수 페이지에서 결제\n"
            "주문자: 상수테스트\n"
            "연락처: 010-0000-****\n"
            "상품: AI 직원 상수 가구매 테스트\n"
            "금액: 30,000원\n"
            "주문일: 2026-06-15"
        ),
        "parse_mode": "Markdown",
    }
    if thread_id is not None:
        body["message_thread_id"] = thread_id

    req = urllib.request.Request(
        url,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=12) as res:
        data = json.loads(res.read().decode("utf-8"))
    print("telegram_ok=" + str(data.get("ok")))
    result = data.get("result") or {}
    print("message_id=" + str(result.get("message_id", "")))
    print("destination=existing_n8n_payment_topic")
    print("token_printed=false")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
