#!/usr/bin/env python3
"""실사이트 검증: 실제 네이버 NID 로그인 페이지에서 로그인 버튼을 찾는지 확인한다.

정적 HTML(curl) 대조만으로는 레이아웃별 버튼(column/row) 중 어느 쪽이 실제로 보이는지
알 수 없다. 여기서는 프로덕션과 같은 셀레니움 스택으로 페이지를 실제 렌더링한 뒤
`_find_login_button` 이 고르는 요소가 보이고 누를 수 있는지까지 확인한다.

로그인하지 않는다. 계정 정보를 입력하지도, 제출하지도 않는다 — DOM 조회만 한다.

실행: .venv/bin/python scripts/verify_naver_login_button_live.py
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from selenium import webdriver  # noqa: E402
from selenium.webdriver.chrome.options import Options  # noqa: E402
from selenium.webdriver.common.by import By  # noqa: E402

from auth.naver_login import _find_login_button, _is_clickable  # noqa: E402
from constants import LOGIN_BUTTON_SELECTORS, NAVER_LOGIN_URL  # noqa: E402

FAILURES: list[str] = []


def check(label: str, actual, expected) -> None:
    if actual == expected:
        print(f"  PASS {label}  ({actual})")
        return
    FAILURES.append(f"{label}: expected={expected!r} actual={actual!r}")
    print(f"  FAIL {label}: expected={expected!r} actual={actual!r}")


def build_driver() -> webdriver.Chrome:
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--window-size=1440,900")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument(
        "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    )
    return webdriver.Chrome(options=options)


def main() -> int:
    driver = build_driver()
    try:
        driver.get(NAVER_LOGIN_URL)

        print("[1] 로그인 폼 자체는 그대로인지 (아이디/비밀번호 입력칸)")
        check("#id 존재", len(driver.find_elements(By.CSS_SELECTOR, "#id")), 1)
        check("#pw 존재", len(driver.find_elements(By.CSS_SELECTOR, "#pw")), 1)

        print("[2] 선택자별 실제 매칭 수")
        for selector in LOGIN_BUTTON_SELECTORS:
            elements = driver.find_elements(By.CSS_SELECTOR, selector)
            visible = sum(1 for e in elements if _is_clickable(e))
            print(f"  {selector}: 발견 {len(elements)}개 / 보이는 것 {visible}개")

        print("[3] _find_login_button 이 실제로 누를 수 있는 버튼을 고르는가")
        button = _find_login_button(driver)
        check("버튼을 찾음", button is not None, True)
        if button is None:
            return 1
        element_id = button.get_attribute("id") or ""
        label = " ".join((button.text or "").split())
        print(f"  선택된 요소: id={element_id!r} text={label!r}")
        check("보이고 활성 상태", _is_clickable(button), True)
        check("패스키 버튼이 아님", "passkey" in element_id.lower(), False)
        check("라벨이 로그인", "로그인" in label, True)

        print("[4] 데스크톱 폭이 좁아져 레이아웃이 바뀌어도 찾는가")
        driver.set_window_size(900, 900)
        narrow = _find_login_button(driver)
        check("좁은 창에서도 버튼 발견", narrow is not None, True)
        if narrow is not None:
            narrow_id = narrow.get_attribute("id") or ""
            print(f"  선택된 요소: id={narrow_id!r}")
            check("좁은 창에서도 누를 수 있음", _is_clickable(narrow), True)
    finally:
        try:
            driver.quit()
        except Exception:
            pass

    print()
    if FAILURES:
        print(f"FAIL {len(FAILURES)}건")
        for line in FAILURES:
            print(f" - {line}")
        return 1
    print("NAVER_LOGIN_BUTTON_LIVE_VERIFY_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
