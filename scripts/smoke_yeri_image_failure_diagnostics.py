#!/usr/bin/env python3
"""No-paid smoke for R3-H Yeori image failure diagnostics."""

from __future__ import annotations

import tempfile
from pathlib import Path

import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import posting.editor as editor


def _temp_image_path() -> str:
    handle = tempfile.NamedTemporaryFile(prefix="aimax-r3h-image-", suffix=".png", delete=False)
    try:
        handle.write(b"not-a-real-image-but-never-opened")
        return handle.name
    finally:
        handle.close()


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    original_generate = editor._generate_image_with_provider
    original_button = editor._try_upload_via_image_button
    original_clipboard = editor._try_upload_via_clipboard

    try:
        called = {"generate": False}

        def fail_if_called(*_args, **_kwargs):
            called["generate"] = True
            raise AssertionError("empty prompt should not call image provider")

        editor._generate_image_with_provider = fail_if_called
        empty = editor._input_image(None, "   ", "", image_provider="gemini")
        _assert(empty["stage"] == "image_prompt_empty", "empty prompt stage missing")
        _assert(empty["error_code"] == "empty_image_prompt", "empty prompt error_code missing")
        _assert(not called["generate"], "empty prompt called provider")

        editor._generate_image_with_provider = lambda *_args, **_kwargs: (None, "gemini")
        generated_fail = editor._input_image(None, "valid prompt", "fake-key", image_provider="gemini")
        _assert(generated_fail["stage"] == "image_generation", "generation failure stage missing")
        _assert(generated_fail["error_code"] == "image_generation_failed", "generation failure code missing")
        _assert(not generated_fail["generated"], "generation failure marked generated")

        editor._generate_image_with_provider = lambda *_args, **_kwargs: (_temp_image_path(), "openai")
        editor._try_upload_via_image_button = lambda *_args, **_kwargs: False
        editor._try_upload_via_clipboard = lambda *_args, **_kwargs: False
        upload_fail = editor._input_image(None, "valid prompt", "fake-key", image_provider="openai")
        _assert(upload_fail["stage"] == "image_upload", "upload failure stage missing")
        _assert(upload_fail["error_code"] == "image_upload_failed", "upload failure code missing")
        _assert(upload_fail["generated"] and not upload_fail["inserted"], "upload failure counts wrong")

        editor._generate_image_with_provider = lambda *_args, **_kwargs: (_temp_image_path(), "openai")
        editor._try_upload_via_image_button = lambda *_args, **_kwargs: False
        editor._try_upload_via_clipboard = lambda *_args, **_kwargs: True
        upload_ok = editor._input_image(None, "valid prompt", "fake-key", image_provider="openai")
        _assert(upload_ok["stage"] == "image_inserted", "success stage missing")
        _assert(upload_ok["method"] == "clipboard", "success method missing")
        _assert(upload_ok["generated"] and upload_ok["inserted"], "success counts wrong")

        editor._generate_image_with_provider = lambda *_args, **_kwargs: (_temp_image_path(), "gemini")
        editor._try_upload_via_image_button = lambda *_args, **_kwargs: False
        editor._try_upload_via_clipboard = lambda *_args, **_kwargs: False
        stats = editor.input_content(
            None,
            [("image", "valid prompt")],
            "fake-key",
            image_provider="gemini",
            fallback_api_key="",
        )
        failures = stats.get("image_failures") or []
        _assert(stats["image_attempted"] == 1, "aggregate attempted count wrong")
        _assert(stats["image_generated"] == 1, "aggregate generated count wrong")
        _assert(stats["image_inserted"] == 0, "aggregate inserted count wrong")
        _assert(len(failures) == 1, "aggregate failure missing")
        _assert(failures[0]["stage"] == "image_upload", "aggregate failure stage wrong")

    finally:
        editor._generate_image_with_provider = original_generate
        editor._try_upload_via_image_button = original_button
        editor._try_upload_via_clipboard = original_clipboard

    print("R3H_YERI_IMAGE_FAILURE_DIAGNOSTICS_OK")


if __name__ == "__main__":
    main()
