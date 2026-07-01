"""Safe SEO research collection for Yeri writing.

The collector only uses allowed inputs: explicit reference posts/text supplied
by the user or the official Naver Search API when credentials are configured.
It does not automate browser scraping.
"""
from __future__ import annotations

import json
import os
import re
import urllib.parse
import urllib.request
from html import unescape
from typing import Any

from content.seo_brief import build_seo_brief


def build_auto_seo_brief(keyword: str, payload: dict[str, Any] | None = None) -> dict[str, Any] | None:
    """Build an SEO brief from safe, already-allowed sources.

    Returns None when no usable source is available. Callers should then proceed
    with the normal writing flow.
    """
    payload = payload if isinstance(payload, dict) else {}
    if isinstance(payload.get("seo_brief"), dict):
        return payload["seo_brief"]
    if not payload.get("seo_research_enabled", False):
        return None

    posts = []
    posts.extend(_reference_posts_from_payload(payload))
    posts.extend(_naver_search_api_posts(keyword))
    if not posts:
        return None
    brief = build_seo_brief(keyword, posts)
    brief["source"] = {
        "mode": "safe_auto",
        "official_search_api": bool(_naver_search_ready()),
        "reference_post_count": len(posts),
        "browser_scraping": False,
    }
    return brief


def _reference_posts_from_payload(payload: dict[str, Any]) -> list[dict[str, Any]]:
    posts: list[dict[str, Any]] = []
    raw_posts = payload.get("seo_reference_posts")
    if isinstance(raw_posts, list):
        for index, item in enumerate(raw_posts[:8], start=1):
            post = _coerce_reference_post(item, index)
            if post:
                posts.append(post)

    raw_text = str(payload.get("seo_reference_text") or "").strip()
    if raw_text:
        for index, chunk in enumerate(_split_reference_text(raw_text), start=len(posts) + 1):
            posts.append({
                "rank": index,
                "title": _first_line(chunk) or "사용자 참고자료",
                "body_text": chunk,
                "headings": _extract_headings(chunk),
                "images": [],
            })
    return posts


def _coerce_reference_post(item: Any, rank: int) -> dict[str, Any] | None:
    if isinstance(item, str):
        text = item.strip()
        if not text:
            return None
        return {
            "rank": rank,
            "title": _first_line(text) or "사용자 참고글",
            "body_text": text,
            "headings": _extract_headings(text),
            "images": [],
        }
    if not isinstance(item, dict):
        return None
    title = str(item.get("title") or "").strip()
    body = str(item.get("body_text") or item.get("text") or item.get("content") or item.get("description") or "").strip()
    if not title and not body:
        return None
    return {
        "rank": int(item.get("rank") or rank),
        "title": title,
        "url": str(item.get("url") or item.get("link") or "").strip(),
        "body_text": body,
        "headings": item.get("headings") if isinstance(item.get("headings"), list) else _extract_headings(body),
        "images": item.get("images") if isinstance(item.get("images"), list) else [],
    }


def _naver_search_ready() -> bool:
    return bool(os.environ.get("AIMAX_NAVER_SEARCH_CLIENT_ID") and os.environ.get("AIMAX_NAVER_SEARCH_CLIENT_SECRET"))


def _naver_search_api_posts(keyword: str) -> list[dict[str, Any]]:
    if not keyword or not _naver_search_ready():
        return []
    query = urllib.parse.urlencode({"query": keyword, "display": 5, "sort": "sim"})
    request = urllib.request.Request(
        f"https://openapi.naver.com/v1/search/blog.json?{query}",
        headers={
            "X-Naver-Client-Id": os.environ.get("AIMAX_NAVER_SEARCH_CLIENT_ID", ""),
            "X-Naver-Client-Secret": os.environ.get("AIMAX_NAVER_SEARCH_CLIENT_SECRET", ""),
            "User-Agent": "AIMAX-YeriSEO/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            data = json.loads(response.read().decode("utf-8", errors="replace"))
    except Exception:
        return []

    posts = []
    for rank, item in enumerate(data.get("items") or [], start=1):
        if not isinstance(item, dict):
            continue
        title = _clean_html(item.get("title"))
        description = _clean_html(item.get("description"))
        if not title and not description:
            continue
        posts.append({
            "rank": rank,
            "title": title,
            "url": str(item.get("link") or ""),
            "body_text": description,
            "headings": [],
            "images": [],
        })
    return posts


def _clean_html(value: Any) -> str:
    text = re.sub(r"<[^>]+>", "", str(value or ""))
    return unescape(text).strip()


def _split_reference_text(text: str) -> list[str]:
    chunks = [chunk.strip() for chunk in re.split(r"\n\s*---+\s*\n", text) if chunk.strip()]
    if len(chunks) > 1:
        return chunks[:8]
    return [text[:6000]]


def _first_line(text: str) -> str:
    for line in str(text or "").splitlines():
        line = line.strip().lstrip("#").strip()
        if line:
            return line[:160]
    return ""


def _extract_headings(text: str) -> list[str]:
    headings = []
    for line in str(text or "").splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            headings.append(stripped.lstrip("#").strip())
    return headings[:12]
