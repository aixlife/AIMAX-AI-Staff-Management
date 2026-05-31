"""Nuitka 빌드 스크립트 — Windows용 standalone 폴더 빌드.

로컬 빌드: python build_nuitka.py
CI 빌드: GitHub Actions (windows-latest) 에서 동일 명령 실행

산출물: dist/AIMAX.dist/ 폴더 → CI에서 zip으로 묶어 배포
(--onefile 대신 --standalone 사용: 빌드 시간 70% 단축)
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ENTRY = ROOT / "app.py"
OUTPUT_DIR = ROOT / "dist"
APP_NAME = "AIMAX"

# Nuitka 공통 플래그
COMMON = [
    sys.executable, "-m", "nuitka",
    "--standalone",
    "--assume-yes-for-downloads",
    "--remove-output",
    "--low-memory",          # C1002 (out of heap) 방지 — 대용량 패키지 분할 컴파일
    "--jobs=1",              # 병렬 C 컴파일 끔 — 메모리 압박 감소
    "--output-dir=" + str(OUTPUT_DIR),
    "--output-filename=" + APP_NAME,
    # Tkinter / ttkbootstrap
    "--enable-plugin=tk-inter",
    "--include-package=ttkbootstrap",
    "--include-package-data=ttkbootstrap",
    # 번들 필요 패키지
    "--include-package=undetected_chromedriver",
    "--include-package=selenium",
    "--include-package=selenium_stealth",
    "--include-package=google",
    "--include-package=google.genai",
    "--include-package=anthropic",
    "--include-package=keyring",
    "--include-package=PIL",
    "--include-package=yaml",
    "--include-package=dotenv",
    "--include-package=requests",
    # 프로젝트 리소스
    "--include-module=aimax_compliance",
    "--include-data-file=" + str(ROOT / "config.yaml") + "=config.yaml",
    # 메타데이터
    "--company-name=MakeFamily",
    "--product-name=AIMAX",
    "--file-version=1.0.0.0",
    "--product-version=1.0.0.0",
    "--file-description=AIMAX",
    "--copyright=Copyright (c) 2026 MakeFamily",
    str(ENTRY),
]

# 플랫폼별 플래그
WINDOWS_EXTRA = [
    "--windows-console-mode=disable",  # GUI 앱 — 콘솔 숨김
]

MAC_EXTRA = [
    "--macos-create-app-bundle",
    "--macos-app-name=" + APP_NAME,
]


def main() -> int:
    if not ENTRY.exists():
        print(f"[ERROR] entry point 없음: {ENTRY}", file=sys.stderr)
        return 1

    cmd = list(COMMON)
    if sys.platform.startswith("win"):
        icon = ROOT / "assets" / "app.ico"
        if icon.exists():
            cmd.insert(-1, f"--windows-icon-from-ico={icon}")
        cmd[-1:-1] = WINDOWS_EXTRA
    elif sys.platform == "darwin":
        cmd[-1:-1] = MAC_EXTRA

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print("[BUILD] " + " ".join(cmd))
    return subprocess.call(cmd)


if __name__ == "__main__":
    raise SystemExit(main())
