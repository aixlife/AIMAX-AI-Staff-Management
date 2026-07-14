#!/usr/bin/env python3

import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, REPO_ROOT)

from content.markdown_parser import parse_markdown, rebalance_image_blocks


def block_types(blocks):
    return [item[0] for item in blocks]


def assert_condition(condition, message):
    if not condition:
        raise RuntimeError(message)


def main():
    markdown = """# 테스트 글

## 서론
첫 문단입니다.

## 본문
두 번째 문단입니다.

## 비교
세 번째 문단입니다.

## 마무리
결론 문단입니다.

[이미지] 첫 번째 이미지
[이미지] 두 번째 이미지
[이미지] 세 번째 이미지
"""
    _title, blocks = parse_markdown(markdown)
    rebalanced, moved = rebalance_image_blocks(blocks)
    types = block_types(rebalanced)

    assert_condition(moved == 3, f"expected_three_images_moved:{moved}:{types}")
    assert_condition(types[-1] != "image", f"image_still_at_tail:{types}")
    assert_condition("image" in types[: len(types) - 2], f"image_not_distributed:{types}")

    already_balanced = [
        ("quote", "서론"),
        ("text", [("text", "첫 문단")]),
        ("image", "첫 이미지"),
        ("quote", "본문"),
        ("text", [("text", "둘째 문단")]),
    ]
    balanced, moved_balanced = rebalance_image_blocks(already_balanced)
    assert_condition(balanced == already_balanced, f"balanced_content_changed:{balanced}")
    assert_condition(moved_balanced == 0, f"balanced_content_reported_moved:{moved_balanced}")

    print("IMAGE_BLOCK_DISTRIBUTION_OK")


if __name__ == "__main__":
    main()
