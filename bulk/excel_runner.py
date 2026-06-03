import time
import pandas as pd
from browser.stealth_driver import create_stealth_driver
from auth.naver_login import login
from content.ai_text import AiQuotaError, generate_blog_content
from content.markdown_parser import parse_markdown
from posting.editor import navigate_to_editor, input_title, input_content
from posting.publisher import schedule_publish
from config import BETWEEN_POSTS
from utils.delays import random_delay
from utils.logger import get_logger

logger = get_logger(__name__)

# 열 이름 후보 (대소문자 무관, 첫 매칭 사용)
_COL_ID  = ["아이디", "id", "계정", "account"]
_COL_PW  = ["비밀번호", "password", "pw", "패스워드"]
_COL_KW  = ["핵심키워드", "키워드", "keyword", "kw", "주제"]


def _find_col(columns, candidates):
    """DataFrame 열 이름에서 후보 중 첫 매칭 반환"""
    lower = {c.lower(): c for c in columns}
    for cand in candidates:
        if cand.lower() in lower:
            return lower[cand.lower()]
    return None


def run_bulk_posting(excel_path, api_key, schedule=True, ai_model="gemini-2.5-flash", claude_key=None):
    """엑셀 기반 대량 발행

    엑셀 구조 (열 이름 유연하게 인식):
      아이디/id/계정  |  비밀번호/password/pw  |  핵심키워드/키워드/keyword
    """
    logger.info(f"엑셀 파일 로드: {excel_path}")
    df = pd.read_excel(excel_path)

    col_id = _find_col(df.columns, _COL_ID)
    col_pw = _find_col(df.columns, _COL_PW)
    col_kw = _find_col(df.columns, _COL_KW)

    if not col_id or not col_pw or not col_kw:
        missing = []
        if not col_id: missing.append("아이디")
        if not col_pw: missing.append("비밀번호")
        if not col_kw: missing.append("핵심키워드")
        raise ValueError(
            f"엑셀 열을 찾을 수 없습니다: {', '.join(missing)}\n"
            f"현재 열 이름: {list(df.columns)}"
        )

    # ai_model에 따라 실제 사용할 API 키 결정
    active_key = claude_key if ai_model == "claude" else api_key

    total = len(df)
    success = 0
    fail = 0

    for index, row in df.iterrows():
        account_id = str(row[col_id]).strip()
        account_pw = str(row[col_pw]).strip()
        keyword    = str(row[col_kw]).strip()

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

        except AiQuotaError as e:
            fail += 1
            logger.error(str(e))
            logger.error("남은 엑셀 행도 같은 이유로 실패할 가능성이 높아 대량 발행을 중단합니다.")
            break
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
