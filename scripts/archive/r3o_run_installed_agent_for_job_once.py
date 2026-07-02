#!/usr/bin/env python3
"""Run the installed AIMAX agent only while one approved R3-O job is active."""
from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import requests

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from web_agent.client import load_session_token  # noqa: E402


FINAL_STATUSES = {"done", "failed", "cancelled"}
OPEN_STATUSES = {"queued", "generating", "ready_for_publish", "running"}


def api(base_url: str, path: str, token: str) -> dict[str, Any]:
    response = requests.get(
        f"{base_url}{path}",
        headers={"authorization": f"Bearer {token}"},
        timeout=20,
    )
    response.raise_for_status()
    return response.json()


def job_by_id(base_url: str, token: str, job_id: str) -> dict[str, Any]:
    jobs = api(base_url, "/api/jobs", token).get("jobs") or []
    for job in jobs:
        if job.get("id") == job_id:
            return job
    raise RuntimeError(f"job_not_found:{job_id}")


def open_jobs(base_url: str, token: str) -> list[dict[str, Any]]:
    jobs = api(base_url, "/api/jobs", token).get("jobs") or []
    return [job for job in jobs if str(job.get("status") or "") in OPEN_STATUSES]


def terminate(proc: subprocess.Popen[str]) -> None:
    if proc.poll() is not None:
        return
    proc.terminate()
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=10)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-id", required=True)
    parser.add_argument("--base-url", default="https://api.aimax.ai.kr")
    parser.add_argument("--timeout-seconds", type=int, default=900)
    parser.add_argument("--poll-seconds", type=int, default=5)
    parser.add_argument("--log-path", default="/private/tmp/aimax_r3o_installed_agent_once.log")
    args = parser.parse_args()

    token = load_session_token()
    if not token:
        raise RuntimeError("missing_saved_aimax_session_token")

    initial_open = open_jobs(args.base_url, token)
    unexpected = [
        {"id": job.get("id"), "kind": job.get("kind"), "status": job.get("status")}
        for job in initial_open
        if job.get("id") != args.job_id
    ]
    if unexpected:
        raise RuntimeError(f"unexpected_open_jobs_before_agent:{json.dumps(unexpected, ensure_ascii=False)}")

    target = job_by_id(args.base_url, token, args.job_id)
    if target.get("kind") != "yeri_write":
        raise RuntimeError(f"target_job_kind_mismatch:{target.get('kind')}")
    payload = target.get("payload") if isinstance(target.get("payload"), dict) else {}
    if payload:
        word_count = payload.get("word_count")
        image_count = payload.get("image_count")
        if payload.get("mode") not in (None, "save"):
            raise RuntimeError(f"target_payload_out_of_scope:{json.dumps(payload, ensure_ascii=False)}")
        if word_count is not None and int(word_count or 0) != 800:
            raise RuntimeError(f"target_payload_out_of_scope:{json.dumps(payload, ensure_ascii=False)}")
        if image_count is not None and int(image_count or 0) > 1:
            raise RuntimeError(f"target_payload_out_of_scope:{json.dumps(payload, ensure_ascii=False)}")

    env = os.environ.copy()
    env["AIMAX_AGENT_DISABLE_COMMANDS"] = "1"
    env["AIMAX_AGENT_POLL_SECONDS"] = "3"
    env["AIMAX_AGENT_COMMAND_POLL_SECONDS"] = "3"
    env["AIMAX_AGENT_VERSION_CHECK_SECONDS"] = "900"
    log_path = Path(args.log_path)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("w", encoding="utf-8") as log:
        proc = subprocess.Popen(
            ["/Applications/AIMAX.app/Contents/MacOS/AIMAX", "--agent"],
            stdout=log,
            stderr=subprocess.STDOUT,
            text=True,
            env=env,
        )
        started_at = time.time()
        timeline: list[dict[str, Any]] = []
        try:
            while time.time() - started_at < args.timeout_seconds:
                current = job_by_id(args.base_url, token, args.job_id)
                snapshot = {
                    "elapsed": round(time.time() - started_at, 1),
                    "status": current.get("status"),
                    "failed_stage": current.get("failed_stage"),
                    "updated_at": current.get("updated_at"),
                }
                if not timeline or timeline[-1] != snapshot:
                    timeline.append(snapshot)
                if str(current.get("status") or "") in FINAL_STATUSES:
                    terminate(proc)
                    print(json.dumps({
                        "ok": current.get("status") == "done",
                        "job": current,
                        "timeline": timeline,
                        "agent_log_path": str(log_path),
                    }, ensure_ascii=False, indent=2, default=str))
                    return 0 if current.get("status") == "done" else 2
                if proc.poll() is not None:
                    raise RuntimeError(f"agent_exited_before_final_status:{proc.returncode}")
                time.sleep(max(2, args.poll_seconds))
            raise TimeoutError(f"job_timeout:{args.job_id}")
        finally:
            terminate(proc)


if __name__ == "__main__":
    raise SystemExit(main())
