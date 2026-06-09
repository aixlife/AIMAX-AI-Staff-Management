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
            "se-is-selected",
            "se-toolbar-item-active",
            "se-toolbar-item-selected",
        }
        if tokens.intersection(active_tokens):
            return True
        return any(token.endswith("--active") or token.endswith("_active") for token in tokens)
    except Exception:
        return False


def _focus_content_area(driver):
    """에디터 본문 영역에 확실하게 포커스를 줍니다."""
    logger.info("본문 영역 포커스 시도...")
    content_selectors = [
        ".se-content [contenteditable='true']",
        "[contenteditable='true'].se-content",
        ".se-text-paragraph [contenteditable='true']",
        ".se-main-container [contenteditable='true']",
        "[contenteditable='true']",
    ]
    for sel in content_selectors:
        try:
            el = driver.find_element(By.CSS_SELECTOR, sel)
            if el.is_displayed():
                human_click(driver, el)
                driver.execute_script("arguments[0].focus();", el)
                wait_short()
                logger.info(f"본문 영역 포커스 성공 ({sel})")
                return el
        except Exception:
            continue
    logger.warning("본문 영역 포커스 실패")
    return None


def _reset_inline_formatting(driver):
    """이전 글쓰기 상태 등으로 인해 볼드, 취소선, 밑줄 등이 활성화되어 있으면 입력 전에 명시적으로 끕니다.
    꺼져 있는 서식을 역활성화하여 켜는 부작용을 막기 위해, 실제 active 상태인 서식만 골라서 비활성화합니다.
    """
    logger.info("인라인 서식(볼드, 취소선, 밑줄 등) 상태 검사 및 정밀 초기화 시작...")

    # 툴바 상태 동기화를 위해 본문 영역에 확실하게 포커스를 먼저 부여합니다.
    _focus_content_area(driver)
    time.sleep(0.5)

    targets = [
        ("볼드", [BOLD_BUTTON, "button[class*='bold']", ".se-toolbar-item-bold button"]),
        ("취소선", ["button[class*='strikethrough']", ".se-toolbar-item-strikethrough button", ".se-strikethrough-toolbar-button"]),
        ("밑줄", ["button[class*='underline']", ".se-toolbar-item-underline button", ".se-underline-toolbar-button"]),
        ("기울임", ["button[class*='italic']", ".se-toolbar-item-italic button", ".se-italic-toolbar-button"]),
    ]

    for name, selectors in targets:
        button = None
        for sel in selectors:
            try:
                el = driver.find_element(By.CSS_SELECTOR, sel)
                if el.is_displayed():
                    button = el
                    break
            except Exception:
                continue

        if button:
            try:
                # 디버그 로그 추가
                parent_html = ""
                try:
                    parent_html = button.find_element(By.XPATH, "./..").get_attribute("outerHTML")
                except Exception:
                    pass
                logger.info(f"[디버그] {name} 버튼 HTML: {button.get_attribute('outerHTML')}")
                logger.info(f"[디버그] {name} 버튼 부모 HTML: {parent_html[:200]}")

                is_active = _toolbar_button_is_active(button)
                logger.info(f"[서식검사] {name} 버튼 감지됨 (활성화 상태: {is_active})")
                if is_active:
                    logger.info(f"[서식초기화] {name} 서식이 활성화되어 있어 클릭하여 비활성화 처리합니다.")
                    driver.execute_script("arguments[0].click();", button)
                    wait_short()
            except Exception as e:
                logger.debug(f"{name} 서식 상태 조회/비활성화 실패: {e}")


def input_title(driver, title):
    """제목 입력 (먼저 제목 컨테이너를 클릭하여 React의 동적 contenteditable 생성을 유도한 뒤, 실제 에디터 알맹이에 100% 주입 보장)"""
    title = str(title or "").strip()
    if not title:
        raise RuntimeError("제목이 비어 있어 Smart Editor에 입력할 수 없습니다.")
    logger.info(f"제목 입력 시도: {title}")

    # 방어: 작성중 글 팝업이 아직 떠 있으면 Cmd/Ctrl+A(전체선택)가 허공으로 날아가
    # 제목이 조용히 비워진다. 제목 입력 직전 한 번 더 정리한다.
    if _draft_popup_visible(driver):
        logger.info("제목 입력 직전 작성중 글 팝업 잔존 — 재정리 시도")
        _dismiss_draft_popup(driver, timeout=5)
        wait_short()

    # 1. 제목 영역의 껍데기(컨테이너)를 먼저 확실히 클릭하여 React 편집 모드를 동적 활성화합니다.
    title_container_selectors = [
        ".se-section-documentTitle",
        ".se-documentTitle",
        ".se-title-text",
        TITLE_AREA,
    ]

    container_element = None
    for sel in title_container_selectors:
        try:
            el = driver.find_element(By.CSS_SELECTOR, sel)
            if el.is_displayed():
                container_element = el
                logger.info(f"제목 컨테이너 매칭 성공: {sel}")
                break
        except Exception:
            continue

    if container_element:
        try:
            human_click(driver, container_element)
            logger.info("제목 컨테이너 클릭 완료 (React contenteditable 활성화 유도)")
            time.sleep(0.5) # React가 DOM을 업데이트하여 진짜 입력 필드를 생성할 시간 부여
        except Exception as e:
            logger.warning(f"제목 컨테이너 클릭 실패: {e}")

    # 2. 클릭 후 동적으로 렌더링된 진짜 제목 문단(p)을 우선 탐색한다.
    # Smart Editor는 빈 span.__se-node 안에 placeholder를 함께 두는 경우가 있어
    # span을 먼저 잡으면 입력/검증이 빈 값으로 남을 수 있다.
    title_editable_selectors = [
        ".se-title-text p.se-text-paragraph",
        ".se-documentTitle p",
        ".se-title-text span.__se-node",
        ".se-documentTitle span.__se-node",
        ".se-documentTitle [contenteditable='true']",
        ".se-section-documentTitle [contenteditable='true']",
        "[contenteditable='true'].se-title-text",
        ".se-title-text [contenteditable='true']",
        "[data-a11y-title='제목'] [contenteditable='true']",
        "h3.se-title-text",
        ".se-title-text",
        TITLE_AREA,
    ]

    title_element = None
    for sel in title_editable_selectors:
        try:
            el = driver.find_element(By.CSS_SELECTOR, sel)
            if el.is_displayed():
                title_element = el
                logger.info(f"실제 제목 입력 엘리먼트 매칭 성공: {sel}")
                break
        except Exception:
            continue

    if not title_element:
        title_element = driver.find_element(By.CSS_SELECTOR, TITLE_AREA)
        logger.warning(f"적합한 제목 입력 엘리먼트를 찾지 못해 기본 영역({TITLE_AREA})을 타겟팅합니다.")

    try:
        logger.info(f"[디버그] 매칭된 제목 엘리먼트 HTML: {title_element.get_attribute('outerHTML')}")
    except Exception as e:
        logger.debug(f"제목 엘리먼트 HTML 가져오기 실패: {e}")

    ctrl_key = Keys.CONTROL if os.name == "nt" else Keys.META

    def _fresh_title_element():
        for selector in title_editable_selectors:
            try:
                el = driver.find_element(By.CSS_SELECTOR, selector)
                if el.is_displayed():
                    return el
            except Exception:
                continue
        return title_element

    def _click_title_target():
        fresh = _fresh_title_element()
        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", fresh)
        try:
            ActionChains(driver).move_to_element(fresh).click().perform()
        except Exception:
            driver.execute_script("arguments[0].click();", fresh)
        # 빈 제목 <p> 는 높이가 0이라 클릭만으로 캐럿이 안 들어가는 경우가 있어
        # JS 로 포커스를 주고 캐럿을 내용 끝으로 옮겨 키 입력이 확실히 꽂히게 한다.
        try:
            driver.execute_script(
                """
                const el = arguments[0];
                el.focus();
                const sel = window.getSelection();
                if (sel) {
                    const range = document.createRange();
                    range.selectNodeContents(el);
                    range.collapse(false);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
                """,
                fresh,
            )
        except Exception:
            pass
        wait_short()
        return fresh

    def _js_insert_title():
        """키 입력이 에디터에 안 꽂힐 때의 폴백 — contenteditable 에 직접 execCommand 로 주입."""
        fresh = _fresh_title_element()
        driver.execute_script(
            """
            const el = arguments[0], text = arguments[1];
            el.focus();
            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(el);
            sel.removeAllRanges();
            sel.addRange(range);
            // 기존 내용 비우고 텍스트 삽입 (React/SmartEditor input 이벤트 동반)
            document.execCommand('selectAll', false, null);
            const ok = document.execCommand('insertText', false, text);
            if (!ok) {
                el.textContent = text;
            }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('keyup', { bubbles: true }));
            """,
            fresh,
            title,
        )
        wait_short()

    def _keyboard_paste_title():
        pyperclip.copy(title)
        _click_title_target()
        actions = ActionChains(driver)
        actions.key_down(ctrl_key).send_keys("a").key_up(ctrl_key)
        actions.send_keys(Keys.BACKSPACE)
        actions.key_down(ctrl_key).send_keys("v").key_up(ctrl_key)
        actions.perform()
        wait_short()

    def _keyboard_type_title():
        _click_title_target()
        actions = ActionChains(driver)
        actions.key_down(ctrl_key).send_keys("a").key_up(ctrl_key)
        actions.send_keys(Keys.BACKSPACE)
        actions.perform()
        wait_short()
        human_type(driver, title, avg_delay=0.015)
        wait_short()

    # 입력 전략 순서 (v1.0.44 의 '키보드=실사용자 입력' 결정을 유지):
    #   1) 클립보드 붙여넣기 → 2) 직접 타이핑 → 3) JS execCommand 주입(폴백)
    # 키보드 입력이 되는 환경은 기존 동작 그대로 유지하고, 빈 제목 <p>(높이 0)에 키 이벤트가
    # 안 꽂히는 환경(Chrome 148 등)에서만 JS 주입이 구제한다. JS 주입 뒤에도 본문은
    # input_content 의 본문 포커스 클릭으로 진입하므로 '본문이 제목에 써지는' 문제는 발생하지 않는다.
    actual = ""
    for attempt in range(1, 4):
        try:
            _keyboard_paste_title()
            actual = _read_title_text(driver)
            logger.info(f"제목 입력 검증 결과(붙여넣기 {attempt}/3): '{actual}'")
            if actual and actual.strip():
                break
        except Exception as e:
            logger.debug(f"클립보드 제목 붙여넣기 실패({attempt}/3): {e}")

    if not actual or actual.strip() == "":
        for attempt in range(1, 3):
            try:
                _keyboard_type_title()
                actual = _read_title_text(driver)
                logger.info(f"제목 입력 검증 결과(직접 타이핑 {attempt}/2): '{actual}'")
                if actual and actual.strip():
                    break
            except Exception as e:
                logger.debug(f"직접 제목 타이핑 실패({attempt}/2): {e}")

    # 키보드 입력이 에디터에 닿지 않는 환경 대비 JS 직접 주입 폴백 (최후 수단)
    if not actual or actual.strip() == "":
        for attempt in range(1, 3):
            try:
                _click_title_target()
                _js_insert_title()
                actual = _read_title_text(driver)
                logger.info(f"제목 입력 검증 결과(JS 주입 폴백 {attempt}/2): '{actual}'")
                if actual and actual.strip():
                    break
            except Exception as e:
                logger.debug(f"JS 제목 주입 실패({attempt}/2): {e}")

    # 제목이 성공했을 때만 Enter로 본문으로 이동한다.
    if actual and actual.strip():
        try:
            ActionChains(driver).send_keys(Keys.ENTER).perform()
            wait_short()
        except Exception as e:
            logger.debug(f"제목 이후 본문 이동 Enter 실패: {e}")

    # 최종 안전 차단 장치: 제목이 제대로 입력되지 않은 경우 저장을 진행하지 않고 예외 발생
    if not actual or actual.strip() == "":
        raise RuntimeError(f"Smart Editor 제목 입력에 실패했습니다. (입력 목표값: {title})")

    logger.info(f"제목 입력 최종 성공 확인: {actual[:80]}")


def _read_title_text(driver):
    """Smart Editor 제목 영역의 현재 텍스트를 읽는다 (플레이스홀더 텍스트는 원천 제외)."""
    try:
        return driver.execute_script("""
            const selectors = [
              '.se-title-text p.se-text-paragraph',
              '.se-documentTitle p',
              '.se-title-text span.__se-node',
              '.se-documentTitle span.__se-node',
              '.se-documentTitle [contenteditable="true"]',
              '.se-section-documentTitle [contenteditable="true"]',
              '[contenteditable="true"].se-title-text',
              '.se-title-text [contenteditable="true"]',
              '[data-a11y-title="제목"] [contenteditable="true"]',
              'textarea[placeholder*="제목"]',
              'input[placeholder*="제목"]'
            ];
            for (const selector of selectors) {
              for (const el of document.querySelectorAll(selector)) {
                if (el.classList.contains('se-placeholder') || el.classList.contains('is-placeholder')) {
                  continue;
                }
                const clone = el.cloneNode(true);
                const placeholders = clone.querySelectorAll('.se-placeholder, [class*="placeholder"]');
                placeholders.forEach(p => p.remove());
                const value = (clone.value || clone.innerText || clone.textContent || '').replace(/\\s+/g, ' ').trim();
                // 순수 플레이스홀더 문자열 자체이거나 빈 값이면 패스
                if (value && value !== '제목' && value !== 'Title') return value;
              }
            }
            const editable = Array.from(document.querySelectorAll('[contenteditable="true"]'));
            for (const el of editable) {
              const label = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('data-placeholder') || ''} ${el.className || ''}`;
              if (!/제목|title/i.test(label)) continue;
              const clone = el.cloneNode(true);
              const placeholders = clone.querySelectorAll('.se-placeholder, [class*="placeholder"]');
              placeholders.forEach(p => p.remove());
              const value = (clone.innerText || clone.textContent || '').replace(/\\s+/g, ' ').trim();
              if (value && value !== '제목' && value !== 'Title') return value;
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
            if image_result.get("failure"):
                image_failures.append(image_result.get("failure"))

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
    }


def _input_text_block(driver, parts):
    """텍스트 블록 입력 (볼드 처리 + 링크 + 문단 구분 포함)"""
    # 붙여넣기 단축키는 OS별로 다르다 (Windows: Ctrl, macOS: Cmd/Meta)
    ctrl_key = Keys.CONTROL if os.name == "nt" else Keys.META

    # 블록 사이 빈 줄은 input_content 의 블록 간 Enter(2회)로 일괄 관리한다.
    # 텍스트 블록 앞뒤에 붙은 순수 줄바꿈 파트('\n', '\n\n')는 빈 줄을 중복으로 쌓아
    # 글이 과도하게 벌어지게 하므로 블록 경계의 줄바꿈만 제거한다(블록 내부 줄바꿈은 보존).
    def _is_newline_only(part):
        return part[0] == 'text' and (part[1] or '').strip('\n') == ''

    parts = list(parts)
    while parts and _is_newline_only(parts[0]):
        parts.pop(0)
    while parts and _is_newline_only(parts[-1]):
        parts.pop()

    for part_type, part_text in parts:
        if part_type == 'bold':
            if not _editor_bold_enabled():
                human_type(driver, part_text)
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


def _generate_image_with_provider(prompt, api_key, image_provider):
    if image_provider == "openai":
        return generate_openai_image(prompt, api_key), "openai"
    return generate_gemini_image(prompt, api_key), "gemini"


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


def _input_image(driver, prompt, api_key, image_provider="gemini", fallback_api_key=""):
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
        image_path, used_provider = _generate_image_with_provider(prompt, api_key, image_provider)
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
            image_path, used_provider = _generate_image_with_provider(prompt, fallback_api_key, fallback_provider)
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
        logger.info("이미지 삽입 완료")
        return {"stage": "image_inserted", "method": upload_method, "generated": True, "inserted": True, "provider": used_provider}
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
