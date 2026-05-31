"""Production-safe heartbeat smoke for the headless AIMAX Local Agent.

This uses the saved web session token from the OS credential store, sends a
real heartbeat to the configured AIMAX API, and verifies /api/agent/status. It
sets AIMAX_AGENT_HEARTBEAT_ONLY=1 so queued commands or jobs are not fetched.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import threading
import time
from typing import Any

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("AIMAX_AGENT_HEARTBEAT_ONLY", "1")
os.environ.setdefault("AIMAX_AGENT_POLL_SECONDS", "5")

import aimax_compliance as aimax  # noqa: E402
from app import HeadlessNaverBlogAgent  # noqa: E402
from web_agent.client import (  # noqa: E402
    AimaxApiError,
    AimaxWebAgentClient,
    load_session_token,
    load_state,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Send one production heartbeat without consuming agent commands or jobs.",
    )
    parser.add_argument("--timeout", type=float, default=20.0, help="Seconds to wait for /api/agent/status.")
    parser.add_argument("--base-url", help="Override AIMAX API base URL.")
    return parser.parse_args()


def status_snapshot(client: AimaxWebAgentClient) -> dict[str, Any]:
    return client._request("GET", "/api/agent/status")  # noqa: SLF001 - smoke script for local API contract


def main() -> int:
    args = parse_args()
    token = load_session_token()
    if not token:
        print(
            "missing saved web session. Run: venv/bin/python scripts/save_web_agent_session.py --email <email>",
            file=sys.stderr,
        )
        return 2

    state = load_state()
    base_url = args.base_url or state.get("base_url")
    client = AimaxWebAgentClient(base_url=base_url, session_token=token)

    try:
        me = client.me()
    except AimaxApiError as exc:
        print(f"session check failed: {exc.error}", file=sys.stderr)
        return 1

    agent = HeadlessNaverBlogAgent()
    poll_thread = threading.Thread(target=agent._web_agent_loop, args=(client,), daemon=True)
    poll_thread.start()

    deadline = time.monotonic() + args.timeout
    last_status: dict[str, Any] | None = None
    try:
        while time.monotonic() < deadline:
            agent._process_headless_queue()
            try:
                last_status = status_snapshot(client)
            except AimaxApiError:
                time.sleep(0.25)
                continue

            info = last_status.get("agent") or {}
            if info.get("connected") and str(info.get("version") or "") == aimax.APP_VERSION:
                break
            time.sleep(0.25)
    finally:
        agent.web_agent_stop_event.set()
        poll_thread.join(timeout=2)

    if not last_status:
        print("agent status was not available", file=sys.stderr)
        return 1

    info = last_status.get("agent") or {}
    summary = {
        "ok": True,
        "base_url": client.base_url,
        "user_email": (me.get("user") or {}).get("email") or "",
        "can_execute": me.get("can_execute"),
        "connected": bool(info.get("connected")),
        "status": info.get("status"),
        "version": info.get("version"),
        "last_seen_at": info.get("last_seen_at"),
        "platform": info.get("platform"),
        "device_label": info.get("device_label"),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    if not summary["connected"]:
        print("heartbeat was sent, but agent is not connected yet", file=sys.stderr)
        return 1
    if summary["version"] != aimax.APP_VERSION:
        print(f"unexpected agent version: {summary['version']}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
