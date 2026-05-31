"""Build, store, and optionally send AIMAX error reports."""
from __future__ import annotations

import json
import os
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

from paths import LOGS_DIR, PENDING_REPORTS_DIR, SENT_REPORTS_DIR
from utils.logger import LOG_FILE_PATH

from .redaction import mask_payload, mask_text
from .system_info import collect_system_info


TRACEBACK_LOG_PATH = LOGS_DIR / "traceback.log"
DEFAULT_REPORT_ENDPOINT_ENV = "AIMAX_REPORT_ENDPOINT"
REPORT_TOKEN_ENV = "AIMAX_REPORT_TOKEN"
_TRACEBACK_CAPTURE_INSTALLED = False
_ORIGINAL_PRINT_EXC = None


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def make_report_id() -> str:
    stamp = datetime.now().strftime("%Y%m%d%H%M%S")
    return f"AIMAX-RPT-{stamp}-{uuid.uuid4().hex[:8]}"


def _read_tail(path: Path, max_chars: int = 20000) -> str:
    try:
        if not path.exists() or not path.is_file():
            return ""
        size = path.stat().st_size
        with path.open("rb") as f:
            if size > max_chars:
                f.seek(max(0, size - max_chars))
            data = f.read()
        return data.decode("utf-8", errors="replace")
    except OSError:
        return ""


def recent_app_log(max_chars: int = 20000) -> str:
    return _read_tail(LOG_FILE_PATH, max_chars=max_chars)


def recent_traceback(max_chars: int = 20000) -> str:
    return _read_tail(TRACEBACK_LOG_PATH, max_chars=max_chars)


def install_traceback_capture() -> Path:
    """Mirror traceback.print_exc() output to a rotating-ish local file.

    Many current workers call traceback.print_exc() directly. This keeps the
    change minimal while making future error reports much more useful.
    """
    global _TRACEBACK_CAPTURE_INSTALLED, _ORIGINAL_PRINT_EXC
    if _TRACEBACK_CAPTURE_INSTALLED:
        return TRACEBACK_LOG_PATH

    import traceback as traceback_module

    _ORIGINAL_PRINT_EXC = traceback_module.print_exc

    def _patched_print_exc(*args, **kwargs):
        result = _ORIGINAL_PRINT_EXC(*args, **kwargs)
        try:
            limit = kwargs.get("limit")
            chain = kwargs.get("chain", True)
            formatted = traceback_module.format_exc(limit=limit, chain=chain)
            if formatted and formatted.strip() != "NoneType: None":
                LOGS_DIR.mkdir(parents=True, exist_ok=True)
                with TRACEBACK_LOG_PATH.open("a", encoding="utf-8") as f:
                    f.write(f"\n[{now_iso()}]\n")
                    f.write(formatted)
                    if not formatted.endswith("\n"):
                        f.write("\n")
        except Exception:
            pass
        return result

    traceback_module.print_exc = _patched_print_exc
    _TRACEBACK_CAPTURE_INSTALLED = True
    return TRACEBACK_LOG_PATH


def build_error_report(
    *,
    work_context: str,
    visible_error: str,
    user_note: str,
    console_log: str = "",
    driver: Any = None,
    source: str = "app",
) -> dict[str, Any]:
    report = {
        "report_id": make_report_id(),
        "created_at": now_iso(),
        "source": source,
        "user_input": {
            "work_context": work_context,
            "visible_error": visible_error,
            "user_note": user_note,
        },
        "system": collect_system_info(driver=driver),
        "logs": {
            "visible_console": console_log,
            "recent_app_log": recent_app_log(),
            "recent_traceback": recent_traceback(),
        },
    }
    return mask_payload(report)


def _safe_filename(report: dict[str, Any]) -> str:
    report_id = str(report.get("report_id") or make_report_id())
    return f"{report_id}.json"


def save_report(report: dict[str, Any], directory: Path) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / _safe_filename(report)
    with path.open("w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    return path


def default_endpoint() -> str:
    return os.environ.get(DEFAULT_REPORT_ENDPOINT_ENV, "").strip()


def default_report_token() -> str:
    return os.environ.get(REPORT_TOKEN_ENV, "").strip()


def post_report(report: dict[str, Any], endpoint: str, timeout: int = 8) -> dict[str, Any]:
    headers = {}
    token = default_report_token()
    if token:
        headers["X-AIMAX-Report-Token"] = token
    response = requests.post(endpoint, json=report, headers=headers, timeout=timeout)
    ok = 200 <= response.status_code < 300
    try:
        body = response.json()
    except ValueError:
        body = {"text": mask_text(response.text[:1000])}
    return {
        "ok": ok,
        "status_code": response.status_code,
        "body": mask_payload(body),
    }


def submit_error_report(
    *,
    work_context: str,
    visible_error: str,
    user_note: str,
    console_log: str = "",
    driver: Any = None,
    endpoint: str | None = None,
) -> dict[str, Any]:
    report = build_error_report(
        work_context=work_context,
        visible_error=visible_error,
        user_note=user_note,
        console_log=console_log,
        driver=driver,
    )

    endpoint = (endpoint if endpoint is not None else default_endpoint()).strip()
    if not endpoint:
        path = save_report(report, PENDING_REPORTS_DIR)
        return {
            "status": "saved_pending",
            "reason": "no_endpoint",
            "report_id": report["report_id"],
            "path": str(path),
        }

    try:
        result = post_report(report, endpoint)
        if result["ok"]:
            path = save_report(report, SENT_REPORTS_DIR)
            return {
                "status": "sent",
                "report_id": report["report_id"],
                "path": str(path),
                "server": result,
            }
        path = save_report(report, PENDING_REPORTS_DIR)
        return {
            "status": "saved_pending",
            "reason": f"http_{result['status_code']}",
            "report_id": report["report_id"],
            "path": str(path),
            "server": result,
        }
    except Exception as exc:
        path = save_report(report, PENDING_REPORTS_DIR)
        return {
            "status": "saved_pending",
            "reason": mask_text(str(exc)),
            "report_id": report["report_id"],
            "path": str(path),
        }
