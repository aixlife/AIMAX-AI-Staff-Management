import json
import time
import random
import platform
import pyperclip
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from constants import NAVER_LOGIN_URL, LOGIN_BUTTON
from browser.session_manager import save_session, load_session, sync_pc_blog_login
from utils.delays import wait_medium, wait_short
from utils.logger import get_logger

logger = get_logger(__name__)


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
        if "captcha" in current_url.lower() or "자동입력" in page:
            raise RuntimeError("CAPTCHA가 발생했습니다. 잠시 후 다시 시도하거나 수동으로 로그인해주세요.")
        raise RuntimeError("NID 로그인 후에도 로그인 페이지에 머무릅니다.")

    save_session(driver, naver_id)
    logger.info(f"NID 로그인 성공 → {current_url[:80]}")
    return True


def login(driver, naver_id, naver_pw):
    """클립보드 기반 네이버 로그인

    1) 저장된 세션(쿠키) 복원 시도
    2) 세션 복원 성공 시 → NID 경유 PC 블로그(blog.naver.com) 로그인 동기화
       - 동기화 실패 시 → 재로그인(fresh login)으로 폴백
    3) 세션 없거나 복원 실패 시 → 직접 로그인 후 PC 블로그 동기화
    """
    # 세션 복원 시도
    if load_session(driver, naver_id):
        # PC 블로그 로그인 동기화 (cbox 댓글에 필수)
        if sync_pc_blog_login(driver):
            logger.info("저장된 세션으로 로그인 성공 (PC 블로그 동기화 완료)")
            return True
        else:
            logger.info("PC 블로그 동기화 실패 - 재로그인 진행...")
            # fall through to fresh login

    # 직접 로그인
    _fresh_login(driver, naver_id, naver_pw)

    # 로그인 후 PC 블로그 세션 동기화
    sync_pc_blog_login(driver)
    return True
