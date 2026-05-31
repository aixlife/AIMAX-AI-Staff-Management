"""Local state diagnostics and repair helpers for AIMAX Local Agent.

The repair path is intentionally conservative: it quarantines suspicious
legacy folders and stale request files by moving/renaming them. It never deletes
user data, secrets, browser profiles, or keychain entries.
"""
from __future__ import annotations

import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from time import time
from typing import Any

from paths import APP_DATA_DIR


LEGACY_APPDATA_PREFIXES = ("naverblog",)
REQUEST_FILE_NAMES = (
    "aimax-local-agent-request.json",
    "aimax-local-agent.request.json",
)
LOCK_FILE_NAME = "aimax-local-agent.lock"
DEFAULT_STALE_SECONDS = 60 * 60
QUARANTINE_DIR_NAME = "local_state_quarantine"


def _now_stamp(now: float | None = None) -> str:
    current = datetime.fromtimestamp(time() if now is None else now, tz=timezone.utc).astimezone()
    return current.strftime("%Y%m%d-%H%M%S")


def _iso_from_timestamp(value: float) -> str:
    return datetime.fromtimestamp(value).astimezone().isoformat(timespec="seconds")


def _safe_stat(path: Path) -> os.stat_result | None:
    try:
        return path.stat()
    except OSError:
        return None


def _safe_resolve(path: Path) -> Path:
    try:
        return path.resolve()
    except OSError:
        return path.absolute()


def _is_legacy_appdata_dir(path: Path, current_app_data_dir: Path) -> bool:
    name = path.name.strip().lower()
    if not any(name.startswith(prefix) for prefix in LEGACY_APPDATA_PREFIXES):
        return False
    return _safe_resolve(path) != _safe_resolve(current_app_data_dir)


def _count_files_limited(path: Path, limit: int = 500) -> dict[str, Any]:
    count = 0
    truncated = False
    try:
        for item in path.rglob("*"):
            if item.is_file():
                count += 1
                if count >= limit:
                    truncated = True
                    break
    except OSError:
        truncated = True
    return {"file_count": count, "truncated": truncated}


def _legacy_dir_summary(path: Path) -> dict[str, Any]:
    stat = _safe_stat(path)
    summary: dict[str, Any] = {
        "name": path.name,
        "path": str(path),
        "exists": path.exists(),
        "is_dir": path.is_dir(),
        "repair_action": "quarantine",
    }
    if stat:
        summary["modified_at"] = _iso_from_timestamp(stat.st_mtime)
    for child_name, key in (
        ("settings.json", "has_settings_json"),
        (".settings_secrets.json", "has_secret_fallback_json"),
        ("logs", "has_logs_dir"),
        ("debug", "has_debug_dir"),
        ("reports", "has_reports_dir"),
        ("browser_profiles", "has_browser_profiles_dir"),
    ):
        summary[key] = (path / child_name).exists()
    summary.update(_count_files_limited(path))
    return summary


def find_legacy_appdata_dirs(app_data_dir: Path | None = None) -> list[Path]:
    current = Path(app_data_dir or APP_DATA_DIR)
    parent = current.parent
    try:
        children = list(parent.iterdir())
    except OSError:
        return []
    candidates = [
        child
        for child in children
        if child.is_dir() and _is_legacy_appdata_dir(child, current)
    ]
    return sorted(candidates, key=lambda item: item.name.lower())


def _request_file_summary(path: Path, now: float | None = None, stale_seconds: int = DEFAULT_STALE_SECONDS) -> dict[str, Any]:
    stat = _safe_stat(path)
    exists = bool(stat)
    age_seconds = int(max(0, (time() if now is None else now) - stat.st_mtime)) if stat else None
    return {
        "name": path.name,
        "path": str(path),
        "exists": exists,
        "modified_at": _iso_from_timestamp(stat.st_mtime) if stat else "",
        "age_seconds": age_seconds,
        "stale": bool(exists and age_seconds is not None and age_seconds >= stale_seconds),
        "repair_action": "quarantine_if_stale",
    }


def _lock_file_summary(path: Path, now: float | None = None) -> dict[str, Any]:
    stat = _safe_stat(path)
    age_seconds = int(max(0, (time() if now is None else now) - stat.st_mtime)) if stat else None
    pid = ""
    if stat:
        try:
            pid = path.read_text(encoding="utf-8", errors="replace").strip()[:32]
        except OSError:
            pid = ""
    return {
        "name": path.name,
        "path": str(path),
        "exists": bool(stat),
        "modified_at": _iso_from_timestamp(stat.st_mtime) if stat else "",
        "age_seconds": age_seconds,
        "pid": pid,
        "repair_action": "diagnostic_only",
    }


def collect_local_state_diagnostics(
    app_data_dir: Path | None = None,
    *,
    now: float | None = None,
    stale_seconds: int = DEFAULT_STALE_SECONDS,
) -> dict[str, Any]:
    current = Path(app_data_dir or APP_DATA_DIR)
    legacy_dirs = find_legacy_appdata_dirs(current)
    request_files = [
        _request_file_summary(current / name, now=now, stale_seconds=stale_seconds)
        for name in REQUEST_FILE_NAMES
    ]
    stale_requests = [item for item in request_files if item.get("stale")]
    lock_file = _lock_file_summary(current / LOCK_FILE_NAME, now=now)
    repair_available = bool(legacy_dirs or stale_requests)
    return {
        "app_data_dir": str(current),
        "app_data_parent": str(current.parent),
        "legacy_appdata_candidates": [_legacy_dir_summary(path) for path in legacy_dirs],
        "legacy_candidate_count": len(legacy_dirs),
        "request_files": request_files,
        "stale_request_count": len(stale_requests),
        "lock_file": lock_file,
        "repair_available": repair_available,
        "repair_strategy": "quarantine_only_no_delete",
    }


def _unique_target(root: Path, name: str) -> Path:
    target = root / name
    if not target.exists():
        return target
    index = 2
    while True:
        candidate = root / f"{name}-{index}"
        if not candidate.exists():
            return candidate
        index += 1


def _move_to_quarantine(path: Path, target_root: Path, *, dry_run: bool) -> dict[str, Any]:
    target = _unique_target(target_root, path.name)
    result = {
        "source": str(path),
        "target": str(target),
        "ok": False,
        "dry_run": dry_run,
        "error": "",
    }
    if dry_run:
        result["ok"] = True
        return result
    try:
        target_root.mkdir(parents=True, exist_ok=True)
        shutil.move(str(path), str(target))
        result["ok"] = True
    except Exception as exc:
        result["error"] = f"{type(exc).__name__}: {exc}"
    return result


def quarantine_local_state_conflicts(
    app_data_dir: Path | None = None,
    *,
    now: float | None = None,
    stale_seconds: int = DEFAULT_STALE_SECONDS,
    include_legacy: bool = True,
    include_stale_requests: bool = True,
    dry_run: bool = False,
) -> dict[str, Any]:
    current = Path(app_data_dir or APP_DATA_DIR)
    stamp = _now_stamp(now)
    quarantine_root = current / QUARANTINE_DIR_NAME / stamp
    legacy_root = quarantine_root / "legacy_appdata"
    request_root = quarantine_root / "stale_requests"
    moved: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []

    if include_legacy:
        for path in find_legacy_appdata_dirs(current):
            moved.append(_move_to_quarantine(path, legacy_root, dry_run=dry_run))

    if include_stale_requests:
        for name in REQUEST_FILE_NAMES:
            path = current / name
            summary = _request_file_summary(path, now=now, stale_seconds=stale_seconds)
            if summary.get("stale"):
                moved.append(_move_to_quarantine(path, request_root, dry_run=dry_run))
            elif summary.get("exists"):
                skipped.append({"path": str(path), "reason": "request_not_stale"})

    errors = [item for item in moved if not item.get("ok")]
    return {
        "ok": not errors,
        "dry_run": dry_run,
        "app_data_dir": str(current),
        "quarantine_root": str(quarantine_root),
        "moved": moved,
        "skipped": skipped,
        "errors": errors,
        "diagnostics_after": collect_local_state_diagnostics(
            current,
            now=now,
            stale_seconds=stale_seconds,
        )
        if not dry_run
        else {},
    }
