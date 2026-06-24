Total output lines: 1503

import os
import re
import time
import pyperclip
from urllib.parse import quote
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from constants import (
    BLOG_WRITE_URL, EDITOR_IFRAME, POPUP_CANCEL, HELP_CLOSE,
    TITLE_AREA, QUOTATION_OPEN, QUOTATION_STYLE,
    IMAGE_BUTTON, BOLD_BUTTON,
    FONT_DROPDOWN, FONT_OPTIONS,
)
from browser.human_actions import human_type, human_click, send_keys_action
from browser.session_manager import sync_pc_blog_login
from content.gemini_image import generate_image as generate_gemini_image
from content.openai_image import generate_image as generate_openai_image
from utils.delays import wait_short, wait_medium, wait_long
from utils.logger import get_logger
from paths import DEBUG_DIR as _DEBUG_DIR
from auth.naver_login import login_on_current_nid_page

logger = get_logger(__name__)
DEBUG_DIR = str(_DEBUG_DIR)

# 글꼴 드롭다운 — 에디터 버전별 셀렉터 후보
FONT_DROPDOWN_SELECTORS = [
    FONT_DROPDOWN,                                                          # 기존
    ".se-toolbar-item-font-family button",                                  # 네이버 에디터 리뉴얼
    "button[class*='font-family']",                                         # 일반화
]
EDITOR_READY_SELECTORS = [
    TITLE_AREA,
    ".se-toolbar-item",
    ".se-section-documentTitle",
    ".se-main-container",
    "[contenteditable='true']",
]
EDITOR_IFRAME_SELECTORS = [
    "iframe#mainFrame",
    "iframe[name='mainFrame']",
    "iframe[id*='mainFrame']",
    "iframe[name*='mainFrame']",
    "iframe[src*='PostWrite']",
    "iframe[src*='GoBlogWrite']",
]


def _editor_bold_enabled():
    value = os.environ.get("AIMAX_EDITOR_ENABLE_BOLD", "")
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _save_editor_debug(driver, step_name):
    try:
        os.makedirs(DEBUG_DIR, exist_ok=True)
        path = os.path.join(DEBUG_DIR, f"editor_{step_name}.html")
        with open(path, "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        logger.info(f"[디버그] 에디터 HTML 저장: editor_{step_name}.html (URL: {driver.current_url})")
    except Exception as e:
        logger.debug(f"에디터 HTML 저장 실패: {e}")


def _is_editor_ready(driver):
    for sel in EDITOR_READY_SELECTORS:
        try:
            if driver.find_elements(By.CSS_SELECTOR, sel):
                return True
        except Exception:
            continue
    return False


def _wait_for_editor_ready(driver, timeout=20):
    """현재 컨텍스트에서 Smart Editor 핵심 DOM이 나타날 때까지 대기."""
    try:
        WebDriverWait(driver, timeout, poll_frequency=0.5).until(
            lambda d: _is_editor_ready(d)
        )
        return True
    except Exception:
        return False


def _log_iframe_candidates(driver):
    try:
        frames = driver.find_elements(By.CSS_SELECTOR, "iframe")
        info = []
        for frame in frames[:8]:
            info.append({
                "id": frame.get_attribute("id"),
                "name": frame.get_attribute("name"),
                "src": (frame.get_attribute("src") or "")[:120],
            })
        logger.info(f"[디버그] 감지된 iframe {len(frames)}개: {info}")
    except Exception as e:
        logger.debug(f"iframe 디버그 실패: {e}")


def _click_new_post_from_draft_popup(driver):
    """작성 중인 글 팝업이 있으면 이어쓰기 대신 새 글 작성 쪽 버튼을 누른다."""
    try:
        clicked = driver.execute_script("""
            function visible(el) {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 &&
                       style.visibility !== 'hidden' &&
                       style.display !== 'none' &&
                       !el.disabled;
            }
            const buttons = Array.from(document.querySelectorAll(
                '.se-popup button, [role="dialog"] button, button, a[role="button"]'
            )).filter(visible);
            const pageText = (document.body && document.body.innerText || '').replace(/\\s+/g, ' ');
            if (!/작성\\s*중|임시\\s*저장|이어\\s*쓰기/.test(pageText)) return false;

            const preferred = ['새 글쓰기', '새글쓰기', '새 글 작성', '새 글 쓰기', '취소', '닫기'];
            for (const label of preferred) {
                const found = buttons.find(btn => {
                    const text = (btn.innerText || btn.textContent || btn.value || '').replace(/\\s+/g, ' ').trim();
                    return text.includes(label);
                });
                if (found) {
                    found.click();
                    return true;
                }
            }
            return false;
        """)
        if clicked:
            logger.info("작성중 글 팝업에서 새 글 작성 선택")
            return True
    except Exception as e:
        logger.debug(f"작성중 글 팝업 처리 실패: {e}")
    return False


# 작성중 글 팝업의 취소 버튼 셀렉터 후보 (사용자 제공 셀렉터 우선)
_DRAFT_CANCEL_SELECTORS = [
    "button.se-popup-button.se-popup-button-cancel",  # 사용자 카피 셀렉터 (가장 구체적)
    ".se-popup-alert-confirm .se-popup-button-cancel",
    POPUP_CANCEL,
    ".se-popup-button-cancel",
    ".se-popup-button-container button.se-popup-button-cancel",
    ".se-popup-footer button:first-child",  # 팝업 하단 첫 번째 버튼
    "button[data-action='cancel']",
    "button[class*='cancel']",
]


def _draft_popup_visible(driver):
    """작성중 글 팝업(또는 확인 팝업)이 화면에 떠 있는지 JS로 판정."""
    try:
        return bool(driver.execute_script("""
            function visible(el) {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 &&
                       style.visibility !== 'hidden' && style.display !== 'none';
            }
            // 작성중 글 팝업은 확인형 알럿(.se-popup-alert-confirm)이다.
            // generic .se-popup 까지 잡으면 '임시저장' 버튼 텍스트로 오탐하므로 알럿류로 한정한다.
            const popup = document.querySelector('.se-popup-alert-confirm, .se-popup-alert');
            if (!popup || !visible(popup)) return false;
            const text = (popup.innerText || popup.textContent || '').replace(/\\s+/g, ' ');
            return /작성\\s*중|임시\\s*저장|이어\\s*쓰기/.test(text);
        """))
    except Exception:
        return False


def _click_draft_cancel(driver):
    """취소 버튼을 Selenium 클릭 + JS 클릭 양쪽으로 시도. 하나라도 누르면 True."""
    for sel in _DRAFT_CANCEL_SELECTORS:
        try:
            btn = driver.find_element(By.CSS_SELECTOR, sel)
        except Exception:
            continue
        # is_displayed() 가 일부 환경에서 false negative 라 보임 여부와 무관하게 클릭 시도
        try:
            btn.click()
            logger.info(f"작성중 팝업 취소 클릭 (selenium, {sel})")
            return True
        except Exception:
            pass
        try:
            driver.execute_script("arguments[0].click();", btn)
            logger.info(f"작성중 팝업 취소 클릭 (js, {sel})")
            return True
        except Exception:
            continue
    return False


def _dismiss_draft_popup(driver, timeout=8):
    """'작성중인 글이 있습니다' 팝업을 최대 timeout 초 동안 폴링하며 취소(새 글) 처리.

    팝업은 에디터 로드 직후 약간 늦게 뜰 수 있어 단발성 클릭으로는 놓친다.
    팝업이 사라질 때까지(또는 timeout) 반복 시도한다.
    """
    deadline = time.time() + timeout
    handled = False
    while time.time() < deadline:
        if not _draft_popup_visible(driver):
            if handled:
                logger.info("작성중 글 팝업 닫힘 확인")
                return True
            # 아직 안 떴을 수 있으니 잠깐 더 기다린다
            time.sleep(0.3)
            continue
        # 팝업이 보인다 → 취소 버튼(사용자 제공 셀렉터) 우선, 실패 시 라벨 기반 폴백.
        # 라벨 기반(_click_new_post...)은 팝업 밖 엉뚱한 버튼을 눌러 True를 반환하고도
        # 팝업을 못 닫는 경우가 있어 신뢰성 있는 취소 셀렉터를 먼저 시도한다.
        if _click_draft_cancel(driver) or _click_new_post_from_draft_popup(driver):
            handled = True
        time.sleep(0.4)
        # 클릭 후 사라졌는지 즉시 확인
        if not _draft_popup_visible(driver):
            logger.info("작성중 글 팝업 닫힘 확인")
            return True
    if handled:
        # timeout 안에 사라짐 확인은 못 했지만 클릭은 했음 — 마지막으로 한 번 더 확인
        return not _draft_popup_visible(driver)
    logger.info("작성중 글 팝업 미감지 — 건너뜀")
    return False


def ensure_editor_context(driver, timeout=20):
    """에디터가 mainFrame 안이든 기본 문서든 실제 입력 가능한 컨텍스트로 이동."""
    driver.switch_to.default_content()

    try:
        WebDriverWait(driver, timeout).until(
            lambda d: d.execute_script("return document.readyState") in ("interactive", "complete")
        )
    except Exception:
        pass

    if _wait_for_editor_ready(driver, timeout=min(timeout, 5)):
        logger.info("에디터 컨텍스트 준비 완료 (default content)")
        return "default"

    try:
        WebDriverWait(driver, timeout).until(
            EC.frame_to_be_available_and_switch_to_it((By.CSS_SELECTOR, "iframe#mainFrame, iframe[name='mainFrame']"))
        )
        if _wait_for_editor_ready(driver, timeout=timeout):
            logger.info("에디터 컨텍스트 준비 완료 (mainFrame)")
            return "mainFrame"
    except Exception:
        driver.switch_to.default_content()

    for sel in EDITOR_IFRAME_SELECTORS:
        try:
            frame = driver.find_element(By.CSS_SELECTOR, sel)
            driver.switch_to.default_content()
            driver.switch_to.frame(frame)
            if _wait_for_editor_ready(driver, timeout=timeout):
                logger.info(f"에디터 컨텍스트 준비 완료 ({sel})")
                return sel
        except Exception:
            driver.switch_to.default_content()
            continue

    driver.switch_to.default_content()
    _log_iframe_candidates(driver)
    _save_editor_debug(driver, "context_missing")
    raise RuntimeError(f"글쓰기 에디터를 찾지 못했습니다. URL={driver.current_url}")


def _try_direct_write_urls(driver, naver_id=None):
    """GoBlogWrite가 NID로 반복 리다이렉트될 때 직접 글쓰기 URL 후보를 시도."""
    blog_id = quote((naver_id or "").strip())
    candidates = [
        f"https://blog.naver.com/PostWriteForm.naver?blogId={blog_id}&Redirect=Write" if blog_id else "",
        f"https://blog.naver.com/PostWriteForm.naver?blogId={blog_id}" if blog_id else "",
        f"https://blog.naver.com/PostWrite.naver?blogId={blog_id}&Redirect=Write" if blog_id else "",
        f"{BLOG_WRITE_URL}?blogId={blog_id}" if blog_id else "",
    ]

    for url in [candidate for candidate in candidates if candidate]:
        try:
            logger.info(f"직접 글쓰기 URL 진입 시도: {url}")
            driver.get(url)
            wait_medium()
            if "nidlogin.login" in (driver.current_url or ""):
                continue
            ensure_editor_context(driver, timeout=14)
            logger.info(f"직접 글쓰기 URL 진입 성공: {url}")
            return True
        except Exception as e:
            logger.debug(f"직접 글쓰기 URL 진입 실패 ({url}): {e}")
            try:
                driver.switch_to.default_content()
            except Exception:
                pass
            continue
    return False


def navigate_to_editor(driver, naver_id=None, naver_pw=None):
    """블로그 글쓰기 화면 진입 + 팝업 닫기"""
    logger.info("블로그 글쓰기 화면으로 이동...")
    for attempt in range(2):
        driver.get(BLOG_WRITE_URL)
        wait_medium()

        if "nidlogin.login" not in driver.current_url:
            break

        # 글쓰기 진입 시점에만 NID 재로그인을 요구하는 경우가 있어 이 흐름을 흡수한다.
        if not naver_id or not naver_pw:
            _save_editor_debug(driver, "nid_redirect")
            raise RuntimeError(
                f"글쓰기 진입 중 NID 로그인 페이지로 리다이렉트되었습니다. URL={driver.current_url}"
            )

        login_on_current_nid_page(driver, naver_id, naver_pw)
        # NID 재로그인 뒤에는 blog.naver.com 쿠키를 다시 심어 주는 편이 안정적이다.
        sync_pc_blog_login(driver)
        time.sleep(1)

        if attempt == 1 and "nidlogin.login" in driver.current_url:
            if _try_direct_write_urls(driver, naver_id):
                break
            _save_editor_debug(driver, "nid_redirect_after_retry")
            raise RuntimeError(
                f"글쓰기 NID 재로그인 후에도 로그인 페이지에 머뭅니다. URL={driver.current_url}"
            )

    try:
        ensure_editor_context(driver, timeout=20)
    except Exception as e:
        logger.warning(f"기본 글쓰기 진입 후 에디터 컨텍스트 확인 실패 - 직접 글쓰기 URL 재시도: {e}")
        if not _try_direct_write_urls(driver, naver_id):
            raise
    wait_short()

    # "작성중인 글이 있습니다" 팝업 → 새 글 작성(취소) 선택.
    # 팝업이 늦게 뜨는 경우가 있어 최대 8초 폴링하며 사라질 때까지 재시도한다.
    _dismiss_draft_popup(driver, timeout=8)
    wait_short()

    # 도움말/기타 패널 닫기 — 발행/툴바 버튼을 가릴 수 있어 견고하게 처리한다.
    # 1) 알려진 close 버튼 셀렉터들을 순회하며 보이면 클릭, 2) 못 찾으면 패널을 직접 숨겨 가림 방지.
    _help_close_selectors = [
        HELP_CLOSE,
        "button[class*='help-panel-close']",
        "button[class*='help_panel_close']",
        ".se-help-panel button[class*='close']",
    ]
    help_closed = False
    for _sel in _help_close_selectors:
        try:
            help_btn = driver.find_element(By.CSS_SELECTOR, _sel)
            if help_btn.is_displayed():
                try:
                    help_btn.click()
                except Exception:
                    driver.execute_script("arguments[0].click();", help_btn)
                help_closed = True
                wait_short()
                break
        except Exception:
            continue
    if not help_closed:
        # close 버튼을 못 찾으면(셀렉터 변경 등) 보이는 도움말 패널을 직접 숨겨 툴바/발행 버튼 가림 방지.
        try:
            driver.execute_script(
                """
                const sels = ['.se-help-panel', "[class*='help-panel']", "[class*='help_panel']"];
                let hidden = 0;
                for (const s of sels) {
                  document.querySelectorAll(s).forEach(el => {
                    const r = el.getBoundingClientRect();
                    if (r.width > 0 && r.height > 0) { el.style.display = 'none'; hidden++; }
                  });
                }
                return hidden;
                """
            )
        except Exception:
            pass

    # 에디터 툴바가 실제로 렌더링될 때까지 대기 (최대 20초)
    try:
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".se-toolbar-item"))
        )
        logger.info("에디터 툴바 로드 완료")
    except Exception:
        logger.warning("에디터 툴바 로드 타임아웃 - 계속 진행")
    wait_short()

    # ── 에디터 DOM 디버그 로그 (셀렉터 확인용) ──
    _debug_editor_selectors(driver)
    
    try:
        _save_editor_debug(driver, "loaded")
    except Exception:
        pass

    try:
        _save_editor_debug(driver, "loaded")
    except Exception:
        pass

    logger.info("글쓰기 화면 준비 완료")


def _debug_editor_selectors(driver):
    """에디터 DOM 셀렉터 확인 (로그 출력용)"""
    try:
        # file input
        fi = driver.find_elements(By.CSS_SELECTOR, 'input[type="file"]')
        logger.info(f"[DOM] input[type=file]: {len(fi)}개")

        # image
        img = driver.find_elements(By.CSS_SELECTOR, IMAGE_BUTTON)
        logger.info(f"[DOM] IMAGE_BUTTON '{IMAGE_BUTTON}': {len(img)}개")

        # 모든 툴바 아이템 클래스 덤프 (셀렉터 파악용)
        items = driver.find_elements(By.CSS_SELECTOR, '.se-toolbar-item')
        classes = [el.get_attribute('class') for el in items]
        logger.info(f"[DOM] 툴바 아이템 {len(items)}개: {classes}")

        # 인용구 관련
        for sel in [QUOTATION_OPEN, QUOTATION_STYLE, '.se-toolbar-item-insert-quotation']:
            n = len(driver.find_elements(By.CSS_SELECTOR, sel))
            logger.info(f"[DOM] '{sel}' → {n}개")

    except Exception as e:
        logger.debug(f"[DOM] 디버그 로그 오류: {e}")


def set_font(driver, font_name):
    """에디터 글꼴 설정 (콘텐츠 입력 전 호출)"""
    if not font_name:
        return

    font_value = FONT_OPTIONS.get(font_name)
    if not font_value:
        logger.warning(f"지원하지 않는 글꼴: {font_name}")
        return

    try:
        # 여러 셀렉터 시도 (에디터 버전별 대응)
        font_btn = None
        for sel in FONT_DROPDOWN_SELECTORS:
            try:
                font_btn = driver.find_element(By.CSS_SELECTOR, sel)
                break
            except Exception:
                continue

        if not font_btn:
            logger.warning("글꼴 드롭다운 버튼을 찾을 수 없습니다 (건너뜀)")
            return

        human_click(driver, font_btn)
        wait_short()

        # 글꼴 옵션 선택 — 여러 셀렉터 시도
        option_selectors = [
            f".se-toolbar-option-font-family-{font_value}-button",
            f"button[class*='font-family-{font_value}']",
            f"[data-font-family='{font_value}']",
        ]
        for sel in option_selectors:
            try:
                option_btn = driver.find_element(By.CSS_SELECTOR, sel)
                human_click(driver, option_btn)
                wait_short()
                logger.info(f"글꼴 설정 완료: {font_name}")
                return
            except Exception:
                continue

        # 드롭다운이 열렸지만 옵션 못 찾음 → ESC로 닫기
        ActionChains(driver).send_keys(Keys.ESCAPE).perform()
        logger.warning(f"글꼴 옵션 '{font_name}'을 찾을 수 없습니다 (건너뜀)")
    except Exception as e:
        logger.warning(f"글꼴 설정 실패 (건너뜀): {e}")


def _toolbar_button_is_active(button):
    try:
        attrs = [
            button.get_attribute("aria-pressed"),
            button.get_attribute("aria-selected"),
            button.get_attribute("data-active"),
        ]
        if any(str(value).lower() == "true" for value in attrs if value is not None):
            return True

        class_values = [
            str(value or "").lower()
            for value in [
                button.get_at…5281 tokens truncated…               human_type(driver, part_text)
                wait_short()
                continue
            # 팝업 정리는 input_content 진입 시 1회 수행됨 — 볼드 파트마다 반복하지 않는다.
            bold_btn = driver.find_element(By.CSS_SELECTOR, BOLD_BUTTON)
            driver.execute_script("arguments[0].click();", bold_btn)
            wait_short()
            # 볼드 텍스트 입력
            human_type(driver, part_text)
            wait_short()
            # 볼드 버튼 OFF
            driver.execute_script("arguments[0].click();", bold_btn)
            wait_short()
        elif part_type == 'link':
            # 클립보드에 URL 복사 → Selenium Ctrl+V 붙여넣기
            # (pyautogui 대신 Selenium 레벨 — 에디터가 URL 자동 감지 → 하이퍼링크)
            pyperclip.copy(part_text)
            actions = ActionChains(driver)
            actions.key_down(ctrl_key).send_keys('v').key_up(ctrl_key)
            actions.perform()
            wait_short()
        elif part_type == 'text':
            if part_text == '\n\n':
                # 문단 구분: Enter 2번 (빈 줄 하나)
                actions = ActionChains(driver)
                actions.send_keys(Keys.ENTER)
                actions.send_keys(Keys.ENTER)
                actions.perform()
                wait_short()
            elif part_text == '\n':
                # 줄바꿈: Enter 1번
                actions = ActionChains(driver)
                actions.send_keys(Keys.ENTER)
                actions.perform()
            else:
                human_type(driver, part_text)
                wait_short()


def _input_quotation(driver, text):
    """인용구 입력 (실패 시 볼드 텍스트로 대체)"""
    logger.info(f"인용구 입력: {text[:30]}...")

    try:
        # 인용구 열기 버튼 클릭
        quotation_btn = driver.find_element(By.CSS_SELECTOR, QUOTATION_OPEN)
        human_click(driver, quotation_btn)
        wait_short()

        # 인용구 스타일 선택 — 여러 셀렉터 시도
        style_selectors = [
            QUOTATION_STYLE,
            ".se-toolbar-option-insert-quotation button:first-child",
            "[class*='quotation'] button",
        ]
        style_found = False
        for sel in style_selectors:
            try:
                style_btn = driver.find_element(By.CSS_SELECTOR, sel)
                human_click(driver, style_btn)
                style_found = True
                break
            except Exception:
                continue

        if not style_found:
            # 드롭다운이 열렸지만 스타일 버튼 못 찾음 → 첫 번째 옵션 클릭 시도
            try:
                options = driver.find_elements(By.CSS_SELECTOR, ".se-toolbar-option button, .se-popup-option button")
                if options:
                    human_click(driver, options[0])
                    style_found = True
                else:
                    ActionChains(driver).send_keys(Keys.ESCAPE).perform()
            except Exception:
                ActionChains(driver).send_keys(Keys.ESCAPE).perform()

        wait_short()

        if style_found:
            # 인용구 내용 입력
            human_type(driver, text)
            wait_short()
            # 인용구 빠져나오기 (↓ ↓ Enter)
            send_keys_action(driver, Keys.ARROW_DOWN, Keys.ARROW_DOWN, Keys.ENTER)
            wait_short()
            return

    except Exception as e:
        logger.warning(f"인용구 삽입 실패, 대체 텍스트로 입력: {e}")

    # 인용구 실패 시 → 기본은 일반 텍스트로 대체한다. 볼드는 네이버 에디터 중복 입력 이슈가 있어 opt-in만 허용한다.
    if not _editor_bold_enabled():
        human_type(driver, text)
        wait_short()
        return

    # 인용구 실패 시 → 볼드 텍스트로 대체
    try:
        bold_btn = driver.find_element(By.CSS_SELECTOR, BOLD_BUTTON)
        bold_btn.click()
        wait_short()
        human_type(driver, text)
        wait_short()
        bold_btn.click()
        wait_short()
    except Exception:
        # 볼드도 실패하면 일반 텍스트로
        human_type(driver, text)
        wait_short()


def _generate_image_with_provider(prompt, api_key, image_provider, image_model=""):
    if image_provider == "openai":
        return generate_openai_image(prompt, api_key, model=image_model), "openai"
    return generate_gemini_image(prompt, api_key, model=image_model), "gemini"


def _image_failure(stage, error, message, provider=""):
    user_actionable = error in {"api_key_missing", "image_paid_required", "quota_exceeded", "rate_limited"}
    return {
        "stage": stage,
        "error": error,
        "error_code": error,
        "message": message,
        "provider": provider,
        "user_actionable": user_actionable,
        "admin_action_required": not user_actionable,
    }


def _editor_image_node_count(driver):
    """Smart Editor 본문 안에 실제 이미지/이미지 블록이 몇 개 있는지 센다."""
    if driver is None:
        return 0
    try:
        return int(driver.execute_script(
            """
            const roots = Array.from(document.querySelectorAll(
              '.se-main-container, .se-content, .se-section-text, body'
            )).filter(Boolean);
            const root = roots[0] || document;
            const selectors = [
              '.se-component-image',
              '.se-module-image',
              '.se-image',
              '.se-section-image',
              '[class*="se-image"]',
              'figure img',
              'img'
            ];
            const nodes = new Set();
            for (const selector of selectors) {
              root.querySelectorAll(selector).forEach((node) => {
                const rect = node.getBoundingClientRect ? node.getBoundingClientRect() : {width: 1, height: 1};
                const style = window.getComputedStyle ? window.getComputedStyle(node) : {};
                if (style.display === 'none' || style.visibility === 'hidden') return;
                if (node.tagName && node.tagName.toLowerCase() === 'img') {
                  const src = node.getAttribute('src') || node.getAttribute('data-src') || '';
                  if (!src && rect.width <= 1 && rect.height <= 1) return;
                }
                nodes.add(node);
              });
            }
            return nodes.size;
            """
        ) or 0)
    except Exception as e:
        logger.debug(f"이미지 DOM 카운트 실패: {e}")
        return 0


def _verify_editor_image_inserted(driver, before_count, timeout=14):
    """업로드 후 Smart Editor 본문에 실제 이미지 노드가 증가했는지 확인한다."""
    if driver is None:
        return True
    try:
        ensure_editor_context(driver, timeout=5)
    except Exception:
        pass
    try:
        WebDriverWait(driver, timeout, poll_frequency=0.7).until(
            lambda d: _editor_image_node_count(d) > int(before_count or 0)
        )
        after_count = _editor_image_node_count(driver)
        logger.info(f"이미지 DOM 반영 확인: {before_count} -> {after_count}")
        return True
    except Exception:
        after_count = _editor_image_node_count(driver)
        logger.warning(f"이미지 DOM 반영 확인 실패: {before_count} -> {after_count}")
        try:
            _save_editor_debug(driver, "image_insert_not_verified")
        except Exception:
            pass
        return False


def _input_image(driver, prompt, api_key, image_provider="gemini", fallback_api_key="", image_model=""):
    """이미지 생성 후 에디터에 삽입"""
    prompt = str(prompt or "").strip()
    logger.info(f"이미지 삽입 중: {prompt[:50]}...")

    if not prompt:
        failure = _image_failure(
            "image_prompt_empty",
            "empty_image_prompt",
            "이미지 프롬프트가 비어 있어 이미지를 건너뜁니다.",
            image_provider,
        )
        return {
            "stage": failure["stage"],
            "error_code": failure["error_code"],
            "message": failure["message"],
            "generated": False,
            "inserted": False,
            "provider": image_provider,
            "failure": failure,
        }

    if not (api_key or "").strip() and not (fallback_api_key or "").strip():
        logger.warning("이미지 생성용 API 키가 없어 이미지 삽입을 건너뜀")
        failure = _image_failure(
            "image_generation",
            "api_key_missing",
            "이미지 생성용 API 키가 없어 이미지 없이 본문을 입력했습니다.",
            image_provider,
        )
        return {
            "stage": failure["stage"],
            "error_code": failure["error_code"],
            "message": failure["message"],
            "generated": False,
            "inserted": False,
            "provider": image_provider,
            "failure": failure,
        }

    try:
        image_path, used_provider = _generate_image_with_provider(prompt, api_key, image_provider, image_model)
    except Exception as e:
        logger.warning(f"{image_provider} 이미지 생성 예외 - 건너뜀: {e}")
        failure = _image_failure(
            "image_generation",
            "image_generation_exception",
            f"이미지 생성 중 오류가 발생해 이미지 없이 본문을 입력했습니다: {e}",
            image_provider,
        )
        return {
            "stage": failure["stage"],
            "error_code": failure["error_code"],
            "message": failure["message"],
            "generated": False,
            "inserted": False,
            "provider": image_provider,
            "failure": failure,
        }
    if not image_path and fallback_api_key:
        fallback_provider = "openai" if image_provider != "openai" else "gemini"
        logger.warning(f"{image_provider} 이미지 생성 실패 - {fallback_provider} fallback 시도")
        try:
            image_path, used_provider = _generate_image_with_provider(prompt, fallback_api_key, fallback_provider, "")
        except Exception as e:
            logger.warning(f"{fallback_provider} 이미지 fallback 예외 - 건너뜀: {e}")
            image_path = None
            used_provider = fallback_provider
    if not image_path:
        logger.warning("이미지 생성 실패, 건너뜀")
        error_code = "image_paid_required" if image_provider == "gemini" else "image_generation_failed"
        message = (
            "Gemini 이미지 모델은 무료 티어에서 사용할 수 없어 이미지 없이 본문을 입력했습니다."
            if error_code == "image_paid_required"
            else "이미지 생성에 실패해 이미지 없이 본문을 입력했습니다."
        )
        failure = _image_failure("image_generation", error_code, message, used_provider or image_provider)
        return {
            "stage": failure["stage"],
            "error_code": failure["error_code"],
            "message": failure["message"],
            "generated": False,
            "inserted": False,
            "provider": used_provider or image_provider,
            "failure": failure,
        }

    abs_path = os.path.abspath(image_path)

    try:
        before_image_count = _editor_image_node_count(driver)

        # 방법 1: 이미지 버튼 클릭 → file input 대기 → send_keys
        uploaded = _try_upload_via_image_button(driver, abs_path)
        upload_method = "image_button" if uploaded else ""

        # 방법 2: 클립보드 붙여넣기 (Ctrl+V / Cmd+V)
        if not uploaded:
            logger.info("file input 방식 실패 - 클립보드 방식 시도...")
            uploaded = _try_upload_via_clipboard(driver, abs_path)
            if uploaded:
                upload_method = "clipboard"

        if not uploaded:
            logger.warning("이미지 업로드 실패 (모든 방법 소진) - 건너뜀")
            failure = _image_failure(
                "image_upload",
                "image_upload_failed",
                "이미지는 생성됐지만 네이버 에디터 업로드에 실패했습니다.",
                used_provider,
            )
            return {
                "stage": failure["stage"],
                "error_code": failure["error_code"],
                "message": failure["message"],
                "generated": True,
                "inserted": False,
                "provider": used_provider,
                "failure": failure,
            }

        wait_long()
        if not _verify_editor_image_inserted(driver, before_image_count):
            failure = _image_failure(
                "image_insert_verification",
                "image_uploaded_but_not_inserted",
                "이미지는 생성/업로드를 시도했지만 네이버 에디터 본문에서 실제 이미지 반영을 확인하지 못했습니다.",
                used_provider,
            )
            return {
                "stage": failure["stage"],
                "error_code": failure["error_code"],
                "message": failure["message"],
                "generated": True,
                "inserted": False,
                "provider": used_provider,
                "method": upload_method,
                "failure": failure,
            }
        logger.info("이미지 삽입 완료")
        return {"stage": "image_inserted", "method": upload_method, "generated": True, "inserted": True, "provider": used_provider, "model": image_model}
    except Exception as e:
        logger.error(f"이미지 삽입 오류: {e}")
        failure = _image_failure(
            "image_insert_exception",
            "image_insert_exception",
            f"이미지 삽입 중 오류가 발생했습니다: {e}",
            used_provider,
        )
        return {
            "stage": failure["stage"],
            "error_code": failure["error_code"],
            "message": failure["message"],
            "generated": True,
            "inserted": False,
            "provider": used_provider,
            "failure": failure,
        }
    finally:
        try:
            os.remove(image_path)
        except Exception:
            pass


def _try_upload_via_image_button(driver, abs_path):
    """이미지 버튼 클릭 → file input 동적 생성 대기 → send_keys"""
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC

    try:
        # 팝업 오버레이 제거 후 이미지 버튼 클릭
        _dismiss_editor_popup(driver)

        # 이미지 버튼 클릭 (toolbar item 내부 button)
        for btn_sel in [
            f"{IMAGE_BUTTON} button",
            IMAGE_BUTTON,
            ".se-toolbar-item-image .se-toolbar-item-button",
        ]:
            try:
                btn = driver.find_element(By.CSS_SELECTOR, btn_sel)
                driver.execute_script("arguments[0].click();", btn)
                break
            except Exception:
                continue

        wait_short()

        # 서브메뉴 "내 컴퓨터" 클릭 시도 (팝업이 뜬 경우)
        for submenu_sel in [
            ".se-popup-button-upload-file",
            "[data-type='file']",
            ".se-file-upload-button",
            "button[class*='upload']",
            ".se-popup-item:first-child button",
        ]:
            try:
                submenu = driver.find_element(By.CSS_SELECTOR, submenu_sel)
                if submenu.is_displayed():
                    driver.execute_script("arguments[0].click();", submenu)
                    wait_short()
                    break
            except Exception:
                continue

        # mainFrame 내 file input 대기
        try:
            file_input = WebDriverWait(driver, 5).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, 'input[type="file"]'))
            )
            file_input.send_keys(abs_path)
            logger.info("이미지 업로드 성공 (mainFrame file input)")
            return True
        except Exception:
            pass

        # 부모 프레임(default content)에도 file input이 생성될 수 있음
        driver.switch_to.default_content()
        try:
            file_input = WebDriverWait(driver, 3).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, 'input[type="file"]'))
            )
            file_input.send_keys(abs_path)
            logger.info("이미지 업로드 성공 (default content file input)")
            ensure_editor_context(driver, timeout=5)
            return True
        except Exception:
            ensure_editor_context(driver, timeout=5)

    except Exception as e:
        logger.debug(f"image button 방식 실패: {e}")
        try:
            ensure_editor_context(driver, timeout=5)
        except Exception:
            pass

    return False


def _try_upload_via_clipboard(driver, abs_path):
    """클립보드에 이미지 복사 후 에디터에 붙여넣기 (Cmd+V / Ctrl+V)"""
    import platform
    import subprocess

    try:
        # 클립보드에 이미지 복사 (OS별)
        if platform.system() == "Darwin":
            # macOS: osascript로 이미지 클립보드 복사
            script = f'set the clipboard to (read (POSIX file "{abs_path}") as TIFF picture)'
            try:
                result = subprocess.run(["osascript", "-e", script],
                                        capture_output=True, text=True, timeout=5)
            except FileNotFoundError:
                logger.debug("osascript 없음 - 클립보드 방식 스킵")
                return False
            if result.returncode != 0:
                # stderr 가 None 이어도 AttributeError 없이 안전하게 메시지 구성
                raise Exception(f"osascript 실패: {result.stderr or 'Unknown error'}")
        elif platform.system() == "Windows":
            # Windows: PIL + win32clipboard
            try:
                import win32clipboard
                from PIL import Image
                import io
                img = Image.open(abs_path)
                output = io.BytesIO()
                img.convert("RGB").save(output, "BMP")
                data = output.getvalue()[14:]
                win32clipboard.OpenClipboard()
                win32clipboard.EmptyClipboard()
                win32clipboard.SetClipboardData(win32clipboard.CF_DIB, data)
                win32clipboard.CloseClipboard()
            except ImportError:
                logger.debug("win32clipboard 없음 - 클립보드 방식 스킵")
                return False
        else:
            # 그 외 OS(Linux 등)는 클립보드 이미지 복사 미지원 - 조기 탈출
            logger.debug(f"클립보드 이미지 복사 미지원 OS: {platform.system()} - 스킵")
            return False

        time.sleep(0.5)

        # 에디터 본문 클릭 (포커스 확보)
        for content_sel in [".se-content", ".se-text-paragraph", "[contenteditable='true']"]:
            try:
                content_el = driver.find_element(By.CSS_SELECTOR, content_sel)
                driver.execute_script("arguments[0].click();", content_el)
                break
            except Exception:
                continue

        time.sleep(0.3)

        # Ctrl+V (Mac은 Meta+V)
        if platform.system() == "Darwin":
            ActionChains(driver).key_down(Keys.META).send_keys('v').key_up(Keys.META).perform()
        else:
            ActionChains(driver).key_down(Keys.CONTROL).send_keys('v').key_up(Keys.CONTROL).perform()

        time.sleep(3)
        logger.info("이미지 업로드 성공 (클립보드 붙여넣기)")
        return True

    except Exception as e:
        logger.debug(f"클립보드 방식 실패: {e}")
        return False
