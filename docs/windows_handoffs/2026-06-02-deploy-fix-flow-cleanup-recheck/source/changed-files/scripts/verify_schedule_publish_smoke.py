"""Live 예약발행(schedule) smoke — 즉시발행 제외, 예약만 실제 검증.

- 실제 네이버 로그인(저장된 자격증명) → SmartEditor 진입 → 제목/본문 입력
- 이미지 블록은 no-paid placeholder 로 대체(유료 AI 호출 없음)
- save_draft 대신 schedule_publish 를 호출해 '먼 미래' 날짜/시각으로 예약 등록
- 검증 포인트: 제목 JS 주입, 달력 월 이동/다른 달 날짜 회피, 시/분 select 폴백,
  예약 confirm 버튼 정확 클릭, "예약 발행 완료" 로그

⚠️ 이 스크립트는 사용자 블로그에 '예약 글'을 실제로 생성한다. 예약 시각이 되면 자동 공개되므로
   테스트 후 [글관리 > 예약] 에서 삭제할 것. 제목에 [AIMAX TEST 예약 - 삭제요망] 표시를 넣는다.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta

# 프로젝트 루트를 import 경로에 추가 (scripts/ 하위 실행 대비)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import load_settings
from auth.naver_login import login
from browser.stealth_driver import create_stealth_driver
from posting import editor
from posting.publisher import schedule_publish


def _fail_if_ai_called(*_args, **_kwargs):
    raise AssertionError("AI provider call is forbidden in schedule smoke")


def fake_input_image(driver, prompt, api_key, image_provider="gemini", fallback_api_key=""):
    editor.human_type(
        driver,
        f"[NO-PAID IMAGE PLACEHOLDER: provider={image_provider}, prompt={prompt}]",
    )
    return {"generated": True, "inserted": True, "provider": image_provider}


def main() -> None:
    naver_id, naver_pw, *_rest = load_settings()
    if not (naver_id or "").strip() or not (naver_pw or "").strip():
        print("SCHEDULE_SMOKE_NEEDS_NAVER_CREDENTIALS")
        raise SystemExit(2)

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    # 7일 뒤, 늦은 시각(23시)으로 예약 — 자동 공개 전 삭제 여유 확보
    target_date = datetime.now() + timedelta(days=7)
    target_hour = 23
    title = f"[AIMAX TEST 예약 - 삭제요망] schedule smoke {stamp}"
    content_list = [
        ("text", [("text", "AIMAX 예약발행 스모크입니다. 자동 검증용이며 예약 시각 전 삭제 예정입니다.")]),
        ("quote", "검증: schedule_publish 달력/시분/확인버튼"),
        ("image", "simple clean test card, no text"),
        ("text", [("text", "이미지 블록은 no-paid placeholder 로 처리했습니다.")]),
    ]

    # 유료 AI 호출 차단 + 이미지 fake
    editor.generate_gemini_image = _fail_if_ai_called
    editor.generate_openai_image = _fail_if_ai_called
    editor._input_image = fake_input_image

    driver = None
    try:
        driver = create_stealth_driver()
        login(driver, naver_id, naver_pw)
        editor.navigate_to_editor(driver, naver_id, naver_pw)
        editor.input_title(driver, title)
        editor.input_content(
            driver,
            content_list,
            api_key="dummy-no-paid",
            image_provider="gemini",
            fallback_api_key="dummy-fallback",
        )
        schedule_publish(driver, target_date=target_date, hour=target_hour, category=None)

        print("SCHEDULE_PUBLISH_SMOKE_OK")
        print(json.dumps(
            {
                "title": title,
                "scheduled_for_date": target_date.strftime("%Y-%m-%d"),
                "scheduled_hour": target_hour,
                "published_immediately": False,
                "note": "예약 글 생성됨 - [글관리 > 예약] 에서 삭제 필요",
            },
            ensure_ascii=False,
            sort_keys=True,
        ))
    finally:
        if driver is not None:
            try:
                driver.quit()
            except Exception:
                pass


if __name__ == "__main__":
    main()
