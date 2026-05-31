"""SEO brief helpers for keyword-based blog writing.

This module deliberately works on already-collected competitor snapshots. It
does not fetch Naver pages by itself, so it is safe to test without touching
real search or posting automation.
"""
from __future__ import annotations

import re
from collections import Counter
from statistics import median
from typing import Any


_IMAGE_ROLE_KEYWORDS = {
    "product": ("제품", "상품", "패키지", "구성품", "후기", "구매", "가격"),
    "process": ("과정", "단계", "설치", "사용법", "전", "후", "준비", "방법"),
    "screenshot": ("캡처", "화면", "앱", "웹", "설정", "메뉴", "버튼"),
    "comparison": ("비교", "전후", "차이", "장단점", "표"),
    "infographic": ("인포그래픽", "체크리스트", "요약", "표", "그래프"),
    "place": ("장소", "매장", "위치", "외관", "내부", "방문"),
}


def build_seo_brief(keyword: str, competitor_posts: list[dict[str, Any]], max_posts: int = 5) -> dict[str, Any]:
    """Build a compact writing brief from top-post snapshots.

    Expected post fields are intentionally flexible:
    - title: str
    - body_text/text/content: str
    - headings: list[str]
    - images: list[dict|str] where dict may include alt/caption/src/type
    - rank/url: optional metadata
    """
    keyword = str(keyword or "").strip()
    posts = [post for post in (competitor_posts or []) if isinstance(post, dict)][:max_posts]
    analyses = [_analyze_post(keyword, idx + 1, post) for idx, post in enumerate(posts)]

    image_counts = [item["image_count"] for item in analyses]
    heading_counts = [item["heading_count"] for item in analyses]
    word_counts = [item["word_count"] for item in analyses]
    keyword_counts = [item["keyword_count"] for item in analyses]
    role_counter = Counter()
    for item in analyses:
        role_counter.update(item["image_roles"])

    recommended_image_count = _recommended_image_count(image_counts)
    return {
        "keyword": keyword,
        "source_count": len(analyses),
        "recommended_image_count": recommended_image_count,
        "averages": {
            "word_count": _rounded_average(word_counts),
            "heading_count": _rounded_average(heading_counts),
            "image_count": _rounded_average(image_counts),
            "keyword_count": _rounded_average(keyword_counts),
        },
        "median": {
            "word_count": _safe_median(word_counts),
            "heading_count": _safe_median(heading_counts),
            "image_count": _safe_median(image_counts),
        },
        "image_roles": [role for role, _ in role_counter.most_common(5)],
        "top_posts": analyses,
        "writing_guidance": _writing_guidance(keyword, recommended_image_count, role_counter),
    }


def format_seo_brief_for_prompt(brief: dict[str, Any] | None) -> str:
    """Convert a structured SEO brief into prompt text."""
    if not brief:
        return ""
    keyword = str(brief.get("keyword") or "").strip()
    averages = brief.get("averages") if isinstance(brief.get("averages"), dict) else {}
    guidance = brief.get("writing_guidance") if isinstance(brief.get("writing_guidance"), list) else []
    roles = brief.get("image_roles") if isinstance(brief.get("image_roles"), list) else []
    recommended_images = brief.get("recommended_image_count")
    lines = [
        "",
        "상위 글 분석 브리프:",
        f"- 분석 키워드: {keyword}",
        f"- 권장 이미지 수: {recommended_images}장",
        f"- 상위 글 평균: 본문 약 {averages.get('word_count', 0)}단어, 소제목 {averages.get('heading_count', 0)}개, 이미지 {averages.get('image_count', 0)}장",
    ]
    if roles:
        lines.append(f"- 자주 보이는 이미지 역할: {', '.join(map(str, roles[:5]))}")
    for item in guidance[:6]:
        lines.append(f"- {item}")
    lines.extend([
        "- 상위 글의 문장, 제목, 이미지 소재를 복사하지 말고 구조적 패턴만 참고하세요.",
        "- 검색 노출을 보장하는 표현은 쓰지 말고 독자에게 실제로 도움이 되는 정보 밀도를 우선하세요.",
    ])
    return "\n".join(lines)


def _analyze_post(keyword: str, rank: int, post: dict[str, Any]) -> dict[str, Any]:
    title = str(post.get("title") or "").strip()
    body = str(post.get("body_text") or post.get("text") or post.get("content") or "").strip()
    headings = post.get("headings") if isinstance(post.get("headings"), list) else []
    images = post.get("images") if isinstance(post.get("images"), list) else []
    image_roles = [_classify_image_role(image) for image in images]
    image_roles = [role for role in image_roles if role]
    return {
        "rank": int(post.get("rank") or rank),
        "title": title[:160],
        "url": str(post.get("url") or "")[:240],
        "word_count": _word_count(body),
        "heading_count": len([item for item in headings if str(item).strip()]),
        "image_count": len(images),
        "first_image_near_top": bool(post.get("first_image_near_top")) if "first_image_near_top" in post else len(images) > 0,
        "keyword_count": _keyword_count(keyword, f"{title}\n{body}"),
        "title_has_keyword": bool(keyword and keyword.lower() in title.lower()),
        "image_roles": image_roles,
    }


def _classify_image_role(image: Any) -> str:
    if isinstance(image, dict):
        text = " ".join(str(image.get(key) or "") for key in ("type", "alt", "caption", "src", "context"))
    else:
        text = str(image or "")
    text = text.lower()
    for role, keywords in _IMAGE_ROLE_KEYWORDS.items():
        if any(keyword.lower() in text for keyword in keywords):
            return role
    return "real_photo" if text else ""


def _word_count(text: str) -> int:
    tokens = re.findall(r"[0-9A-Za-z가-힣]+", text or "")
    return len(tokens)


def _keyword_count(keyword: str, text: str) -> int:
    keyword = str(keyword or "").strip()
    if not keyword:
        return 0
    return len(re.findall(re.escape(keyword), text or "", re.I))


def _rounded_average(values: list[int]) -> int:
    values = [int(value or 0) for value in values]
    if not values:
        return 0
    return int(round(sum(values) / len(values)))


def _safe_median(values: list[int]) -> int:
    values = [int(value or 0) for value in values]
    if not values:
        return 0
    return int(round(median(values)))


def _recommended_image_count(image_counts: list[int]) -> int:
    if not image_counts:
        return 3
    return max(1, min(6, _safe_median(image_counts)))


def _writing_guidance(keyword: str, image_count: int, role_counter: Counter) -> list[str]:
    guidance = [
        f"정확한 키워드 '{keyword}'는 제목과 첫 문단에 자연스럽게 넣되 본문 전체에서 과반복하지 마세요.",
        "상위 글보다 더 구체적인 경험, 기준, 체크포인트를 추가해 정보 밀도를 높이세요.",
        f"이미지는 {image_count}장 안팎으로 구성하고 각 이미지가 서로 다른 역할을 하게 하세요.",
    ]
    if role_counter:
        roles = ", ".join(role for role, _ in role_counter.most_common(3))
        guidance.append(f"이미지 구성은 {roles} 역할을 우선 고려하세요.")
    return guidance
