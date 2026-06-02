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

    # 도움말/기타 팝업 닫기
    try:
        help_btn = driver.find_element(By.CSS_SELECTOR, HELP_CLOSE)
        help_btn.click()
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
                button.get_attribute("class"),
                button.find_element(By.XPATH, "./..").get_attribute("class"),
            ]
        ]
        tokens = set()
        for class_value in class_values:
            tokens.update(token for token in re.split(r"\s+", class_value) if token)
        active_tokens = {
            "active",
            "selected",
            "checked",
            "is-active",
            "is-selected",
            "se-is-active",
            "se-selected",
            "se-toolbar-item-active",
            "se-toolbar-item-selected",
        }
        if tokens.intersection(active_tokens):
            return True
        return any(token.endswith("--active") or token.endswith("_active") for token in tokens)
    except Exception:
        return False


def _reset_inline_formatting(driver):
    """이전 작성중 글의 인라인 서식이 남아 있으면 본문 입력 전 끈다."""
    selectors = {
        "취소선": [
            ".se-toolbar-item-strikethrough button",
            ".se-strikethrough-toolbar-button",
            "button[class*='strikethrough']",
        ],
        "볼드": [
            BOLD_BUTTON,
            ".se-toolbar-item-bold button",
            "button[class*='bold']",
        ],
        "기울임": [
            ".se-toolbar-item-italic button",
            "button[class*='italic']",
        ],
        "밑줄": [
            ".se-toolbar-item-underline button",
            "button[class*='underline']",
        ],
    }
    for label, candidates in selectors.items():
        disabled = False
        for selector in candidates:
            try:
                buttons = driver.find_elements(By.CSS_SELECTOR, selector)
            except Exception:
                continue
            for button in buttons[:2]:
                try:
                    if button.is_displayed() and _toolbar_button_is_active(button):
                        driver.execute_script("arguments[0].click();", button)
                        wait_short()
                        logger.info(f"본문 입력 전 남아있는 {label} 서식 해제")
                        disabled = True
                        break
                except Exception:
                    continue
            if disabled:
                break


def input_title(driver, title):
    """제목 입력"""
    title = str(title or "").strip()
    if not title:
        raise RuntimeError("제목이 비어 있어 Smart Editor에 입력할 수 없습니다.")
    logger.info(f"제목 입력: {title}")
    title_element = driver.find_element(By.CSS_SELECTOR, TITLE_AREA)
    human_click(driver, title_element)
    wait_short()

    actions = ActionChains(driver)
    actions.send_keys(title)
    actions.send_keys(Keys.ENTER)
    actions.perform()
    wait_short()
    actual = _read_title_text(driver)
    if not actual:
        logger.warning("제목 입력 검증 실패 - 제목 영역이 비어 있어 재입력합니다.")
        human_click(driver, title_element)
        ActionChains(driver).key_down(Keys.CONTROL).send_keys("a").key_up(Keys.CONTROL).send_keys(title).send_keys(Keys.ENTER).perform()
        wait_short()
        actual = _read_title_text(driver)
    if not actual:
        raise RuntimeError("Smart Editor 제목 입력 후 제목 영역이 비어 있습니다.")
    logger.info(f"제목 입력 확인: {actual[:80]}")


def _read_title_text(driver):
    """Smart Editor 제목 영역의 현재 텍스트를 읽는다."""
    try:
        return driver.execute_script("""
            const selectors = [
              '.se-title-text',
              '.se-title-text span',
              '[data-a11y-title="제목"]',
              '[contenteditable="true"].se-title-text',
              'textarea[placeholder*="제목"]',
              'input[placeholder*="제목"]'
            ];
            for (const selector of selectors) {
              for (const el of document.querySelectorAll(selector)) {
                const value = (el.value || el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
                if (value) return value;
              }
            }
            const editable = Array.from(document.querySelectorAll('[contenteditable="true"]'));
            for (const el of editable) {
              const label = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('data-placeholder') || ''} ${el.className || ''}`;
              if (!/제목|title/i.test(label)) continue;
              const value = (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
              if (value) return value;
            }
            return '';
        """) or ""
    except Exception:
        return ""


def _dismiss_editor_popup(driver):
    """에디터 팝업 오버레이(.se-popup-dim) 가 떠 있으면 닫기"""
    try:
        overlays = driver.find_elements(By.CSS_SELECTOR, ".se-popup-dim")
        visible = [el for el in overlays if el.is_displayed()]
        if not visible:
            return

        logger.info(f"팝업 오버레이 감지 ({len(visible)}개) - 닫는 중...")

        # 1) 팝업 내 닫기/취소 버튼 클릭
        for cancel_sel in [
            ".se-popup-button-cancel",
            ".se-popup-footer button:first-child",
            "button[data-action='cancel']",
            ".se-popup button[class*='cancel']",
            ".se-popup button[class*='close']",
            ".se-popup .se-close-button",
        ]:
            try:
                btn = driver.find_element(By.CSS_SELECTOR, cancel_sel)
                if btn.is_displayed():
                    driver.execute_script("arguments[0].click();", btn)
                    wait_short()
                    logger.info(f"팝업 닫기 성공 ({cancel_sel})")
                    return
            except Exception:
                continue

        # 2) Escape 키
        ActionChains(driver).send_keys(Keys.ESCAPE).perform()
        wait_short()

        # 3) JS로 강제 숨김 (최후 수단)
        for el in visible:
            try:
                driver.execute_script("arguments[0].style.display='none';", el)
            except Exception:
                pass
        logger.info("팝업 JS 강제 숨김 처리")
    except Exception as e:
        logger.debug(f"팝업 닫기 시도 중 오류: {e}")


def input_content(driver, content_list, api_key, image_provider="gemini", fallback_api_key=""):
    """파싱된 콘텐츠 리스트를 에디터에 입력

    content_list 형식:
      [('quote', text), ('image', prompt), ('text', [(type, text), ...]), ...]
    """
    # 혹시 남아있는 팝업 먼저 제거
    _dismiss_editor_popup(driver)
    _reset_inline_formatting(driver)

    image_attempted = 0
    image_generated = 0
    image_inserted = 0
    image_providers = {"gemini": 0, "openai": 0}
    image_failures = []
    image_results = []
    for i, (content_type, content_data) in enumerate(content_list):
        if content_type == 'text':
            _input_text_block(driver, content_data)
        elif content_type == 'quote':
            _input_quotation(driver, content_data)
        elif content_type == 'image':
            image_attempted += 1
            image_result = _input_image(
                driver,
                content_data,
                api_key,
                image_provider=image_provider,
                fallback_api_key=fallback_api_key,
            ) or {}
            if image_result.get("generated"):
                image_generated += 1
                provider = image_result.get("provider")
                if provider in image_providers:
                    image_providers[provider] += 1
            if image_result.get("inserted"):
                image_inserted += 1
            image_results.append({
                "index": image_attempted,
                "stage": str(image_result.get("stage") or "").strip()[:80],
                "error_code": str(image_result.get("error_code") or "").strip()[:80],
                "provider": str(image_result.get("provider") or "").strip()[:40],
                "method": str(image_result.get("method") or "").strip()[:40],
                "generated": bool(image_result.get("generated")),
                "inserted": bool(image_result.get("inserted")),
            })
            if not image_result.get("inserted"):
                image_failures.append({
                    "index": image_attempted,
                    "stage": str(image_result.get("stage") or "image_completion").strip()[:80],
                    "error_code": str(image_result.get("error_code") or "image_not_inserted").strip()[:80],
                    "provider": str(image_result.get("provider") or "").strip()[:40],
                    "method": str(image_result.get("method") or "").strip()[:40],
                    "message": str(image_result.get("message") or "").strip()[:180],
                })

        # 블록 사이에 2줄 줄바꿈 (마지막 블록 제외)
        if i < len(content_list) - 1:
            actions = ActionChains(driver)
            actions.send_keys(Keys.ENTER)
            actions.send_keys(Keys.ENTER)
            actions.perform()
            wait_short()

    return {
        "image_attempted": image_attempted,
        "image_generated": image_generated,
        "image_inserted": image_inserted,
        "image_providers": image_providers,
        "image_failures": image_failures,
        "image_results": image_results,
    }


def _input_text_block(driver, parts):
    """텍스트 블록 입력 (볼드 처리 + 링크 + 문단 구분 포함)"""
    for part_type, part_text in parts:
        if part_type == 'bold':
            if not _editor_bold_enabled():
                human_type(driver, part_text)
                wait_short()
                continue
            # 팝업 오버레이 제거 후 볼드 버튼 클릭
            _dismiss_editor_popup(driver)
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
            actions.key_down(Keys.CONTROL).send_keys('v').key_up(Keys.CONTROL)
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


def _generate_image_with_provider(prompt, api_key, image_provider):
    if image_provider == "openai":
        return generate_openai_image(prompt, api_key), "openai"
    return generate_gemini_image(prompt, api_key), "gemini"


def _image_result(generated, inserted, provider="", stage="", error_code="", method="", message=""):
    return {
        "generated": bool(generated),
        "inserted": bool(inserted),
        "provider": str(provider or "").strip()[:40],
        "stage": str(stage or "").strip()[:80],
        "error_code": str(error_code or "").strip()[:80],
        "method": str(method or "").strip()[:40],
        "message": str(message or "").strip()[:180],
    }


def _input_image(driver, prompt, api_key, image_provider="gemini", fallback_api_key=""):
    """이미지 생성 후 에디터에 삽입"""
    prompt = str(prompt or "").strip()
    if not prompt:
        logger.warning("이미지 프롬프트가 비어 있어 이미지 생성을 건너뜁니다.")
        return _image_result(
            False, False,
            stage="image_prompt_empty",
            error_code="empty_image_prompt",
            message="이미지 프롬프트가 비어 있어 provider 호출 없이 건너뜀",
        )
    logger.info(f"이미지 삽입 중: {prompt[:50]}...")

    image_path, used_provider = _generate_image_with_provider(prompt, api_key, image_provider)
    if not image_path and fallback_api_key:
        fallback_provider = "openai" if image_provider != "openai" else "gemini"
        logger.warning(f"{image_provider} 이미지 생성 실패 - {fallback_provider} fallback 시도")
        image_path, used_provider = _generate_image_with_provider(prompt, fallback_api_key, fallback_provider)
    if not image_path:
        logger.warning("이미지 생성 실패, 건너뜀")
        return _image_result(
            False, False,
            provider=used_provider or image_provider,
            stage="image_generation",
            error_code="image_generation_failed",
            message="이미지 provider가 파일 경로를 반환하지 않음",
        )

    abs_path = os.path.abspath(image_path)

    try:
        # 방법 1: 이미지 버튼 클릭 → file input 대기 → send_keys
        uploaded = _try_upload_via_image_button(driver, abs_path)
        method = "file_input" if uploaded else ""

        # 방법 2: 클립보드 붙여넣기 (Ctrl+V / Cmd+V)
        if not uploaded:
            logger.info("file input 방식 실패 - 클립보드 방식 시도...")
            uploaded = _try_upload_via_clipboard(driver, abs_path)
            method = "clipboard" if uploaded else ""

        if not uploaded:
            logger.warning("이미지 업로드 실패 (모든 방법 소진) - 건너뜀")
            return _image_result(
                True, False,
                provider=used_provider,
                stage="image_upload",
                error_code="image_upload_failed",
                method="file_input+clipboard",
                message="file input과 clipboard 업로드 방식이 모두 실패",
            )

        wait_long()
        logger.info("이미지 삽입 완료")
        return _image_result(
            True, True,
            provider=used_provider,
            stage="image_inserted",
            method=method,
        )
    except Exception as e:
        logger.error(f"이미지 삽입 오류: {e}")
        return _image_result(
            True, False,
            provider=used_provider,
            stage="image_insert_exception",
            error_code="image_insert_exception",
            message=str(e),
        )
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
            result = subprocess.run(["osascript", "-e", script],
                                    capture_output=True, timeout=5)
            if result.returncode != 0:
                raise Exception(f"osascript 실패: {result.stderr.decode()}")
        else:
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
