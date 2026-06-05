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


def _web_agent_report_target() -> tuple[str, dict[str, str]]:
    """연결된 웹 세션이 있으면 (서버 /api/reports endpoint, Bearer 인증 헤더)를 반환한다.

    실행기는 연결 시 사용자 세션 토큰을 보유하므로, 빌드 산출물에 시크릿을 박지 않고도
    그 토큰으로 서버에 오류 보고를 인증 전송할 수 있다. 서버 handleReport 는 활성 세션을
    받아 보고를 사용자에게 귀속한다. 연결 안 됐으면 ("", {}) 반환.
    """
    try:
        from web_agent.client import load_state, load_session_token
    except Exception:
        return "", {}
    try:
        token = (load_session_token() or "").strip()
        if not token:
            return "", {}
        base = str(load_state().get("base_url") or "").rstrip("/")
        if not base:
            return "", {}
        return f"{base}/api/reports", {"authorization": f"Bearer {token}"}
    except Exception:
        return "", {}


def post_report(report: dict[str, Any], endpoint: str, timeout: int = 8,
                extra_headers: dict[str, str] | None = None) -> dict[str, Any]:
    headers = {}
    token = default_report_token()
    if token:
        headers["X-AIMAX-Report-Token"] = token
    if extra_headers:
        headers.update(extra_headers)
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

    # 전송 대상 결정 우선순위: 명시 endpoint > 환경변수(AIMAX_REPORT_ENDPOINT) > 연결된 웹 세션.
    # 웹 세션 경로는 빌드에 시크릿 없이 사용자 세션 토큰(Bearer)으로 /api/reports 에 인증 전송.
    extra_headers: dict[str, str] = {}
    endpoint = (endpoint if endpoint is not None else default_endpoint()).strip()
    if not endpoint:
        wa_endpoint, wa_headers = _web_agent_report_target()
        if wa_endpoint:
            endpoint, extra_headers = wa_endpoint, wa_headers
    if not endpoint:
        path = save_report(report, PENDING_REPORTS_DIR)
        return {
            "status": "saved_pending",
            "reason": "no_endpoint",
            "report_id": report["report_id"],
            "path": str(path),
        }

    try:
        result = post_report(report, endpoint, extra_headers=extra_headers)
        if result["ok"]:
            path = save_report(report, SENT_REPORTS_DIR)
            # 전송 성공 시 그동안 쌓인 pending 도 기회적으로 함께 비운다.
            try:
                flush_pending_reports()
            except Exception:
                pass
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


def flush_pending_reports(max_reports: int = 25) -> dict[str, Any]:
    """PENDING_REPORTS_DIR 에 쌓인 보고를 연결된 웹 세션(또는 env endpoint)으로 재전송한다.

    연결 전 오프라인에서 누적된 보고를, 연결 직후 1회 호출로 서버에 올려보낸다.
    성공한 보고는 SENT_REPORTS_DIR 로 이동(중복 전송 방지). 연결 안 됐으면 아무것도 안 함.
    """
    endpoint = default_endpoint().strip()
    extra_headers: dict[str, str] = {}
    if not endpoint:
        endpoint, extra_headers = _web_agent_report_target()
    if not endpoint:
        return {"flushed": 0, "failed": 0, "reason": "no_endpoint"}

    try:
        files = sorted(PENDING_REPORTS_DIR.glob("*.json"))[:max_reports]
    except Exception:
        return {"flushed": 0, "failed": 0, "reason": "no_pending"}

    sent = failed = 0
    for fp in files:
        try:
            with fp.open("r", encoding="utf-8") as f:
                report = json.load(f)
        except Exception:
            continue
        try:
            result = post_report(report, endpoint, extra_headers=extra_headers)
        except Exception:
            failed += 1
            continue
        if result.get("ok"):
            # 전송 성공분은 pending→sent 로 atomic move 해 중복 재전송(서버 index/Telegram 중복)을 막는다.
            # save+unlink 2단계는 unlink 실패 시 다음 flush 에서 재전송되는 창이 있어 os.replace 로 대체.
            try:
                SENT_REPORTS_DIR.mkdir(parents=True, exist_ok=True)
                os.replace(str(fp), str(SENT_REPORTS_DIR / fp.name))
            except Exception:
                try:
                    fp.unlink()  # 이동 실패해도 최소한 pending 에서 제거(중복 방지)
                except Exception:
                    pass
            sent += 1
        else:
            failed += 1
            # 인증/권한 외 일시 오류면 다음 기회에 재시도하도록 남겨둔다.
    return {"flushed": sent, "failed": failed}
