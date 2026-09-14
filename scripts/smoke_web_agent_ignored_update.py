#!/usr/bin/env python3
"""Behavior regression: unconfirmed remote jobs never launch a local worker."""
from __future__ import annotations

import ast
import time
from pathlib import Path
from queue import Queue
from types import MethodType, SimpleNamespace


ROOT = Path(__file__).resolve().parent.parent
TREE = ast.parse((ROOT / "app.py").read_text(encoding="utf-8"))
application = next(node for node in TREE.body if isinstance(node, ast.ClassDef) and node.name == "NaverBlogApp")
methods = {node.name: node for node in application.body if isinstance(node, ast.FunctionDef) and node.name in {
    "_run_remote_job_worker", "_worker_remote_job", "_handle_web_agent_command"
}}
if len(methods) != 3:
    raise SystemExit("required NaverBlogApp methods missing")

namespace = {
    "time": time,
    "_normalize_image_model": lambda *_args: "fixture-image-model",
    "_payload_image_count": lambda _payload: 0,
    "_send_command_update": lambda *_args, **_kwargs: None,
}
for method in methods.values():
    exec(compile(ast.Module(body=[method], type_ignores=[]), "app.py", "exec"), namespace)


def fail(label: str, value: object) -> None:
    raise SystemExit(f"{label}:{value!r}")


def run_start_ack(ack):
    calls, queue = [], Queue()
    def update_job(*_args, **_kwargs):
        if isinstance(ack, BaseException):
            raise ack
        return ack
    app = SimpleNamespace(
        queue=queue, _log=lambda *_: None, _set_web_agent_active_job_stage=lambda *_a, **_k: None,
        _reset_web_agent_active_job=lambda: calls.append("reset"),
        _worker_remote_job=lambda *_a: calls.append("worker"),
    )
    namespace["_run_remote_job_worker"](app, SimpleNamespace(update_job=update_job), {"id": "job-a", "kind": "yeri_write"})
    return calls, list(queue.queue)


for label, acknowledgement in [
    ("ignored", {"ok": True, "ignored": True}),
    ("exception", RuntimeError("json_write_conflict")),
    ("unconfirmed", {"ok": False}),
]:
    calls, queued = run_start_ack(acknowledgement)
    if calls != ["reset"] or queued != [("done", None)]:
        fail(label, (calls, queued))
calls, queued = run_start_ack({"ok": True})
if calls != ["worker"] or queued:
    fail("first_ack_normal", (calls, queued))


class StopEvent:
    def is_set(self): return False


def run_two_acks(second):
    calls, updates, queue = [], [], Queue()
    acknowledgements = [{"ok": True}, second, {"ok": True}, {"ok": True}]
    def update_job(*args, **kwargs):
        updates.append({"status": args[1] if len(args) > 1 else "", "result": kwargs.get("result")})
        calls.append(("update", kwargs.get("result", {}).get("runner_event")))
        if not acknowledgements:
            raise AssertionError("unexpected_update_after_terminal_report")
        next_ack = acknowledgements.pop(0)
        if isinstance(next_ack, BaseException):
            raise next_ack
        return next_ack
    app = SimpleNamespace(
        queue=queue, _log=lambda *_: None, _set_web_agent_active_job_stage=lambda *_a, **_k: None,
        _reset_web_agent_active_job=lambda: calls.append(("reset", None)),
        _remote_job_artifact=lambda _job: {"title": "fixture"}, _validate_credentials=lambda **_k: True,
        _fetch_web_secret_statuses=lambda: {}, _remote_artifact_image_count=lambda _a: 0,
        ai_model_var=SimpleNamespace(get=lambda: "fixture"), _remote_write_kwargs=lambda *_a, **_k: {},
        _worker_write=lambda **_k: calls.append(("worker", None)) or {"ok": True}, stop_event=StopEvent(),
    )
    app._worker_remote_job = MethodType(namespace["_worker_remote_job"], app)
    namespace["_run_remote_job_worker"](app, SimpleNamespace(update_job=update_job), {"id": "job-a", "kind": "yeri_write", "payload": {}})
    return calls, updates, list(queue.queue)


for label, acknowledgement in [
    ("second_ignored", {"ok": True, "ignored": True}),
    ("second_exception", RuntimeError("json_write_conflict")),
    ("second_unconfirmed", {"ok": False}),
]:
    calls, _updates, queued = run_two_acks(acknowledgement)
    if ("worker", None) in calls or calls.count(("reset", None)) != 1 or queued != [("done", None)]:
        fail(label, (calls, queued))
calls, updates, queued = run_two_acks({"ok": True})
if calls.count(("worker", None)) != 1 or calls.count(("reset", None)) != 1 or queued:
    fail("two_acks_normal", (calls, updates, queued))
if any(update["status"] == "failed" for update in updates) or not any(update["status"] == "done" for update in updates):
    fail("two_acks_normal_terminal_report", updates)


class Driver:
    def __init__(self): self.quit_calls = 0
    def quit(self): self.quit_calls += 1
class Signal:
    def __init__(self): self.calls = 0
    def set(self): self.calls += 1

for target, expected in [("job-other", 0), ("", 0), ("job-active", 1)]:
    signal, driver = Signal(), Driver()
    app = SimpleNamespace(web_agent_active_job_id="job-active", stop_event=signal, running=True, driver=driver, _log=lambda *_: None)
    namespace["_handle_web_agent_command"](app, {"client": None, "command": {"id": "stop", "type": "stop_current_job", "payload": {"job_id": target}}})
    if signal.calls != expected:
        fail("stop_target", (target, signal.calls))
print("WEB_AGENT_IGNORED_UPDATE_SMOKE_OK")
