#!/usr/bin/env python3
"""Verify the deployed Cafe24 partner attribution endpoint on Oracle."""

from __future__ import annotations

import json
import urllib.request
from pathlib import Path


ENV_PATH = Path("/home/ubuntu/aimax-reports-api/.env")
ENDPOINT = "http://127.0.0.1:18988/api/integrations/cafe24/partner-attribution"


def read_env(key: str) -> str:
    for raw_line in ENV_PATH.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        if name.strip() != key:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            return value[1:-1]
        return value
    return ""


def post(secret: str, body: dict) -> dict:
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-AIMAX-Cafe24-Secret": secret,
        },
    )
    with urllib.request.urlopen(req, timeout=12) as res:
        return json.loads(res.read().decode("utf-8"))


def main() -> int:
    secret = read_env("AIMAX_CAFE24_WEBHOOK_SECRET")
    if not secret:
        raise RuntimeError("AIMAX_CAFE24_WEBHOOK_SECRET missing")

    cases = [
        (
            "no_hint",
            {"order": {"name": "테스트", "product": "테스트", "amount": 30000}},
        ),
        (
            "fake_ref",
            {"order": {"name": "테스트", "product": "테스트", "amount": 30000, "ref": "codex_nomatch_20260615"}},
        ),
    ]
    for label, body in cases:
        data = post(secret, body)
        print(
            label,
            "ok=" + str(data.get("ok")),
            "matched=" + str(data.get("matched")),
            "reason=" + str(data.get("reason")),
            "partner_line_len=" + str(len(data.get("partner_line") or "")),
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
