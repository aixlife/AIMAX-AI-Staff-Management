"""Client for the AIMAX web app and local agent API."""
from __future__ import annotations

import json
import os
import platform
import socket
import sys
import threading
from pathlib import Path
from typing import Any

import requests

from paths import APP_DATA_DIR

DEFAULT_BASE_URL = os.environ.get("AIMAX_API_BASE_URL", "https://api.aimax.ai.kr").rstrip("/")
STATE_PATH = APP_DATA_DIR / "web_agent.json"
SESSION_TOKEN_FALLBACK_PATH = APP_DATA_DIR / ".web_agent_session.json"
KEYRING_SERVICE = "AIMAXWebAgent"
KEY_SESSION_TOKEN = "session_token"
REQUEST_TIMEOUT = 15
KEYRING_GET_TIMEOUT = float(os.environ.get("AIMAX_KEYCHAIN_TIMEOUT_SECONDS", "2") or "2")
PASSWORD_INPUT_HINT = "비밀번호는 영문 입력 상태에서 입력해주세요. 한글로 입력된 값은 사용할 수 없습니다."


class AimaxApiError(RuntimeError):
    """Raised when the AIMAX API returns an error response."""

    def __init__(self, status_code: int, error: str, payload: dict[str, Any] | None = None):
        super().__init__(error)
        self.status_code = status_code
        self.error = error
        self.payload = payload or {}


def friendly_error_message(error: BaseException | str) -> str:
    """Return a user-facing Korean message for common web-agent failures."""
    raw = str(error or "").strip()
    code = str(getattr(error, "error", "") or raw).strip()
    status_code = getattr(error, "status_code", None)
    lowered = code.lower()

    if code == "invalid_credentials":
        return (
            "웹앱 이메일 또는 비밀번호가 맞지 않습니다. "
            "웹앱에서 로그인되는 계정 정보와 같은 비밀번호를 입력해주세요. "
            "최근 비밀번호를 재설정했다면 새 비밀번호를 사용해야 하며, "
            "복사한 값 앞뒤 공백과 한/영 입력 상태도 확인해주세요."
        )
    if code in {"account_inactive", "inactive_user"}:
        return "이 계정은 현재 비활성화되어 있습니다. 관리자 화면에서 계정 상태를 확인해주세요."
    if code in {"password_change_or_entitlement_required", "password_change_required"}:
        return "첫 로그인 비밀번호 변경이 필요합니다. 웹앱에서 비밀번호를 변경한 뒤 실행기를 다시 연결해주세요."
    if lowered.startswith("network_error"):
        return "AIMAX 서버에 연결하지 못했습니다. 인터넷 연결, VPN/보안 프로그램, 방화벽 설정을 확인한 뒤 다시 시도해주세요."
    if "안전 저장소에 세션 토큰" in raw:
        return (
            "로그인은 성공했지만 이 PC의 안전 저장소에 세션을 저장하지 못했습니다. "
            "Windows 자격 증명 관리자 또는 macOS 키체인 접근을 허용한 뒤 다시 시도해주세요."
        )
    if "세션 토큰이 없습니다" in raw:
        return "로그인은 응답했지만 실행기 세션을 받지 못했습니다. 잠시 뒤 다시 시도해주세요."
    if status_code == 429:
        return "요청이 잠시 많아 로그인을 처리하지 못했습니다. 1분 정도 뒤 다시 시도해주세요."
    if status_code and int(status_code) >= 500:
        return "AIMAX 서버에서 일시 오류가 발생했습니다. 잠시 뒤 다시 시도해주세요."
    return raw or "알 수 없는 오류가 발생했습니다."


def password_input_error(password: str) -> str:
    """Return a Korean validation error for AIMAX web-account passwords."""
    value = str(password or "")
    if not value:
        return "비밀번호를 입력해주세요."
    if value != value.strip():
        return "비밀번호 앞뒤에 공백이 들어갔습니다. 공백 없이 다시 입력해주세요."
    if any("\u3130" <= ch <= "\u318f" or "\uac00" <= ch <= "\ud7a3" for ch in value):
        return "비밀번호에 한글이 입력되었습니다. 한/영 키로 영어 입력 상태로 바꾼 뒤 다시 입력해주세요."
    if any(ord(ch) < 33 or ord(ch) > 126 for ch in value):
        return "비밀번호는 영문 입력 상태에서 영문/숫자/기호만 입력해주세요."
    return ""


def _read_json(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    with tmp_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    tmp_path.replace(path)


def _write_sensitive_json(path: Path, data: dict[str, Any]) -> bool:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = path.with_suffix(path.suffix + ".tmp")
        fd = os.open(str(tmp_path), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        tmp_path.replace(path)
        try:
            path.chmod(0o600)
        except OSError:
            pass
        return True
    except OSError:
        return False


def load_state() -> dict[str, Any]:
    data = _read_json(STATE_PATH)
    base_url = str(data.get("base_url") or DEFAULT_BASE_URL).rstrip("/")
    return {
        "email": str(data.get("email") or ""),
        "base_url": base_url or DEFAULT_BASE_URL,
        "device_label": str(data.get("device_label") or default_device_label()),
    }


def save_state(email: str, base_url: str | None = None, device_label: str | None = None) -> None:
    previous = load_state()
    _write_json(
        STATE_PATH,
        {
            "email": (email or "").strip().lower(),
            "base_url": (base_url or previous.get("base_url") or DEFAULT_BASE_URL).rstrip("/"),
            "device_label": device_label or previous.get("device_label") or default_device_label(),
        },
    )


def _keyring_set(key: str, value: str) -> bool:
    if not _keychain_enabled():
        return False
    try:
        import keyring

        keyring.set_password(KEYRING_SERVICE, key, value or "")
        return True
    except Exception:
        return False


def _keyring_get(key: str) -> str:
    if not _keychain_enabled():
        return ""
    result = {"value": ""}

    def _worker() -> None:
        try:
            import keyring

            result["value"] = keyring.get_password(KEYRING_SERVICE, key) or ""
        except Exception:
            result["value"] = ""

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()
    thread.join(KEYRING_GET_TIMEOUT)
    if thread.is_alive():
        return ""
    return result.get("value", "") or ""


def _env_truthy(name: str) -> bool:
    value = os.environ.get(name, "")
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _keychain_enabled() -> bool:
    if _env_truthy("AIMAX_DISABLE_KEYCHAIN"):
        return False
    if sys.platform == "darwin" and not _env_truthy("AIMAX_ENABLE_KEYCHAIN"):
        return False
    return True


def _fallback_set_session_token(token: str) -> bool:
    if not token:
        _fallback_clear_session_token()
        return True
    return _write_sensitive_json(SESSION_TOKEN_FALLBACK_PATH, {"session_token": token})


def _fallback_get_session_token() -> str:
    data = _read_json(SESSION_TOKEN_FALLBACK_PATH)
    return str(data.get("session_token") or "")


def _fallback_clear_session_token() -> None:
    try:
        SESSION_TOKEN_FALLBACK_PATH.unlink()
    except FileNotFoundError:
        pass
    except OSError:
        pass


def save_session_token(token: str) -> bool:
    fallback_saved = _fallback_set_session_token(token)
    keyring_saved = _keyring_set(KEY_SESSION_TOKEN, token)
    return keyring_saved or fallback_saved


def load_session_token() -> str:
    fallback_token = _fallback_get_session_token()
    if fallback_token:
        return fallback_token
    return _keyring_get(KEY_SESSION_TOKEN)


def clear_session_token() -> None:
    _keyring_set(KEY_SESSION_TOKEN, "")
    _fallback_clear_session_token()


def default_device_label() -> str:
    hostname = socket.gethostname() or "AIMAX PC"
    system = platform.system() or "Unknown"
    return f"{hostname} ({system})"


def current_platform_label() -> str:
    system = platform.system() or "Unknown"
    release = platform.release() or ""
    machine = platform.machine() or ""
    parts = [system, release, machine]
    return " ".join(part for part in parts if part).strip()


class AimaxWebAgentClient:
    def __init__(self, base_url: str | None = None, session_token: str | None = None, timeout: int = REQUEST_TIMEOUT):
        self.base_url = (base_url or DEFAULT_BASE_URL).rstrip("/")
        self.session_token = session_token or ""
        self.timeout = timeout

    def set_session_token(self, token: str) -> None:
        self.session_token = token or ""

    def _headers(self, auth: bool = True) -> dict[str, str]:
        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "user-agent": "AIMAX-Local-Agent/1",
        }
        if auth and self.session_token:
            headers["authorization"] = f"Bearer {self.session_token}"
        return headers

    def _request(
        self,
        method: str,
        path: str,
        *,
        payload: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
        auth: bool = True,
    ) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        try:
            response = requests.request(
                method,
                url,
                headers=self._headers(auth=auth),
                json=payload,
                params=params,
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            raise AimaxApiError(0, f"network_error: {exc}") from exc

        try:
            data = response.json()
        except ValueError:
            data = {"ok": False, "error": response.text[:300] or "invalid_json"}

        if response.status_code >= 400 or data.get("ok") is False:
            error = str(data.get("error") or f"http_{response.status_code}")
            raise AimaxApiError(response.status_code, error, data)
        return data

    def login(self, email: str, password: str, device_label: str | None = None) -> dict[str, Any]:
        data = self._request(
            "POST",
            "/api/auth/login",
            payload={
                "email": email,
                "password": password,
                "device_label": device_label or default_device_label(),
            },
            auth=False,
        )
        token = str(data.get("session_token") or "")
        if token:
            self.set_session_token(token)
        return data

    def logout(self) -> dict[str, Any]:
        return self._request("POST", "/api/auth/logout", payload={})

    def me(self) -> dict[str, Any]:
        return self._request("GET", "/api/auth/me")

    def version(self, current_version: str, platform_label: str | None = None) -> dict[str, Any]:
        params: dict[str, str] = {"current": current_version}
        if platform_label:
            params["platform"] = platform_label
        return self._request("GET", "/api/version", params=params, auth=False)

    def heartbeat(
        self,
        *,
        status: str,
        version: str,
        platform_label: str,
        device_label: str,
        readiness: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        payload = {
            "status": status,
            "version": version,
            "platform": platform_label,
            "device_label": device_label,
        }
        if readiness is not None:
            payload["readiness"] = readiness
        return self._request(
            "POST",
            "/api/agent/heartbeat",
            payload=payload,
        )

    def next_job(self, platform_label: str | None = None, device_label: str | None = None) -> dict[str, Any]:
        params: dict[str, str] = {}
        if platform_label:
            params["platform"] = platform_label
        if device_label:
            params["device_label"] = device_label
        return self._request("GET", "/api/agent/next-job", params=params or None)

    def create_command(self, command_type: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        command_payload: dict[str, Any] = {"type": command_type}
        if payload is not None:
            command_payload["payload"] = payload
        return self._request(
            "POST",
            "/api/agent/commands",
            payload=command_payload,
        )

    def next_command(self, platform_label: str | None = None, device_label: str | None = None) -> dict[str, Any]:
        params = {}
        if platform_label:
            params["platform"] = platform_label
        if device_label:
            params["device_label"] = device_label
        if not params:
            params = None
        return self._request("GET", "/api/agent/next-command", params=params)

    def update_command(self, command_id: str, status: str, log: str, result: dict[str, Any] | None = None) -> dict[str, Any]:
        payload = {
            "command_id": command_id,
            "status": status,
            "log": log,
        }
        if result is not None:
            payload["result"] = result
        return self._request(
            "POST",
            "/api/agent/commands/update",
            payload=payload,
        )

    def put_user_secret(self, provider: str, value: str) -> dict[str, Any]:
        return self._request(
            "PUT",
            f"/api/user/secrets/{provider}",
            payload={"value": value},
        )

    def get_user_secrets(self) -> dict[str, Any]:
        return self._request("GET", "/api/user/secrets")

    def update_job(self, job_id: str, status: str, log: str, level: str = "info", result: dict[str, Any] | None = None) -> dict[str, Any]:
        payload = {
            "job_id": job_id,
            "status": status,
            "log": log,
            "level": level,
        }
        if result is not None:
            payload["result"] = result
        return self._request(
            "POST",
            "/api/agent/jobs/update",
            payload=payload,
        )
