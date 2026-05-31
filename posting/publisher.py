import random
import time
from datetime import datetime, timedelta
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select
from constants import (
    SAVE_BUTTON, PUBLISH_BUTTON, CONFIRM_BUTTON,
    SCHEDULE_RADIO, DATE_INPUT, PUBLISH_LAYER,
    DATEPICKER_YEAR, DATEPICKER_MONTH, DATEPICKER_NEXT, DATEPICKER_DAYS,
    HOUR_SELECT, MINUTE_SELECT,
    CATEGORY_BUTTON, CATEGORY_LIST_ITEM
)
from browser.human_actions import human_click
from config import SCHEDULE_HOUR_MIN, SCHEDULE_HOUR_MAX, SCHEDULE_DAYS_AHEAD
from utils.delays import wait_short, wait_medium
from utils.logger import get_logger
from paths import DEBUG_DIR as _DEBUG_DIR
import os
import re

logger = get_logger(__name__)
DEBUG_DIR = str(_DEBUG_DIR)

# 발행 버튼 후보 셀렉터 (네이버 UI 변경 대비)
_PUBLISH_BTN_SELECTORS = [
    PUBLISH_BUTTON,
    ".publish_btn",
    "button.se-toolbar-item-publish",
    "[data-action='publish']",
    "button[class*='publish']",
]
_CONFIRM_BTN_SELECTORS = [
    CONFIRM_BUTTON,
    ".btn_ok",
    "button.confirm",
    ".layer_btn_group button:last-child",
]
_SAVE_BTN_SELECTORS = [
    SAVE_BUTTON,
    ".save_btn",
    ".se-toolbar-item-save button",
    "button[aria-label*='임시']",
    "button[title*='임시']",
    "button[data-action*='save']",
    "button[data-action*='Save']",
    "button[class*='save']",
    "button[class*='Save']",
    "a[class*='save']",
    "a[class*='Save']",
]
_SAVE_TEXTS = ["임시저장", "임시 저장", "저장"]
_PUBLISH_OPEN_TEXTS = ["발행", "Publish"]
_CONFIRM_TEXTS = ["발행", "예약", "예약 발행", "확인", "완료"]


def _normalize_text(text):
    return re.sub(r"\s+", " ", text or "").strip()


def _save_publish_debug(driver, step_name):
    try:
        os.makedirs(DEBUG_DIR, exist_ok=True)
        path = os.path.join(DEBUG_DIR, f"publish_{step_name}.html")
        with open(path, "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        logger.info(f"[디버그] 발행 HTML 저장: publish_{step_name}.html (URL: {driver.current_url})")
    except Exception as e:
        logger.debug(f"발행 HTML 저장 실패: {e}")


def _find_by_text(driver, texts):
    """현재 문서에서 버튼/링크 텍스트로 요소를 찾는다."""
    try:
        element = driver.execute_script("""
            const targets = (arguments[0] || []).map(t => (t || '').trim()).filter(Boolean);
            function visible(el) {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 &&
                       style.visibility !== 'hidden' &&
                       style.display !== 'none' &&
                       !el.disabled;
            }

            const nodes = Array.from(document.querySelectorAll(
                'button, a[role="button"], [role="button"], input[type="button"], input[type="submit"], a'
            ));
            const scored = [];

            for (const el of nodes) {
                if (!visible(el)) continue;
                let txt = (el.innerText || el.textContent || el.value || '').replace(/\\s+/g, ' ').trim();
                if (!txt) continue;
                if (!targets.some(t => txt === t || txt.includes(t))) continue;

                let score = 0;
                let cur = el;
                while (cur) {
                    const cls = String(cur.className || '');
                    const role = cur.getAttribute ? cur.getAttribute('role') : '';
                    if (role === 'dialog') score += 5;
                    if (/layer|popup|dialog|modal|publish|confirm/i.test(cls)) score += 2;
                    cur = cur.parentElement;
                }
                if (/toolbar/i.test(String(el.className || ''))) score -= 3;
                scored.push({ el, score, txt });
            }

            scored.sort((a, b) => b.score - a.score);
            return scored.length ? scored[0].el : null;
        """, texts)
        if element:
            return element
    except Exception:
        pass
    return None


def _find_save_button(driver):
    """네이버 에디터 버전별 임시저장 버튼 탐색."""
    try:
        return _find_any(driver, _SAVE_BTN_SELECTORS, text_candidates=_SAVE_TEXTS)
    except Exception:
        pass

    contexts = [False, True]
    for switch_default in contexts:
        try:
            if switch_default:
                driver.switch_to.default_content()
        except Exception:
            pass
        try:
            element = driver.execute_script("""
                function visible(el) {
                    if (!el) return false;
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    return rect.width > 0 && rect.height > 0 &&
                           style.visibility !== 'hidden' &&
                           style.display !== 'none' &&
                           !el.disabled;
                }
                const nodes = Array.from(document.querySelectorAll(
                    'button, a[role="button"], [role="button"], input[type="button"], input[type="submit"], a'
                ));
                const scored = [];
                for (const el of nodes) {
                    if (!visible(el)) continue;
                    const text = `${el.innerText || ''} ${el.textContent || ''} ${el.value || ''} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`.replace(/\\s+/g, ' ').trim();
                    const cls = String(el.className || '');
                    const action = String(el.getAttribute('data-action') || '');
                    let score = 0;
                    if (/임시\\s*저장|저장/.test(text)) score += 10;
                    if (/save|draft/i.test(cls)) score += 8;
                    if (/save|draft/i.test(action)) score += 8;
                    if (/publish|발행|예약/i.test(text + ' ' + cls + ' ' + action)) score -= 10;
                    if (score > 0) scored.push({el, score, text});
                }
                scored.sort((a, b) => b.score - a.score);
                return scored.length ? scored[0].el : null;
            """)
            if element:
                return element
        except Exception:
            continue
    raise Exception(f"임시저장 버튼을 찾을 수 없음: {_SAVE_BTN_SELECTORS} / texts={_SAVE_TEXTS}")


def _find_any(driver, selectors, text_candidates=None):
    """현재 문서와 default content를 모두 뒤져 첫 매칭 요소 반환"""
    contexts = [False, True]
    errors = []

    for switch_default in contexts:
        try:
            if switch_default:
                driver.switch_to.default_content()
        except Exception:
            pass

        for sel in selectors:
            try:
                elements = driver.find_elements(By.CSS_SELECTOR, sel)
                for el in elements:
                    try:
                        if el.is_displayed():
                            return el
                    except Exception:
                        return el
            except Exception as e:
                errors.append((sel, str(e)))
                continue

        if text_candidates:
            el = _find_by_text(driver, text_candidates)
            if el:
                return el

    raise Exception(f"요소를 찾을 수 없음: {selectors} / texts={text_candidates}")


def _find_all(driver, selector):
    """현재 문서와 default content를 모두 뒤져 요소 목록 반환"""
    contexts = [False, True]
    for switch_default in contexts:
        try:
            if switch_default:
                driver.switch_to.default_content()
        except Exception:
            pass
        try:
            elements = driver.find_elements(By.CSS_SELECTOR, selector)
            if elements:
                return elements
        except Exception:
            continue
    return []


def _wait_publish_layer(driver, timeout=8):
    """발행 레이어가 뜰 시간을 준다."""
    end = datetime.now().timestamp() + timeout
    while datetime.now().timestamp() < end:
        try:
            if _find_all(driver, PUBLISH_LAYER):
                return True
        except Exception:
            pass
        try:
            if _find_by_text(driver, _CONFIRM_TEXTS):
                return True
        except Exception:
            pass
        time.sleep(0.3)
    return False


def _wait_draft_saved(driver, timeout=10):
    """임시저장 완료 토스트/상태 메시지를 확인한다."""
    done_texts = [
        "임시저장 되었습니다",
        "임시 저장되었습니다",
        "임시저장되었습니다",
        "저장되었습니다",
        "저장 완료",
        "임시저장 완료",
    ]
    end = datetime.now().timestamp() + timeout
    while datetime.now().timestamp() < end:
        try:
            body_text = driver.execute_script("return document.body ? document.body.innerText : ''") or ""
            normalized = _normalize_text(body_text)
            if any(text in normalized for text in done_texts):
                return True
        except Exception:
            pass
        time.sleep(0.3)
    return False


def set_category(driver, category_name):
    """발행 팝업에서 카테고리 선택

    발행 버튼 클릭 후 팝업이 열린 상태에서 호출해야 함.
    카테고리 이름(텍스트)으로 매칭하여 선택.
    """
    if not category_name:
        return

    try:
        # 카테고리 드롭다운/버튼 클릭
        cat_btn = _find_any(driver, [CATEGORY_BUTTON], text_candidates=["카테고리"])
        human_click(driver, cat_btn)
        wait_short()

        # 카테고리 목록에서 이름으로 찾아 클릭
        items = _find_all(driver, CATEGORY_LIST_ITEM)
        for item in items:
            if category_name in item.text:
                human_click(driver, item)
                logger.info(f"카테고리 선택: {category_name}")
                wait_short()
                return
        logger.warning(f"카테고리 '{category_name}'을 찾지 못함")
    except Exception as e:
        logger.warning(f"카테고리 설정 실패 (건너뜀): {e}")


def save_draft(driver):
    """임시 저장"""
    logger.info("임시 저장 중...")
    btn = _find_save_button(driver)
    try:
        human_click(driver, btn)
    except Exception:
        driver.execute_script("arguments[0].click();", btn)
    wait_medium()
    confirmed = _wait_draft_saved(driver)
    if not confirmed:
        _save_publish_debug(driver, "draft_confirmation_missing")
        logger.warning("임시 저장 완료 메시지를 확인하지 못했습니다. 버튼 클릭은 수행했습니다.")
    logger.info("임시 저장 완료" if confirmed else "임시 저장 버튼 클릭 완료")
    return confirmed


def publish_now(driver, category=None):
    """즉시 발행"""
    logger.info("즉시 발행 중...")
    pub_btn = _find_any(driver, _PUBLISH_BTN_SELECTORS, text_candidates=_PUBLISH_OPEN_TEXTS)
    human_click(driver, pub_btn)
    wait_short()
    _wait_publish_layer(driver, timeout=8)

    if category:
        set_category(driver, category)

    try:
        confirm_btn = _find_any(driver, _CONFIRM_BTN_SELECTORS, text_candidates=_CONFIRM_TEXTS)
        human_click(driver, confirm_btn)
    except Exception:
        _save_publish_debug(driver, "confirm_missing")
        raise
    wait_medium()
    logger.info("즉시 발행 완료")


def schedule_publish(driver, target_date=None, hour=None, category=None):
    """예약 발행 (기본: 내일 랜덤 시간)"""
    if target_date is None:
        target_date = datetime.now() + timedelta(days=SCHEDULE_DAYS_AHEAD)
    if hour is None:
        hour = random.randint(SCHEDULE_HOUR_MIN, SCHEDULE_HOUR_MAX)

    logger.info(f"예약 발행 설정: {target_date.strftime('%Y-%m-%d')} {hour}시")

    # 발행 버튼 클릭
    pub_btn = _find_any(driver, _PUBLISH_BTN_SELECTORS, text_candidates=_PUBLISH_OPEN_TEXTS)
    human_click(driver, pub_btn)
    wait_short()
    _wait_publish_layer(driver, timeout=8)

    if category:
        set_category(driver, category)

    # 예약 라디오 선택
    schedule_radio = _find_any(driver, [SCHEDULE_RADIO], text_candidates=["예약"])
    human_click(driver, schedule_radio)
    wait_short()

    # 날짜 입력 클릭 → 달력 열기
    date_input = _find_any(driver, [DATE_INPUT], text_candidates=["날짜"])
    human_click(driver, date_input)
    wait_short()

    # 발행 레이어 스크롤
    try:
        layer = _find_any(driver, [PUBLISH_LAYER])
        driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight;", layer)
    except Exception:
        pass
    wait_short()

    # 현재 달력 년월 확인 및 필요시 다음 달 이동
    cur_year = int(_find_any(driver, [DATEPICKER_YEAR]).text.replace('년', ''))
    cur_month = int(_find_any(driver, [DATEPICKER_MONTH]).text.replace('월', ''))

    # 목표 월까지 반복 이동 (2달 이상 미래 날짜 지원)
    for _ in range(24):
        if (cur_year, cur_month) >= (target_date.year, target_date.month):
            break
        next_btn = _find_any(driver, [DATEPICKER_NEXT], text_candidates=["다음"])
        human_click(driver, next_btn)
        wait_short()
        cur_year = int(_find_any(driver, [DATEPICKER_YEAR]).text.replace('년', ''))
        cur_month = int(_find_any(driver, [DATEPICKER_MONTH]).text.replace('월', ''))

    # 날짜 선택
    target_day = str(target_date.day)
    clickable_dates = _find_all(driver, DATEPICKER_DAYS)
    for date_btn in clickable_dates:
        if date_btn.text.strip() == target_day:
            human_click(driver, date_btn)
            break
    wait_short()

    # 시간 설정
    hour_str = str(hour).zfill(2)
    Select(_find_any(driver, [HOUR_SELECT])).select_by_value(hour_str)
    wait_short()

    minute_val = str(random.choice([0, 10, 20, 30, 40, 50])).zfill(2)
    Select(_find_any(driver, [MINUTE_SELECT])).select_by_value(minute_val)
    wait_short()

    # 최종 발행 확인
    try:
        confirm_btn = _find_any(driver, _CONFIRM_BTN_SELECTORS, text_candidates=_CONFIRM_TEXTS)
        human_click(driver, confirm_btn)
    except Exception:
        _save_publish_debug(driver, "schedule_confirm_missing")
        raise
    wait_medium()

    logger.info(f"예약 발행 완료: {target_date.strftime('%Y-%m-%d')} {hour_str}:{minute_val}")
