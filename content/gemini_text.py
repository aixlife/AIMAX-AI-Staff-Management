from google import genai
from content.prompts import get_style_guide, STYLES
from utils.logger import get_logger

logger = get_logger(__name__)


def generate_blog_content(keyword, api_key, style_id="info"):
    """키워드 기반 마크다운 블로그 글 생성 (ccidablog 프롬프트 3종 지원)

    Args:
        keyword: 블로그 글 키워드
        api_key: Gemini API 키
        style_id: 글 스타일 ('info'=정보성, 'buy'=구매성, 'ad'=광고성)
    """
    client = genai.Client(api_key=api_key)

    style_guide = get_style_guide(style_id)
    style_name = STYLES.get(style_id, STYLES["info"])["name"]

    prompt = f"""{style_guide}

키워드: {keyword}

위 키워드를 바탕으로 블로그 글을 작성해주세요."""

    logger.info(f"블로그 글 생성 중: {keyword} (스타일: {style_name})")
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )

    if response and response.text:
        logger.info(f"블로그 글 생성 완료: {keyword}")
        return response.text
    else:
        logger.error(f"블로그 글 생성 실패: {keyword}")
        return None


def save_to_markdown(content, title):
    """마크다운 파일로 저장"""
    safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).strip()
    filename = f"{safe_title}.md"

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

    logger.info(f"마크다운 저장 완료: {filename}")
    return filename
