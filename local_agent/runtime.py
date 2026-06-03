"""Headless runtime adapter for the AIMAX Local Agent.

The existing automation workers still live on the Tkinter app class. This
adapter provides just enough non-UI state for those methods to run while the
normal product entrypoint stays invisible.
"""
from __future__ import annotations

import os
import sys
import threading
import time
from queue import Empty, Queue
from typing import Any, Callable


class HeadlessVar:
    """Small stand-in for Tk variables used by existing worker methods."""

    def __init__(self, value: Any = ""):
        self.value = value

    def get(self) -> Any:
        return self.value

    def set(self, value: Any) -> None:
        self.value = value


def env_truthy(name: str) -> bool:
    value = os.environ.get(name, "")
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


_PLACEHOLDER_SECRET_VALUES = {
    "",
    "your_gemini_api_key",
    "your_claude_api_key",
    "your_openai_api_key",
    "your_apify_api_token",
    "your_api_key_here",
    "your_api_key",
    "changeme",
    "change_me",
}


def _has_real_local_secret(value: Any) -> bool:
    value = str(value or "").strip()
    return bool(value) and value.lower() not in _PLACEHOLDER_SECRET_VALUES


def agent_mode_requested(args: Any | None = None) -> bool:
    if getattr(args, "legacy_ui", False) or env_truthy("AIMAX_LEGACY_UI"):
        return False
    if any(bool(getattr(args, name, False)) for name in ("connect", "status", "open_settings")):
        return True
    if bool(getattr(args, "agent", False)) or env_truthy("AIMAX_AGENT_MODE"):
        return True
    return bool(getattr(sys, "frozen", False)) or "__compiled__" in globals()


def agent_start_request_kind() -> str:
    joined = " ".join(str(item) for item in sys.argv[1:]).lower()
    if "open_settings" in joined or "open-settings" in joined or "settings" in joined:
        return "open_settings"
    if "status" in joined:
        return "status"
    if "connect" in joined:
        return "connect"
    return ""


class HeadlessAgentMixin:
    """Mixin layered before NaverBlogApp to avoid creating any Tk window."""

    def _init_headless_agent(
        self,
        *,
        settings_loader: Callable[[], tuple[Any, ...]],
        settings_saver: Callable[..., Any] | None = None,
        local_settings_saver: Callable[..., Any] | None = None,
        settings_recoverer: Callable[[dict[str, str]], dict[str, str]] | None = None,
        default_ai_model: str,
        normalizer: Callable[[str], str] | None = None,
        api_key_guide_url: str = "",
    ) -> None:
        self._headless_settings_loader = settings_loader
        self._headless_settings_saver = settings_saver
        self._headless_local_settings_saver = local_settings_saver
        self._headless_settings_recoverer = settings_recoverer
        self._headless_default_ai_model = default_ai_model
        self._headless_ai_model_normalizer = normalizer
        self._headless_api_key_guide_url = api_key_guide_url
        loaded = tuple(settings_loader())
        if len(loaded) >= 7:
            naver_id, naver_pw, api_key, ai_model, claude_key, openai_key, apify_key = loaded[:7]
        elif len(loaded) >= 6:
            naver_id, naver_pw, api_key, ai_model, claude_key, openai_key = loaded[:6]
            apify_key = ""
        else:
            naver_id, naver_pw, api_key, ai_model, claude_key = loaded[:5]
            openai_key = ""
            apify_key = ""
        if normalizer:
            ai_model = normalizer(ai_model or default_ai_model)

        self.queue = Queue()
        self.running = False
        self.worker_thread = None
        self.driver = None
        self.stop_event = threading.Event()

        self.naver_id_var = HeadlessVar(naver_id)
        self.naver_pw_var = HeadlessVar(naver_pw)
        self.api_key_var = HeadlessVar(api_key)
        self.ai_model_var = HeadlessVar(ai_model or default_ai_model)
        self.claude_key_var = HeadlessVar(claude_key)
        self.openai_key_var = HeadlessVar(openai_key)
        self.apify_key_var = HeadlessVar(apify_key)
        self.web_email_var = HeadlessVar("")
        self.web_password_var = HeadlessVar("")
        self.web_status_var = HeadlessVar("웹앱 연결 안 됨")

        self.last_scraper_csv_path = ""
        self.web_agent_client = None
        self.web_agent_thread = None
        self.web_agent_stop_event = threading.Event()
        self.web_agent_active_job_id = None
        self.web_agent_active_job_claimed_at = 0.0
        self.web_agent_active_job_kind = ""
        self.web_agent_active_job_stage = ""
        self.web_agent_active_job_latest_stage_error = ""
        self._shown_update_popup_keys = set()
        self._headless_last_status = ""
        self._headless_tk_root = None
        self._single_instance_request_mtime_ns = 0

        try:
            self._load_web_agent_state()
        except Exception:
            pass

    def run(self) -> None:
        self._setup_logging()
        if not getattr(self, "_single_instance_lock", None):
            try:
                from local_agent.single_instance import SingleInstanceError, acquire_single_instance_lock

                self._single_instance_lock = acquire_single_instance_lock()
            except SingleInstanceError as error:
                self._log(f"[중복 실행] {error}")
                try:
                    from local_agent.single_instance import signal_existing_instance

                    signal_existing_instance("connect")
                    self._log("[중복 실행] 기존 실행기에 연결 창 표시 요청을 보냈습니다.")
                except Exception as signal_error:
                    self._log(f"[중복 실행] 기존 실행기 알림 실패: {signal_error}")
                self._process_headless_queue()
                return
            except Exception as error:
                self._log(f"[경고] 중복 실행 잠금을 확인하지 못했습니다: {error}")
        self._log("AIMAX Local Agent headless mode started.")
        self._reset_single_instance_request_cursor()
        self._restore_web_agent_session()
        startup_request = agent_start_request_kind()
        if startup_request == "open_settings":
            self._handle_agent_open_settings_request()
        elif startup_request in {"connect", "status"}:
            self._handle_agent_connect_request()
        elif not self.web_agent_client:
            if self._should_open_first_run_connection_dialog():
                login_result = self._open_first_run_connection_dialog()
                self._complete_first_run_connection(login_result)
            else:
                self._log("[웹앱 연결] 저장된 웹앱 세션이 없습니다. 웹앱에서 연결/페어링이 필요합니다.")

        once = env_truthy("AIMAX_AGENT_ONCE")
        once_seconds = float(os.environ.get("AIMAX_AGENT_ONCE_SECONDS", "2") or "2")
        started_at = time.monotonic()
        try:
            while not self.web_agent_stop_event.is_set():
                self._process_headless_queue()
                self._process_single_instance_requests()
                if once and time.monotonic() - started_at >= once_seconds:
                    break
                time.sleep(0.1)
        except KeyboardInterrupt:
            self._log("AIMAX Local Agent stopping.")
        finally:
            self._stop_headless_agent()
            lock = getattr(self, "_single_instance_lock", None)
            if lock:
                try:
                    lock.release()
                except Exception:
                    pass
            self._process_headless_queue()

    def _should_open_first_run_connection_dialog(self) -> bool:
        if env_truthy("AIMAX_AGENT_NO_CONNECT_DIALOG") or env_truthy("AIMAX_AGENT_ONCE"):
            return False
        if bool(getattr(sys, "frozen", False)) or "__compiled__" in globals():
            return True
        return env_truthy("AIMAX_AGENT_CONNECT_ON_START")

    def _get_headless_tk_root(self):
        import tkinter as tk

        root = getattr(self, "_headless_tk_root", None)
        if root is not None:
            try:
                if root.winfo_exists():
                    return root
            except tk.TclError:
                self._headless_tk_root = None

        root = tk.Tk()
        root.withdraw()
        root.title("AIMAX Local Agent")
        self._headless_tk_root = root
        return root

    def _destroy_headless_tk_root(self) -> None:
        root = getattr(self, "_headless_tk_root", None)
        if not root:
            return
        self._headless_tk_root = None
        try:
            root.destroy()
        except Exception:
            pass

    def _center_headless_window(self, window) -> None:
        window.update_idletasks()
        x = max(0, (window.winfo_screenwidth() - window.winfo_width()) // 2)
        y = max(0, (window.winfo_screenheight() - window.winfo_height()) // 3)
        window.geometry(f"+{x}+{y}")

    def _focus_headless_window(self, window) -> None:
        try:
            window.deiconify()
            window.lift()
            window.focus_force()
            window.attributes("-topmost", True)
            window.after(250, lambda: window.attributes("-topmost", False))
        except Exception:
            pass

    def _wait_for_headless_window(self, root, window) -> None:
        try:
            window.grab_set()
        except Exception:
            pass
        root.wait_window(window)

    def _reset_single_instance_request_cursor(self) -> None:
        try:
            from local_agent.single_instance import latest_request

            latest = latest_request()
            self._single_instance_request_mtime_ns = latest[0] if latest else 0
        except Exception:
            self._single_instance_request_mtime_ns = 0

    def _process_single_instance_requests(self) -> None:
        try:
            from local_agent.single_instance import latest_request

            latest = latest_request()
        except Exception as error:
            self._log(f"[웹앱 연결] 중복 실행 요청 확인 실패: {error}")
            return
        if not latest:
            return
        mtime_ns, request = latest
        if mtime_ns <= getattr(self, "_single_instance_request_mtime_ns", 0):
            return
        self._single_instance_request_mtime_ns = mtime_ns
        kind = str(request.get("kind") or "")
        if kind == "connect":
            self._handle_agent_connect_request()
        elif kind == "status":
            self._handle_agent_connect_request()
        elif kind == "open_settings":
            self._handle_agent_open_settings_request()

    def _complete_first_run_connection(self, login_result: dict[str, Any]) -> None:
        if login_result.get("ready") and login_result.get("client"):
            client = login_result["client"]
            self.web_agent_client = client
            self._start_web_agent_polling(client)
            try:
                self._send_immediate_web_agent_heartbeat("first_run_login")
                self._log("[웹앱 연결] 폴링과 연결 상태를 먼저 웹앱에 반영했습니다. 로컬 보안 설정을 이어서 확인합니다.")
            except Exception as heartbeat_error:
                self._log(f"[웹앱 연결] 첫 연결 상태 즉시 반영 실패: {heartbeat_error}")
            try:
                self._open_headless_settings_dialog()
            except Exception as settings_error:
                self._log(f"[웹앱 연결] 로컬 보안 설정 창을 열 수 없습니다: {settings_error}")
        elif login_result.get("stored"):
            self._log("[웹앱 연결] 웹앱 세션은 저장했지만 작업 실행 권한 확인이 필요합니다.")
        elif login_result.get("login_succeeded"):
            self._log("[웹앱 연결] 로그인은 성공했지만 작업 실행 권한 또는 안전 저장소 상태 확인이 필요합니다.")
        else:
            self._log("[웹앱 연결] 저장된 웹앱 세션이 없습니다. 웹앱 연결 창이 취소되었습니다.")

    def _handle_agent_connect_request(self) -> None:
        self._log("[웹앱 연결] 실행기 연결 요청을 받았습니다.")
        if self.web_agent_client:
            try:
                self._send_immediate_web_agent_heartbeat("protocol_connect")
            except Exception:
                pass
            self._open_headless_status_dialog()
            return
        login_result = self._open_first_run_connection_dialog()
        self._complete_first_run_connection(login_result)

    def _handle_agent_open_settings_request(self) -> None:
        self._log("[웹앱 연결] 로컬 설정 열기 요청을 받았습니다.")
        if self.web_agent_client:
            try:
                self._send_immediate_web_agent_heartbeat("protocol_open_settings")
            except Exception:
                pass
            try:
                self._open_headless_settings_dialog()
            except Exception as error:
                self._log(f"[웹앱 연결] 로컬 보안 설정 창을 열 수 없습니다: {error}")
            return
        login_result = self._open_first_run_connection_dialog()
        self._complete_first_run_connection(login_result)

    def _open_headless_status_dialog(self) -> None:
        import tkinter as tk
        from tkinter import ttk

        root = self._get_headless_tk_root()
        dialog = tk.Toplevel(root)
        dialog.title("AIMAX 실행기 연결됨")
        dialog.geometry("430x210")
        dialog.resizable(False, False)
        dialog.configure(bg="#f7f7f5")

        result = {"open_settings": False}
        frame = ttk.Frame(dialog, padding=22)
        frame.pack(fill="both", expand=True)
        ttk.Label(frame, text="AIMAX 실행기가 연결되어 있습니다.", font=("", 15, "bold")).pack(anchor="w")
        ttk.Label(
            frame,
            text="웹앱 작업을 받을 준비가 되어 있습니다. 로컬 보안 설정을 확인하려면 아래 버튼을 눌러주세요.",
            wraplength=370,
            foreground="#555555",
        ).pack(anchor="w", pady=(10, 18))

        buttons = ttk.Frame(frame)
        buttons.pack(anchor="e", fill="x")

        def _open_settings() -> None:
            result["open_settings"] = True
            dialog.destroy()

        ttk.Button(buttons, text="닫기", command=dialog.destroy).pack(side="right", padx=(8, 0))
        ttk.Button(buttons, text="로컬 보안 설정 열기", command=_open_settings).pack(side="right")

        dialog.protocol("WM_DELETE_WINDOW", dialog.destroy)
        self._center_headless_window(dialog)
        self._focus_headless_window(dialog)
        self._wait_for_headless_window(root, dialog)
        if result["open_settings"]:
            try:
                self._open_headless_settings_dialog()
            except Exception as error:
                self._log(f"[웹앱 연결] 로컬 보안 설정 창을 열 수 없습니다: {error}")

    def _open_first_run_connection_dialog(self) -> dict[str, Any]:
        import tkinter as tk
        from tkinter import ttk

        try:
            from web_agent.client import PASSWORD_INPUT_HINT, load_state

            state = load_state()
        except Exception:
            state = {}
            PASSWORD_INPUT_HINT = "비밀번호는 영문 입력 상태에서 입력해주세요. 한글로 입력된 값은 사용할 수 없습니다."

        result: dict[str, Any] = {"stored": False, "ready": False, "client": None, "login_succeeded": False}
        root = self._get_headless_tk_root()
        dialog = tk.Toplevel(root)
        dialog.title("AIMAX 웹앱 연결")
        dialog.geometry("460x340")
        dialog.resizable(False, False)
        dialog.configure(bg="#f7f7f5")

        frame = ttk.Frame(dialog, padding=22)
        frame.pack(fill="both", expand=True)
        frame.columnconfigure(1, weight=1)

        ttk.Label(frame, text="AIMAX 웹앱 연결", font=("", 16, "bold")).grid(
            row=0, column=0, columnspan=2, sticky="w", pady=(0, 8)
        )
        ttk.Label(
            frame,
            text="웹앱 계정으로 로그인하면 이 PC의 안전 저장소에 실행기 세션만 저장합니다.",
            wraplength=400,
            foreground="#555555",
        ).grid(row=1, column=0, columnspan=2, sticky="w", pady=(0, 16))

        email_var = tk.StringVar(master=root, value=getattr(self, "web_email_var", HeadlessVar("")).get() or state.get("email", ""))
        password_var = tk.StringVar(master=root, value="")
        status_var = tk.StringVar(master=root, value="")

        ttk.Label(frame, text="웹앱 이메일").grid(row=2, column=0, sticky="w", padx=(0, 12), pady=6)
        email_entry = ttk.Entry(frame, textvariable=email_var)
        email_entry.grid(row=2, column=1, sticky="ew", pady=6)

        ttk.Label(frame, text="웹앱 비밀번호").grid(row=3, column=0, sticky="w", padx=(0, 12), pady=6)
        password_entry = ttk.Entry(frame, textvariable=password_var, show="*")
        password_entry.grid(row=3, column=1, sticky="ew", pady=6)

        password_hint = ttk.Label(
            frame,
            text=PASSWORD_INPUT_HINT,
            wraplength=400,
            foreground="#666666",
        )
        password_hint.grid(row=4, column=0, columnspan=2, sticky="w", pady=(4, 0))

        status_label = ttk.Label(frame, textvariable=status_var, wraplength=400, foreground="#555555")
        status_label.grid(row=5, column=0, columnspan=2, sticky="w", pady=(10, 0))

        buttons = ttk.Frame(frame)
        buttons.grid(row=6, column=0, columnspan=2, sticky="e", pady=(22, 0))

        def _cancel() -> None:
            dialog.destroy()

        def _connect() -> None:
            email = email_var.get().strip().lower()
            raw_password = password_var.get()
            password = raw_password.strip()
            if not email:
                status_var.set("이메일과 비밀번호를 입력해주세요.")
                status_label.configure(foreground="#C0392B")
                return
            try:
                from web_agent.client import password_input_error

                password_error = password_input_error(raw_password)
            except Exception:
                password_error = ""
            if password_error:
                password_var.set("")
                status_var.set(password_error)
                status_label.configure(foreground="#C0392B")
                password_entry.focus_set()
                return

            connect_btn.configure(state="disabled")
            status_var.set("웹앱 로그인 중...")
            status_label.configure(foreground="#555555")
            dialog.update_idletasks()
            try:
                from web_agent.client import (
                    AimaxWebAgentClient,
                    default_device_label,
                    friendly_error_message,
                    save_session_token,
                    save_state,
                )

                client = AimaxWebAgentClient(base_url=state.get("base_url"), session_token="")
                login_data = client.login(email=email, password=password, device_label=default_device_label())
                token = str(login_data.get("session_token") or "")
                if not token:
                    raise RuntimeError("로그인은 성공했지만 세션 토큰이 없습니다.")
                token_stored = save_session_token(token)

                save_state(email=email, base_url=client.base_url, device_label=default_device_label())
                self.web_email_var.set(email)
                self.web_password_var.set("")
                result["stored"] = token_stored
                result["login_succeeded"] = True
                result["client"] = client
                if login_data.get("requires_password_change") or not login_data.get("can_execute"):
                    result["ready"] = False
                    self._set_web_agent_status(
                        "첫 로그인 비밀번호 변경이 필요합니다. 웹앱에서 변경 후 다시 연결해주세요.",
                        "#C0392B",
                    )
                else:
                    result["ready"] = True
                    if token_stored:
                        self._set_web_agent_status("웹앱 로그인 성공. 로컬 보안 설정을 확인합니다.", "#198754")
                    else:
                        self._set_web_agent_status(
                            "웹앱 로그인 성공. 다만 이 PC의 안전 저장소에 세션을 저장하지 못해 재시작 후 다시 로그인해야 할 수 있습니다.",
                            "#C77C02",
                        )
                dialog.destroy()
            except Exception as error:
                try:
                    message = friendly_error_message(error)
                except Exception:
                    message = str(error)
                status_var.set(f"로그인 실패: {message}")
                status_label.configure(foreground="#C0392B")
                connect_btn.configure(state="normal")

        def _password_focus(_event=None) -> None:
            status_var.set(PASSWORD_INPUT_HINT)
            status_label.configure(foreground="#555555")

        password_entry.bind("<FocusIn>", _password_focus)

        ttk.Button(buttons, text="취소", command=_cancel).pack(side="right", padx=(8, 0))
        connect_btn = ttk.Button(buttons, text="연결", command=_connect)
        connect_btn.pack(side="right")

        dialog.protocol("WM_DELETE_WINDOW", _cancel)
        self._center_headless_window(dialog)
        if email_var.get():
            password_entry.focus_set()
        else:
            email_entry.focus_set()
        self._focus_headless_window(dialog)
        self._wait_for_headless_window(root, dialog)
        return result

    def _headless_print(self, value: Any) -> None:
        text = str(value)
        try:
            print(text, flush=True)
        except UnicodeEncodeError:
            encoding = getattr(sys.stdout, "encoding", None) or "utf-8"
            safe_text = text.encode(encoding, errors="replace").decode(encoding, errors="replace")
            print(safe_text, flush=True)

    def _process_headless_queue(self) -> None:
        try:
            while True:
                msg_type, msg_data = self.queue.get_nowait()
                if msg_type == "log":
                    self._headless_print(msg_data)
                elif msg_type == "progress":
                    self._headless_print(f"[진행률] {msg_data}%")
                elif msg_type == "done":
                    self._on_worker_done()
                elif msg_type == "popup":
                    try:
                        _stage, title, body, _next_stage = msg_data
                        self._headless_print(f"[완료] {title}: {body}")
                    except Exception:
                        self._headless_print(f"[완료] {msg_data}")
                elif msg_type == "web_agent_status":
                    self._set_web_agent_status(*msg_data)
                elif msg_type == "web_agent_update_popup":
                    try:
                        self._show_update_popup(msg_data)
                    except Exception as error:
                        self._headless_print(f"[업데이트 팝업 오류] {error}")
                        self._headless_print("[업데이트] 새 실행기 버전이 있습니다. 웹앱에서 업데이트 파일을 내려받아 설치해주세요.")
                elif msg_type == "web_agent_controls":
                    continue
                elif msg_type == "web_agent_clear_password":
                    self.web_password_var.set("")
                elif msg_type == "web_agent_command":
                    self._handle_web_agent_command(msg_data)
                elif msg_type == "remote_job":
                    try:
                        self._start_remote_job(msg_data)
                    except Exception as error:
                        if hasattr(self, "_fail_remote_job_dispatch"):
                            self._fail_remote_job_dispatch(msg_data, error)
                        else:
                            raise
                elif msg_type == "ai_ment_done":
                    self._headless_print("[AI 멘트] headless mode에서는 화면 반영을 건너뜁니다.")
                elif msg_type == "ai_ment_error":
                    self._headless_print(f"[AI 멘트] 생성 오류: {msg_data}")
        except Empty:
            pass

    def _stop_headless_agent(self) -> None:
        self.running = False
        self.web_agent_stop_event.set()
        if hasattr(self, "_reset_web_agent_active_job"):
            self._reset_web_agent_active_job()
        else:
            self.web_agent_active_job_id = None
            self.web_agent_active_job_claimed_at = 0.0
            self.web_agent_active_job_kind = ""
            self.web_agent_active_job_stage = ""
            self.web_agent_active_job_latest_stage_error = ""
        if self.driver:
            try:
                self.driver.quit()
            except Exception:
                pass
            self.driver = None
        self._destroy_headless_tk_root()

    def _log(self, msg: str) -> None:
        self.queue.put(("log", str(msg)))

    def _set_web_agent_status(self, text: str, color: str | None = None) -> None:
        self.web_status_var.set(text)
        if text != self._headless_last_status:
            self._headless_last_status = text
            self._log(f"[웹앱 연결] {text}")

    def _start_worker(self, target: Callable[..., Any], **kwargs: Any) -> bool:
        if self.running:
            self._log("이미 실행 중입니다.")
            return False
        self.stop_event.clear()
        self.running = True
        self.worker_thread = threading.Thread(target=target, kwargs=kwargs, daemon=True)
        self.worker_thread.start()
        return True

    def _on_worker_done(self) -> None:
        self.running = False
        self.driver = None

    def _set_buttons_running(self, is_running: bool) -> None:
        return

    def _local_provider_secret_values(self) -> dict[str, str]:
        return {
            "gemini": str(self.api_key_var.get() or "").strip(),
            "apify": str(self.apify_key_var.get() or "").strip(),
            "openai": str(self.openai_key_var.get() or "").strip(),
            "claude": str(self.claude_key_var.get() or "").strip(),
        }

    def _import_local_provider_secrets(self, client: Any, command: dict[str, Any]) -> tuple[dict[str, Any], str]:
        allowed = ("gemini", "apify", "openai", "claude")
        payload = command.get("payload") if isinstance(command.get("payload"), dict) else {}
        requested = payload.get("providers") if isinstance(payload.get("providers"), list) else allowed
        providers: list[str] = []
        for provider in requested:
            provider = str(provider or "").strip().lower()
            if provider in allowed and provider not in providers:
                providers.append(provider)
        if not providers:
            providers = list(allowed)

        local_values = self._local_provider_secret_values()
        result: dict[str, Any] = {"type": "local_provider_secret_import", "providers": {}}
        for provider in providers:
            value = local_values.get(provider, "")
            if not _has_real_local_secret(value):
                result["providers"][provider] = {"status": "missing"}
                continue
            try:
                client.put_user_secret(provider, value)
                result["providers"][provider] = {"status": "imported"}
            except Exception as error:
                result["providers"][provider] = {
                    "status": "failed",
                    "error": str(error)[:160],
                }

        statuses = [item.get("status") for item in result["providers"].values()]
        imported_count = statuses.count("imported")
        missing_count = statuses.count("missing")
        failed_count = statuses.count("failed")
        result["imported_count"] = imported_count
        result["missing_count"] = missing_count
        result["failed_count"] = failed_count
        result["requested_count"] = len(providers)
        log = f"AI/API 키 가져오기 완료: {imported_count}개 저장, {missing_count}개 없음, {failed_count}개 실패"
        return result, log

    def _handle_web_agent_command(self, data: dict[str, Any]) -> None:
        client = data.get("client")
        command = data.get("command") or {}
        command_id = command.get("id") or ""
        command_type = command.get("type") or ""

        def _send_command_update(status: str, log: str, result: dict[str, Any] | None = None) -> None:
            if not client or not command_id:
                return

            def _worker() -> None:
                try:
                    client.update_command(command_id, status, log, result=result)
                except Exception as update_error:
                    self.queue.put(("log", f"[웹앱 연결] 명령 상태 전송 오류: {update_error}"))

            threading.Thread(target=_worker, daemon=True).start()

        if command_type == "import_local_provider_secrets":
            result, log = self._import_local_provider_secrets(client, command)
            self._log(f"[웹앱 연결] {log}")
            _send_command_update("done", log, result)
            return

        if command_type == "songi_youtube_discovery":
            self._log("[송이] YouTube 키워드 후보 찾기를 시작합니다.")

            def _discovery_worker() -> None:
                try:
                    result, log = self._songi_youtube_discovery(command)
                    self.queue.put(("log", f"[송이] {log}"))
                    _send_command_update("done", log, result)
                except Exception as error:
                    message = str(error) or "YouTube 후보 찾기에 실패했습니다."
                    payload = command.get("payload") if isinstance(command.get("payload"), dict) else {}
                    self.queue.put(("log", f"[송이] YouTube 후보 찾기 실패: {message}"))
                    _send_command_update("failed", message, {
                        "ok": False,
                        "run_id": payload.get("run_id") or "",
                        "error": "local_ytdlp_discovery_failed",
                        "message": message,
                    })

            threading.Thread(target=_discovery_worker, daemon=True).start()
            return

        if command_type != "open_settings":
            message = f"지원하지 않는 웹앱 명령입니다: {command_type}"
            self._log(f"[웹앱 연결] 명령 처리 불가: {message}")
            _send_command_update("failed", message)
            return

        try:
            saved = self._open_headless_settings_dialog()
        except Exception as error:
            message = (
                "로컬 설정 창을 열지 못했습니다. 실행기를 완전히 종료한 뒤 다시 실행하거나 "
                f"최신 설치 파일로 업데이트해주세요. 원인: {error}"
            )
            self._log(f"[웹앱 연결] 명령 처리 실패: {message}")
            _send_command_update("failed", message)
            return

        if saved:
            message = "로컬 보안 설정을 이 PC에 저장했습니다."
            self._log(f"[웹앱 연결] {message}")
            _send_command_update("done", message)
        else:
            message = "로컬 보안 설정 저장을 취소했습니다."
            self._log(f"[웹앱 연결] {message}")
            _send_command_update("failed", message)

    def _open_headless_settings_dialog(self) -> bool:
        saver = getattr(self, "_headless_settings_saver", None)
        if not saver:
            raise RuntimeError("settings saver가 설정되어 있지 않습니다")

        import tkinter as tk
        import webbrowser
        from tkinter import ttk

        result = {"saved": False}
        root = self._get_headless_tk_root()
        dialog = tk.Toplevel(root)
        dialog.title("AIMAX 로컬 보안 설정")
        screen_width = root.winfo_screenwidth()
        screen_height = root.winfo_screenheight()
        width = min(760, max(560, screen_width - 80))
        height = min(680, max(520, screen_height - 120))
        dialog.geometry(f"{width}x{height}")
        dialog.minsize(560, 500)
        dialog.resizable(True, True)
        dialog.configure(bg="#f7f7f5")

        outer = ttk.Frame(dialog, padding=22)
        outer.pack(fill="both", expand=True)
        outer.columnconfigure(0, weight=1)
        outer.rowconfigure(2, weight=1)

        title = ttk.Label(outer, text="AIMAX 로컬 보안 설정", font=("", 16, "bold"))
        title.grid(row=0, column=0, columnspan=2, sticky="w", pady=(0, 8))
        desc = ttk.Label(
            outer,
            text=(
                "네이버 계정과 브라우저 세션만 이 PC에 저장합니다. "
                "Gemini, Claude, OpenAI, Apify 키는 웹 설정 탭의 AI/API 연결에서 관리합니다."
            ),
            wraplength=680,
            foreground="#555555",
        )
        desc.grid(row=1, column=0, columnspan=2, sticky="w", pady=(0, 16))

        canvas = tk.Canvas(outer, highlightthickness=0, bg="#f7f7f5")
        scrollbar = ttk.Scrollbar(outer, orient="vertical", command=canvas.yview)
        frame = ttk.Frame(canvas)
        window_id = canvas.create_window((0, 0), window=frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.grid(row=2, column=0, sticky="nsew")
        scrollbar.grid(row=2, column=1, sticky="ns")
        frame.columnconfigure(1, weight=1)

        def _sync_scroll_region(_event=None) -> None:
            canvas.configure(scrollregion=canvas.bbox("all"))

        def _sync_canvas_width(event) -> None:
            canvas.itemconfigure(window_id, width=event.width)

        frame.bind("<Configure>", _sync_scroll_region)
        canvas.bind("<Configure>", _sync_canvas_width)

        entries: dict[str, Any] = {}
        initial_values = {
            "naver_id": self.naver_id_var.get() or "",
            "naver_pw": self.naver_pw_var.get() or "",
        }
        local_provider_count = sum(
            1 for value in self._local_provider_secret_values().values() if _has_real_local_secret(value)
        )
        if local_provider_count:
            status_message = (
                "이 PC에 저장된 기존 AI/API 키는 삭제하지 않고 유지합니다. "
                "웹 설정의 '기존 실행기 키 가져오기'로 웹 보안 저장소에 옮길 수 있습니다."
            )
        else:
            status_message = (
                "AI/API 키는 여기서 입력하지 않습니다. "
                "송이와 웹 기반 AI 작업은 웹 설정 탭의 AI/API 연결에서 저장해주세요."
            )
        fields = [
            ("네이버 ID", "naver_id", False),
            ("네이버 비밀번호", "naver_pw", True),
        ]
        row = 0
        for label, key, secret in fields:
            ttk.Label(frame, text=label).grid(row=row, column=0, sticky="w", padx=(0, 12), pady=6)
            entry = ttk.Entry(frame, show="*" if secret else "")
            entry.insert(0, str(initial_values.get(key) or ""))
            entry.grid(row=row, column=1, sticky="ew", pady=6)
            entries[key] = entry
            row += 1

        help_text = ttk.Label(
            frame,
            text=(
                "블로그팀 자동화에 필요한 네이버 로그인 정보만 이 창에서 저장합니다. "
                "AI/API 키를 새로 발급하거나 저장하려면 웹의 AI/API 연결 화면을 사용해주세요."
            ),
            wraplength=680,
            foreground="#666666",
        )
        help_text.grid(row=row, column=0, columnspan=2, sticky="w", pady=(12, 10))
        row += 1

        status = ttk.Label(frame, text=status_message, wraplength=680, foreground="#666666")
        status.grid(row=row, column=0, columnspan=2, sticky="w", pady=(0, 10))
        row += 1

        def _set_status(message: str) -> None:
            status.configure(text=message)

        if "naver_pw" in entries:
            entries["naver_pw"].bind(
                "<FocusIn>",
                lambda _event: _set_status("비밀번호 입력 전 한/영 상태가 영어인지 확인해주세요. 한글로 입력되면 로그인에 실패할 수 있습니다."),
            )

        buttons = ttk.Frame(outer)
        buttons.grid(row=3, column=0, columnspan=2, sticky="ew", pady=(14, 0))

        def _cancel() -> None:
            dialog.destroy()

        def _save() -> None:
            try:
                if str(save_button.cget("state")) == "disabled":
                    return
            except Exception:
                pass
            normalizer = getattr(self, "_headless_ai_model_normalizer", None)
            ai_model = self.ai_model_var.get() or getattr(self, "_headless_default_ai_model", "")
            if normalizer:
                ai_model = normalizer(ai_model)
            naver_id = entries["naver_id"].get().strip()
            naver_pw = entries["naver_pw"].get().strip()
            _set_status("로컬 보안 설정을 저장하는 중입니다...")
            save_button.configure(state="disabled")
            cancel_button.configure(state="disabled")
            finish_queue: Queue[str] = Queue()

            def _worker() -> None:
                error = ""
                try:
                    local_saver = getattr(self, "_headless_local_settings_saver", None)
                    if local_saver:
                        local_saver(naver_id, naver_pw, ai_model)
                    else:
                        saver(
                            naver_id,
                            naver_pw,
                            self.api_key_var.get(),
                            ai_model,
                            self.claude_key_var.get(),
                            self.openai_key_var.get(),
                            getattr(self, "apify_key_var", HeadlessVar("")).get(),
                        )
                except Exception as exc:
                    error = str(exc)
                finish_queue.put(error)

            def _poll_finish() -> None:
                try:
                    error = finish_queue.get_nowait()
                except Empty:
                    try:
                        dialog.after(50, _poll_finish)
                    except Exception:
                        pass
                    return
                if error:
                    _set_status(f"저장하지 못했습니다: {error}")
                    save_button.configure(state="normal")
                    cancel_button.configure(state="normal")
                    return
                self.naver_id_var.set(naver_id)
                self.naver_pw_var.set(naver_pw)
                self.ai_model_var.set(ai_model)
                try:
                    self._send_immediate_web_agent_heartbeat("settings_saved")
                except Exception:
                    pass
                result["saved"] = True
                dialog.destroy()

            threading.Thread(target=_worker, daemon=True).start()
            dialog.after(50, _poll_finish)

        def _open_api_guide() -> None:
            url = (getattr(self, "_headless_api_key_guide_url", "") or "").strip()
            if not url:
                _set_status("API 키 발급 가이드 주소가 아직 설정되지 않았습니다.")
                return
            try:
                webbrowser.open(url)
                _set_status("API 키 발급 가이드를 브라우저로 열었습니다.")
            except Exception as error:
                _set_status(f"API 키 발급 가이드를 열 수 없습니다: {error}")

        ttk.Button(buttons, text="AI/API 연결 안내", command=_open_api_guide).pack(side="left")
        cancel_button = ttk.Button(buttons, text="취소", command=_cancel)
        cancel_button.pack(side="right", padx=(8, 0))
        save_button = ttk.Button(buttons, text="저장", command=_save)
        save_button.pack(side="right")
        dialog.bind("<Return>", lambda _event: _save())
        dialog.bind("<Escape>", lambda _event: _cancel())

        def _recover_missing_secrets() -> None:
            recoverer = getattr(self, "_headless_settings_recoverer", None)
            if not recoverer:
                return
            snapshot = {
                "naver_pw": entries["naver_pw"].get(),
            }
            if all(str(value or "").strip() for value in snapshot.values()):
                return
            _set_status("이전 안전 저장소에 저장된 키가 있는지 확인 중입니다. 창은 그대로 사용하셔도 됩니다.")
            recover_queue: Queue[tuple[dict[str, str], str]] = Queue()

            def _worker() -> None:
                try:
                    recovered = recoverer(snapshot) or {}
                    error_message = ""
                except Exception:
                    recovered = {}
                    error_message = "이전 안전 저장소 확인 중 오류가 있었습니다. 저장된 값이 없다면 각 서비스 콘솔에서 기존 키를 확인해주세요."
                recover_queue.put((recovered, error_message))

            def _poll_recover() -> None:
                try:
                    recovered, error_message = recover_queue.get_nowait()
                except Empty:
                    try:
                        dialog.after(50, _poll_recover)
                    except Exception:
                        pass
                    return
                if error_message:
                    _set_status(error_message)
                    return
                mapping = {
                    "naver_pw": "naver_pw",
                }
                restored = 0
                for storage_key, ui_key in mapping.items():
                    value = recovered.get(storage_key)
                    entry = entries.get(ui_key)
                    if value and entry and not str(entry.get() or "").strip():
                        entry.delete(0, "end")
                        entry.insert(0, str(value))
                        restored += 1
                if restored:
                    _set_status(f"기존 안전 저장소에서 저장된 항목 {restored}개를 복원했습니다. 저장 버튼을 누르면 현재 설정으로 유지됩니다.")
                else:
                    _set_status("기존 안전 저장소에서 추가로 복원할 키를 찾지 못했습니다. 새로 발급하기 전 각 서비스 콘솔의 기존 키를 먼저 확인해주세요.")

            threading.Thread(target=_worker, daemon=True).start()
            dialog.after(50, _poll_recover)

        dialog.after(250, _recover_missing_secrets)
        dialog.protocol("WM_DELETE_WINDOW", _cancel)
        self._center_headless_window(dialog)
        self._focus_headless_window(dialog)
        self._wait_for_headless_window(root, dialog)
        return bool(result["saved"])
