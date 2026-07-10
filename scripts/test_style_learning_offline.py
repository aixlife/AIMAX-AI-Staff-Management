#!/usr/bin/env python3
"""Offline verification for Yeri Naver blog style learning."""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from content.ai_text import _style_reference_instruction, humanize_blog_content
from content.style_profile import (
    create_style_profile,
    normalize_style_learning_settings,
    resolve_style_reference_text,
)
from scraper.blog_style_collector import (
    CollectorHttpError,
    collect_blog_posts,
    normalize_blog_id,
)


BLOG_ID = "styleowner"


def _post_list_json(post_ids: list[int], *, is_success: bool = True) -> str:
    # 실제 API는 isSuccess가 최상위 키다 (2026-07-10 실측: m.blog.naver.com/api/blogs/*/post-list).
    return json.dumps(
        {
            "isSuccess": is_success,
            "result": {
                "items": [{"logNo": post_id} for post_id in post_ids],
            },
        }
    )


def _post_html(post_id: int) -> str:
    return f"""<html>
    <head><title>테스트 글 {post_id} : 네이버 블로그</title></head>
    <body><div class="se-main-container">
      <p>안녕하세요. 첫 문장은 짧고 자연스럽게 씁니다.</p>
      <p>테스트 본문 {post_id}입니다. 경험을 차분하게 설명합니다.</p>
    </div></body></html>"""


def _test_normalization() -> None:
    assert normalize_blog_id(BLOG_ID) == BLOG_ID
    assert normalize_blog_id(f"https://blog.naver.com/{BLOG_ID}") == BLOG_ID
    assert normalize_blog_id(f"https://m.blog.naver.com/{BLOG_ID}") == BLOG_ID
    print("PASS (1) 주소 정규화 3형태")


def _test_success_profile_and_injection(temp_dir: Path) -> None:
    calls: list[str] = []
    sleep_calls: list[float] = []

    def fetcher(url: str, _timeout: int, headers: dict[str, str]) -> str:
        calls.append(url)
        if "/api/blogs/" in url:
            assert headers["Referer"] == f"https://m.blog.naver.com/{BLOG_ID}"
            assert "iPhone" in headers["User-Agent"]
            assert "Cookie" not in headers
            return _post_list_json([301, 302, 303])
        post_id = int(url.rstrip("/").split("/")[-1])
        return _post_html(post_id)

    result = collect_blog_posts(
        f"https://blog.naver.com/{BLOG_ID}",
        max_posts=3,
        profiles_dir=temp_dir,
        fetcher=fetcher,
        sleep_func=sleep_calls.append,
        monotonic_func=lambda: 0.0,
    )
    assert result["ok"] is True, result
    assert result["post_count"] == 3, result
    posts_path = temp_dir / f"{BLOG_ID}_posts.json"
    assert posts_path.exists()
    stored_posts = json.loads(posts_path.read_text(encoding="utf-8"))
    assert stored_posts["post_count"] == 3
    assert all(post["content"] for post in stored_posts["posts"])

    ai_calls: list[tuple[str, str, str]] = []

    def ai_stub(prompt: str, api_key: str, model: str):
        ai_calls.append((prompt, api_key, model))
        return (
            "어휘 습관: 일상적인 단어를 사용합니다.\n"
            "문장 길이: 짧은 문장과 중간 길이 문장을 섞습니다.\n"
            "종결어미: 설명형 종결을 주로 사용합니다.\n"
            "문단 구성: 경험을 먼저 말하고 요점을 정리합니다.\n"
            "자주 쓰는 표현: 독자에게 차분히 설명하는 연결 표현을 사용합니다.",
            {"input_tokens": 120, "output_tokens": 80},
        )

    profile_result = create_style_profile(
        BLOG_ID,
        result["posts"],
        "offline-test-key",
        "gpt-5.4-mini",
        profiles_dir=temp_dir,
        ai_call=ai_stub,
    )
    assert profile_result["ok"] is True, profile_result
    assert len(ai_calls) == 1
    assert (temp_dir / f"{BLOG_ID}_style.json").exists()

    reference = resolve_style_reference_text(
        "",
        enabled=True,
        blog_url_or_id=BLOG_ID,
        profiles_dir=temp_dir,
    )
    assert reference == profile_result["profile_text"]
    instruction = _style_reference_instruction(reference)
    assert "기존 작성글 스타일 참고" in instruction
    assert reference in instruction

    existing = "기존 호출자가 제공한 스타일 참고값"
    assert resolve_style_reference_text(
        existing,
        enabled=True,
        blog_url_or_id=BLOG_ID,
        profiles_dir=temp_dir,
    ) == existing
    assert len(calls) == 4
    assert calls[0] == (
        f"https://m.blog.naver.com/api/blogs/{BLOG_ID}/post-list"
        "?categoryNo=0&itemCount=30&page=1"
    )
    assert len(sleep_calls) == 3
    assert all(wait >= 1.5 for wait in sleep_calls)
    print("PASS (2) 수집 성공 → 프로필 저장 → 주입 텍스트 생성")


def _test_safe_failures(temp_dir: Path) -> None:
    private_calls = 0

    def private_fetcher(_url: str, _timeout: int, _headers: dict[str, str]) -> str:
        nonlocal private_calls
        private_calls += 1
        return _post_list_json([], is_success=False)

    private_result = collect_blog_posts(
        BLOG_ID,
        profiles_dir=temp_dir / "private",
        fetcher=private_fetcher,
        sleep_func=lambda _seconds: None,
        monotonic_func=lambda: 0.0,
    )
    assert private_result["ok"] is False
    assert private_result["reason"] == "private_or_unavailable"
    assert private_calls == 1

    empty_calls = 0

    def empty_fetcher(_url: str, _timeout: int, _headers: dict[str, str]) -> str:
        nonlocal empty_calls
        empty_calls += 1
        return _post_list_json([])

    empty_result = collect_blog_posts(
        BLOG_ID,
        profiles_dir=temp_dir / "empty",
        fetcher=empty_fetcher,
        sleep_func=lambda _seconds: None,
        monotonic_func=lambda: 0.0,
    )
    assert empty_result["ok"] is False
    assert empty_result["reason"] == "no_posts"
    assert empty_calls == 1

    missing_items_result = collect_blog_posts(
        BLOG_ID,
        profiles_dir=temp_dir / "missing-items",
        fetcher=lambda _url, _timeout, _headers: json.dumps(
            {"isSuccess": True, "result": {}}
        ),
        sleep_func=lambda _seconds: None,
        monotonic_func=lambda: 0.0,
    )
    assert missing_items_result["ok"] is False
    assert missing_items_result["reason"] == "network_error"

    list_blocked_calls = 0

    def list_blocked_fetcher(
        _url: str, _timeout: int, _headers: dict[str, str]
    ) -> str:
        nonlocal list_blocked_calls
        list_blocked_calls += 1
        raise CollectorHttpError(403, "HTTP 403")

    list_blocked_result = collect_blog_posts(
        BLOG_ID,
        profiles_dir=temp_dir / "list-blocked",
        fetcher=list_blocked_fetcher,
        sleep_func=lambda _seconds: None,
        monotonic_func=lambda: 0.0,
    )
    assert list_blocked_result["ok"] is False
    assert list_blocked_result["reason"] == "blocked"
    assert list_blocked_result["http_status"] == 403
    assert list_blocked_calls == 1

    blocked_calls: list[str] = []

    def blocked_fetcher(url: str, _timeout: int, _headers: dict[str, str]) -> str:
        blocked_calls.append(url)
        if "/api/blogs/" in url:
            return _post_list_json([401, 402])
        if url.endswith("/401"):
            return _post_html(401)
        raise CollectorHttpError(429, "HTTP 429")

    blocked_dir = temp_dir / "blocked"
    blocked_result = collect_blog_posts(
        BLOG_ID,
        max_posts=2,
        profiles_dir=blocked_dir,
        fetcher=blocked_fetcher,
        sleep_func=lambda _seconds: None,
        monotonic_func=lambda: 0.0,
    )
    assert blocked_result["ok"] is False
    assert blocked_result["reason"] == "blocked"
    assert blocked_result["http_status"] == 429
    assert blocked_result["partial"] is True
    assert blocked_result["post_count"] == 1
    assert len(blocked_calls) == 3
    saved = json.loads((blocked_dir / f"{BLOG_ID}_posts.json").read_text(encoding="utf-8"))
    assert saved["partial"] is True and saved["post_count"] == 1
    print("PASS (3) 비공개·글 0개·목록 403·본문 429 안전 실패")


def _test_toggle_off(temp_dir: Path) -> None:
    reference = resolve_style_reference_text(
        "",
        enabled=False,
        blog_url_or_id=BLOG_ID,
        profiles_dir=temp_dir,
    )
    assert reference is None
    assert _style_reference_instruction(reference) == ""
    print("PASS (4) 토글 꺼짐 시 style_reference_text 미주입")


def _test_legacy_settings(temp_dir: Path) -> None:
    legacy_path = temp_dir / "legacy-settings.json"
    legacy_path.write_text(
        json.dumps({"naver_id": "legacy-user", "ai_model": "gemini-2.5-flash"}),
        encoding="utf-8",
    )
    legacy_data = json.loads(legacy_path.read_text(encoding="utf-8"))
    settings = normalize_style_learning_settings(legacy_data)
    assert settings == {
        "style_blog_url": "",
        "style_profile_enabled": False,
        "humanize_review_enabled": False,
    }
    print("PASS (5) 신규 키 없는 기존 settings.json 로드 호환")


def _test_humanize_failure_keeps_original() -> None:
    import content.ai_text as ai_text

    original_call = ai_text._generate_once
    original = "# 제목\n\n원문을 그대로 보존합니다."

    def failing_call(_prompt: str, _api_key: str, _model: str):
        raise RuntimeError("offline failure")

    try:
        ai_text._generate_once = failing_call
        reviewed, usage, applied = humanize_blog_content(original, "offline-key", "gpt-5.4-mini")
    finally:
        ai_text._generate_once = original_call
    assert reviewed == original
    assert usage == {}
    assert applied is False
    print("PASS (추가) 문체 검수 실패 시 최초 원고 보존")


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="aimax-style-learning-") as temp:
        temp_dir = Path(temp)
        _test_normalization()
        _test_success_profile_and_injection(temp_dir)
        _test_safe_failures(temp_dir)
        _test_toggle_off(temp_dir)
        _test_legacy_settings(temp_dir)
        _test_humanize_failure_keeps_original()
    print("ALL PASS: 예리 문체 학습 오프라인 테스트")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
