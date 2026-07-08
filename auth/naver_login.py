import json
import time
import random
import platform
from urllib.parse import urlparse
import pyperclip
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from constants import NAVER_LOGIN_URL, LOGIN_BUTTON
from browser.session_manager import (
    save_session,
    load_session,
    load_session_cdp,
    has_recent_session_file,
    sync_pc_blog_login,
)
from utils.delays import wait_medium, wait_short
from utils.logger import get_logger

logger = get_logger(__name__)
_manual_login_notifier = None


def set_manual_login_notifier(fn):
    """수동 로그인 안내를 UI 로그 등으로 전달하는 콜백을 등록한다."""
    global _manual_login_notifier
    _manual_login_notifier = fn


def _notify_manual_login(message):
    if _manual_login_notifier:
        try:
            _manual_login_notifier(message)
        except Exception:
            pass


def _inject_credentials(driver, naver_id, naver_pw):
    """JS 직접 주입으로 ID/PW 설정 - 키보드 이벤트 없이 CAPTCHA 우회"""
    id_js = json.dumps(naver_id)
    pw_js = json.dumps(naver_pw)
    # input 이벤트 발화: React controlled component 환경에서 상태 동기화
    injected = driver.execute_script(f"""
        var idEl = document.getElementById('id');
        var pwEl = document.getElementById('pw');
        if (idEl) {{
            idEl.value = {id_js};
            idEl.dispatchEvent(new Event('input', {{bubbles: true}}));
        }}
        if (pwEl) {{
            pwEl.value = {pw_js};
            pwEl.dispatchEvent(new Event('input', {{bubbles: true}}));
        }}
        return idEl ? idEl.value : null;
    """)
    if not injected:
        raise RuntimeError("로그인 폼 요소(#id)를 찾을 수 없습니다. 네이버 페이지 구조가 변경되었을 수 있습니다.")
    time.sleep(random.uniform(0.8, 1.5))


def _click_login_button(driver):
    """로그인 버튼 클릭을 여러 방식으로 시도한다."""
    for selector in [LOGIN_BUTTON, "button.btn_login", "input.btn_login"]:
        try:
            button = driver.find_element(By.CSS_SELECTOR, selector)
            button.click()
            return True
        except Exception:
            try:
                button = driver.find_element(By.CSS_SELECTOR, selector)
                driver.execute_script("arguments[0].click();", button)
                return True
            except Exception:
                continue
    raise RuntimeError("로그인 버튼을 찾을 수 없습니다. 네이버 페이지 구조가 변경되었을 수 있습니다.")


def _wait_until_leave_nid(driver, timeout=10):
    """현재 URL이 NID 로그인 페이지를 벗어날 때까지 대기한다."""
    try:
        WebDriverWait(driver, timeout, poll_frequency=0.4).until(
            lambda d: "nidlogin.login" not in (d.current_url or "")
        )
        return True
    except Exception:
        return False


def _is_nid_host(url):
    host = urlparse(url or "").hostname or ""
    return host == "nid.naver.com" or host.endswith(".nid.naver.com")


def _wait_for_manual_login(driver, naver_id, timeout_seconds=180, reason=""):
    """열린 브라우저에서 사용자가 직접 로그인하기를 기다린 뒤 세션을 저장한다."""
    current_url = driver.current_url or ""
    if "nidlogin.login" not in current_url:
        driver.get(NAVER_LOGIN_URL)

    try:
        driver.execute_cdp_cmd("Page.bringToFront", {})
    except Exception:
        pass

    message = "네이버 자동 로그인이 막혔습니다. 열려 있는 브라우저 창에서 3분 안에 직접 로그인해 주세요. 로그인이 확인되면 작업이 자동으로 이어집니다."
    if reason:
        logger.info(f"{message} (원인: {reason})")
    else:
        logger.info(message)
    _notify_manual_login(message)

    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        current_url = driver.current_url or ""
        if "nidlogin.login" not in current_url and not _is_nid_host(current_url):
            if _blog_session_ready(driver, naver_id):
                save_session(driver, naver_id)
                logger.info("수동 네이버 로그인 확인 - 세션 저장 완료")
                return True
        time.sleep(2)
    logger.warning("수동 네이버 로그인 대기 시간 초과")
    return False


def _clipboard_login(driver, naver_id, naver_pw):
    """현재 열린 NID 로그인 페이지에서 실제 붙여넣기 입력으로 로그인한다."""
    mod_key = Keys.META if platform.system() == "Darwin" else Keys.CONTROL

    def _paste_into(selector, value):
        field = driver.find_element(By.CSS_SELECTOR, selector)
        field.click()
        time.sleep(random.uniform(0.2, 0.4))
        ActionChains(driver).key_down(mod_key).send_keys("a").key_up(mod_key).perform()
        time.sleep(random.uniform(0.1, 0.2))
        field.send_keys(Keys.DELETE)
        pyperclip.copy(value)
        ActionChains(driver).key_down(mod_key).send_keys("v").key_up(mod_key).perform()
        time.sleep(random.uniform(0.4, 0.8))

    _paste_into("#id", naver_id)
    _paste_into("#pw", naver_pw)
    _click_login_button(driver)


def _fresh_login(driver, naver_id, naver_pw):
    """NID 로그인 페이지에서 JS 주입 방식으로 직접 로그인 (키보드 이벤트 없음)"""
    logger.info("네이버 로그인 시작 (JS 주입 방식)...")
    driver.get(NAVER_LOGIN_URL)
    wait_medium()

    # JS로 직접 value 주입 → send_keys/clipboard 없이 CAPTCHA 우회
    _inject_credentials(driver, naver_id, naver_pw)

    # 로그인 버튼 클릭
    _click_login_button(driver)
    wait_medium()

    # 로그인 성공 여부 확인
    current_url = driver.current_url
    if "nidlogin.login" in current_url:
        page = driver.page_source
        if "captcha" in current_url.lower() or "자동입력" in page:
            raise RuntimeError("CAPTCHA가 발생했습니다. 잠시 후 다시 시도하거나 수동으로 로그인해주세요.")
        raise RuntimeError("로그인 실패: 아이디 또는 비밀번호를 확인해주세요.")

    # 세션 저장
    save_session(driver, naver_id)
    logger.info("네이버 로그인 완료")


def login_on_current_nid_page(driver, naver_id, naver_pw, wait_seconds=4):
    """현재 NID 로그인 페이지에서 직접 로그인 후 리다이렉트를 기다린다."""
    if "nidlogin.login" not in driver.current_url:
        return True

    logger.info("NID 로그인 리다이렉트 - 현재 페이지에서 직접 로그인 시도")
    original_nid_url = driver.current_url

    # 1차: JS 주입 방식
    try:
        _inject_credentials(driver, naver_id, naver_pw)
        _click_login_button(driver)
    except Exception as e:
        logger.warning(f"NID JS 로그인 시도 실패 - 붙여넣기 방식으로 전환: {e}")

    if not _wait_until_leave_nid(driver, timeout=wait_seconds):
        # 2차: 실제 붙여넣기 입력 방식
        logger.info("NID 페이지에 그대로 머묾 - 붙여넣기 방식 재시도")
        driver.get(original_nid_url)
        wait_short()
        _clipboard_login(driver, naver_id, naver_pw)

    if not _wait_until_leave_nid(driver, timeout=max(wait_seconds + 4, 8)):
        # 3차: 로그인 쿠키는 살아있는데 리다이렉트만 꼬인 경우가 있어
        # blog.naver.com 세션 동기화를 한 번 더 시도한다.
        logger.info("NID 리다이렉트 지연 - PC 블로그 세션 재동기화 시도")
        if sync_pc_blog_login(driver):
            current_url = driver.current_url
            # 방어: sync가 True를 반환해도 여전히 NID 페이지면 세션 만료
            if "nidlogin.login" in current_url:
                logger.warning("sync_pc_blog_login 우회 후에도 NID 페이지 - 세션 만료, 재로그인 필요")
            else:
                save_session(driver, naver_id)
                logger.info(f"NID 로그인 우회 성공 → {current_url[:80]}")
                return True

    current_url = driver.current_url
    if "nidlogin.login" in current_url:
        page = driver.page_source
        is_captcha = "captcha" in current_url.lower() or "자동입력" in page
        reason = "CAPTCHA 또는 자동입력 방지 화면" if is_captcha else "NID 로그인 페이지 유지"
        if _wait_for_manual_login(driver, naver_id, reason=reason):
            return True
        if is_captcha:
            # 'captcha' 키워드 보존: 서버 자동안내 분류 regex의 naver_login_required 신호
            raise RuntimeError("CAPTCHA가 발생했고 수동 로그인도 완료되지 않았습니다. NID 로그인 후에도 로그인 페이지에 머무릅니다.")
        raise RuntimeError("NID 로그인 후에도 로그인 페이지에 머무릅니다.")

    save_session(driver, naver_id)
    logger.info(f"NID 로그인 성공 → {current_url[:80]}")
    return True


def _blog_session_ready(driver, naver_id=None):
    """blog.naver.com에 접속해 로그인 상태인지 빠르게 확인한다.

    sync_pc_blog_login이 쓰는 로그아웃 마커('btn_blog_login')를 그대로 사용하므로
    cbox 댓글까지 동일한 유효성을 보장한다. 페이지 이동 1회 + page_source 읽기만 수행하며,
    키보드/JS 주입은 하지 않는다(CAPTCHA/봇 탐지 민감 구간이라 fast path에서는 읽기만).

    - 현재 호스트가 blog.naver.com / *.blog.naver.com(예: section.blog.naver.com)이고
      page_source에 'btn_blog_login'이 없으면 로그인 상태로 판단.
    - 네이버 강제 재인증으로 nid.naver.com으로 튕기면 준비 안 된 것으로 간주(여기서 로그인 시도 안 함).
    주의: 이 함수는 "로그인됨"만 판단하고 어느 계정인지는 판단하지 않는다 — 로그인된
      블로그 페이지 초기 HTML에는 계정 ID가 노출되지 않음을 실측으로 확인함(2026-07-04).
      계정 일치는 호출부(login)의 세션 파일 게이트가 담당한다.
    """
    try:
        driver.get("https://blog.naver.com")
        wait_medium()

        current_host = urlparse(driver.current_url or "").hostname or ""
        # NID 강제 재인증으로 튕긴 경우 → not-ready. 로그인은 login()의 폴백 흐름이 처리한다.
        if current_host == "nid.naver.com" or current_host.endswith(".nid.naver.com"):
            return False

        is_blog_host = (
            current_host == "blog.naver.com"
            or current_host.endswith(".blog.naver.com")
        )
        if not is_blog_host:
            return False

        # sync_pc_blog_login과 동일한 로그아웃 마커
        if "btn_blog_login" in driver.page_source:
            return False
        return True
    except Exception as e:
        logger.warning(f"블로그 세션 확인 중 오류: {e}")
        return False


def login(driver, naver_id, naver_pw):
    """네이버 로그인 (기존 세션 우선 확인 방식)

    사용자가 로그인 창 깜빡임/페이지 바운스를 겪지 않도록, 매번 전체 로그인
    시퀀스를 도는 대신 살아있는 세션을 먼저 확인한다.

    1) 빠른 경로(프로필 세션): 브라우저 영구 프로필에 세션이 살아있으면 blog.naver.com
       확인만 하고 추가 이동 없이 종료. 쿠키 파일은 건드리지 않음.
    2) 쿠키 복원(CDP): 페이지 이동 없이 쿠키 파일을 CDP로 주입 후 세션 재확인.
    3) 신규 로그인 폴백: 위 두 경로 실패 시 기존과 동일하게 직접 로그인 + PC 블로그 동기화.

    최악의 경우에도 오늘과 완전히 동일한 동작(신규 로그인 + sync)으로 degrade 된다.
    함수 시그니처와 True 반환 / 예외 발생 계약은 기존과 동일하게 유지한다.
    """
    # 1) 빠른 경로: 브라우저 프로필 세션 확인
    # 계정 게이트: 프로필은 계정을 바꿔 저장한 뒤에도 이전 계정 세션을 들고 있을 수 있다.
    # 페이지에서 계정 ID 를 읽을 수 없으므로(초기 HTML 미노출 실측), "이 계정으로 이 기기에서
    # 로그인한 이력(=계정별 세션 파일, 30일 이내)"이 있을 때만 fast path 를 허용한다.
    # 새 계정으로 바꾸면 파일이 없어 자동으로 신규 로그인 경로를 타고, 예리 글쓰기 URL 은
    # 소유자가 아니면 NID 재인증을 요구하므로 2차 방어선이 된다.
    if has_recent_session_file(naver_id) and _blog_session_ready(driver, naver_id):
        logger.info("브라우저 프로필 세션으로 로그인 확인 — 추가 이동 없이 진행 (경로: 프로필 세션)")
        save_session(driver, naver_id)
        return True

    # 2) 쿠키 복원(CDP): 페이지 이동 없이 쿠키만 주입 후 재확인
    # 주의: 복원이 실제로 이뤄졌을 때만 재확인한다 — 이 계정의 쿠키 파일이 없는데도 재확인하면
    # 프로필에 남은 다른 계정 세션이 이 단계로 통과할 수 있다(fast path 게이트 우회 방지).
    if load_session_cdp(driver, naver_id) and _blog_session_ready(driver, naver_id):
        logger.info("쿠키 복원(CDP)으로 로그인 확인 — 추가 이동 없이 진행 (경로: 쿠키 복원(CDP))")
        save_session(driver, naver_id)
        return True

    # 3) 신규 로그인 폴백 (기존 동작과 동일)
    logger.info("기존 세션 확인 실패 - 신규 로그인 진행 (경로: 신규 로그인)")
    try:
        _fresh_login(driver, naver_id, naver_pw)
    except RuntimeError as e:
        if not _wait_for_manual_login(driver, naver_id, reason=str(e)):
            raise RuntimeError(
                f"네이버 로그인이 필요합니다. 자동 로그인이 막혀 브라우저 창에서 수동 로그인을 기다렸지만 완료되지 않았습니다. (원인: {e})"
            ) from e

    # 신규 로그인 직후 이미 blog 세션이 잡혔으면 sync 생략, 아니면 기존과 동일하게 sync
    if _blog_session_ready(driver, naver_id):
        return True
    sync_pc_blog_login(driver)
    return True
