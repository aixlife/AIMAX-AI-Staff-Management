"""Collect non-secret system context for AIMAX error reports."""
from __future__ import annotations

import os
import platform
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import aimax_compliance as aimax
from paths import APP_DATA_DIR, DEBUG_DIR, IS_FROZEN, LOGS_DIR


def _iso_from_timestamp(ts: float) -> str:
    return datetime.fromtimestamp(ts).astimezone().isoformat(timespec="seconds")


def collect_debug_files(limit: int = 20) -> list[dict[str, Any]]:
    if not DEBUG_DIR.exists():
        return []
    files = []
    for path in DEBUG_DIR.iterdir():
        if not path.is_file():
            continue
        try:
            stat = path.stat()
        except OSError:
            continue
        files.append(
            {
                "name": path.name,
                "size_bytes": stat.st_size,
                "modified_at": _iso_from_timestamp(stat.st_mtime),
            }
        )
    files.sort(key=lambda item: item["modified_at"], reverse=True)
    return files[:limit]


def collect_driver_state(driver: Any = None) -> dict[str, Any]:
    if driver is None:
        return {"available": False}

    state: dict[str, Any] = {"available": True}
    try:
        state["session_id"] = getattr(driver, "session_id", None)
    except Exception:
        state["session_id"] = None

    try:
        state["current_url"] = driver.current_url
    except Exception as exc:
        state["current_url_error"] = str(exc)

    try:
        caps = getattr(driver, "capabilities", {}) or {}
        state["browser_name"] = caps.get("browserName")
        state["browser_version"] = caps.get("browserVersion")
        state["platform_name"] = caps.get("platformName")
        chrome_info = caps.get("chrome") if isinstance(caps, dict) else None
        if isinstance(chrome_info, dict):
            state["chromedriver_version"] = chrome_info.get("chromedriverVersion")
    except Exception as exc:
        state["capabilities_error"] = str(exc)
    return state


def collect_system_info(driver: Any = None) -> dict[str, Any]:
    if hasattr(aimax, "load_consent_record"):
        consent = aimax.load_consent_record()
    else:
        consent = aimax.load_compliance_record()
    return {
        "app": {
            "name": aimax.APP_NAME,
            "version": aimax.APP_VERSION,
            "version_label": aimax.APP_VERSION_LABEL,
            "mode": os.environ.get("APP_MODE", "all"),
        },
        "runtime": {
            "os": platform.platform(),
            "system": platform.system(),
            "release": platform.release(),
            "machine": platform.machine(),
            "python_version": platform.python_version(),
            "executable": sys.executable,
            "frozen": bool(IS_FROZEN),
        },
        "paths": {
            "app_data_dir": str(APP_DATA_DIR),
            "logs_dir": str(LOGS_DIR),
            "debug_dir": str(DEBUG_DIR),
        },
        "license": {
            "license_id": consent.get("license_id") or "",
            "terms_version": consent.get("terms_version") or "",
            "pc_identifier_hash": consent.get("pc_identifier_hash") or aimax.pc_identifier_hash(),
        },
        "debug_files": collect_debug_files(),
        "driver": collect_driver_state(driver),
    }
