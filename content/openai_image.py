import base64
import os
import tempfile
import time

import requests

from utils.logger import get_logger

logger = get_logger(__name__)


def _normalize_prompt(prompt):
    if not prompt:
        return ""
    if "프롬프트:" in prompt:
        prompt = prompt.split("프롬프트:", 1)[1].strip().strip('"')
    return str(prompt).strip()


def _save_image_bytes(data):
    image_path = os.path.join(
        tempfile.gettempdir(),
        f"generated_openai_image_{int(time.time() * 1000)}.png",
    )
    with open(image_path, "wb") as f:
        f.write(data)
    return image_path


def _download_image(url):
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    return _save_image_bytes(response.content)


def generate_image(prompt, api_key, max_retries=2, model=None):
    """OpenAI Image API로 이미지 생성 후 임시 파일 경로 반환."""
    prompt = _normalize_prompt(prompt)
    if not prompt:
        logger.error("OpenAI 이미지 생성 실패: 프롬프트 비어 있음")
        return None
    if not api_key:
        logger.error("OpenAI 이미지 생성 실패: API Key 없음")
        return None

    model = (model or os.environ.get("AIMAX_OPENAI_IMAGE_MODEL", "gpt-image-1")).strip() or "gpt-image-1"
    quality = os.environ.get("AIMAX_OPENAI_IMAGE_QUALITY", "medium").strip() or "medium"
    size = os.environ.get("AIMAX_OPENAI_IMAGE_SIZE", "1024x1024").strip() or "1024x1024"
    last_error = None

    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"OpenAI 이미지 생성 중 ({attempt}/{max_retries}): {prompt[:50]}...")
            response = requests.post(
                "https://api.openai.com/v1/images/generations",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "prompt": prompt,
                    "n": 1,
                    "size": size,
                    "quality": quality,
                    "output_format": "png",
                },
                timeout=180,
            )

            if response.status_code >= 400:
                last_error = f"HTTP {response.status_code} {response.text[:300]}"
                logger.warning(f"OpenAI 이미지 생성 시도 실패 ({attempt}/{max_retries}): {last_error}")
            else:
                data = response.json()
                item = (data.get("data") or [{}])[0] or {}
                if item.get("b64_json"):
                    image_path = _save_image_bytes(base64.b64decode(item["b64_json"]))
                    logger.info(f"OpenAI 이미지 생성 완료: {image_path}")
                    return image_path
                if item.get("url"):
                    image_path = _download_image(item["url"])
                    logger.info(f"OpenAI 이미지 생성 완료: {image_path}")
                    return image_path
                last_error = "이미지 데이터 없음"
                logger.warning(f"OpenAI 이미지 생성 재시도 필요: {last_error}")
        except Exception as e:
            last_error = str(e)
            logger.warning(f"OpenAI 이미지 생성 시도 실패 ({attempt}/{max_retries}): {e}")

        if attempt < max_retries:
            time.sleep(1.2 * attempt)

    logger.error(f"OpenAI 이미지 생성 실패: {last_error}")
    return None
