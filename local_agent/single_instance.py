"""Single-instance lock for the AIMAX Local Agent."""
from __future__ import annotations

import json
import os
from pathlib import Path
from time import time

from paths import APP_DATA_DIR

REQUEST_PATH = APP_DATA_DIR / "aimax-local-agent-request.json"
LEGACY_REQUEST_PATH = APP_DATA_DIR / "aimax-local-agent.request.json"


class SingleInstanceError(RuntimeError):
    """Raised when another Local Agent process already owns the lock."""


class SingleInstanceLock:
    def __init__(self, path: Path, handle):
        self.path = path
        self.handle = handle

    def release(self) -> None:
        if not self.handle:
            return
        try:
            if os.name == "nt":
                import msvcrt

                self.handle.seek(0)
                msvcrt.locking(self.handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl

                fcntl.flock(self.handle.fileno(), fcntl.LOCK_UN)
        except Exception:
            pass
        try:
            self.handle.close()
        except Exception:
            pass
        self.handle = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.release()


def acquire_single_instance_lock(name: str = "aimax-local-agent") -> SingleInstanceLock:
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    lock_path = APP_DATA_DIR / f"{name}.lock"
    handle = lock_path.open("a+", encoding="utf-8")
    try:
        if os.name == "nt":
            import msvcrt

            handle.seek(0)
            if not handle.read(1):
                handle.write("0")
                handle.flush()
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl

            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError as exc:
        try:
            handle.close()
        except Exception:
            pass
        raise SingleInstanceError("이미 실행 중인 AIMAX Local Agent가 있습니다.") from exc

    try:
        handle.seek(0)
        handle.truncate()
        handle.write(str(os.getpid()))
        handle.flush()
    except Exception:
        pass
    return SingleInstanceLock(lock_path, handle)


def signal_existing_instance(kind: str = "connect") -> None:
    """Leave a small request file that the already-running agent can poll."""
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    request_kind = "open_settings" if str(kind or "").strip() == "open_settings" else "connect"
    payload = {
        "kind": request_kind,
        "requested_at": time(),
        "pid": os.getpid(),
    }
    tmp_path = REQUEST_PATH.with_suffix(REQUEST_PATH.suffix + ".tmp")
    with tmp_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    tmp_path.replace(REQUEST_PATH)
    try:
        os.utime(REQUEST_PATH, None)
    except OSError:
        pass


def _read_request(path: Path) -> tuple[int, dict] | None:
    try:
        stat = path.stat()
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return None
        mtime_ns = getattr(stat, "st_mtime_ns", int(stat.st_mtime * 1_000_000_000))
        return int(mtime_ns), data
    except (OSError, json.JSONDecodeError):
        return None


def latest_request() -> tuple[int, dict] | None:
    """Return the newest single-instance request, if any."""
    requests = [item for item in (_read_request(REQUEST_PATH), _read_request(LEGACY_REQUEST_PATH)) if item]
    if not requests:
        return None
    return max(requests, key=lambda item: item[0])
