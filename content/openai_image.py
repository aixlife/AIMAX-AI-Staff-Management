import base64
import os
import tempfile
import time
import uuid

import requests

from utils.logger import get_logger

logger = get_logger(__name__)


def _set_last_error(error_code="", message=""):
    generate_image.last_error = {
        "error_code": str(error_code or "").strip(),
        "message": str(message or "").strip()[:500],
    }


def _classify_error(message):
    text = str(message or "").lower()
    if not text:
        return "image_generation_failed"
    if "invalid_api_key" in text or "incorrect api key" in text or "unauthorized" in text or "401" in text:
        return "api_key_invalid"
    if "organization verification" in text or "verify your organization" in text or "must be verified" in text:
        return "organization_verification_required"
    if "billing" in text or "payment" in text or "credit" in text or "insufficient_quota" in text:
        return "quota_exceeded"
    if "rate" in text or "429" in text:
        return "rate_limited"
    if (
        "model" in text
        and ("not found" in text or "does not exist" in text or "unsupported" in text or "not supported" in text)
    ):
        return "model_not_found"
    if "timeout" in text or "timed out" in text:
        return "timeout"
    return "image_generation_failed"


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


def _safe_error_text(response):
    request_id = response.headers.get("x-request-id") or response.headers.get("openai-request-id") or ""
    body = ""
    try:
        payload = response.json()
        error = payload.get("error") if isinstance(payload, dict) else None
        if isinstance(error, dict):
            parts = [
                error.get("code"),
                error.get("type"),
                error.get("param"),
                error.get("message"),
            ]
            body = " | ".join(str(part) for part in parts if part)
        elif isinstance(payload, dict):
            body = str(payload)[:500]
    except Exception:
        body = (response.text or "").strip()[:500]
    if not body:
        body = (response.reason or "empty error response").strip()
    rid = f" request_id={request_id}" if request_id else ""
    return f"HTTP {response.status_code}{rid} {body}".strip()


def _image_request_payload(model, prompt, size, quality, output_format):
    payload = {
        "model": model,
        "prompt": prompt,
        "n": 1,
        "size": size,
        "quality": quality,
        "output_format": output_format,
    }
    moderation = (os.environ.get("AIMAX_OPENAI_IMAGE_MODERATION", "") or "").strip()
    if moderation:
        payload["moderation"] = moderation
    return payload


def _candidate_models(model):
    primary = (model or "gpt-image-1").strip() or "gpt-image-1"
    candidates = [primary]
    enable_fallback = (os.environ.get("AIMAX_OPENAI_IMAGE_MODEL_FALLBACK", "1") or "").strip().lower()
    if enable_fallback not in {"0", "false", "no", "off"} and primary != "gpt-image-1":
        candidates.append("gpt-image-1")
    return candidates


def _should_try_next_model(error_code):
    return error_code in {
        "model_not_found",
        "image_generation_failed",
        "timeout",
        "rate_limited",
    }


def generate_image(prompt, api_key, max_retries=2, model=None):
    """OpenAI Image API로 이미지 생성 후 임시 파일 경로 반환."""
    prompt = _normalize_prompt(prompt)
    _set_last_error("", "")
    if not prompt:
        logger.error("OpenAI 이미지 생성 실패: 프롬프트 비어 있음")
        _set_last_error("empty_image_prompt", "이미지 프롬프트가 비어 있습니다.")
        return None
    if not api_key:
        logger.error("OpenAI 이미지 생성 실패: API Key 없음")
        _set_last_error("api_key_missing", "OpenAI 이미지 생성용 API 키가 없습니다.")
        return None

    model = (model or os.environ.get("AIMAX_OPENAI_IMAGE_MODEL", "gpt-image-1")).strip() or "gpt-image-1"
    quality = os.environ.get("AIMAX_OPENAI_IMAGE_QUALITY", "medium").strip() or "medium"
    size = os.environ.get("AIMAX_OPENAI_IMAGE_SIZE", "1024x1024").strip() or "1024x1024"
    output_format = os.environ.get("AIMAX_OPENAI_IMAGE_OUTPUT_FORMAT", "png").strip() or "png"
    last_error = None

    for candidate_model in _candidate_models(model):
        for attempt in range(1, max_retries + 1):
            request_tag = str(uuid.uuid4())[:8]
            try:
                logger.info(
                    f"OpenAI 이미지 생성 중 ({attempt}/{max_retries}, model={candidate_model}, tag={request_tag}): "
                    f"{prompt[:50]}..."
                )
                response = requests.post(
                    "https://api.openai.com/v1/images/generations",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json=_image_request_payload(candidate_model, prompt, size, quality, output_format),
                    timeout=180,
                )

                if response.status_code >= 400:
                    last_error = _safe_error_text(response)
                    logger.warning(
                        f"OpenAI 이미지 생성 시도 실패 ({attempt}/{max_retries}, model={candidate_model}, tag={request_tag}): "
                        f"{last_error}"
                    )
                    error_code = _classify_error(last_error)
                    if error_code in {"api_key_invalid", "quota_exceeded", "rate_limited", "organization_verification_required"}:
                        break
                    if candidate_model != "gpt-image-1" and error_code == "model_not_found":
                        break
                else:
                    data = response.json()
                    item = (data.get("data") or [{}])[0] or {}
                    if item.get("b64_json"):
                        image_path = _save_image_bytes(base64.b64decode(item["b64_json"]))
                        logger.info(f"OpenAI 이미지 생성 완료: {image_path}")
                        _set_last_error("", "")
                        return image_path
                    if item.get("url"):
                        image_path = _download_image(item["url"])
                        logger.info(f"OpenAI 이미지 생성 완료: {image_path}")
                        _set_last_error("", "")
                        return image_path
                    last_error = "이미지 데이터 없음"
                    logger.warning(f"OpenAI 이미지 생성 재시도 필요: {last_error}")
            except Exception as e:
                last_error = str(e) or e.__class__.__name__
                logger.warning(
                    f"OpenAI 이미지 생성 시도 실패 ({attempt}/{max_retries}, model={candidate_model}, tag={request_tag}): {last_error}"
                )

            if attempt < max_retries:
                time.sleep(1.2 * attempt)

        error_code = _classify_error(last_error)
        if candidate_model != "gpt-image-1" and _should_try_next_model(error_code):
            logger.warning(f"OpenAI 이미지 모델 {candidate_model} 실패({error_code}) - gpt-image-1 fallback 시도")
            continue
        break

    logger.error(f"OpenAI 이미지 생성 실패: {last_error}")
    _set_last_error(_classify_error(last_error), last_error)
    return None
