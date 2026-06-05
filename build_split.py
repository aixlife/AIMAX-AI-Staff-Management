# Copyright (c) 2026 주식회사 메이크패밀리 (AIMAX). All rights reserved.
# AIMAX는 AIXLIFE와 주식회사 메이크패밀리가 공동으로 사용하는 브랜드입니다.
# License: Proprietary - 무단 복제·재배포·재판매·역공학 금지
# Contact: makefamily@makefamily.kr
"""Build two release packages from the shared split-version code.

Usage:
  python build_split.py                 # build all release packages
  python build_split.py find            # build 찾아볼게요 only
  python build_split.py engage_write    # build 친해질게요+설득할게요 only
"""
from __future__ import annotations

import sys

import build as base_build


# base build.py owns PyInstaller hidden-import/collect-submodules, including
# web_agent and diagnostics for the Windows Agent contract.
TARGETS = {
    "find": ("AIMAX-Find", "app_find.py"),
    "engage_write": ("AIMAX-EngageWrite", "app_engage_write.py"),
}

ALIASES = {
    "engage-write": "engage_write",
    "engagewrite": "engage_write",
    "work": "engage_write",
}


def main() -> int:
    if any(arg in ("-h", "--help") for arg in sys.argv[1:]):
        print(__doc__.strip())
        print(f"\nAvailable targets: {', '.join(TARGETS)}")
        return 0

    selected = [ALIASES.get(arg.lower(), arg.lower()) for arg in sys.argv[1:] if not arg.startswith("-")]
    if selected:
        unknown = [name for name in selected if name not in TARGETS]
        if unknown:
            print(f"[ERROR] unknown target(s): {', '.join(unknown)}", file=sys.stderr)
            print(f"[INFO] available targets: {', '.join(TARGETS)}", file=sys.stderr)
            return 2
        target_names = selected
    else:
        target_names = list(TARGETS)

    for target_name in target_names:
        app_name, entry_file = TARGETS[target_name]
        print(f"\n[SPLIT BUILD] {target_name} -> {app_name}\n")
        base_build.APP_NAME = app_name
        base_build.ENTRY = base_build.ROOT / entry_file
        result = base_build.main()
        if result != 0:
            return result
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
