import time
from browser.stealth_driver import create_stealth_driver
from auth.naver_login import login
from bulk.excel_loader import load_bulk_rows
from content.ai_text import generate_blog_content
from content.markdown_parser import parse_markdown
from posting.editor import navigate_to_editor, input_title, input_content
from posting.publisher import schedule_publish
from config import BETWEEN_POSTS
from utils.delays import random_delay
from utils.logger import get_logger

logger = get_logger(__name__)

def run_bulk_posting(excel_path, api_key, schedule=True, ai_model="gemini-3.1-pro-preview", claude_key=None):
    """엑셀 기반 대량 발행

    엑셀 구조 (열 이름 유연하게 인식):
      아이디/id/계정  |  비밀번호/password/pw  |  핵심키워드/키워드/keyword
    """
    logger.info(f"엑셀 파일 로드: {excel_path}")
    rows = load_bulk_rows(excel_path)

    # ai_model에 따라 실제 사용할 API 키 결정
    active_key = claude_key if ai_model == "claude" else api_key

    total = len(rows)
    success = 0
    fail = 0

    for index, row in enumerate(rows):
        account_id = row["account_id"]
        account_pw = row["account_pw"]
        keyword = row["keyword"]

        logger.info(f"[{index + 1}/{total}] 처리 중: {keyword} (계정: {account_id})")

        driver = None
        try:
            # 1. 콘텐츠 생성
            markdown_content = generate_blog_content(keyword, active_key, model=ai_model)
            if not markdown_content:
                logger.error(f"글 생성 실패: {keyword}")
                fail += 1
                continue

            # 2. 마크다운 파싱
            title, content_list = parse_markdown(markdown_content)

            # 3. 브라우저 + 로그인
            driver = create_stealth_driver()
            login(driver, account_id, account_pw)

            # 4. 에디터 진입 + 입력
            navigate_to_editor(driver, account_id, account_pw)
            input_title(driver, title)
            input_content(driver, content_list, active_key)

            # 5. 발행
            if schedule:
                schedule_publish(driver)
            else:
                from posting.publisher import publish_now
                publish_now(driver)

            success += 1
            logger.info(f"성공: {keyword}")

        except Exception as e:
            fail += 1
            logger.error(f"오류 발생: {keyword} - {e}")
        finally:
            if driver:
                try:
                    driver.quit()
                except Exception:
                    pass

        if index < total - 1:
            delay = random_delay(BETWEEN_POSTS, 3.0, 5.0, 20.0)
            logger.info(f"다음 계정까지 {delay:.1f}초 대기...")
            time.sleep(delay)

    logger.info(f"대량 발행 완료: 성공 {success}/{total}, 실패 {fail}/{total}")
    return success, fail
