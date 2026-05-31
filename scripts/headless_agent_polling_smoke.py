"""Local smoke test for the headless AIMAX agent polling loop.

This test starts a tiny local HTTP API that behaves like the AIMAX server. It
does not contact production and replaces final Naver automation workers with
test doubles, so no Naver login, posting, or neighbor requests are executed.
"""
from __future__ import annotations

import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("AIMAX_AGENT_POLL_SECONDS", "1")

from app import HeadlessNaverBlogAgent  # noqa: E402
from web_agent.client import AimaxWebAgentClient  # noqa: E402


class FakeApiState:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.heartbeats: list[dict[str, Any]] = []
        self.command_updates: list[dict[str, Any]] = []
        self.job_updates: list[dict[str, Any]] = []
        self.commands = [
            {
                "id": "cmd-open-settings",
                "type": "open_settings",
            }
        ]
        self.jobs = [
            {
                "id": "job-yeri",
                "kind": "yeri_write",
                "payload": {
                    "keywords": ["headless 테스트 글감"],
                    "mode": "save",
                    "ai_model": "gemini-2.5-pro",
                    "word_count": 1200,
                    "image_count": 4,
                    "category": "테스트",
                    "cta_text": "상담 신청",
                },
            },
            {
                "id": "job-hyunju",
                "kind": "hyunju_find",
                "payload": {
                    "keywords": ["headless 테스트 고객"],
                    "max_per_keyword": 2,
                    "speed": "safe",
                    "messages": ["안녕하세요. 테스트 멘트입니다."],
                },
            },
            {
                "id": "job-yeri-fail",
                "kind": "yeri_write",
                "payload": {
                    "keywords": ["headless 실패 글감"],
                    "mode": "save",
                },
            },
        ]


def make_handler(state: FakeApiState):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: Any) -> None:
            return

        def _body(self) -> dict[str, Any]:
            length = int(self.headers.get("content-length") or 0)
            if not length:
                return {}
            raw = self.rfile.read(length).decode("utf-8")
            return json.loads(raw) if raw else {}

        def _json(self, payload: dict[str, Any], status: int = 200) -> None:
            data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self) -> None:
            path = urlparse(self.path).path
            if path == "/api/auth/me":
                self._json({"ok": True, "can_execute": True, "requires_password_change": False})
                return
            if path == "/api/version":
                self._json(
                    {
                        "ok": True,
                        "agent": {
                            "latest_version": "v1.0.2",
                            "min_version": "v1.0.2",
                            "update_available": False,
                            "update_required": False,
                        },
                    }
                )
                return
            if path == "/api/agent/next-command":
                with state.lock:
                    command = state.commands.pop(0) if state.commands else None
                self._json({"ok": True, "command": command})
                return
            if path == "/api/agent/next-job":
                with state.lock:
                    job = state.jobs.pop(0) if state.jobs else None
                self._json({"ok": True, "job": job})
                return
            self._json({"ok": False, "error": "not_found"}, status=404)

        def do_POST(self) -> None:
            path = urlparse(self.path).path
            body = self._body()
            if path == "/api/agent/heartbeat":
                with state.lock:
                    state.heartbeats.append(body)
                self._json({"ok": True, "agent": {"connected": True}})
                return
            if path == "/api/agent/commands/update":
                with state.lock:
                    state.command_updates.append(body)
                self._json({"ok": True})
                return
            if path == "/api/agent/jobs/update":
                with state.lock:
                    state.job_updates.append(body)
                self._json({"ok": True})
                return
            self._json({"ok": False, "error": "not_found"}, status=404)

    return Handler


def main() -> int:
    state = FakeApiState()
    server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(state))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_port}"

    agent = HeadlessNaverBlogAgent()
    agent.naver_id_var.set("naver-smoke")
    agent.naver_pw_var.set("naver-password-smoke")
    agent.api_key_var.set("gemini-api-key-smoke")
    agent.claude_key_var.set("")
    agent.ai_model_var.set("gemini-3.1-pro-preview")
    agent._open_headless_settings_dialog = lambda: True  # type: ignore[method-assign]

    captured: list[dict[str, Any]] = []
    def fake_write(**kwargs: Any) -> dict[str, Any]:
        captured.append({"type": "worker_write", "kwargs": kwargs})
        agent.queue.put(("done", None))
        if "headless 실패 글감" in kwargs.get("keywords", []):
            return {
                "ok": False,
                "success": 0,
                "total": 1,
                "error": "smoke forced write failure",
                "usage": {"input_tokens": 10, "output_tokens": 20, "billable_output_tokens": 20},
                "images": {"attempted": 0, "generated": 0, "inserted": 0},
                "cost": {"currency": "KRW", "total_won": 1, "text_won": 1, "image_won": 0},
                "failed_posts": [{
                    "type": "keyword",
                    "source": kwargs.get("keywords", [""])[0],
                    "keyword": kwargs.get("keywords", [""])[0],
                    "status": "failed",
                    "stage": "content_generation",
                    "error": "smoke forced write failure",
                    "char_count": 0,
                    "target_char_count": kwargs.get("word_count", 0),
                }],
            }
        return {
            "ok": True,
            "success": 1,
            "total": 1,
            "usage": {"input_tokens": 100, "output_tokens": 200, "billable_output_tokens": 200},
            "images": {"attempted": kwargs.get("image_count", 0), "generated": kwargs.get("image_count", 0), "inserted": kwargs.get("image_count", 0)},
            "cost": {"currency": "KRW", "total_won": 230, "text_won": 1, "image_won": 229},
            "posts": [{"type": "keyword", "source": kwargs.get("keywords", [""])[0], "keyword": kwargs.get("keywords", [""])[0], "status": "done", "stage": "completed", "char_count": kwargs.get("word_count", 0), "target_char_count": kwargs.get("word_count", 0)}],
        }

    def fake_neighbor(**kwargs: Any) -> None:
        captured.append({"type": "worker_neighbor", "kwargs": kwargs})
        agent.queue.put(("done", None))

    agent._worker_write = fake_write  # type: ignore[method-assign]
    agent._worker_neighbor = fake_neighbor  # type: ignore[method-assign]

    client = AimaxWebAgentClient(base_url=base_url, session_token="fake-session-token")
    poll_thread = threading.Thread(target=agent._web_agent_loop, args=(client,), daemon=True)
    poll_thread.start()

    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        agent._process_headless_queue()
        with state.lock:
            done_jobs = [item for item in state.job_updates if item.get("status") == "done"]
            failed_jobs = [item for item in state.job_updates if item.get("status") == "failed"]
            command_done = any(item.get("status") == "done" for item in state.command_updates)
            heartbeat_count = len(state.heartbeats)
        if heartbeat_count and len(done_jobs) == 2 and len(failed_jobs) == 1 and command_done:
            break
        time.sleep(0.05)

    agent.web_agent_stop_event.set()
    poll_thread.join(timeout=2)
    server.shutdown()

    with state.lock:
        summary = {
            "heartbeat_count": len(state.heartbeats),
            "command_updates": state.command_updates,
            "job_updates": state.job_updates,
            "captured": captured,
        }

    if summary["heartbeat_count"] < 1:
        raise RuntimeError(f"heartbeat not sent: {summary}")
    first_heartbeat = state.heartbeats[0] if state.heartbeats else {}
    local_state = (
        first_heartbeat.get("readiness", {})
        .get("diagnostics", {})
        .get("local_state", {})
    )
    if local_state.get("repair_strategy") != "quarantine_only_no_delete":
        raise RuntimeError(f"heartbeat did not include compact local_state diagnostics: {first_heartbeat}")
    if not any(item.get("status") == "done" for item in summary["command_updates"]):
        raise RuntimeError(f"open_settings command was not completed: {summary}")
    done_job_ids = [item.get("job_id") for item in summary["job_updates"] if item.get("status") == "done"]
    if sorted(done_job_ids) != ["job-hyunju", "job-yeri"]:
        raise RuntimeError(f"expected both jobs done: {summary}")
    failed_job_ids = [item.get("job_id") for item in summary["job_updates"] if item.get("status") == "failed"]
    if failed_job_ids != ["job-yeri-fail"]:
        raise RuntimeError(f"expected forced write failure to be reported: {summary}")
    yeri_done_update = next((item for item in summary["job_updates"] if item.get("job_id") == "job-yeri" and item.get("status") == "done"), {})
    if yeri_done_update.get("result", {}).get("cost", {}).get("currency") != "KRW":
        raise RuntimeError(f"expected yeri result cost in KRW: {summary}")
    if yeri_done_update.get("result", {}).get("posts", [{}])[0].get("char_count") != 1200:
        raise RuntimeError(f"expected yeri result char_count: {summary}")
    yeri_failed_update = next((item for item in summary["job_updates"] if item.get("job_id") == "job-yeri-fail" and item.get("status") == "failed"), {})
    if yeri_failed_update.get("result", {}).get("cost", {}).get("currency") != "KRW":
        raise RuntimeError(f"expected failed yeri result cost in KRW: {summary}")
    if not any(item.get("type") == "worker_write" for item in captured):
        raise RuntimeError(f"worker_write was not called: {summary}")
    write_calls = [item for item in captured if item.get("type") == "worker_write"]
    if not any(item.get("kwargs", {}).get("ai_model") == "gemini-2.5-pro" for item in write_calls):
        raise RuntimeError(f"worker_write did not receive web ai_model: {summary}")
    if not any(item.get("kwargs", {}).get("image_count") == 4 for item in write_calls):
        raise RuntimeError(f"worker_write did not receive web image_count: {summary}")
    if not any(item.get("type") == "worker_neighbor" for item in captured):
        raise RuntimeError(f"worker_neighbor was not called: {summary}")

    os.environ["AIMAX_AGENT_HEARTBEAT_ONLY"] = "1"
    try:
        heartbeat_state = FakeApiState()
        heartbeat_server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(heartbeat_state))
        heartbeat_thread = threading.Thread(target=heartbeat_server.serve_forever, daemon=True)
        heartbeat_thread.start()
        heartbeat_url = f"http://127.0.0.1:{heartbeat_server.server_port}"

        heartbeat_agent = HeadlessNaverBlogAgent()
        heartbeat_agent.naver_id_var.set("naver-smoke")
        heartbeat_agent.naver_pw_var.set("naver-password-smoke")
        heartbeat_agent.api_key_var.set("gemini-api-key-smoke")
        heartbeat_client = AimaxWebAgentClient(base_url=heartbeat_url, session_token="fake-session-token")
        heartbeat_poll_thread = threading.Thread(
            target=heartbeat_agent._web_agent_loop,
            args=(heartbeat_client,),
            daemon=True,
        )
        heartbeat_poll_thread.start()

        deadline = time.monotonic() + 4
        while time.monotonic() < deadline:
            heartbeat_agent._process_headless_queue()
            with heartbeat_state.lock:
                heartbeat_count = len(heartbeat_state.heartbeats)
            if heartbeat_count:
                break
            time.sleep(0.05)

        heartbeat_agent.web_agent_stop_event.set()
        heartbeat_poll_thread.join(timeout=2)
        heartbeat_server.shutdown()

        with heartbeat_state.lock:
            heartbeat_summary = {
                "heartbeat_count": len(heartbeat_state.heartbeats),
                "remaining_commands": len(heartbeat_state.commands),
                "remaining_jobs": len(heartbeat_state.jobs),
                "command_updates": heartbeat_state.command_updates,
                "job_updates": heartbeat_state.job_updates,
            }

        if heartbeat_summary["heartbeat_count"] < 1:
            raise RuntimeError(f"heartbeat-only mode did not send heartbeat: {heartbeat_summary}")
        if heartbeat_summary["remaining_commands"] != 1 or heartbeat_summary["remaining_jobs"] != 3:
            raise RuntimeError(f"heartbeat-only mode consumed queued work: {heartbeat_summary}")
        if heartbeat_summary["command_updates"] or heartbeat_summary["job_updates"]:
            raise RuntimeError(f"heartbeat-only mode updated queued work: {heartbeat_summary}")
    finally:
        os.environ.pop("AIMAX_AGENT_HEARTBEAT_ONLY", None)

    summary["heartbeat_only"] = heartbeat_summary
    print(json.dumps({"ok": True, **summary}, ensure_ascii=False, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
