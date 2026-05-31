"""Smoke-test the AIMAX web job -> local agent dispatch flow.

This test uses the real production API and the real local dispatch code, but it
replaces the final Naver automation workers with test doubles so no Naver login,
posting, comments, or neighbor requests are executed.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import threading
from queue import Queue
from typing import Any

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from app import NaverBlogApp  # noqa: E402
from web_agent.client import AimaxWebAgentClient, current_platform_label, default_device_label  # noqa: E402


class Var:
    def __init__(self, value: str = ""):
        self.value = value

    def get(self) -> str:
        return self.value

    def set(self, value: str) -> None:
        self.value = value


def api(base_url: str, path: str, token: str | None = None, method: str = "GET", payload: dict[str, Any] | None = None) -> dict[str, Any]:
    headers = {"content-type": "application/json"}
    if token:
        headers["authorization"] = f"Bearer {token}"
    response = requests.request(method, f"{base_url}{path}", headers=headers, json=payload, timeout=20)
    try:
        body = response.json()
    except ValueError:
        body = {"ok": False, "error": response.text[:300]}
    if response.status_code >= 400 or body.get("ok") is False:
        raise RuntimeError(f"{method} {path} failed: {response.status_code} {body}")
    return body


def login_and_prepare(base_url: str, email: str, password: str, new_password: str | None) -> tuple[str, dict[str, Any]]:
    result = api(
        base_url,
        "/api/auth/login",
        method="POST",
        payload={"email": email, "password": password, "device_label": "codex-mac-e2e-smoke"},
    )
    token = result["session_token"]
    if result.get("requires_password_change"):
        if not new_password:
            raise RuntimeError("Account requires password change. Pass --new-password.")
        api(
            base_url,
            "/api/auth/change-password",
            token=token,
            method="POST",
            payload={"current_password": password, "new_password": new_password},
        )
        result = api(
            base_url,
            "/api/auth/login",
            method="POST",
            payload={"email": email, "password": new_password, "device_label": "codex-mac-e2e-smoke"},
        )
        token = result["session_token"]
    return token, result


def create_job(base_url: str, token: str, kind: str, payload: dict[str, Any]) -> dict[str, Any]:
    return api(base_url, "/api/jobs", token=token, method="POST", payload={"kind": kind, "payload": payload})["job"]


def build_test_app(captured: list[dict[str, Any]]) -> NaverBlogApp:
    app = object.__new__(NaverBlogApp)
    app.queue = Queue()
    app.stop_event = threading.Event()
    app.running = True
    app.web_agent_active_job_id = None
    app.driver = None
    app.naver_id_var = Var("naver-smoke")
    app.naver_pw_var = Var("naver-password-smoke")
    app.api_key_var = Var("gemini-api-key-smoke")
    app.claude_key_var = Var("")
    app.ai_model_var = Var("gemini-3.1-pro-preview")

    def fake_log(message: str) -> None:
        captured.append({"type": "log", "message": message})

    def fake_write(**kwargs: Any) -> None:
        captured.append({"type": "worker_write", "kwargs": kwargs})

    def fake_neighbor(**kwargs: Any) -> None:
        captured.append({"type": "worker_neighbor", "kwargs": kwargs})

    app._log = fake_log  # type: ignore[method-assign]
    app._worker_write = fake_write  # type: ignore[method-assign]
    app._worker_neighbor = fake_neighbor  # type: ignore[method-assign]
    return app


def run_remote_job(app: NaverBlogApp, client: AimaxWebAgentClient) -> dict[str, Any]:
    job = client.next_job().get("job")
    if not job:
        raise RuntimeError("No queued job returned by /api/agent/next-job")
    app.web_agent_active_job_id = job["id"]
    app._worker_remote_job(client, job)
    return job


def assert_readiness_and_command(base_url: str, token: str, client: AimaxWebAgentClient, app: NaverBlogApp) -> dict[str, Any]:
    readiness = app._collect_web_agent_readiness()
    readiness["neighbor_messages"] = {"status": "ready", "count": 1}
    readiness["workers"]["hyunju_find"] = "ready"
    client.heartbeat(
        status="connected",
        version="v1.0.2",
        platform_label=current_platform_label(),
        device_label=default_device_label(),
        readiness=readiness,
    )
    agent_status = api(base_url, "/api/agent/status", token=token)["agent"]
    received = agent_status.get("readiness") or {}
    if received.get("naver_account", {}).get("status") != "ready":
        raise RuntimeError(f"Readiness naver_account not ready: {received}")
    if received.get("ai_keys", {}).get("selected_model_ready") != "ready":
        raise RuntimeError(f"Readiness ai_keys not ready: {received}")
    if received.get("workers", {}).get("yeri_write") != "ready":
        raise RuntimeError(f"Readiness yeri_write not ready: {received}")

    created = api(base_url, "/api/agent/commands", token=token, method="POST", payload={"type": "open_settings"})["command"]
    command = client.next_command().get("command")
    if not command or command.get("id") != created.get("id") or command.get("type") != "open_settings":
        raise RuntimeError(f"Expected open_settings command, got: {command}")
    client.update_command(command["id"], "done", "smoke test command completed")
    return {"agent": agent_status, "command": command}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=os.environ.get("AIMAX_API_BASE_URL", "https://api.aimax.ai.kr"))
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--new-password")
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    token, login_result = login_and_prepare(base_url, args.email, args.password, args.new_password)
    if not login_result.get("can_execute"):
        raise RuntimeError(f"Account cannot execute: {login_result}")

    client = AimaxWebAgentClient(base_url=base_url, session_token=token)
    captured: list[dict[str, Any]] = []
    app = build_test_app(captured)
    readiness_summary = assert_readiness_and_command(base_url, token, client, app)

    yeri_payload = {
        "keywords": ["맥 E2E 테스트 글감"],
        "mode": "save",
        "word_count": 1200,
        "category": "테스트",
        "cta_text": "상담 신청",
        "cta_link": "https://aimax.ai.kr",
    }
    hyunju_payload = {
        "keywords": ["맥 E2E 테스트 고객"],
        "max_per_keyword": 2,
        "speed_mode": "safe",
        "messages": ["안녕하세요. 테스트 멘트입니다."],
    }
    create_job(base_url, token, "yeri_write", yeri_payload)
    create_job(base_url, token, "hyunju_find", hyunju_payload)

    first_job = run_remote_job(app, client)
    second_job = run_remote_job(app, client)
    jobs = api(base_url, "/api/jobs", token=token)["jobs"]
    relevant = [job for job in jobs if job["id"] in {first_job["id"], second_job["id"]}]

    summary = {
        "ok": True,
        "email": args.email,
        "readiness_workers": readiness_summary["agent"].get("readiness", {}).get("workers"),
        "command": {"id": readiness_summary["command"]["id"], "type": readiness_summary["command"]["type"]},
        "jobs": [{"id": job["id"], "kind": job["kind"], "status": job["status"]} for job in relevant],
        "captured": captured,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2, default=str))
    if sorted(item["status"] for item in relevant) != ["done", "done"]:
        raise RuntimeError(f"Expected both jobs done, got: {relevant}")
    if not any(item["type"] == "worker_write" for item in captured):
        raise RuntimeError("worker_write was not called")
    if not any(item["type"] == "worker_neighbor" for item in captured):
        raise RuntimeError("worker_neighbor was not called")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
