import os
import time
import tempfile
from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO
from utils.logger import get_logger

logger = get_logger(__name__)


def _normalize_prompt(prompt):
    if not prompt:
        return ""
    if '프롬프트:' in prompt:
        prompt = prompt.split('프롬프트:')[1].strip().strip('"')
    return prompt.strip()


def _iter_parts(response):
    candidates = getattr(response, "candidates", None) or []
    for candidate in candidates:
        content = getattr(candidate, "content", None)
        parts = getattr(content, "parts", None) or []
        for part in parts:
            yield part


def _save_image_part(part):
    inline_data = getattr(part, "inline_data", None)
    if inline_data is None or not getattr(inline_data, "data", None):
        return None

    image = Image.open(BytesIO(inline_data.data))
    image_path = os.path.join(
        tempfile.gettempdir(),
        f"generated_image_{int(time.time() * 1000)}.png"
    )
    image.save(image_path)
    return image_path


def _summarize_response(response):
    candidates = getattr(response, "candidates", None) or []
    summary = []
    for idx, candidate in enumerate(candidates, start=1):
        content = getattr(candidate, "content", None)
        parts = getattr(content, "parts", None) or []
        part_types = []
        for part in parts:
            if getattr(part, "inline_data", None) is not None:
                part_types.append("image")
            elif getattr(part, "text", None):
                part_types.append("text")
            else:
                part_types.append("other")
        summary.append(f"c{idx}:{'/'.join(part_types) or 'empty'}")
    return ", ".join(summary) or "no-candidates"


def generate_image(prompt, api_key, max_retries=3):
    """Gemini로 이미지 생성 후 임시 파일 경로 반환.

    간헐적으로 텍스트만 반환하는 케이스가 있어, 짧은 재시도와
    응답 구조 로그를 남겨 안정성을 높인다.
    """
    prompt = _normalize_prompt(prompt)
    if not prompt:
        logger.error("이미지 생성 실패: 프롬프트 비어 있음")
        return None

    client = genai.Client(api_key=api_key)
    last_error = None

    for attempt in range(1, max_retries + 1):
        try:
            attempt_prompt = prompt
            if attempt > 1:
                attempt_prompt = (
                    f"{prompt}\n\n"
                    "중요: 설명문만 쓰지 말고 실제 이미지를 1장 생성해주세요."
                )

            logger.info(f"이미지 생성 중 ({attempt}/{max_retries}): {prompt[:50]}...")
            response = client.models.generate_content(
                model="gemini-2.5-flash-image",
                contents=attempt_prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["TEXT", "IMAGE"]
                )
            )

            if not response or not getattr(response, "candidates", None):
                last_error = "응답 없음"
                logger.warning(f"이미지 생성 재시도 필요: {last_error}")
            else:
                for part in _iter_parts(response):
                    image_path = _save_image_part(part)
                    if image_path:
                        logger.info(f"이미지 생성 완료: {image_path}")
                        return image_path

                last_error = f"이미지 데이터 없음 ({_summarize_response(response)})"
                logger.warning(f"이미지 생성 재시도 필요: {last_error}")

        except Exception as e:
            last_error = str(e)
            logger.warning(f"이미지 생성 시도 실패 ({attempt}/{max_retries}): {e}")

        if attempt < max_retries:
            time.sleep(1.2 * attempt)

    logger.error(f"이미지 생성 실패: {last_error}")
    return None
