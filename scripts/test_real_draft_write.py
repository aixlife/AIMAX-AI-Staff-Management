"""실제 네이버 블로그 임시저장 테스트 (수정 검증용).

실제 워커와 동일한 순서로 진행한다:
  create_stealth_driver -> login -> navigate_to_editor(_dismiss_draft_popup)
  -> input_title -> input_content(텍스트 전용) -> save_draft

공개 발행이 아닌 임시저장만 한다(되돌림 가능). AI/이미지 키 불필요.
실행: PYTHONPATH=. venv/bin/python scripts/test_real_draft_write.py
"""
import sys
import time
import traceback

sys.path.insert(0, ".")

from app import load_settings
from browser.stealth_driver import create_stealth_driver
from auth.naver_login import login
from posting.editor import navigate_to_editor, input_title, input_content
from posting.publisher import save_draft


def main():
    naver_id, naver_pw, *_rest = load_settings()
    if not naver_id:
        print("STAGE error: 저장된 네이버 ID가 없습니다.")
        return 2
    print(f"STAGE start: naver_id={naver_id[:2]}...{naver_id[-2:]}")

    title = "AIMAX 편집기 점검 임시저장 테스트"
    content_list = [
        ("text", [("text", "이 글은 편집기 진입, 작성중 글 팝업 취소, 제목/본문 입력을 점검하는 임시저장 테스트입니다.")]),
        ("text", [("text", "두 번째 문단입니다. 줄바꿈과 본문 입력이 정상인지 확인합니다.")]),
    ]

    driver = None
    try:
        print("STAGE browser_start")
        driver = create_stealth_driver()

        print("STAGE naver_login")
        login(driver, naver_id, naver_pw)

        print("STAGE editor_open")
        navigate_to_editor(driver, naver_id, naver_pw)

        print("STAGE title")
        input_title(driver, title)

        print("STAGE content")
        input_content(driver, content_list, api_key="", image_provider="gemini", fallback_api_key="")

        print("STAGE save_draft")
        ok = save_draft(driver)
        print(f"RESULT draft_saved={bool(ok)}")
        time.sleep(3)
        return 0 if ok else 1
    except Exception as exc:
        print(f"STAGE FAILED: {type(exc).__name__}: {exc}")
        traceback.print_exc()
        return 1
    finally:
        if driver is not None:
            try:
                driver.quit()
            except Exception:
                pass


if __name__ == "__main__":
    sys.exit(main())
