"""Collect public Naver blog posts for local writing-style learning.

Ported from k-skill naver-blog-research (MIT), especially naver_search.py,
naver_read.py, and _naver_http.py. This module intentionally uses only the
Python standard library and does not use login sessions, cookies, or Selenium.
"""

from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from html import unescape
from pathlib import Path
from typing import Callable

from paths import STYLE_PROFILES_DIR


POST_LIST_URL_TEMPLATE = (
    "https://m.blog.naver.com/api/blogs/{blog_id}/post-list"
    "?categoryNo=0&itemCount=30&page=1"
)
MIN_REQUEST_INTERVAL_SECONDS = 1.5
DEFAULT_TIMEOUT_SECONDS = 20
MAX_POSTS = 30

MOBILE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 "
    "Mobile/15E148 Safari/604.1"
)
DEFAULT_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko,en-US;q=0.9,en;q=0.8",
    "User-Agent": MOBILE_UA,
}

BLOG_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{2,50}$")
TAG_RE = re.compile(r"<[^>]+>")
BR_RE = re.compile(r"<br\s*/?>", re.IGNORECASE)
BLOCK_END_RE = re.compile(r"</(p|div|li|h[1-6])>", re.IGNORECASE)
WHITESPACE_RE = re.compile(r"[ \t]+")
BLANK_LINES_RE = re.compile(r"\n{3,}")
SCRIPT_STYLE_RE = re.compile(
    r"<(script|style|noscript)[^>]*>.*?</\1>", re.DOTALL | re.IGNORECASE
)
TITLE_PATTERN = re.compile(r"<title[^>]*>(.*?)</title>", re.DOTALL | re.IGNORECASE)
BLOCK_MARKERS = (
    "비정상적인 접근",
    "자동입력 방지",
    "서비스 이용이 제한",
    "접근이 제한",
    "captcha",
)


class CollectorHttpError(RuntimeError):
    """HTTP failure with the status code kept for structured handling."""

    def __init__(self, status: int | None, message: str):
        super().__init__(message)
        self.status = status


def normalize_blog_id(value: str) -> str:
    """Return a safe Naver blog id from a PC URL, mobile URL, or plain id."""
    raw = str(value or "").strip()
    if not raw:
        raise ValueError("내 블로그 주소를 입력해 주세요.")

    if BLOG_ID_PATTERN.fullmatch(raw):
        return raw

    candidate = raw if "://" in raw else f"https://{raw}"
    parsed = urllib.parse.urlparse(candidate)
    host = (parsed.hostname or "").lower().rstrip(".")
    if host not in {"blog.naver.com", "m.blog.naver.com"}:
        raise ValueError("blog.naver.com 또는 m.blog.naver.com 주소만 사용할 수 있습니다.")

    parts = [urllib.parse.unquote(part) for part in parsed.path.split("/") if part]
    if not parts or not BLOG_ID_PATTERN.fullmatch(parts[0]):
        raise ValueError("네이버 블로그 주소에서 블로그 ID를 확인할 수 없습니다.")
    return parts[0]


def canonical_blog_url(value: str) -> str:
    return f"https://blog.naver.com/{normalize_blog_id(value)}"


def _default_fetcher(url: str, timeout: int, headers: dict[str, str]) -> str:
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as error:
        raise CollectorHttpError(
            error.code,
            f"네이버가 HTTP {error.code} 응답을 반환했습니다.",
        ) from error
    except urllib.error.URLError as error:
        reason = getattr(error, "reason", error)
        raise CollectorHttpError(None, f"네이버 연결에 실패했습니다: {reason}") from error


class _RateLimitedFetcher:
    def __init__(
        self,
        fetcher: Callable[[str, int, dict[str, str]], str],
        *,
        interval_seconds: float,
        sleep_func: Callable[[float], None],
        monotonic_func: Callable[[], float],
    ) -> None:
        self.fetcher = fetcher
        self.interval_seconds = max(MIN_REQUEST_INTERVAL_SECONDS, float(interval_seconds))
        self.sleep_func = sleep_func
        self.monotonic_func = monotonic_func
        self.last_request_at: float | None = None

    def get(
        self,
        url: str,
        timeout: int,
        headers: dict[str, str] | None = None,
    ) -> str:
        if self.last_request_at is not None:
            elapsed = self.monotonic_func() - self.last_request_at
            wait_seconds = self.interval_seconds - elapsed
            if wait_seconds > 0:
                self.sleep_func(wait_seconds)
        self.last_request_at = self.monotonic_func()
        request_headers = dict(DEFAULT_HEADERS)
        if headers:
            request_headers.update(headers)
        return self.fetcher(url, timeout, request_headers)


def _contains_marker(html: str, markers: tuple[str, ...]) -> bool:
    lowered = str(html or "").lower()
    return any(marker.lower() in lowered for marker in markers)


def _build_post_list_url(blog_id: str) -> str:
    return POST_LIST_URL_TEMPLATE.format(blog_id=urllib.parse.quote(blog_id, safe=""))


def _extract_post_urls(items: list[object], blog_id: str) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()

    for item in items:
        if not isinstance(item, dict):
            continue
        post_id = str(item.get("logNo") or "").strip()
        if not post_id.isdigit():
            continue
        url = f"https://m.blog.naver.com/{blog_id}/{post_id}"
        if url not in seen:
            seen.add(url)
            found.append(url)
    return found


def _extract_div_block(html: str, start_pos: int) -> str:
    tag_start = html.rfind("<div", 0, start_pos)
    if tag_start < 0:
        tag_start = start_pos

    depth = 0
    pos = tag_start
    started = False
    length = len(html)
    while pos < length:
        if html[pos : pos + 4] == "<!--":
            end = html.find("-->", pos + 4)
            pos = end + 3 if end >= 0 else length
            continue
        if html[pos : pos + 4] == "<div" and (
            pos + 4 >= length or html[pos + 4] in (" ", ">", "\t", "\n", "/")
        ):
            depth += 1
            started = True
        elif html[pos : pos + 6] == "</div>":
            depth -= 1
            if started and depth == 0:
                return html[tag_start : pos + 6]
        pos += 1
    return html[tag_start:]


def _extract_content_area(html: str) -> str:
    cleaned = SCRIPT_STYLE_RE.sub("", html)
    match = re.search(r'class=["\'][^"\']*\bse-main-container\b[^"\']*["\']', cleaned)
    if match:
        return _extract_div_block(cleaned, match.start())

    for class_name in ("post_ct", "postViewArea", "post-view"):
        match = re.search(
            rf'class=["\'][^"\']*\b{re.escape(class_name)}\b[^"\']*["\']',
            cleaned,
        )
        if match:
            return _extract_div_block(cleaned, match.start())

    marker = cleaned.find('id="viewTypeSelector"')
    if marker < 0:
        marker = cleaned.find("id='viewTypeSelector'")
    if marker >= 0:
        return _extract_div_block(cleaned, marker)
    return ""


def _extract_title(html: str) -> str:
    match = TITLE_PATTERN.search(html)
    if not match:
        return ""
    title = unescape(TAG_RE.sub("", match.group(1))).strip()
    return re.sub(r"\s*[-:|]?\s*네이버\s*블로그$", "", title).strip()


def _extract_text(html_fragment: str) -> str:
    text = BR_RE.sub("\n", html_fragment)
    text = BLOCK_END_RE.sub("\n", text)
    text = TAG_RE.sub("", text)
    text = unescape(text)
    lines = []
    for line in text.split("\n"):
        cleaned = WHITESPACE_RE.sub(" ", line).strip()
        if cleaned:
            lines.append(cleaned)
    return BLANK_LINES_RE.sub("\n\n", "\n".join(lines)).strip()


def _read_post(html: str, url: str) -> dict[str, object]:
    content = _extract_text(_extract_content_area(html))
    return {
        "url": url,
        "title": _extract_title(html),
        "content": content,
        "char_count": len(content),
    }


def _write_posts_file(
    blog_id: str,
    posts: list[dict[str, object]],
    profiles_dir: Path,
    *,
    partial: bool,
) -> Path:
    profiles_dir.mkdir(parents=True, exist_ok=True)
    target = profiles_dir / f"{blog_id}_posts.json"
    temp = target.with_suffix(target.suffix + ".tmp")
    payload = {
        "blog_id": blog_id,
        "blog_url": f"https://blog.naver.com/{blog_id}",
        "collected_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "post_count": len(posts),
        "partial": bool(partial),
        "posts": posts,
    }
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(target)
    return target


def _result(
    *,
    ok: bool,
    blog_id: str = "",
    reason: str = "",
    message: str = "",
    posts: list[dict[str, object]] | None = None,
    partial: bool = False,
    saved_path: Path | None = None,
    http_status: int | None = None,
) -> dict[str, object]:
    collected = list(posts or [])
    return {
        "ok": bool(ok),
        "blog_id": blog_id,
        "reason": reason,
        "message": message,
        "posts": collected,
        "post_count": len(collected),
        "partial": bool(partial),
        "saved_path": str(saved_path) if saved_path else "",
        "http_status": http_status,
    }


def collect_blog_posts(
    blog_url_or_id: str,
    *,
    max_posts: int = MAX_POSTS,
    profiles_dir: Path | str = STYLE_PROFILES_DIR,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
    request_interval: float = MIN_REQUEST_INTERVAL_SECONDS,
    fetcher: Callable[[str, int, dict[str, str]], str] | None = None,
    sleep_func: Callable[[float], None] = time.sleep,
    monotonic_func: Callable[[], float] = time.monotonic,
) -> dict[str, object]:
    """Collect up to 30 recent public posts and save their text locally."""
    try:
        blog_id = normalize_blog_id(blog_url_or_id)
    except ValueError as error:
        return _result(ok=False, reason="invalid_blog_url", message=str(error))

    limit = max(1, min(int(max_posts or MAX_POSTS), MAX_POSTS))
    output_dir = Path(profiles_dir)
    client = _RateLimitedFetcher(
        fetcher or _default_fetcher,
        interval_seconds=request_interval,
        sleep_func=sleep_func,
        monotonic_func=monotonic_func,
    )

    try:
        payload_text = client.get(
            _build_post_list_url(blog_id),
            timeout,
            {"Referer": f"https://m.blog.naver.com/{blog_id}"},
        )
        if _contains_marker(payload_text, BLOCK_MARKERS):
            return _result(
                ok=False,
                blog_id=blog_id,
                reason="blocked",
                message="네이버가 자동 요청을 제한해 수집을 중단했습니다. 잠시 후 다시 시도해 주세요.",
            )
        try:
            payload = json.loads(payload_text)
        except (TypeError, json.JSONDecodeError):
            return _result(
                ok=False,
                blog_id=blog_id,
                reason="network_error",
                message="블로그 글 목록 응답을 확인할 수 없습니다.",
            )

        # isSuccess는 result 내부가 아니라 응답 최상위 키다 (2026-07-10 실측).
        if not isinstance(payload, dict) or payload.get("isSuccess") is not True:
            return _result(
                ok=False,
                blog_id=blog_id,
                reason="private_or_unavailable",
                message="비공개이거나 존재하지 않는 블로그입니다.",
            )
        result = payload.get("result")
        if not isinstance(result, dict):
            return _result(
                ok=False,
                blog_id=blog_id,
                reason="network_error",
                message="블로그 글 목록 응답을 확인할 수 없습니다.",
            )
        items = result.get("items")
        if not isinstance(items, list):
            return _result(
                ok=False,
                blog_id=blog_id,
                reason="network_error",
                message="블로그 글 목록 응답에 글 항목이 없습니다.",
            )
        post_urls = _extract_post_urls(items, blog_id)[:limit]
    except CollectorHttpError as error:
        if error.status in {403, 429}:
            reason = "blocked"
            message = "네이버가 요청을 차단해 수집을 중단했습니다. 재시도하지 않았습니다."
        elif error.status == 404:
            reason = "private_or_unavailable"
            message = "블로그를 찾을 수 없습니다. 주소와 공개 상태를 확인해 주세요."
        else:
            reason = "network_error"
            message = "블로그 글 목록을 불러오지 못했습니다. 네트워크 상태를 확인해 주세요."
        return _result(
            ok=False,
            blog_id=blog_id,
            reason=reason,
            message=message,
            http_status=error.status,
        )

    if not post_urls:
        return _result(
            ok=False,
            blog_id=blog_id,
            reason="no_posts",
            message="공개 글을 찾지 못했습니다.",
        )

    posts: list[dict[str, object]] = []
    skipped = 0
    for url in post_urls:
        try:
            html = client.get(url, timeout)
            if _contains_marker(html, BLOCK_MARKERS):
                saved_path = _write_posts_file(blog_id, posts, output_dir, partial=True)
                return _result(
                    ok=False,
                    blog_id=blog_id,
                    reason="blocked",
                    message="네이버가 자동 요청을 제한해 즉시 수집을 중단했습니다.",
                    posts=posts,
                    partial=True,
                    saved_path=saved_path,
                )
            post = _read_post(html, url)
            if post["content"]:
                posts.append(post)
            else:
                skipped += 1
        except CollectorHttpError as error:
            if error.status in {403, 429}:
                saved_path = _write_posts_file(blog_id, posts, output_dir, partial=True)
                return _result(
                    ok=False,
                    blog_id=blog_id,
                    reason="blocked",
                    message="네이버가 요청을 차단해 즉시 수집을 중단했습니다. 재시도하지 않았습니다.",
                    posts=posts,
                    partial=True,
                    saved_path=saved_path,
                    http_status=error.status,
                )
            skipped += 1

    if not posts:
        return _result(
            ok=False,
            blog_id=blog_id,
            reason="no_content",
            message="공개 글은 찾았지만 읽을 수 있는 본문이 없습니다.",
        )

    saved_path = _write_posts_file(blog_id, posts, output_dir, partial=bool(skipped))
    return _result(
        ok=True,
        blog_id=blog_id,
        posts=posts,
        partial=bool(skipped),
        saved_path=saved_path,
        message=f"공개 글 {len(posts)}개를 수집했습니다.",
    )
