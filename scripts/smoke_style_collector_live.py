#!/usr/bin/env python3
"""One-shot live smoke for a verifier-provided public Naver blog URL.

This script performs real network requests. Do not run it without an explicit
target and approval. It never logs in, uses cookies, or uploads collected text.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from paths import STYLE_PROFILES_DIR
from scraper.blog_style_collector import collect_blog_posts


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="공개 네이버 블로그에서 글 3개를 수집하는 1회 네트워크 스모크",
    )
    parser.add_argument("blog_url", help="검증자 본인의 공개 네이버 블로그 주소 또는 ID")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=STYLE_PROFILES_DIR,
        help="로컬 수집 결과 저장 폴더",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    result = collect_blog_posts(
        args.blog_url,
        max_posts=3,
        profiles_dir=args.output_dir,
    )
    summary = {
        "ok": result.get("ok"),
        "blog_id": result.get("blog_id"),
        "reason": result.get("reason"),
        "message": result.get("message"),
        "post_count": result.get("post_count"),
        "partial": result.get("partial"),
        "saved_path": result.get("saved_path"),
        "http_status": result.get("http_status"),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if not result.get("ok") or int(result.get("post_count") or 0) < 3:
        return 1
    if not all(str(post.get("content") or "").strip() for post in result.get("posts") or []):
        return 1
    print("PASS: 공개 글 3개 원문 추출")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
