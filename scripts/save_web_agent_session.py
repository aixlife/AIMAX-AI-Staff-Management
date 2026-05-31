"""Store an AIMAX web session token in the local OS credential store.

This helper is for local smoke testing and migration. It prompts for the web
app password without echoing it, logs in through the AIMAX API, then stores only
the returned session token in keyring via web_agent.client.
"""
from __future__ import annotations

import argparse
import getpass
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from web_agent.client import (  # noqa: E402
    AimaxApiError,
    AimaxWebAgentClient,
    DEFAULT_BASE_URL,
    default_device_label,
    save_session_token,
    save_state,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Log in to the AIMAX web API and save the local agent session token.",
    )
    parser.add_argument("--email", help="AIMAX web app email. If omitted, prompts interactively.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="AIMAX API base URL.")
    parser.add_argument("--device-label", default=default_device_label(), help="Device label for this login.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    email = (args.email or input("AIMAX email: ")).strip().lower()
    if not email:
        print("email is required", file=sys.stderr)
        return 2

    password = getpass.getpass("AIMAX password: ")
    if not password:
        print("password is required", file=sys.stderr)
        return 2

    client = AimaxWebAgentClient(base_url=args.base_url, session_token="")
    try:
        result = client.login(email=email, password=password, device_label=args.device_label)
    except AimaxApiError as exc:
        print(f"login failed: {exc.error}", file=sys.stderr)
        return 1

    token = str(result.get("session_token") or "")
    if not token:
        print("login succeeded, but no session token was returned", file=sys.stderr)
        return 1
    if not save_session_token(token):
        print("failed to store session token in the OS credential store", file=sys.stderr)
        return 1

    save_state(email=email, base_url=args.base_url, device_label=args.device_label)
    print(f"saved AIMAX web session for {email} on {args.device_label}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
