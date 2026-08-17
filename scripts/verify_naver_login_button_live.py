#!/usr/bin/env python3
"""실사이트 검증: 실제 네이버 NID 로그인 페이지에서 로그인 버튼을 찾는지 확인한다.

정적 HTML(curl) 대조만으로는 레이아웃별 버튼(column/row) 중 어느 쪽이 실제로 보이는지
알 수 없다. 여기서는 프로덕션과 같은 셀레니움 스택으로 페이지를 실제 렌더링한 뒤
`_find_login_button` 이 고르는 요소가 보이고 누를 수 있는지까지 확인한다.

기본 모드는 DOM 조회만 한다 — 실계정 정보를 입력하지도, 제출하지도 않는다.

`--submit-probe` 를 주면 한 걸음 더 간다. **존재하지 않는 가짜 계정**으로 로그인 버튼을
한 번만 눌러, 네이버가 "아이디/비밀번호 확인" 화면으로 응답하는지 본다.
버튼을 못 눌렀다면 폼에 그대로 머물기 때문에, 이 응답이 곧 "클릭이 제출까지 이어졌다"는 증거다.
실계정은 절대 쓰지 않으며 재시도도 하지 않는다(반복 실패는 IP 단위 캡차를 부른다).

실행: .venv/bin/python scripts/verify_naver_login_button_live.py [--submit-probe]
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from selenium import webdriver  # noqa: E402
from selenium.webdriver.chrome.options import Options  # noqa: E402
from selenium.webdriver.common.by import By  # noqa: E402

from auth.naver_login import (  # noqa: E402
    _click_login_button,
    _find_login_button,
    _inject_credentials,
    _is_clickable,
)
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

        if "--submit-probe" in sys.argv:
            print("[5] 클릭이 실제 폼 제출까지 이어지는가 (존재하지 않는 가짜 계정, 1회만)")
            driver.set_window_size(1440, 900)
            driver.get(NAVER_LOGIN_URL)
            # 실계정 아님. 로그인 성공을 기대하지 않는다 — 네이버가 "확인" 화면으로
            # 응답하는지만 본다. 버튼을 못 눌렀다면 폼에 그대로 머문다.
            before_url = driver.current_url or ""
            _inject_credentials(driver, "aimax-qa-no-such-account-8f21c", "not-a-real-password-8f21c")
            clicked = _click_login_button(driver)
            check("클릭 자체는 성공", clicked, True)

            # 제출 증거는 두 가지 중 하나다.
            #  (a) URL 이 폼 주소(?mode=form)에서 POST 대상으로 바뀐다
            #  (b) 폼 안에 오류 메시지 요소(.form_message.error)가 나타난다
            # 버튼을 못 눌렀다면 둘 다 일어나지 않는다.
            deadline = time.monotonic() + 12
            error_text = ""
            while time.monotonic() < deadline:
                if (driver.current_url or "") != before_url:
                    break
                for node in driver.find_elements(By.CSS_SELECTOR, ".form_message.error"):
                    text = " ".join((node.text or "").split())
                    if text:
                        error_text = text
                        break
                if error_text:
                    break
                time.sleep(0.5)

            url = driver.current_url or ""
            print(f"  제출 전 URL: {before_url[:80]}")
            print(f"  제출 후 URL: {url[:80]}")
            if error_text:
                print(f"  폼 오류 메시지: {error_text[:120]}")
            submitted = url != before_url or bool(error_text)
            check("폼이 실제로 제출됨(네이버가 응답)", submitted, True)
            if "captcha" in url.lower():
                print("  참고: 캡차 화면 — 제출은 됐다는 뜻이다. 재시도하지 않는다.")
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
