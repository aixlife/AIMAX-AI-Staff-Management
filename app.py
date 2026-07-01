Total output lines: 7384

import sys
import os
import json
import base64
import math
import re
import threading
import logging
import traceback
import subprocess
import argparse
import shutil
import time
from queue import Empty, Queue
from datetime import datetime, timezone

# 프로젝트 루트를 sys.path에 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def _ensure_tcl_tk_library():
    """uv/venv 로 실행 시 Tcl 이 base Python 의 tcl/tk 라이브러리를 못 찾아
    Tk() 생성이 'Can't find a usable init.tcl' 로 실패하는 문제를 보정한다.
    (sys.executable 이 .venv/bin/python 이면 Tcl 의 기본 탐색이 venv 기준이 되어
     base Python 의 lib/tcl8.x 를 못 찾는다.)
    PyInstaller 프리즌 번들은 자체적으로 처리하므로 건드리지 않는다.
    """
    if getattr(sys, "frozen", False) or "__compiled__" in globals():
        return
    if os.environ.get("TCL_LIBRARY") and os.environ.get("TK_LIBRARY"):
        return
    import glob
    base = getattr(sys, "base_prefix", sys.prefix)
    if base == sys.prefix:
        return  # venv 가 아니면 표준 탐색으로 충분
    # python-build-standalone 레이아웃: macOS/Linux 는 base/lib/tcl8.x,
    # Windows 는 base/tcl/tcl8.x. 양쪽 모두 탐색한다.
    tcl_globs = [os.path.join(base, "lib", "tcl8.*"), os.path.join(base, "tcl", "tcl8.*")]
    tk_globs = [os.path.join(base, "lib", "tk8.*"), os.path.join(base, "tcl", "tk8.*")]
    if not os.environ.get("TCL_LIBRARY"):
        for pattern in tcl_globs:
            for tcl_dir in sorted(glob.glob(pattern), reverse=True):
                if os.path.exists(os.path.join(tcl_dir, "init.tcl")):
                    os.environ["TCL_LIBRARY"] = tcl_dir
                    break
            if os.environ.get("TCL_LIBRARY"):
                break
    if not os.environ.get("TK_LIBRARY"):
        for pattern in tk_globs:
            for tk_dir in sorted(glob.glob(pattern), reverse=True):
                if os.path.exists(os.path.join(tk_dir, "tk.tcl")):
                    os.environ["TK_LIBRARY"] = tk_dir
                    break
            if os.environ.get("TK_LIBRARY"):
                break


_ensure_tcl_tk_library()


_EARLY_AGENT_LOCK = None


def _early_env_truthy(name):
    value = os.environ.get(name, "")
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _early_agent_mode_requested(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    if "--diagnostics-probe" in argv or "--repair-local-state" in argv:
        return False
    if "--legacy-ui" in argv or _early_env_truthy("AIMAX_LEGACY_UI"):
        return False
    if any(flag in argv for flag in ("--connect", "--status", "--open-settings", "--open_settings")):
        return True
    if "--agent" in argv or _early_env_truthy("AIMAX_AGENT_MODE"):
        return True
    return bool(getattr(sys, "frozen", False)) or "__compiled__" in globals()


def _early_agent_request_kind(argv=None):
    joined = " ".join(list(sys.argv[1:] if argv is None else argv)).lower()
    if "open_settings" in joined or "open-settings" in joined or "settings" in joined:
        return "open_settings"
    if "status" in joined:
        return "status"
    return "connect"


def _preacquire_agent_lock():
    global _EARLY_AGENT_LOCK
    if not _early_agent_mode_requested():
        return
    try:
        from local_agent.single_instance import SingleInstanceError, acquire_single_instance_lock

        _EARLY_AGENT_LOCK = acquire_single_instance_lock()
    except SingleInstanceError:
        try:
            from local_agent.single_instance import signal_existing_instance

            signal_existing_instance(_early_agent_request_kind())
        except Exception:
            pass
        sys.exit(0)
    except Exception:
        pass


_preacquire_agent_lock()


def _hidden_subprocess_kwargs():
    if os.name != "nt":
        return {}
    kwargs = {}
    creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    if creationflags:
        kwargs["creationflags"] = creationflags
    try:
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startupinfo.wShowWindow = subprocess.SW_HIDE
        kwargs["startupinfo"] = startupinfo
    except Exception:
        pass
    return kwargs


# macOS PyInstaller 번들 SSL 인증서 경로 설정
try:
    import certifi
    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
    os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
except ImportError:
    pass

import ttkbootstrap as ttk
from ttkbootstrap.constants import *
from tkinter import filedialog, END
import tkinter as tk
import aimax_compliance as aimax
from local_agent.runtime import HeadlessAgentMixin, agent_mode_requested, env_truthy

# ── 플랫폼별 폰트 ──
if sys.platform == "darwin":
    FONT_UI   = "Apple SD Gothic Neo"
    FONT_MONO = "Monaco"
elif sys.platform.startswith("win"):
    FONT_UI   = "Malgun Gothic"
    FONT_MONO = "Consolas"
else:
    FONT_UI   = "DejaVu Sans"
    FONT_MONO = "DejaVu Sans Mono"



# ──────────────────────────────────────────────
# 설정 파일 경로 (플랫폼별 사용자 데이터 디렉토리 사용)
# ──────────────────────────────────────────────
from paths import SETTINGS_PATH as _SETTINGS_PATH, APP_DATA_DIR as _APP_DATA_DIR, GENERATED_DIR as _GENERATED_DIR

SETTINGS_PATH = str(_SETTINGS_PATH)
SECRET_FALLBACK_PATH = str(_APP_DATA_DIR / ".settings_secrets.json")
EXPORTS_DIR = str(_APP_DATA_DIR / "exports")
GENERATED_IMAGE_DIR = str(_GENERATED_DIR)
GENERATED_DIR = _GENERATED_DIR


# ──────────────────────────────────────────────
# 설정 저장 / 로드
# ──────────────────────────────────────────────
# 새 저장값은 AIMAX 이름으로 관리하고, 기존 설치 사용자는 NaverBlogAuto에서 1회 폴백/마이그레이션한다.
_KR_SERVICE = os.environ.get("AIMAX_KEYRING_SERVICE", "AIMAX")
_KR_LEGACY_SERVICE = "NaverBlogAuto"
_SECRET_ENV_KEYS = {
    "naver_pw": "AIMAX_NAVER_PASSWORD",
    "gemini_api_key": "AIMAX_GEMINI_API_KEY",
    "claude_api_key": "AIMAX_CLAUDE_API_KEY",
    "openai_api_key": ("AIMAX_OPENAI_API_KEY", "OPENAI_API_KEY", "openai_api_key"),
    "apify_api_token": ("AIMAX_APIFY_API_TOKEN", "APIFY_API_TOKEN", "apify_api_token"),
}
_DEFAULT_AI_MODEL = "gemini-2.5-flash"
API_KEY_GUIDE_URL = os.environ.get(
    "AIMAX_API_KEY_GUIDE_URL",
    "https://www.notion.so/367b31f1da5581ed9b11f23757476cd2",
) or "https://www.notion.so/367b31f1da5581ed9b11f23757476cd2"
_KEYCHAIN_READ_UNAVAILABLE = False
_USD_KRW_RATE = 1476
_USD_KRW_RATE_LABEL = "2026-05-06 Wise/Investing.com spot"
_DEFAULT_IMAGE_MODEL = "gpt-image-1"
_IMAGE_MODEL_PRICE_USD = {
    "gpt-image-1": {"provider": "openai", "label": "OpenAI GPT Image 1", "per_image": 0.042},
    "gpt-image-2": {"provider": "openai", "label": "OpenAI GPT Image 2", "per_image": 0.053},
    "gemini-2.5-flash-image": {"provider": "gemini", "label": "Gemini Nano Banana", "per_image": 0.039},
    "gemini-3.1-flash-image": {"provider": "gemini", "label": "Gemini Nano Banana 2", "per_image": 0.067},
    "gemini-3-pro-image": {"provider": "gemini", "label": "Gemini Nano Banana Pro", "per_image": 0.134},
}
_GEMINI_IMAGE_PRICE_USD = _IMAGE_MODEL_PRICE_USD["gemini-3.1-flash-image"]["per_image"]
_OPENAI_IMAGE_PRICE_USD = _IMAGE_MODEL_PRICE_USD["gpt-image-1"]["per_image"]
_AI_TEXT_PRICE_USD_PER_1M = {
    # gemini-3.1-pro-preview 단가는 2.5 Pro 기준 추정치 — 정확한 공식 단가 확인 후 보정 필요
    "gemini-3.5-flash": {"input": 1.50, "output": 9.00, "label": "Gemini 3.5 Flash"},
    "gemini-3.1-pro-preview": {"input": 1.25, "output": 10.00, "label": "Gemini 3.1 Pro Preview"},
    "gemini-2.5-pro": {"input": 1.25, "output": 10.00, "label": "Gemini 2.5 Pro"},
    "gemini-2.5-flash": {"input": 0.30, "output": 2.50, "label": "Gemini 2.5 Flash"},
    "claude": {"input": 3.00, "output": 15.00, "label": "Claude Sonnet"},
    "gpt-5.4-mini": {"input": 0.75, "output": 4.50, "label": "GPT-5.4 mini"},
    "gpt-5-mini": {"input": 0.25, "output": 2.00, "label": "GPT-5 mini"},
}
_LEGACY_AI_MODEL_MAP = {
    "gemini": _DEFAULT_AI_MODEL,
    "gemini-pro": "gemini-3.1-pro-preview",
    "gemini-flash": _DEFAULT_AI_MODEL,
    # 구버전 기본값/접미사 없는 레거시값(2.5 Pro, 3.1 Pro 등)은 무료 등급에서 동작하는
    # 기본값(3.5 Flash)으로 매핑한다. UI 선택지 값은 "gemini-3.1-pro-preview"(접미사 포함)이므로
    # 접미사 없는 "gemini-3.1-pro"는 사용자의 명시 선택이 아니라 자동/레거시값 → flash 가 안전.
    # (무료 키 사용자가 기본값/레거시값으로 대량 실패하던 문제 방지)
    "gemini-2.5-pro": _DEFAULT_AI_MODEL,
    "gemini-3.1-pro": _DEFAULT_AI_MODEL,
}
_PLACEHOLDER_SECRET_VALUES = {
    "",
    "your_naver_id",
    "your_naver_password",
    "your_gemini_api_key",
    "your_claude_api_key",
    "your_openai_api_key",
    "your_apify_api_token",
    "your_api_key_here",
    "your_api_key",
    "changeme",
    "change_me",
}
_PROVIDER_SECRET_KEYS = {
    "gemini_api_key",
    "claude_api_key",
    "openai_api_key",
    "apify_api_token",
}


def _normalize_ai_model(value):
    value = (value or "").strip()
    if value in ("claude", "gemini-3.5-flash", "gemini-3.1-pro-preview", "gemini-2.5-flash", "gpt-5.4-mini", "gpt-5-mini"):
        return value
    return _LEGACY_AI_MODEL_MAP.get(value, _DEFAULT_AI_MODEL)


def _is_openai_model(value):
    return str(value or "").startswith("gpt-")


def _normalize_image_model(value, ai_model=None):
    value = str(value or "").strip()
    if not value:
        return "gpt-image-1" if _is_openai_model(ai_model) else "gemini-3.1-flash-image"
    aliases = {
        "openai": "gpt-image-1",
        "gpt-image": "gpt-image-1",
        "gemini": "gemini-3.1-flash-image",
        "nano-banana": "gemini-2.5-flash-image",
        "nano-banana-pro": "gemini-3-pro-image",
    }
    value = aliases.get(value, value)
    if value in _IMAGE_MODEL_PRICE_USD:
        return value
    if _is_openai_model(ai_model):
        return "gpt-image-1"
    return _DEFAULT_IMAGE_MODEL


def _image_provider_for_model(image_model):
    model = _normalize_image_model(image_model)
    return _IMAGE_MODEL_PRICE_USD.get(model, {}).get("provider", "openai")


def _safe_generated_basename(source):
    safe = re.sub(r"[^0-9A-Za-z가-힣 _-]", "", str(source or "post")).strip()[:40]
    return safe or "post"


def _persist_generated_markdown(source, markdown):
    """AI가 생성한(과금된) 원고를 네이버 입력 전에 파일로 보관한다.

    발행/네이버 입력이 나중에 실패해도 이미 만든 원고를 잃지 않도록 따로 저장한다.
    저장 경로(str)를 반환하고, 실패하면 None 을 반환한다(저장 실패가 발행을 막지 않음).
    """
    text = str(markdown or "").strip()
    if not text:
        return None
    try:
        from datetime import datetime as _dt
        from paths import GENERATED_DIR
        GENERATED_DIR.mkdir(parents=True, exist_ok=True)
        safe = _safe_generated_basename(source)
        stamp = _dt.now().strftime("%Y%m%d-%H%M%S")
        path = GENERATED_DIR / f"{stamp}_{safe}.md"
        path.write_text(text, encoding="utf-8")
        return str(path)
    except Exception:
        return None


def _write_recovery_manifest(title, markdown_path=None, image_items=None, error=""):
    """사용자가 네이버 에디터 실패 뒤 직접 옮길 수 있게 원고/이미지 위치를 한 파일에 남긴다."""
    try:
        from datetime import datetime as _dt
        GENERATED_DIR.mkdir(parents=True, exist_ok=True)
        stamp = _dt.now().strftime("%Y%m%d-%H%M%S")
        safe = _safe_generated_basename(title)
        manifest_path = GENERATED_DIR / f"{stamp}_{safe}_복구안내.json"
        payload = {
            "title": str(title or "").strip(),
            "markdown_path": str(markdown_path or "").strip(),
            "generated_folder": str(GENERATED_DIR),
            "images": image_items if isinstance(image_items, list) else [],
            "error": str(error or "")[:500],
            "guide": [
                "markdown_path의 원고를 열어 네이버 편집기에 붙여넣을 수 있습니다.",
                "images 배열은 본문 [이미지] 위치 순서와 로컬 이미지 파일 경로입니다.",
                "자동 발행/예약 중 이미지 실패가 있으면 공개 발행 대신 임시저장으로 보호됩니다.",
            ],
        }
        manifest_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return str(manifest_path)
    except Exception:
        return None


def _normalize_image_count(value):
    try:
        count = int(value)
    except (TypeError, ValueError):
        count = 3
    return max(0, min(8, count))


def _abort_on_image_prompt_shortfall():
    """이미지 프롬프트가 요청 수보다 부족할 때 작업을 통째로 중단할지 여부.
    기본값 True = 기존 동작 보존(이미지 없는 글 발행 방지). 환경변수로만 완화 허용.
    AIMAX_IMAGE_PROMPT_SHORTFALL=warn|soft|proceed|0|false 이면 0장일 때도 진행."""
    return str(os.environ.get("AIMAX_IMAGE_PROMPT_SHORTFALL", "abort")).strip().lower() not in (
        "warn", "soft", "proceed", "0", "false",
    )


def _payload_image_count(payload, default=3):
    if not isinstance(payload, dict):
        return _normalize_image_count(default)
    for key in ("image_count", "images"):
        if key not in payload:
            continue
        value = payload.get(key)
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        return _normalize_image_count(value)
    return _normalize_image_count(default)


def _normalize_target_char_count(value):
    raw = str(value or "").split(" - ")[0].strip()
    raw = raw.replace("자", "").replace("단어", "").strip()
    try:
        count = int(raw)
    except (TypeError, ValueError):
        count = 1500
    return max(300, min(6000, count))


def _is_browser_session_error(error):
    text = str(error or "").lower()
    return any(
        marker in text
        for marker in (
            "invalid session",
            "invalidsessionid",
            "not connected to devtools",
            "disconnected",
            "browser has closed",
            "chrome not reachable",
            "target window already closed",
            "target frame detached",
            "frame detached",
            "no such window",
        )
    )


def _limit_image_blocks(content_list, image_count):
    limit = _normalize_image_count(image_count)
    image_seen = 0
    filtered = []
    for item in content_list:
        if item and item[0] == "image":
            if image_seen >= limit:
                continue
            image_seen += 1
        filtered.append(item)
    return filtered


def _is_empty_image_prompt(prompt):
    text = str(prompt or "").strip().strip("\"'`")
    text = re.sub(r"\s+", " ", text)
    if not text:
        return True
    normalized = text.lower().strip(" .,:;!()[]{}")
    return normalized in {
        "image",
        "image prompt",
        "prompt",
        "photo",
        "picture",
        "이미지",
        "이미지 프롬프트",
        "프롬프트",
        "사진",
        "그림",
    }


def _fallback_image_prompt(title, source, index):
    seed = str(title or source or "블로그 글").strip()
    seed = re.sub(r"\s+", " ", seed)
    seed = seed[:80] or "블로그 글"
    return (
        f"{seed} 주제를 시각적으로 설명하는 네이버 블로그용 이미지 {index}, "
        "자연스러운 사진 스타일, 밝고 선명한 분위기, 텍스트나 로고 없이"
    )


def _repair_empty_image_prompts(content_list, title="", source=""):
    repaired = []
    image_index = 0
    changed = 0
    for item in content_list:
        if item and item[0] == "image":
            image_index += 1
            prompt = item[1] if len(item) > 1 else ""
            if _is_empty_image_prompt(prompt):
                prompt = _fallback_image_prompt(title, source, image_index)
                changed += 1
            repaired.append(("image", prompt))
            continue
        repaired.append(item)
    return repaired, changed


def _usage_number(value):
    try:
        if value is None:
            return 0
        return int(value)
    except (TypeError, ValueError):
        return 0


def _merge_usage_totals(totals, usage):
    for key in ("input_tokens", "output_tokens", "thinking_tokens", "billable_output_tokens", "total_tokens"):
        value = _usage_number((usage or {}).get(key))
        if value:
            totals[key] = _usage_number(totals.get(key)) + value
    return totals


def _safe_image_failures(raw, limit=20):
    if not isinstance(raw, list):
        return []
    failures = []
    for item in raw[:limit]:
        if not isinstance(item, dict):
            continue
        failures.append({
            "index": max(0, _usage_number(item.get("index"))),
            "stage": str(item.get("stage") or "image_completion")[:80],
            "error_code": str(item.get("error_code") or item.get("error") or "image_not_inserted")[:80],
            "provider": str(item.get("provider") or "")[:40],
            "method": str(item.get("method") or "")[:40],
            "message": str(item.get("message") or "")[:180],
            "local_image_path": str(item.get("local_image_path") or "")[:260],
            "user_actionable": bool(item.get("user_actionable")),
            "admin_action_required": bool(item.get("admin_action_required")),
        })
    return failures


def _safe_local_image_paths(raw, limit=20):
    if not isinstance(raw, list):
        return []
    paths = []
    seen = set()
    for item in raw[:limit]:
        path = str(item or "").strip()
        if not path or path in seen:
            continue
        seen.add(path)
        paths.append(path[:260])
    return paths


def _safe_image_items(raw, limit=20):
    if not isinstance(raw, list):
        return []
    items = []
    for item in raw[:limit]:
        if not isinstance(item, dict):
            continue
        items.append({
            "index": max(0, _usage_number(item.get("index"))),
            "prompt": str(item.get("prompt") or "")[:500],
            "provider": str(item.get("provider") or "")[:40],
            "model": str(item.get("model") or "")[:80],
            "generated": bool(item.get("generated")),
            "inserted": bool(item.get("inserted")),
            "local_image_path": str(item.get("local_image_path") or "")[:260],
            "stage": str(item.get("stage") or "")[:80],
            "error_code": str(item.get("error_code") or "")[:80],
        })
    return items


def _image_failure_stage(failures):
    stages = [str(item.get("stage") or "").strip() for item in failures if isinstance(item, dict)]
    for stage in ("image_generation", "image_upload", "image_insert_verification", "image_insert_exception", "image_prompt_empty"):
        if stage in stages:
            return stage
    return "image_completion"


def _image_failure_message(requested, inserted, failures):
    stage = _image_failure_stage(failures)
    stage_labels = {
        "image_generation": "이미지 생성 실패",
        "image_upload": "네이버 이미지 업로드 실패",
        "image_insert_verification": "네이버 편집기 이미지 반영 …74782 tokens truncated…\n"
                    f"400자를 넘는 멘트 {len(too_long)}개를 줄인 뒤 다시 실행해 주세요.",
                )
            except Exception:
                pass
            return None
        save_neighbor_messages(self.naver_id_var.get(), messages)
        if status_label is not None:
            status_label.configure(text=f"멘트 {len(messages)}개 저장됨", fg=COLORS["text_muted"])
        return messages

    def _run_neighbor(self):
        keywords_str = self.neighbor_keywords_var.get().strip()
        if not keywords_str:
            self._log("[오류] 검색 키워드를 입력해주세요.")
            return
        if not self._validate_credentials(need_api=False):
            return
        keywords = [k.strip() for k in keywords_str.split(",") if k.strip()]
        max_per = self.neighbor_count_var.get()

        messages = self._collect_neighbor_messages(self.neighbor_msg_text, self.ai_ment_status)
        if messages is None:
            return

        speed_mode = self.neighbor_speed_var.get() or "normal"
        cooldown_every = max(0, int(self.neighbor_cooldown_var.get() or 0))
        daily_limit = max(0, int(self.neighbor_daily_limit_var.get() or 0))
        if not self._confirm_limit_override(
            "서로이웃 일일 상한",
            daily_limit,
            aimax.RECOMMENDED_LIMITS["daily_neighbor_requests"],
        ):
            self._log("권장 한도 초과 확인이 취소되어 실행하지 않았습니다.")
            return

        self._start_worker(
            self._worker_neighbor,
            keywords=keywords, max_per_keyword=max_per,
            messages=messages, speed_mode=speed_mode,
            cooldown_every=cooldown_every, daily_limit=daily_limit,
        )

    def _run_link_neighbor(self):
        blogger_url = self.link_blogger_url_var.get().strip()
        if not blogger_url:
            self._log("[오류] 블로거 링크 또는 ID를 입력해주세요.")
            return
        try:
            from scraper.follower_scraper import extract_blogger_id_from_url
            if not extract_blogger_id_from_url(blogger_url):
                self._log("[오류] 네이버 블로그 링크 또는 블로그 ID 형식을 확인해주세요.")
                return
        except Exception as e:
            self._log(f"[오류] 블로거 링크 확인 실패: {e}")
            return
        if not self._validate_credentials(need_api=False):
            return

        messages = self._collect_neighbor_messages(
            self.link_neighbor_msg_text, self.link_neighbor_status,
        )
        if messages is None:
            return

        max_requests = max(1, int(self.link_neighbor_count_var.get() or 1))
        speed_mode = self.neighbor_speed_var.get() or "normal"
        cooldown_every = max(0, int(self.neighbor_cooldown_var.get() or 0))
        daily_limit = max(0, int(self.neighbor_daily_limit_var.get() or 0))
        if not self._confirm_limit_override(
            "서로이웃 일일 상한",
            daily_limit,
            aimax.RECOMMENDED_LIMITS["daily_neighbor_requests"],
        ):
            self._log("권장 한도 초과 확인이 취소되어 실행하지 않았습니다.")
            return

        self._start_worker(
            self._worker_link_neighbor,
            blogger_url=blogger_url, max_requests=max_requests,
            messages=messages, speed_mode=speed_mode,
            cooldown_every=cooldown_every, daily_limit=daily_limit,
        )

    def _worker_neighbor(self, keywords, max_per_keyword, messages=None,
                        speed_mode="normal", cooldown_every=10, daily_limit=50):
        try:
            from browser.stealth_driver import create_stealth_driver
            from auth.naver_login import login
            from engagement.auto_neighbor import auto_neighbor

            nid = self.naver_id_var.get()
            npw = self.naver_pw_var.get()

            self.queue.put(("progress", 10))
            self._log("스텔스 브라우저 시작...")
            self.driver = create_stealth_driver()
            if self.stop_event.is_set():
                self._log("사용자에 의해 중지됨")
                return

            self.queue.put(("progress", 25))
            self._log("네이버 로그인 중...")
            login(self.driver, nid, npw)
            if self.stop_event.is_set():
                self._log("사용자에 의해 중지됨")
                return

            self.queue.put(("progress", 40))
            speed_label = {"safe": "안전", "normal": "보통", "fast": "빠름"}.get(speed_mode, speed_mode)
            self._log(
                f"서로이웃 추가 시작 (키워드: {', '.join(keywords)}, "
                f"속도={speed_label}, 멘트 {len(messages or [])}종, "
                f"Cool-down={cooldown_every}명, 일일 상한={daily_limit or '무제한'})"
            )
            total = auto_neighbor(
                self.driver, keywords, max_per_keyword=max_per_keyword,
                messages=messages, speed_mode=speed_mode,
                cooldown_every=cooldown_every, daily_limit=daily_limit,
                naver_id=nid, naver_pw=npw, stop_event=self.stop_event,
            )

            if self.stop_event.is_set():
                self._log("사용자에 의해 중지됨")
                return

            self.queue.put(("progress", 100))
            self._log(f"서로이웃 추가 완료: {total}명 신청")

            # 완료 팝업
            try:
                from engagement.neighbor_quota import get_today_count
                today = get_today_count(nid)
                daily_txt = f" / 일일 상한 {daily_limit}명" if daily_limit else ""
                body = (
                    f"이번에 {total}명에게 서로이웃을 신청했어요 ✨\n"
                    f"(오늘 누적 {today}명{daily_txt})\n\n"
                    f"이제 댓글과 공감으로 친해질 시간이에요!"
                )
            except Exception:
                body = f"이번에 {total}명에게 서로이웃을 신청했어요 ✨"
            self.queue.put((
                "popup",
                ("find_keyword", "고객을 찾아오기 완료", body, "engage"),
            ))

        except Exception as e:
            if self.stop_event.is_set():
                self._log("사용자에 의해 중지됨")
            else:
                self._log(f"[오류] {e}")
                traceback.print_exc()
        finally:
            if self.driver:
                try:
                    self.driver.quit()
                except Exception:
                    pass
            self.queue.put(("done", None))

    def _worker_link_neighbor(self, blogger_url, max_requests, messages=None,
                              speed_mode="normal", cooldown_every=10, daily_limit=50):
        try:
            from browser.stealth_driver import create_stealth_driver
            from auth.naver_login import login
            from scraper.follower_scraper import (
                extract_blogger_id_from_url,
                scrape_follower_ids,
            )
            from engagement.auto_neighbor import auto_neighbor_to_blog_ids

            nid = self.naver_id_var.get()
            npw = self.naver_pw_var.get()
            owner_id = extract_blogger_id_from_url(blogger_url) or blogger_url

            self.queue.put(("progress", 10))
            self._log("스텔스 브라우저 시작...")
            self.driver = create_stealth_driver()
            if self.stop_event.is_set():
                self._log("사용자에 의해 중지됨")
                return

            self.queue.put(("progress", 25))
            self._log("네이버 로그인 중...")
            login(self.driver, nid, npw)
            if self.stop_event.is_set():
                self._log("사용자에 의해 중지됨")
                return

            self.queue.put(("progress", 40))
            scrape_limit = max(max_requests * 3, max_requests + 10)
            self._log(f"'{owner_id}' 블로거의 이웃 목록 수집 중... (후보 최대 {scrape_limit}명)")
            blog_ids = scrape_follower_ids(
                self.driver, blogger_url, max_count=scrape_limit,
                stop_event=self.stop_event,
            )
            if self.stop_event.is_set():
                self._log("사용자에 의해 중지됨")
                return
            if not blog_ids:
                self.queue.put(("progress", 100))
                self._log("이웃 목록이 비공개이거나 접근 제한됨")
                return

            self.queue.put(("progress", 60))
            speed_label = {"safe": "안전", "normal": "보통", "fast": "빠름"}.get(speed_mode, speed_mode)
            self._log(
                f"서로이웃 추가 시작 (기준 블로거: {owner_id}, 후보 {len(blog_ids)}명, "
                f"최대 신청 {max_requests}명, 속도={speed_label}, 멘트 {len(messages or [])}종, "
                f"Cool-down={cooldown_every}명, 일일 상한={daily_limit or '무제한'})"
            )
            total = auto_neighbor_to_blog_ids(
                self.driver, blog_ids, max_requests=max_requests,
                messages=messages, speed_mode=speed_mode,
                cooldown_every=cooldown_every, daily_limit=daily_limit,
                naver_id=nid, naver_pw=npw, stop_event=self.stop_event,
                source_label=f"{owner_id} 이웃 목록",
            )

            if self.stop_event.is_set():
                self._log("사용자에 의해 중지됨")
                return

            self.queue.put(("progress", 100))
            self._log(f"특정 블로거 링크 작업 완료: 후보 {len(blog_ids)}명 중 {total}명 신청")

            try:
                from engagement.neighbor_quota import get_today_count
                today = get_today_count(nid)
                daily_txt = f" / 일일 상한 {daily_limit}명" if daily_limit else ""
                body = (
                    f"'{owner_id}' 이웃 목록에서 후보 {len(blog_ids)}명을 찾고,\n"
                    f"이번에 {total}명에게 서로이웃을 신청했어요.\n"
                    f"(오늘 누적 {today}명{daily_txt})"
                )
            except Exception:
                body = f"'{owner_id}' 이웃 목록에서 {total}명에게 서로이웃을 신청했어요."
            self.queue.put((
                "popup",
                ("find_link", "고객을 찾아오기 완료", body, "engage"),
            ))

        except Exception as e:
            if self.stop_event.is_set():
                self._log("사용자에 의해 중지됨")
            else:
                self._log(f"[오류] {e}")
                traceback.print_exc()
        finally:
            if self.driver:
                try:
                    self.driver.quit()
                except Exception:
                    pass
            self.queue.put(("done", None))

    def _run_scraper(self):
        keyword = self.scraper_keyword_var.get().strip()
        if not keyword:
            self._log("[오류] 검색 키워드를 입력해주세요.")
            return
        self._start_worker(self._worker_scraper_blog, keyword=keyword,
                           max_results=self.scraper_count_var.get())

    def _worker_scraper_blog(self, keyword, max_results):
        try:
            from browser.stealth_driver import create_stealth_driver
            from auth.naver_login import login
            from scraper.blog_scraper import scrape_blogger_ids, save_to_csv

            nid = self.naver_id_var.get()
            npw = self.naver_pw_var.get()

            self.queue.put(("progress", 10))
            self._log("스텔스 브라우저 시작...")
            self.driver = create_stealth_driver()

            self.queue.put(("progress", 25))
            self._log("네이버 로그인 중...")
            login(self.driver, nid, npw)

            self.queue.put(("progress", 40))
            self._log(f"블로거 ID 수집 중: '{keyword}'")
            ids = scrape_blogger_ids(self.driver, keyword, max_results=max_results)

            self.queue.put(("progress", 90))
            filepath = save_to_csv(keyword, ids, include_email=True)
            self.last_scraper_csv_path = filepath
            self._log(f"수집 완료: {len(ids)}명 → {filepath}")
            if self._open_local_path(filepath, quiet=True):
                self._log("CSV 파일을 기본 프로그램으로 열었습니다.")
            self.queue.put(("progress", 100))

        except Exception as e:
            self._log(f"[오류] {e}")
            traceback.print_exc()
        finally:
            if self.driver:
                try:
                    self.driver.quit()
                except Exception:
                    pass
            self.queue.put(("done", None))

    def _open_local_path(self, path, quiet=False):
        try:
            if not path or not os.path.exists(path):
                if not quiet:
                    self._log(f"[오류] 경로를 찾을 수 없습니다: {path}")
                return False

            if sys.platform.startswith("win"):
                os.startfile(path)
            elif sys.platform == "darwin":
                subprocess.Popen(["open", path])
            else:
                subprocess.Popen(["xdg-open", path])
            return True
        except Exception as e:
            if not quiet:
                self._log(f"[오류] 파일 열기 실패: {e}")
            return False

    def _open_last_scraper_csv(self):
        if self.last_scraper_csv_path and os.path.exists(self.last_scraper_csv_path):
            if self._open_local_path(self.last_scraper_csv_path):
                self._log(f"CSV 열기: {self.last_scraper_csv_path}")
            return

        self._log("최근 CSV가 없어 exports 폴더를 엽니다.")
        self._open_exports_folder()

    def _open_exports_folder(self):
        os.makedirs(EXPORTS_DIR, exist_ok=True)
        if self._open_local_path(EXPORTS_DIR):
            self._log(f"내보내기 폴더 열기: {EXPORTS_DIR}")

    # ── 종료 ──
    def _on_close(self):
        self.running = False
        try:
            self.web_agent_stop_event.set()
        except Exception:
            pass
        driver = getattr(self, "driver", None)
        if driver:
            try:
                driver.quit()
            except Exception:
                pass
        self.root.destroy()

    # ── 실행 ──
    def run(self):
        self.root.mainloop()


class HeadlessNaverBlogAgent(HeadlessAgentMixin, NaverBlogApp):
    def __init__(self, app_mode=None):
        self.app_mode = self._normalize_app_mode(app_mode or os.environ.get("APP_MODE", "all"))
        self.mode_config = self.MODE_CONFIG[self.app_mode]
        self._init_headless_agent(
            settings_loader=load_settings,
            settings_saver=save_settings,
            local_settings_saver=save_local_security_settings,
            settings_recoverer=recover_missing_settings_secrets,
            default_ai_model=_DEFAULT_AI_MODEL,
            normalizer=_normalize_ai_model,
            api_key_guide_url=API_KEY_GUIDE_URL,
        )


def _parse_runtime_args(argv=None):
    parser = argparse.ArgumentParser(description="AIMAX Local Agent")
    parser.add_argument("--agent", action="store_true", help="화면 없는 Local Agent 모드로 실행")
    parser.add_argument("--legacy-ui", action="store_true", help="기존 Tkinter UI를 실행")
    parser.add_argument("--connect", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--status", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--open-settings", dest="open_settings", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--open_settings", dest="open_settings", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--diagnostics-probe", metavar="PATH", help=argparse.SUPPRESS)
    parser.add_argument("--repair-local-state", metavar="PATH", help=argparse.SUPPRESS)
    parser.add_argument("--repair-local-state-dry-run", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--repair-local-state-stale-seconds", type=int, default=3600, help=argparse.SUPPRESS)
    args, _unknown = parser.parse_known_args(argv)
    return args


def _run_local_state_repair(args):
    output_path = getattr(args, "repair_local_state", None)
    if not output_path:
        return False
    from local_agent.state_repair import quarantine_local_state_conflicts

    result = quarantine_local_state_conflicts(
        dry_run=bool(getattr(args, "repair_local_state_dry_run", False)),
        stale_seconds=max(0, int(getattr(args, "repair_local_state_stale_seconds", 3600) or 3600)),
    )
    output_path = os.path.abspath(output_path)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    return True


def _run_diagnostics_probe(args):
    output_path = getattr(args, "diagnostics_probe", None)
    if not output_path:
        return False
    from diagnostics.error_reporter import build_error_report

    report = build_error_report(
        work_context="runtime diagnostics probe",
        visible_error="diagnostics probe",
        user_note="",
        console_log="diagnostics probe",
        source="diagnostics_probe",
    )
    try:
        from content.ai_text import generate_blog_content, measure_visible_char_count

        report["ai_text_import_smoke"] = {
            "ok": True,
            "module_file": getattr(sys.modules.get("content.ai_text"), "__file__", None),
            "has_generate_blog_content": callable(generate_blog_content),
            "has_measure_visible_char_count": callable(measure_visible_char_count),
            "sample_visible_char_count": measure_visible_char_count("AIMAX 테스트 123"),
        }
    except Exception as exc:
        report["ai_text_import_smoke"] = {
            "ok": False,
            "error": f"{type(exc).__name__}: {exc}",
        }
    try:
        import tempfile
        from pathlib import Path

        from openpyxl import Workbook
        from bulk.excel_loader import load_bulk_rows

        with tempfile.TemporaryDirectory(prefix="aimax-excel-probe-") as temp_dir:
            excel_path = Path(temp_dir) / "bulk.xlsx"
            workbook = Workbook()
            sheet = workbook.active
            sheet.append(["아이디", "비밀번호", "핵심키워드"])
            sheet.append(["probe_id", "probe_pw", "AIMAX 진단"])
            workbook.save(excel_path)
            workbook.close()
            rows = load_bulk_rows(excel_path)
        report["excel_loader_import_smoke"] = {
            "ok": rows == [{"account_id": "probe_id", "account_pw": "probe_pw", "keyword": "AIMAX 진단"}],
            "row_count": len(rows),
        }
    except Exception as exc:
        report["excel_loader_import_smoke"] = {
            "ok": False,
            "error": f"{type(exc).__name__}: {exc}",
        }
    output_path = os.path.abspath(output_path)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    return True


if __name__ == "__main__":
    import multiprocessing

    multiprocessing.freeze_support()
    args = _parse_runtime_args()
    if _run_local_state_repair(args):
        sys.exit(0)
    if _run_diagnostics_probe(args):
        sys.exit(0)
    app = HeadlessNaverBlogAgent() if agent_mode_requested(args) else NaverBlogApp()
    if _EARLY_AGENT_LOCK is not None and agent_mode_requested(args):
        app._single_instance_lock = _EARLY_AGENT_LOCK
    app.run()
