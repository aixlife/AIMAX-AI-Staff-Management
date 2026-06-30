import os
import time
import tempfile
import base64
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO
from utils.logger import get_logger

logger = get_logger(__name__)

GEMINI_IMAGE_MODEL = os.environ.get("AIMAX_GEMINI_IMAGE_MODEL", "gemini-3.1-flash-image").strip() or "gemini-3.1-flash-image"
try:
    GEMINI_IMAGE_TIMEOUT_SECONDS = max(30, int(os.environ.get("AIMAX_GEMINI_IMAGE_TIMEOUT_SECONDS", "180") or "180"))
except (TypeError, ValueError):
    GEMINI_IMAGE_TIMEOUT_SECONDS = 180


def _set_last_error(error_code="", message=""):
    generate_image.last_error = {
        "error_code": str(error_code or "").strip(),
        "message": str(message or "").strip()[:500],
    }


def _classify_error(message):
    text = str(message or "").lower()
    if not text:
        return "image_generation_failed"
    if "api key" in text or "unauthorized" in text or "permission" in text or "403" in text:
        return "api_key_invalid"
    if "quota" in text or "resource_exhausted" in text:
        return "quota_exceeded"
    if "rate" in text or "429" in text:
        return "rate_limited"
    if "billing" in text or "paid" in text or "payment" in text or "credit" in text:
        return "image_paid_required"
    if "not found" in text or "unsupported" in text or "model" in text:
        return "model_not_found"
    if "timed out" in text or "timeout" in text:
        return "timeout"
    return "image_generation_failed"


def _normalize_prompt(prompt):
    if not prompt:
        return ""
    if '프롬프트:' in prompt:
        prompt = prompt.split('프롬프트:')[1].strip().strip('"')
    return prompt.strip()


def _iter_parts(response):
    direct_parts = getattr(response, "parts", None) or []
    for part in direct_parts:
        yield part
    candidates = getattr(response, "candidates", None) or []
    for candidate in candidates:
        content = getattr(candidate, "content", None)
        parts = getattr(content, "parts", None) or []
        for part in parts:
            yield part


def _save_image_part(part):
    as_image = getattr(part, "as_image", None)
    if callable(as_image):
        image = as_image()
        if image is not None:
            image_path = os.path.join(
                tempfile.gettempdir(),
                f"generated_image_{int(time.time() * 1000)}.png"
            )
            image.save(image_path)
            return image_path

    inline_data = getattr(part, "inline_data", None)
    if inline_data is None or not getattr(inline_data, "data", None):
        return None

    data = inline_data.data
    if isinstance(data, str):
        data = base64.b64decode(data)
    image = Image.open(BytesIO(data))
    image_path = os.path.join(
        tempfile.gettempdir(),
        f"generated_image_{int(time.time() * 1000)}.png"
    )
    image.save(image_path)
    return image_path


def _summarize_response(response):
    direct_parts = getattr(response, "parts", None) or []
    if direct_parts:
        part_types = []
        for part in direct_parts:
            if getattr(part, "inline_data", None) is not None:
                part_types.append("image")
            elif getattr(part, "text", None):
                part_types.append("text")
            else:
                part_types.append("other")
        return f"parts:{'/'.join(part_types) or 'empty'}"
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


def _generate_content_with_timeout(client, *, model, contents, config):
    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(
        client.models.generate_content,
        model=model,
        contents=contents,
        config=config,
    )
    try:
        return future.result(timeout=GEMINI_IMAGE_TIMEOUT_SECONDS)
    except TimeoutError:
        future.cancel()
        raise TimeoutError(f"Gemini image generation timed out after {GEMINI_IMAGE_TIMEOUT_SECONDS}s")
    finally:
        executor.shutdown(wait=False, cancel_futures=True)


def generate_image(prompt, api_key, max_retries=3, model=None):
    """Gemini로 이미지 생성 후 임시 파일 경로 반환.

    간헐적으로 텍스트만 반환하는 케이스가 있어, 짧은 재시도와
    응답 구조 로그를 남겨 안정성을 높인다.
    """
    prompt = _normalize_prompt(prompt)
    _set_last_error("", "")
    if not prompt:
        logger.error("이미지 생성 실패: 프롬프트 비어 있음")
        _set_last_error("empty_image_prompt", "이미지 프롬프트가 비어 있습니다.")
        return None
    if not (api_key or "").strip():
        logger.error("이미지 생성 실패: Gemini API 키가 없습니다. 이미지 없이 본문 입력을 계속합니다.")
        _set_last_error("api_key_missing", "Gemini 이미지 생성용 API 키가 없습니다.")
        return None

    image_model = (model or GEMINI_IMAGE_MODEL).strip() or GEMINI_IMAGE_MODEL
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
            response = _generate_content_with_timeout(
                client,
                model=image_model,
                contents=attempt_prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["TEXT", "IMAGE"]
                ),
            )

            if not response or not getattr(response, "candidates", None):
                last_error = "응답 없음"
                logger.warning(f"이미지 생성 재시도 필요: {last_error}")
            else:
                for part in _iter_parts(response):
                    image_path = _save_image_part(part)
                    if image_path:
                        logger.info(f"이미지 생성 완료: {image_path}")
                        _set_last_error("", "")
                        return image_path

                last_error = f"이미지 데이터 없음 ({_summarize_response(response)})"
                logger.warning(f"이미지 생성 재시도 필요: {last_error}")

        except Exception as e:
            last_error = str(e)
            logger.warning(f"이미지 생성 시도 실패 ({attempt}/{max_retries}): {e}")

        if attempt < max_retries:
            time.sleep(1.2 * attempt)

    logger.error(f"이미지 생성 실패: {last_error}")
    _set_last_error(_classify_error(last_error), last_error)
    return None
