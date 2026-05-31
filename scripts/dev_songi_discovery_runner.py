#!/usr/bin/env python3
"""Run a local Songi YouTube discovery poller against a dev AIMAX server.

This helper is for local manual testing only. It logs into the selected AIMAX
web app, sends local readiness, polls agent commands, and lets the existing
Songi yt-dlp command handler populate discovery cards.
"""
from __future__ import annotations

import argparse
import os
import sys
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from app import HeadlessNaverBlogAgent  # noqa: E402
from web_agent.client import AimaxWebAgentClient, default_device_label  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Local Songi YouTube discovery dev runner")
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--heartbeat-seconds", default="5")
    parser.add_argument("--command-poll-seconds", default="2")
    args = parser.parse_args()

    os.environ.setdefault("AIMAX_AGENT_HEARTBEAT_SECONDS", str(args.heartbeat_seconds))
    os.environ.setdefault("AIMAX_AGENT_COMMAND_POLL_SECONDS", str(args.command_poll_seconds))
    os.environ.setdefault("AIMAX_AGENT_DISABLE_JOBS", "1")

    base_url = args.base_url.rstrip("/")
    client = AimaxWebAgentClient(base_url=base_url, session_token="")
    login = client.login(args.email, args.password, device_label=default_device_label())
    if login.get("requires_password_change") or not login.get("can_execute"):
        raise RuntimeError("The dev account cannot execute local agent commands.")

    agent = HeadlessNaverBlogAgent()
    agent.web_agent_client = client
    agent.web_agent_stop_event.clear()
    poll_thread = threading.Thread(target=agent._web_agent_loop, args=(client,), daemon=True)
    poll_thread.start()

    print(f"[송이 dev runner] connected to {base_url}", flush=True)
    print("[송이 dev runner] keyword discovery commands will run with local yt-dlp.", flush=True)
    try:
        while poll_thread.is_alive():
            agent._process_headless_queue()
            time.sleep(0.1)
    except KeyboardInterrupt:
        print("[송이 dev runner] stopping.", flush=True)
    finally:
        agent.web_agent_stop_event.set()
        poll_thread.join(timeout=3)
        agent._process_headless_queue()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
