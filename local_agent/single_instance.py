"""Single-instance lock for the AIMAX Local Agent."""
from __future__ import annotations

import os
import json
import time
from pathlib import Path

from paths import APP_DATA_DIR

try:
    from aimax_compliance import APP_VERSION as _APP_VERSION
except Exception:
    _APP_VERSION = ""

REQUEST_PATH = APP_DATA_DIR / "aimax-local-agent.request.json"
# Go 런처(aimax_agent_launcher.go)는 하이픈 파일명으로 연결 요청을 쓴다.
# 코어는 두 이름을 모두 감시해야 이미 실행 중인 코어가 런처의 재연결 요청을 받을 수 있다.
LAUNCHER_REQUEST_PATH = APP_DATA_DIR / "aimax-local-agent-request.json"
REQUEST_PATHS = (REQUEST_PATH, LAUNCHER_REQUEST_PATH)
LAUNCH_GUARD_PATH = APP_DATA_DIR / "aimax-agent-launch.lock"


def _lock_payload() -> str:
    """락 파일 기록 내용: 런처가 실행 중 코어 버전을 알 수 있게 JSON{pid,version} 기록."""
    return json.dumps({"pid": os.getpid(), "version": _APP_VERSION})


def _pid_from_lock_text(raw: str):
    """락 텍스트에서 PID 추출. JSON{pid,version} 우선, 레거시 PID-단독 폴백. 실패 시 None."""
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        data = json.loads(raw)
        if isinstance(data, dict) and "pid" in data:
            return int(data["pid"])
    except Exception:
        pass
    try:
        return int(raw)
    except Exception:
        return None


class SingleInstanceError(RuntimeError):
    """Raised when another Local Agent process already owns the lock."""


class SingleInstanceLock:
    def __init__(self, path: Path, handle, mode: str = "file"):
        self.path = path
        self.handle = handle
        self.mode = mode

    def release(self) -> None:
        if not self.handle:
            return
        try:
            if os.name == "nt" and self.mode == "sentinel":
                self.handle.close()
                try:
                    if _pid_from_lock_text(self.path.read_text(encoding="utf-8")) == os.getpid():
                        self.path.unlink()
                except FileNotFoundError:
                    pass
                clear_launch_guard()
            elif os.name == "nt":
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
    if os.name == "nt":
        if _lock_file_has_running_owner(lock_path):
            raise SingleInstanceError("이미 실행 중인 AIMAX Local Agent가 있습니다.")
        try:
            lock_path.unlink()
        except FileNotFoundError:
            pass
        except Exception:
            if _lock_file_has_running_owner(lock_path):
                raise SingleInstanceError("이미 실행 중인 AIMAX Local Agent가 있습니다.")
        try:
            fd = os.open(str(lock_path), os.O_CREAT | os.O_EXCL | os.O_RDWR)
        except FileExistsError as exc:
            raise SingleInstanceError("이미 실행 중인 AIMAX Local Agent가 있습니다.") from exc
        handle = os.fdopen(fd, "w", encoding="utf-8")
        handle.write(_lock_payload())
        handle.flush()
        return SingleInstanceLock(lock_path, handle, mode="sentinel")

    handle = lock_path.open("a+", encoding="utf-8")
    try:
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
        handle.write(_lock_payload())
        handle.flush()
    except Exception:
        pass
    return SingleInstanceLock(lock_path, handle)


def signal_existing_instance(kind: str = "connect") -> Path:
    """Ask the already-running Local Agent to surface a useful window."""

    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "kind": kind,
        "pid": os.getpid(),
        "timestamp": time.time(),
    }
    tmp_path = REQUEST_PATH.with_suffix(".json.tmp")
    tmp_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp_path, REQUEST_PATH)
    return REQUEST_PATH


def clear_launch_guard() -> None:
    try:
        if LAUNCH_GUARD_PATH.is_dir():
            LAUNCH_GUARD_PATH.rmdir()
        else:
            LAUNCH_GUARD_PATH.unlink()
    except FileNotFoundError:
        pass
    except OSError:
        pass


def _windows_pid_running(pid: int) -> bool:
    if pid <= 0:
        return False
    if pid == os.getpid():
        return True
    try:
        import ctypes
        from ctypes import wintypes

        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        open_process = kernel32.OpenProcess
        open_process.argtypes = (wintypes.DWORD, wintypes.BOOL, wintypes.DWORD)
        open_process.restype = wintypes.HANDLE
        close_handle = kernel32.CloseHandle
        close_handle.argtypes = (wintypes.HANDLE,)
        close_handle.restype = wintypes.BOOL

        handle = open_process(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
        if not handle:
            return ctypes.get_last_error() == 5  # Access denied means something owns the PID.
        try:
            return True
        finally:
            close_handle(handle)
    except Exception:
        return True


def _lock_file_has_running_owner(lock_path: Path) -> bool:
    try:
        raw = lock_path.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return False
    except Exception:
        try:
            return time.time() - lock_path.stat().st_mtime < 30
        except Exception:
            return True
    pid = _pid_from_lock_text(raw)
    if pid is None:
        try:
            return time.time() - lock_path.stat().st_mtime < 30
        except Exception:
            return True
    return _windows_pid_running(pid)


def latest_request() -> tuple[int, dict[str, object]] | None:
    # 점(.)·하이픈(-) 두 요청 파일 중 가장 최근 것을 반환한다.
    # Go 런처는 ``aimax-local-agent-request.json``(하이픈)에 쓰고, 파이썬끼리의
    # 재신호는 ``aimax-local-agent.request.json``(점)에 쓴다. 둘 다 보고 mtime이
    # 더 새 것을 채택해야 런처가 남긴 연결 요청을 코어가 놓치지 않는다.
    newest: tuple[int, dict[str, object]] | None = None
    for path in REQUEST_PATHS:
        try:
            stat = path.stat()
            raw = path.read_text(encoding="utf-8")
        except (FileNotFoundError, OSError):
            continue
        try:
            data = json.loads(raw) if raw.strip() else {}
        except json.JSONDecodeError:
            data = {}
        if not isinstance(data, dict):
            data = {}
        mtime_ns = stat.st_mtime_ns
        if newest is None or mtime_ns > newest[0]:
            newest = (mtime_ns, data)
    return newest
