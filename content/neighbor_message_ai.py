"""서로이웃 신청 멘트 AI 생성기.

사용자의 블로그 프로필을 기반으로 자연스러운 서이추 멘트 N개를 한 번에 배치 생성.
생성 후 매 신청마다 풀에서 랜덤 선택(+{닉네임} 치환)하므로 API 호출은 세션당 1회.
"""
from __future__ import annotations

import re
from typing import Optional

from utils.logger import get_logger

logger = get_logger(__name__)


_PROMPT_TEMPLATE = """당신은 네이버 블로그 운영자가 서로이웃을 신청할 때 보낼 메시지를 대신 써주는 작가입니다.
아래는 블로그 운영자 본인의 프로필입니다.

--- 운영자 블로그 프로필 ---
{profile}
---

요구사항:
- 위 프로필에 나타난 블로그 주제·관심사·말투를 살려, 진짜 그 운영자가 쓴 것처럼 자연스럽게 써야 합니다.
- 절대 AI가 쓴 것 같은 형식적 표현을 쓰지 마세요. ("안녕하세요. 좋은 글 잘 보고 갑니다" 같은 일반적 인사 금지)
- 각 멘트는 **50자 이내** (한국어 글자 수 기준).
- 각 멘트 안에 수신자 닉네임 자리는 반드시 `{{닉네임}}` 으로 표기하세요.
- 인사·자기소개·제안(서로이웃)이 자연스럽게 녹아야 합니다.
- 똑같은 시작 패턴을 반복하지 마세요 (각 멘트를 시작 표현이 다르게).
- 딱딱한 존댓말·과한 이모티콘은 지양, 친근한 톤 선호.

**정확히 {count}개의 멘트**를 아래 형식으로만 응답하세요. 설명·번호·따옴표 붙이지 말고 한 줄에 하나씩만:

<멘트1>
<멘트2>
...

지금 바로 생성해 주세요."""


def generate_neighbor_messages(
    profile_text: str,
    api_key: str,
    # 2026-07-21: 2.x 계열은 구글이 신규 API 키에 대해 내렸다. 서로이웃 멘트는 출력이
    # 아주 짧고 건수가 많아, 예리 본문(3.5 Flash)과 달리 최저가 3.x 인 flash-lite 를 쓴다.
    model: str = "gemini-3.1-flash-lite",
    count: int = 10,
    claude_key: Optional[str] = None,
    openai_key: Optional[str] = None,
) -> list[str]:
    """블로거 프로필을 바탕으로 서로이웃 멘트 N개 생성.

    Args:
        profile_text: 운영자 블로그 소개 (사용자가 설정 탭에 작성)
        api_key: Gemini API 키 (model이 gemini 계열일 때)
        model: "claude" | "gpt-*" | "gemini-3.5-flash" | "gemini-3.1-flash-lite" | "gemini-3.1-pro-preview"
        count: 생성할 멘트 개수 (기본 10)
        claude_key: Claude API 키 (model이 "claude"일 때 필요)
        openai_key: OpenAI API 키 (model이 "gpt-*"일 때 필요)

    Returns:
        멘트 리스트. 실패 시 빈 리스트 반환 — 호출자가 fallback 처리.
    """
    if not profile_text or not profile_text.strip():
        logger.warning("프로필이 비어있어 AI 멘트 생성 건너뜀")
        return []

    prompt = _PROMPT_TEMPLATE.format(profile=profile_text.strip(), count=count)
    logger.info(f"서이추 멘트 AI 생성 시작 (model={model}, count={count})")

    text = None
    try:
        if model == "claude":
            if not claude_key:
                logger.error("Claude 모델 선택했으나 claude_key 없음")
                return []
            text = _call_claude(prompt, claude_key)
        elif str(model or "").startswith("gpt-"):
            if not openai_key:
                logger.error("OpenAI 모델 선택했으나 openai_key 없음")
                return []
            text = _call_openai(prompt, openai_key, str(model).strip())
        else:
            if not api_key:
                logger.error("Gemini 모델 선택했으나 gemini api_key 없음")
                return []
            gemini_model = model if model.startswith("gemini-") else "gemini-3.1-flash-lite"
            text = _call_gemini(prompt, api_key, gemini_model)
    except Exception as e:
        logger.error(f"AI 멘트 생성 중 예외: {e}")
        return []

    if not text:
        return []

    messages = _parse_messages(text, max_count=count)
    logger.info(f"서이추 멘트 {len(messages)}개 생성 완료")
    return messages


def _parse_messages(raw_text: str, max_count: int = 10) -> list[str]:
    """AI 응답 원문에서 멘트 리스트만 깔끔히 추출."""
    lines = [ln.strip() for ln in raw_text.splitlines()]
    out = []
    for line in lines:
        if not line:
            continue
        # 불릿/번호/따옴표 등 앞 꾸밈 제거
        cleaned = re.sub(r"^[\s\-\*\d\.\)\]\[\"'`<>]+", "", line).strip()
        cleaned = re.sub(r"[\"'`>]+$", "", cleaned).strip()
        # 너무 짧거나 설명문처럼 긴 것 제외
        if not (5 <= len(cleaned) <= 120):
            continue
        has_placeholder = ("{닉네임}" in cleaned) or ("{nickname}" in cleaned)
        if has_placeholder:
            out.append(cleaned)
        else:
            # {닉네임} 없으면 자동 삽입 (시작부에)
            out.append("{닉네임}님, " + cleaned)
        if len(out) >= max_count:
            break
    return out


def _call_claude(prompt: str, api_key: str) -> Optional[str]:
    import anthropic
    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )
    if response and response.content:
        return response.content[0].text
    return None


def _call_gemini(prompt: str, api_key: str, model_id: str) -> Optional[str]:
    from google import genai
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model_id,
        contents=prompt,
    )
    return response.text if response else None


def _call_openai(prompt: str, api_key: str, model_id: str) -> Optional[str]:
    import requests
    response = requests.post(
        "https://api.openai.com/v1/responses",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model_id,
            "input": prompt,
            "max_output_tokens": 2000,
            "reasoning": {"effort": "minimal"},
            "store": False,
        },
        timeout=120,
    )
    if response.status_code >= 400:
        logger.error(f"OpenAI 멘트 생성 실패: {response.status_code} {response.text[:200]}")
        return None
    return _extract_openai_text(response.json())


def _extract_openai_text(data) -> Optional[str]:
    """OpenAI Responses API 응답에서 본문 텍스트만 추출 (content/ai_text.py 와 동일 규약)."""
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
