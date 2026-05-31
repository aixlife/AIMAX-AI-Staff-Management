#!/usr/bin/env python3
"""Verify Yeri editor input_content accepts image provider routing arguments."""

from __future__ import annotations

import inspect
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from posting.editor import input_content


def main() -> None:
    signature = inspect.signature(input_content)
    required = {"driver", "content_list", "api_key", "image_provider", "fallback_api_key"}
    missing = required.difference(signature.parameters)
    if missing:
        raise SystemExit(f"missing input_content parameters: {', '.join(sorted(missing))}")

    result = input_content(
        driver=None,
        content_list=[],
        api_key="",
        image_provider="gemini",
        fallback_api_key="",
    )
    expected_keys = {"image_attempted", "image_generated", "image_inserted", "image_providers"}
    if not isinstance(result, dict) or not expected_keys.issubset(result):
        raise SystemExit(f"unexpected input_content stats: {result!r}")

    providers = result.get("image_providers") or {}
    if "gemini" not in providers or "openai" not in providers:
        raise SystemExit(f"missing provider counters: {providers!r}")

    print("EDITOR_IMAGE_PROVIDER_CONTRACT_OK")


if __name__ == "__main__":
    main()
