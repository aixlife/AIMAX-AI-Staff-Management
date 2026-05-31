#!/usr/bin/env python3
"""Quiet LaunchAgent entrypoint for AIMAX Mac status capture."""

from __future__ import annotations

import json
import os
import sys
import traceback
from datetime import datetime, timedelta
from pathlib import Path

import aimax_mac_status_capture as capture


DEFAULT_SINCE = "2026-05-23"
HEALTH_PATH = capture.REPORT_DIR / "mac-status-capture-health.json"


def write_health(payload: dict) -> None:
    capture.REPORT_DIR.mkdir(parents=True, exist_ok=True)
    HEALTH_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run_capture() -> dict:
    since_value = os.environ.get("AIMAX_STATUS_CAPTURE_SINCE", DEFAULT_SINCE)
    marker_days = int(os.environ.get("AIMAX_STATUS_CAPTURE_MARKER_DAYS", "2"))
    since = datetime.fromisoformat(since_value).replace(tzinfo=capture.KST)

    marker_since = capture.kst_now() - timedelta(days=marker_days)
    current_paths = capture.find_current_session_paths(marker_since)
    sessions = capture.collect_sessions(since, current_paths)
    artifacts = capture.collect_artifacts(since)
    status = capture.infer_current_status(sessions, artifacts)
    backfill = capture.render_backfill(sessions, artifacts, current_paths)
    written = capture.write_outputs(status, backfill, write_session_backfill=False)

    return {
        "ok": True,
        "generated_at": capture.kst_now().strftime("%Y-%m-%d %H:%M:%S %Z"),
        "source": "macos-launchagent",
        "since": since_value,
        "marker_days": marker_days,
        "sessions": len(sessions),
        "artifacts": len(artifacts),
        "current_excluded_count": len(current_paths),
        "written": written,
    }


def main() -> int:
    try:
        write_health(run_capture())
        return 0
    except Exception as exc:
        error_payload = {
            "ok": False,
            "generated_at": capture.kst_now().strftime("%Y-%m-%d %H:%M:%S %Z"),
            "source": "macos-launchagent",
            "error_type": type(exc).__name__,
            "error": str(exc)[:1000],
        }
        try:
            write_health(error_payload)
        except Exception:
            pass
        traceback.print_exc(file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
