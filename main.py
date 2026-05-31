import sys
import os

# 프로젝트 루트를 sys.path에 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import click
from config import NAVER_ID, NAVER_PW, GEMINI_API_KEY, MAX_LIKES, MAX_COMMENTS
from utils.logger import get_logger

logger = get_logger("main")


@click.group()
def cli():
    """네이버 블로그 자동화 CLI 프로그램"""
    pass


@cli.command()
@click.option('--keyword', '-k', help='AI로 생성할 블로그 글 키워드')
@click.option('--file', '-f', 'md_file', help='기존 마크다운 파일 경로')
@click.option('--style', '-t', default='info', type=click.Choice(['info', 'buy', 'ad']), help='글 스타일 (info=정보성, buy=구매성, ad=광고성)')
@click.option('--schedule', '-s', is_flag=True, help='예약 발행 (기본: 즉시 발행)')
@click.option('--save-only', is_flag=True, help='임시 저장만 (발행하지 않음)')
@click.option('--naver-id', envvar='NAVER_ID', default=NAVER_ID, help='네이버 ID')
@click.option('--naver-pw', envvar='NAVER_PW', default=NAVER_PW, help='네이버 비밀번호')
@click.option('--api-key', envvar='GEMINI_API_KEY', default=GEMINI_API_KEY, help='Gemini API 키')
def write(keyword, md_file, style, schedule, save_only, naver_id, naver_pw, api_key):
    """블로그 글 작성 (키워드 또는 마크다운 파일)"""
    if not keyword and not md_file:
        click.echo("오류: --keyword 또는 --file 옵션을 지정해주세요.")
        return

    _validate_credentials(naver_id, naver_pw, api_key)

    from browser.stealth_driver import create_stealth_driver
    from auth.naver_login import login
    from content.ai_text import generate_blog_content
    from content.markdown_parser import parse_markdown, parse_markdown_file
    from posting.editor import navigate_to_editor, input_title, input_content
    from posting.publisher import save_draft, publish_now, schedule_publish

    driver = None
    try:
        # 콘텐츠 준비
        if keyword:
            logger.info(f"키워드로 글 생성: {keyword} (스타일: {style})")
            content = generate_blog_content(keyword, api_key, style_id=style)
            if not content:
                click.echo("글 생성에 실패했습니다.")
                return
            title, content_list = parse_markdown(content)
        else:
            logger.info(f"마크다운 파일 사용: {md_file}")
            title, content_list = parse_markdown_file(md_file)

        # 브라우저 시작
        driver = create_stealth_driver()

        # 로그인
        login(driver, naver_id, naver_pw)

        # 글쓰기
        navigate_to_editor(driver, naver_id, naver_pw)
        input_title(driver, title)
        input_content(driver, content_list, api_key)

        # 발행
        if save_only:
            save_draft(driver)
            click.echo("임시 저장이 완료되었습니다.")
        elif schedule:
            schedule_publish(driver)
            click.echo("예약 발행이 설정되었습니다.")
        else:
            publish_now(driver)
            click.echo("즉시 발행이 완료되었습니다.")

    except Exception as e:
        logger.error(f"글 작성 중 오류: {e}")
        click.echo(f"오류 발생: {e}")
    finally:
        if driver:
            driver.quit()


@cli.command()
@click.option('--excel', '-e', required=True, help='엑셀 파일 경로 (data.xlsx)')
@click.option('--no-schedule', is_flag=True, help='즉시 발행 (기본: 예약 발행)')
@click.option('--api-key', envvar='GEMINI_API_KEY', default=GEMINI_API_KEY, help='Gemini API 키')
def bulk(excel, no_schedule, api_key):
    """엑셀 기반 대량 블로그 글 발행"""
    if not api_key:
        click.echo("오류: GEMINI_API_KEY를 설정해주세요.")
        return

    from bulk.excel_runner import run_bulk_posting

    success, fail = run_bulk_posting(excel, api_key, schedule=not no_schedule)
    click.echo(f"대량 발행 완료: 성공 {success}개, 실패 {fail}개")


@cli.command()
@click.option('--count', '-c', default=20, help='공감할 포스팅 수 (기본: 20)')
@click.option('--naver-id', envvar='NAVER_ID', default=NAVER_ID, help='네이버 ID')
@click.option('--naver-pw', envvar='NAVER_PW', default=NAVER_PW, help='네이버 비밀번호')
def like(count, naver_id, naver_pw):
    """이웃 포스팅 자동 공감"""
    _validate_credentials(naver_id, naver_pw)

    from browser.stealth_driver import create_stealth_driver
    from auth.naver_login import login
    from engagement.auto_like import auto_like

    driver = None
    try:
        driver = create_stealth_driver()
        login(driver, naver_id, naver_pw)
        liked = auto_like(driver, max_posts=count)
        click.echo(f"자동 공감 완료: {liked}개 성공")
    except Exception as e:
        logger.error(f"자동 공감 중 오류: {e}")
        click.echo(f"오류 발생: {e}")
    finally:
        if driver:
            driver.quit()


@cli.command()
@click.option('--count', '-c', default=10, help='댓글 작성할 포스팅 수 (기본: 10)')
@click.option('--naver-id', envvar='NAVER_ID', default=NAVER_ID, help='네이버 ID')
@click.option('--naver-pw', envvar='NAVER_PW', default=NAVER_PW, help='네이버 비밀번호')
@click.option('--api-key', envvar='GEMINI_API_KEY', default=GEMINI_API_KEY, help='Gemini API 키')
def comment(count, naver_id, naver_pw, api_key):
    """이웃 포스팅 AI 자동 댓글"""
    _validate_credentials(naver_id, naver_pw, api_key)

    from browser.stealth_driver import create_stealth_driver
    from auth.naver_login import login
    from engagement.auto_comment import auto_comment

    driver = None
    try:
        driver = create_stealth_driver()
        login(driver, naver_id, naver_pw)
        commented = auto_comment(driver, api_key, max_posts=count, naver_id=naver_id)
        click.echo(f"자동 댓글 완료: {commented}개 성공")
    except Exception as e:
        logger.error(f"자동 댓글 중 오류: {e}")
        click.echo(f"오류 발생: {e}")
    finally:
        if driver:
            driver.quit()


@cli.command()
@click.option('--like', '-l', 'like_count', default=20, help='공감 수 (기본: 20)')
@click.option('--comment', '-c', 'comment_count', default=10, help='댓글 수 (기본: 10)')
@click.option('--naver-id', envvar='NAVER_ID', default=NAVER_ID, help='네이버 ID')
@click.option('--naver-pw', envvar='NAVER_PW', default=NAVER_PW, help='네이버 비밀번호')
@click.option('--api-key', envvar='GEMINI_API_KEY', default=GEMINI_API_KEY, help='Gemini API 키')
def engage(like_count, comment_count, naver_id, naver_pw, api_key):
    """공감 + 댓글 한번에 실행"""
    _validate_credentials(naver_id, naver_pw, api_key)

    from browser.stealth_driver import create_stealth_driver
    from auth.naver_login import login
    from engagement.auto_like import auto_like
    from engagement.auto_comment import auto_comment

    driver = None
    try:
        driver = create_stealth_driver()
        login(driver, naver_id, naver_pw)

        liked = auto_like(driver, max_posts=like_count)
        click.echo(f"자동 공감 완료: {liked}개 성공")

        commented = auto_comment(driver, api_key, max_posts=comment_count, naver_id=naver_id)
        click.echo(f"자동 댓글 완료: {commented}개 성공")

    except Exception as e:
        logger.error(f"참여 활동 중 오류: {e}")
        click.echo(f"오류 발생: {e}")
    finally:
        if driver:
            driver.quit()


@cli.command()
@click.option('--keywords', '-k', required=True, help='검색 키워드 (쉼표 구분: 맛집,여행,카페)')
@click.option('--count', '-c', default=10, help='키워드당 서로이웃 신청 수 (기본: 10)')
@click.option('--naver-id', envvar='NAVER_ID', default=NAVER_ID, help='네이버 ID')
@click.option('--naver-pw', envvar='NAVER_PW', default=NAVER_PW, help='네이버 비밀번호')
def neighbor(keywords, count, naver_id, naver_pw):
    """키워드 검색 기반 서로이웃 자동 추가"""
    _validate_credentials(naver_id, naver_pw)

    from browser.stealth_driver import create_stealth_driver
    from auth.naver_login import login
    from engagement.auto_neighbor import auto_neighbor

    keyword_list = [k.strip() for k in keywords.split(",") if k.strip()]
    if not keyword_list:
        click.echo("오류: 유효한 키워드가 없습니다.")
        return

    driver = None
    try:
        driver = create_stealth_driver()
        login(driver, naver_id, naver_pw)
        total = auto_neighbor(driver, keyword_list, max_per_keyword=count,
                              naver_id=naver_id, naver_pw=naver_pw)
        click.echo(f"서로이웃 추가 완료: {total}명 신청")
    except Exception as e:
        logger.error(f"서로이웃 추가 중 오류: {e}")
        click.echo(f"오류 발생: {e}")
    finally:
        if driver:
            driver.quit()


def _validate_credentials(naver_id=None, naver_pw=None, api_key=None):
    """인증 정보 유효성 검증"""
    if naver_id is not None and not naver_id:
        click.echo("오류: NAVER_ID를 설정해주세요. (.env 파일 또는 --naver-id 옵션)")
        sys.exit(1)
    if naver_pw is not None and not naver_pw:
        click.echo("오류: NAVER_PW를 설정해주세요. (.env 파일 또는 --naver-pw 옵션)")
        sys.exit(1)
    if api_key is not None and not api_key:
        click.echo("오류: GEMINI_API_KEY를 설정해주세요. (.env 파일 또는 --api-key 옵션)")
        sys.exit(1)


if __name__ == "__main__":
    cli()
