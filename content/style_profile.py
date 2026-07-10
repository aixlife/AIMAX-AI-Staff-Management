"""Local writing-style profile generation and injection helpers."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from paths import STYLE_PROFILES_DIR
from scraper.blog_style_collector import normalize_blog_id


MAX_PROFILE_CHARS = 800
MAX_TOTAL_SAMPLE_CHARS = 18000
MAX_PER_POST_CHARS = 1600
MAX_SAMPLE_POSTS = 30


def normalize_style_learning_settings(data: dict | None) -> dict[str, object]:
    """Return backward-compatible defaults for old settings.json files."""
    source = data if isinstance(data, dict) else {}
    return {
        "style_blog_url": str(source.get("style_blog_url") or "").strip(),
        "style_profile_enabled": bool(source.get("style_profile_enabled", False)),
        "humanize_review_enabled": bool(source.get("humanize_review_enabled", False)),
    }


def sample_posts_for_profile(
    posts: list[dict] | None,
    *,
    max_total_chars: int = MAX_TOTAL_SAMPLE_CHARS,
    max_per_post_chars: int = MAX_PER_POST_CHARS,
) -> str:
    """Sample the beginning of each post within a bounded total input size."""
    sections: list[str] = []
    used = 0
    for index, post in enumerate((posts or [])[:MAX_SAMPLE_POSTS], start=1):
        if not isinstance(post, dict):
            continue
        content = str(post.get("content") or "").strip()
        if not content:
            continue
        title = str(post.get("title") or "").strip()
        prefix = f"\n[글 {index}]"
        if title:
            prefix += f" {title}"
        prefix += "\n"
        remaining = max_total_chars - used - len(prefix)
        if remaining <= 0:
            break
        excerpt = content[: min(max_per_post_chars, remaining)]
        sections.append(prefix + excerpt)
        used += len(prefix) + len(excerpt)
        if used >= max_total_chars:
            break
    return "".join(sections).strip()


def _profile_prompt(sample_text: str) -> str:
    return f"""아래 글들은 한 사용자가 본인 네이버 블로그에 공개한 글의 앞부분 샘플입니다.
이 글들의 사실이나 고유 표현을 복사하지 말고, 이후 새 글의 문체 참고자료로 쓸 수 있게 문체만 분석하세요.

분석 항목:
- 어휘 습관
- 문장 길이 경향
- 종결어미 패턴
- 문단 구성
- 자주 쓰는 표현의 유형

출력 기준:
- 한국어 800자 이내
- 항목별로 간결하게 작성
- 원문 문장, 개인정보, 업체명, 가격, 후기 내용은 옮기지 않기
- 분석 결과만 출력

글 샘플:
{sample_text}"""


def _default_ai_call(prompt: str, api_key: str, model: str):
    from content.ai_text import _generate_once, _normalize_generation_result

    return _normalize_generation_result(_generate_once(prompt, api_key, model))


def _normalize_ai_result(result) -> tuple[str, dict]:
    if isinstance(result, tuple):
        return str(result[0] or "").strip(), result[1] if isinstance(result[1], dict) else {}
    return str(result or "").strip(), {}


def _write_style_profile(
    blog_id: str,
    profile_text: str,
    source_post_count: int,
    profiles_dir: Path,
) -> Path:
    profiles_dir.mkdir(parents=True, exist_ok=True)
    target = profiles_dir / f"{blog_id}_style.json"
    temp = target.with_suffix(target.suffix + ".tmp")
    payload = {
        "blog_id": blog_id,
        "profile_text": profile_text,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source_post_count": int(source_post_count),
    }
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(target)
    return target


def create_style_profile(
    blog_url_or_id: str,
    posts: list[dict] | None,
    api_key: str,
    model: str,
    *,
    profiles_dir: Path | str = STYLE_PROFILES_DIR,
    ai_call: Callable[[str, str, str], object] | None = None,
) -> dict[str, object]:
    """Analyze collected posts with one existing-provider call and save locally."""
    try:
        blog_id = normalize_blog_id(blog_url_or_id)
    except ValueError as error:
        return {"ok": False, "reason": "invalid_blog_url", "message": str(error)}

    clean_posts = [post for post in (posts or []) if isinstance(post, dict) and str(post.get("content") or "").strip()]
    if not clean_posts:
        return {"ok": False, "reason": "no_posts", "message": "분석할 공개 글 본문이 없습니다."}
    if not str(api_key or "").strip():
        return {"ok": False, "reason": "missing_api_key", "message": "선택한 AI 모델의 API 키가 없습니다."}

    sample_text = sample_posts_for_profile(clean_posts)
    if not sample_text:
        return {"ok": False, "reason": "no_content", "message": "문체 분석용 글 샘플을 만들 수 없습니다."}

    try:
        raw_result = (ai_call or _default_ai_call)(_profile_prompt(sample_text), api_key, model)
        profile_text, usage = _normalize_ai_result(raw_result)
    except Exception as error:  # provider errors are returned to the UI, never persisted with secrets
        return {
            "ok": False,
            "reason": "ai_analysis_failed",
            "message": f"문체 분석에 실패했습니다: {str(error)[:200]}",
        }

    profile_text = profile_text[:MAX_PROFILE_CHARS].strip()
    if not profile_text:
        return {"ok": False, "reason": "empty_profile", "message": "AI가 문체 프로필을 만들지 못했습니다."}

    saved_path = _write_style_profile(blog_id, profile_text, len(clean_posts), Path(profiles_dir))
    return {
        "ok": True,
        "blog_id": blog_id,
        "profile_text": profile_text,
        "source_post_count": len(clean_posts),
        "saved_path": str(saved_path),
        "usage": usage,
    }


def load_style_profile(
    blog_url_or_id: str,
    *,
    profiles_dir: Path | str = STYLE_PROFILES_DIR,
) -> dict[str, object] | None:
    try:
        blog_id = normalize_blog_id(blog_url_or_id)
    except ValueError:
        return None
    path = Path(profiles_dir) / f"{blog_id}_style.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict) or str(data.get("blog_id") or "").lower() != blog_id.lower():
        return None
    profile_text = str(data.get("profile_text") or "").strip()
    if not profile_text:
        return None
    data["profile_text"] = profile_text[:MAX_PROFILE_CHARS]
    return data


def resolve_style_reference_text(
    existing_value: str | None,
    *,
    enabled: bool,
    blog_url_or_id: str,
    profiles_dir: Path | str = STYLE_PROFILES_DIR,
) -> str | None:
    """Keep an existing reference first; otherwise load the enabled local profile."""
    existing = str(existing_value or "").strip()
    if existing:
        return existing
    if not enabled:
        return None
    profile = load_style_profile(blog_url_or_id, profiles_dir=profiles_dir)
    if not profile:
        return None
    return str(profile.get("profile_text") or "").strip() or None
