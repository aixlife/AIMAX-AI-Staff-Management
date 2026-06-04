"""AI 텍스트 생성 통합 모듈 — Claude / Gemini / OpenAI 선택 가능"""
import re

from content.prompts import get_style_guide, STYLES
from content.seo_brief import format_seo_brief_for_prompt
from utils.logger import get_logger

logger = get_logger(__name__)


class AiGenerationError(RuntimeError):
    """사용자에게 그대로 보여줄 수 있는 AI 생성 오류."""

    fatal = False


class AiQuotaError(AiGenerationError):
    """API 사용량/요금제 문제처럼 남은 작업도 실패할 가능성이 높은 오류."""

    fatal = True

    def __init__(self, message, retry_after=None, hard_stop=True):
        super().__init__(message)
        self.retry_after = retry_after
        self.hard_stop = hard_stop


def _classify_provider_error(provider, exc):
    """공급자 예외를 사용자에게 보여줄 오류로 분류한다.

    반환: (raise 할 오류 객체, 일시적 오류라 재시도 가치가 있는지)
    """
    msg = str(exc) or exc.__class__.__name__
    low = msg.lower()
    status = getattr(exc, "status_code", None) or getattr(exc, "code", None)

    # 인증/키 문제 - 재시도해도 안 됨
    if status in (401, 403) or any(k in low for k in (
        "authentication", "invalid x-api-key", "api key", "api_key_invalid", "api key expired", "permission")):
        return AiQuotaError(f"{provider} API 키 인증 실패 - 키를 확인/갱신해주세요. ({msg[:160]})", hard_stop=True), False

    # 사용량/요금제 - 결제/크레딧 고갈은 재시도 무의미, 순간 rate limit 은 재시도 가치 있음
    if status == 429 or any(k in low for k in (
        "quota", "insufficient", "credit", "billing", "rate limit", "resource_exhausted", "limit: 0")):
        credit_dead = any(k in low for k in ("insufficient_quota", "credit", "billing", "limit: 0", "expired"))
        transient = (not credit_dead) and (status == 429 or "rate" in low)
        return AiQuotaError(f"{provider} 사용량/요금제 한도 초과 - 결제/사용량 한도를 확인해주세요. ({msg[:160]})", hard_stop=True), transient

    # 일시적 서버/네트워크 오류 - 재시도 가치 있음
    if status in (500, 502, 503, 529) or any(k in low for k in (
        "overloaded", "unavailable", "timeout", "timed out", "temporarily", "try again", "503", "529", "500")):
        return AiGenerationError(f"{provider} 일시적 오류 - 잠시 후 다시 시도해주세요. ({msg[:160]})"), True

    return AiGenerationError(f"{provider} 글 생성 오류: {msg[:200]}"), False


def _safe_generate_once(prompt, api_key, model):
    """보조(재작성) 생성용 — 실패해도 예외를 삼켜 원본 결과를 보존한다.

    1차 생성은 _generate_once 로 직접 호출해 실패를 사용자에게 노출하지만,
    키워드/글자수 완화 같은 재작성은 실패하더라도 이미 만든(과금된) 본문을 버리면 안 되므로
    여기서 예외를 흡수한다.
    """
    try:
        return _normalize_generation_result(_generate_once(prompt, api_key, model))
    except AiGenerationError as e:
        logger.warning("보조 재작성 실패 - 직전 결과를 유지합니다: %s", e)
        return None, {}
    except Exception as e:  # noqa: BLE001 - 재작성은 어떤 실패든 원본 보존이 우선
        logger.warning("보조 재작성 예외 - 직전 결과를 유지합니다: %s", str(e)[:160])
        return None, {}


def generate_blog_content(keyword, api_key, style_id="info", model="gemini-3.1-pro-preview",
                          cta_link=None, cta_text=None, word_count=1500,
                          image_count=3,
                          seo_brief=None,
                          return_usage=False):
    """키워드 기반 마크다운 블로그 글 생성

    Args:
        keyword: 블로그 글 키워드
        api_key: API 키 (Claude, Gemini 또는 OpenAI)
        style_id: 글 스타일 ('info'=정보성, 'buy'=구매성, 'ad'=광고성)
        model: AI 모델 ('claude', Gemini 모델 ID 또는 GPT 모델 ID)
        cta_link: CTA 링크 URL (선택)
        cta_text: CTA 문구/설명 (선택)
        seo_brief: 상위 글 분석 브리프 dict (선택)
        return_usage: True면 (content, usage_dict) 튜플 반환
    """
    target_chars = _normalize_target_char_count(word_count)
    char_range = _target_char_range(target_chars)
    style_guide = get_style_guide(style_id, word_count=target_chars)
    style_name = STYLES.get(style_id, STYLES["info"])["name"]

    cta_instruction = ""
    if cta_link:
        cta_desc = cta_text or "자세한 내용 확인"
        cta_instruction = f"""

CTA 요청:
- 결론 섹션의 맨 마지막에 아래 링크를 자연스럽게 연결해주세요.
- 링크: {cta_link}
- 용도: {cta_desc}
- 노골적인 광고처럼 보이지 않게, 독자에게 도움이 되는 정보를 더 얻을 수 있다는 맥락으로 자연스럽게 유도하세요.
- 링크는 본문 텍스트 안에 그대로 URL을 포함시켜주세요 (마크다운 링크 문법 사용 금지, URL 그대로 노출).
- 중요: CTA 링크가 포함된 문장이 글의 마지막 문장이어야 합니다. CTA 이후에 추가 문장이나 섹션을 절대 작성하지 마세요."""

    image_count = _normalize_image_count(image_count)
    seo_instruction = format_seo_brief_for_prompt(seo_brief)

    prompt = f"""{style_guide}

키워드: {keyword}{cta_instruction}

위 키워드를 바탕으로 블로그 글을 작성해주세요.

분량 기준:
- 목표는 단어 수가 아니라 최종 노출 글자 수입니다.
- 제목과 본문을 합쳐 공백 포함 {target_chars}자에 맞추세요.
- 마크다운 기호(`#`, `##`, `**`)와 [이미지] 프롬프트 줄은 글자 수에서 제외합니다.
- 허용 범위는 {char_range['min']}자 이상 {char_range['max']}자 이하입니다. 이 범위를 벗어나면 실패로 간주합니다.
- 분량을 맞추기 위해 소제목 수와 문단 수를 조절하고, 불필요한 반복 설명은 넣지 마세요.

키워드 사용 품질 기준:
- 정확한 키워드 문구 "{keyword}"는 제목 포함 전체 글에서 {_keyword_limit(target_chars)}회 이하로만 사용하세요.
- 제목과 첫 문단 이후에는 같은 문구를 반복하기보다 의미가 통하는 자연스러운 대체 표현을 사용하세요.
- 서로 이어지는 문단이나 소제목을 같은 키워드로 시작하지 마세요.
- 검색 의도는 충분히 반영하되, 키워드 나열처럼 보이면 안 됩니다.

이미지 생성 기준:
- [이미지] 줄은 정확히 {image_count}개만 작성하세요.
- 각 이미지 프롬프트는 글의 내용을 보완하는 실제 블로그용 사진처럼 구체적으로 작성하세요.
- 같은 구도나 같은 소재가 반복되지 않게 하세요.
- 이미지가 0개라면 [이미지] 줄을 만들지 마세요.{seo_instruction}"""

    logger.info(f"블로그 글 생성 중: {keyword} (스타일: {style_name}, 모델: {model})")

    result = _generate_once(prompt, api_key, model)
    text, usage = _normalize_generation_result(result)
    report = _keyword_repetition_report(text, keyword, target_chars)
    if text and report["needs_rewrite"]:
        logger.warning(
            "키워드 반복 감지: %s회, 문단 시작 %s회 (한도 %s회). 재작성 요청",
            report["exact_count"],
            report["paragraph_start_count"],
            report["limit"],
        )
        rewrite_prompt = _rewrite_keyword_repetition_prompt(
            text,
            keyword,
            report["limit"],
            image_count=image_count,
            cta_link=cta_link,
            target_chars=target_chars,
        )
        rewritten_text, rewrite_usage = _safe_generate_once(rewrite_prompt, api_key, model)
        if rewritten_text:
            text = rewritten_text
            usage = _merge_usage(usage, rewrite_usage)
            logger.info("키워드 반복 완화 재작성 완료")
        else:
            logger.warning("키워드 반복 완화 재작성 실패. 최초 생성 결과를 사용합니다.")

    if text:
        text, usage, char_report = _enforce_character_count(
            text,
            keyword,
            target_chars,
            image_count,
            cta_link,
            api_key,
            model,
            usage,
        )
        logger.info(
            "글자 수 확인: %s자 (목표 %s자, 허용 %s-%s자, 통과=%s)",
            char_report["count"],
            char_report["target"],
            char_report["min"],
            char_report["max"],
            char_report["in_range"],
        )

    if return_usage:
        return text, usage
    return text


def _generate_once(prompt, api_key, model):
    if model == "claude":
        return _generate_with_claude(prompt, api_key)
    if str(model or "").startswith("gpt-"):
        return _generate_with_openai(prompt, api_key, str(model).strip())
    # model 값이 구체적인 Gemini 모델 ID이면 그대로 사용,
    # 레거시 "gemini" 문자열이면 기본 모델로 폴백
    gemini_model_id = _normalize_gemini_model_id(model)
    return _generate_with_gemini(prompt, api_key, gemini_model_id)


def _normalize_gemini_model_id(model):
    value = str(model or "").strip()
    aliases = {
        "gemini": "gemini-3.1-pro-preview",
        "gemini-pro": "gemini-3.1-pro-preview",
        "gemini-2.5-pro": "gemini-3.1-pro-preview",
        "gemini-3.1-pro": "gemini-3.1-pro-preview",
    }
    if value in aliases:
        return aliases[value]
    return value if value.startswith("gemini-") else "gemini-3.1-pro-preview"


def _normalize_generation_result(result):
    if isinstance(result, tuple):
        return result[0], result[1] or {}
    return result, {}


def _merge_usage(base, extra):
    merged = dict(base or {})
    for key, value in (extra or {}).items():
        if isinstance(value, (int, float)) and isinstance(merged.get(key), (int, float)):
            merged[key] += value
        elif value is not None:
            merged[key] = value
    return merged


def _normalize_target_char_count(value):
    try:
        count = int(value)
    except (TypeError, ValueError):
        count = 1500
    return max(300, min(6000, count))


def _target_char_range(target_chars, tolerance=0.05):
    target_chars = _normalize_target_char_count(target_chars)
    return {
        "target": target_chars,
        "min": max(1, int(round(target_chars * (1 - tolerance)))),
        "max": max(1, int(round(target_chars * (1 + tolerance)))),
    }


def measure_visible_char_count(text):
    """제목/본문의 최종 노출 글자 수를 공백 포함 기준으로 센다.

    마크다운 기호와 [이미지] 프롬프트 줄은 실제 본문에 그대로 들어가지 않으므로 제외한다.
    줄바꿈은 문단 구분용으로 보고 글자 수에서 제외한다.
    """
    visible_lines = []
    for raw_line in str(text or "").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("[이미지]"):
            continue
        line = re.sub(r"^#{1,6}\s*", "", line).strip()
        line = re.sub(r"^[\s]*[-*]\s+", "", line).strip()
        line = line.replace("**", "").replace("`", "")
        visible_lines.append(line)
    visible = " ".join(visible_lines)
    visible = re.sub(r"\s+", " ", visible).strip()
    return len(visible)


def _character_count_report(text, target_chars):
    range_info = _target_char_range(target_chars)
    count = measure_visible_char_count(text)
    return {
        **range_info,
        "count": count,
        "in_range": range_info["min"] <= count <= range_info["max"],
    }


def _keyword_limit(word_count):
    try:
        count = int(word_count)
    except (TypeError, ValueError):
        count = 1500
    if count <= 900:
        return 4
    if count <= 1700:
        return 5
    return 6


def _normalize_image_count(value):
    try:
        count = int(value)
    except (TypeError, ValueError):
        count = 3
    return max(0, min(8, count))


def _keyword_repetition_report(text, keyword, word_count=1500):
    text = text or ""
    keyword = str(keyword or "").strip()
    limit = _keyword_limit(word_count)
    if not text or not keyword:
        return {
            "exact_count": 0,
            "paragraph_start_count": 0,
            "limit": limit,
            "needs_rewrite": False,
        }

    exact_pattern = re.compile(re.escape(keyword), re.IGNORECASE)
    exact_count = len(exact_pattern.findall(text))

    paragraph_start_count = 0
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("[이미지]"):
            continue
        line = re.sub(r"^#{1,6}\s*", "", line).strip()
        if line.lower().startswith(keyword.lower()):
            paragraph_start_count += 1

    return {
        "exact_count": exact_count,
        "paragraph_start_count": paragraph_start_count,
        "limit": limit,
        "needs_rewrite": exact_count > limit or paragraph_start_count >= 4,
    }


def _rewrite_keyword_repetition_prompt(text, keyword, limit, image_count=3, cta_link=None, target_chars=1500):
    char_range = _target_char_range(target_chars)
    cta_rule = ""
    if cta_link:
        cta_rule = f"""
- 기존 CTA URL `{cta_link}`는 삭제하지 말고 글의 마지막 문장에만 자연스럽게 유지하세요."""
    return f"""아래 네이버 블로그 글은 정확한 키워드 문구가 너무 반복되어 어색합니다.
의미와 구조는 유지하되, 키워드 과반복만 줄여 자연스러운 최종 원고로 다시 작성하세요.

수정 기준:
- 정확한 키워드 문구 "{keyword}"는 제목 포함 전체 글에서 최대 {limit}회까지만 사용하세요.
- 첫 문단 이후에는 동의어, 상위개념, 관련 상황 표현으로 자연스럽게 바꾸세요.
- 문단과 소제목이 같은 키워드로 반복 시작되지 않게 하세요.
- 마크다운 구조(`#`, `##`, `[이미지]`)는 유지하되, [이미지] 줄은 정확히 {image_count}개만 유지하세요.
- 최종 노출 글자 수는 공백 포함 {char_range['min']}자 이상 {char_range['max']}자 이하로 맞추세요.
- 새 설명이나 분석을 덧붙이지 말고 최종 글 본문만 출력하세요.{cta_rule}

원문:
{text}"""


def _rewrite_character_count_prompt(text, keyword, target_chars, image_count=3, cta_link=None):
    report = _character_count_report(text, target_chars)
    direction = "줄이세요" if report["count"] > report["max"] else "보강하세요"
    delta = target_chars - report["count"]
    adjustment_rule = (
        f"현재보다 약 {abs(delta)}자 줄이고, 반복 문장부터 정리하세요."
        if delta < 0
        else f"현재보다 약 {abs(delta)}자 늘리고, 실제 예시나 체크 포인트를 한 단락 이상 추가하세요."
    )
    cta_rule = ""
    if cta_link:
        cta_rule = f"""
- 기존 CTA URL `{cta_link}`는 삭제하지 말고 글의 마지막 문장에만 자연스럽게 유지하세요."""
    return f"""아래 네이버 블로그 글의 분량이 요청 범위를 벗어났습니다.
내용의 핵심과 검색 의도는 유지하되, 최종 원고를 다시 작성하세요.

분량 기준:
- 목표 글자 수: 공백 포함 {target_chars}자
- 허용 범위: {report['min']}자 이상 {report['max']}자 이하
- 현재 글자 수: {report['count']}자
- 제목과 본문을 합산하되, 마크다운 기호(`#`, `##`, `**`)와 [이미지] 프롬프트 줄은 제외합니다.

수정 기준:
- 현재 분량에 맞게 문단 수와 설명 밀도를 조절해 {direction}.
- {adjustment_rule}
- 최종 결과는 반드시 {report['min']}자 이상 {report['max']}자 이하로 끝내세요. 이 범위를 벗어난 원고는 실패입니다.
- [이미지] 줄은 정확히 {image_count}개만 유지하세요.
- 정확한 키워드 문구 "{keyword}"는 전체 글에서 최대 {_keyword_limit(target_chars)}회까지만 사용하세요.
- 새 설명이나 분석을 덧붙이지 말고 최종 글 본문만 출력하세요.{cta_rule}

원문:
{text}"""


def _enforce_character_count(text, keyword, target_chars, image_count, cta_link, api_key, model, usage):
    report = _character_count_report(text, target_chars)
    max_attempts = 4
    for attempt in range(max_attempts):
        if report["in_range"]:
            return text, usage, report

        logger.warning(
            "글자 수 범위 초과: %s자 (목표 %s자, 허용 %s-%s자). 재작성 %s/%s",
            report["count"],
            report["target"],
            report["min"],
            report["max"],
            attempt + 1,
            max_attempts,
        )
        rewrite_prompt = _rewrite_character_count_prompt(
            text,
            keyword,
            target_chars,
            image_count=image_count,
            cta_link=cta_link,
        )
        rewritten_text, rewrite_usage = _safe_generate_once(rewrite_prompt, api_key, model)
        if not rewritten_text:
            logger.warning("글자 수 조정 재작성 실패. 직전 결과를 사용합니다.")
            break
        text = rewritten_text
        usage = _merge_usage(usage, rewrite_usage)
        report = _character_count_report(text, target_chars)

    return text, usage, report


def _extract_anthropic_text(response):
    """Anthropic 응답에서 텍스트 블록을 안전하게 합쳐 반환 (과금된 본문을 잃지 않도록 방어적)."""
    try:
        blocks = getattr(response, "content", None) or []
        parts = []
        for block in blocks:
            text = getattr(block, "text", None)
            if text:
                parts.append(text)
        return "\n".join(parts).strip()
    except Exception:
        return ""


def _generate_with_claude(prompt, api_key):
    """Claude API로 글 생성 → (content, usage) 반환.

    실패 시 None 을 조용히 반환하지 않고, 사용자에게 보여줄 수 있는 오류(AiQuotaError/AiGenerationError)를
    raise 한다. 일시적 오류(rate limit/overload/timeout)는 백오프로 최대 3회 재시도한다.
    """
    import time

    if not (api_key or "").strip():
        raise AiGenerationError("Claude 모델을 선택했으나 API 키가 없습니다.")
    try:
        import anthropic
    except Exception as e:
        raise AiGenerationError(f"Claude SDK 로드 실패: {e}")

    client = anthropic.Anthropic(api_key=api_key)
    max_attempts = 3
    last_error = None

    for attempt in range(1, max_attempts + 1):
        try:
            response = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=8000,
                messages=[{"role": "user", "content": prompt}],
            )
            text = _extract_anthropic_text(response)
            usage = {}
            try:
                usage = {
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens,
                }
            except Exception:
                pass  # 본문은 살아있으니 usage 실패해도 본문을 버리지 않는다
            if text:
                logger.info(f"Claude 글 생성 완료 (in={usage.get('input_tokens','?')}, out={usage.get('output_tokens','?')})")
                return text, usage
            stop = getattr(response, "stop_reason", None)
            last_error = AiGenerationError(f"Claude가 빈 본문을 반환했습니다 (stop_reason={stop}). 잠시 후 다시 시도해주세요.")
            break  # 빈 본문은 재시도해도 동일할 가능성이 커서 중단
        except AiGenerationError:
            raise
        except Exception as e:
            error, transient = _classify_provider_error("Claude", e)
            last_error = error
            if transient and attempt < max_attempts:
                delay = min(20, 4 * attempt)
                logger.warning(f"Claude 글 생성 재시도 {attempt}/{max_attempts - 1}: {str(e)[:160]} (대기 {delay}s)")
                time.sleep(delay)
                continue
            raise error

    raise last_error or AiGenerationError("Claude 글 생성 실패")


def _extract_openai_text(data):
    if not isinstance(data, dict):
        return None
    if data.get("output_text"):
        return str(data.get("output_text") or "").strip()

    chunks = []
    for item in data.get("output") or []:
        if not isinstance(item, dict):
            continue
        for content in item.get("content") or []:
            if not isinstance(content, dict):
                continue
            if content.get("type") == "output_text" and content.get("text"):
                chunks.append(str(content.get("text")))
    return "\n".join(chunks).strip() or None


class _HttpStatusError(Exception):
    """HTTP 상태코드를 분류기에 넘기기 위한 경량 예외."""

    def __init__(self, status, body):
        super().__init__(f"HTTP {status} {body}")
        self.status_code = status


def _generate_with_openai(prompt, api_key, model_id="gpt-5.4-mini"):
    """OpenAI Responses API로 글 생성 -> (content, usage) 반환.

    실패 시 None 을 조용히 반환하지 않고 사용자에게 보여줄 오류를 raise 한다.
    일시적 오류(5xx/timeout)는 최대 3회 재시도한다.
    """
    import time

    if not (api_key or "").strip():
        raise AiGenerationError("OpenAI 모델을 선택했으나 API 키가 없습니다.")

    import requests

    max_attempts = 3
    last_error = None
    for attempt in range(1, max_attempts + 1):
        try:
            response = requests.post(
                "https://api.openai.com/v1/responses",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model_id,
                    "input": prompt,
                    "max_output_tokens": 8000,
                    "reasoning": {"effort": "low"},
                    "store": False,
                },
                timeout=180,
            )
            if response.status_code >= 400:
                raise _HttpStatusError(response.status_code, response.text[:300])

            data = response.json()
            text = _extract_openai_text(data)
            usage_data = data.get("usage") or {}
            output_details = usage_data.get("output_tokens_details") or {}
            usage = {
                "input_tokens": usage_data.get("input_tokens") or 0,
                "output_tokens": usage_data.get("output_tokens") or 0,
                "thinking_tokens": output_details.get("reasoning_tokens") or 0,
                "billable_output_tokens": usage_data.get("output_tokens") or 0,
                "total_tokens": usage_data.get("total_tokens") or 0,
            }
            if text:
                logger.info(f"OpenAI 글 생성 완료 [{model_id}] (in={usage['input_tokens']}, out={usage['output_tokens']})")
                return text, usage
            last_error = AiGenerationError("OpenAI가 빈 본문을 반환했습니다. 잠시 후 다시 시도해주세요.")
            break
        except AiGenerationError:
            raise
        except Exception as e:
            error, transient = _classify_provider_error("OpenAI", e)
            last_error = error
            if transient and attempt < max_attempts:
                delay = min(20, 4 * attempt)
                logger.warning(f"OpenAI 글 생성 재시도 {attempt}/{max_attempts - 1}: {str(e)[:160]} (대기 {delay}s)")
                time.sleep(delay)
                continue
            raise error

    raise last_error or AiGenerationError("OpenAI 글 생성 실패")


def _generate_with_gemini(prompt, api_key, model_id="gemini-3.1-pro-preview"):
    """Gemini API로 글 생성 → (content, usage) 반환.

    실패 시 None 을 조용히 반환하지 않고 사용자에게 보여줄 오류를 raise 한다.
    일시적 오류(UNAVAILABLE/503/rate limit)는 백오프로 최대 3회 재시도한다.
    """
    import time

    if not (api_key or "").strip():
        raise AiGenerationError("Gemini 모델을 선택했으나 API 키가 없습니다.")
    try:
        from google import genai
    except Exception as e:
        raise AiGenerationError(f"Gemini SDK 로드 실패: {e}")

    client = genai.Client(api_key=api_key)
    max_attempts = 3
    last_error = None

    for attempt in range(1, max_attempts + 1):
        try:
            response = client.models.generate_content(
                model=model_id,
                contents=prompt
            )

            if response and response.text:
                usage = {}
                try:
                    meta = response.usage_metadata
                    thoughts_tokens = getattr(meta, "thoughts_token_count", 0) or 0
                    output_tokens = meta.candidates_token_count or 0
                    usage = {
                        "input_tokens":  meta.prompt_token_count,
                        "output_tokens": output_tokens,
                        "thinking_tokens": thoughts_tokens,
                        "billable_output_tokens": output_tokens + thoughts_tokens,
                        "total_tokens": getattr(meta, "total_token_count", None),
                    }
                except Exception:
                    pass
                logger.info(f"Gemini 글 생성 완료 [{model_id}] (in={usage.get('input_tokens','?')}, out={usage.get('output_tokens','?')})")
                return response.text, usage
            last_error = AiGenerationError("Gemini가 빈 본문을 반환했습니다. 잠시 후 다시 시도해주세요.")
            break
        except AiGenerationError:
            raise
        except Exception as e:
            error, transient = _classify_provider_error("Gemini", e)
            last_error = error
            if transient and attempt < max_attempts:
                delay = min(20, 4 * attempt)
                logger.warning(f"Gemini 글 생성 재시도 {attempt}/{max_attempts - 1}: {str(e)[:180]} (대기 {delay}s)")
                time.sleep(delay)
                continue
            raise error

    raise last_error or AiGenerationError("Gemini 글 생성 실패")
