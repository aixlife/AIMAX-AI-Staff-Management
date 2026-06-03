# Copyright (c) 2026 주식회사 메이크패밀리 (AIMAX). All rights reserved.
# AIMAX는 AIXLIFE와 주식회사 메이크패밀리가 공동으로 사용하는 브랜드입니다.
# License: Proprietary - 무단 복제·재배포·재판매·역공학 금지
# Contact: makefamily@makefamily.kr
"""PyInstaller 빌드 스크립트 — Windows / macOS standalone 빌드.

로컬 빌드: python build.py
CI 빌드:  GitHub Actions 에서 동일 명령 실행

산출물:
  Windows: dist/AIMAX/          → CI에서 zip으로 묶어 배포
  macOS:   dist/AIMAX.app/      → CI에서 zip으로 묶어 배포
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ENTRY = ROOT / "app.py"
APP_NAME = "AIMAX"
IS_WIN = sys.platform.startswith("win")
IS_MAC = sys.platform == "darwin"


def _copy_release_docs(dist_app_dir: Path) -> None:
    for name in ("처음_읽어주세요.txt", "업데이트_내역.txt"):
        src = ROOT / name
        if src.exists():
            shutil.copy2(src, dist_app_dir / name)


def _build_agent_launcher(dist_app_dir: Path) -> Path | None:
    if not IS_WIN:
        return None

    go = os.getenv("AIMAX_GO_EXE", "").strip() or shutil.which("go")
    if not go:
        raise RuntimeError("Go compiler not found; install Go to build aimax-agent-launcher.exe")

    src = ROOT.parent / "packaging" / "windows" / "aimax_agent_launcher.go"
    if not src.exists():
        raise RuntimeError(f"Go launcher source not found: {src}")

    output = dist_app_dir / "aimax-agent-launcher.exe"
    go_cache = ROOT.parent / ".tmp" / "go-build-cache"
    go_cache.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env.setdefault("GOCACHE", str(go_cache))
    cmd = [
        go,
        "build",
        "-ldflags=-s -w -H=windowsgui",
        "-o",
        str(output),
        str(src),
    ]
    print(f"[BUILD] Building native launcher: {output}")
    result = subprocess.run(cmd, cwd=ROOT.parent, env=env)
    if result.returncode != 0:
        raise RuntimeError("Go launcher build failed")
    return output


def _make_release_archive(dist_app_dir: Path) -> Path:
    platform_tag = "windows" if IS_WIN else "macos" if IS_MAC else sys.platform
    archive_base = ROOT / "dist" / f"{APP_NAME}-{platform_tag}"
    archive_path = archive_base.with_suffix(".zip")
    if archive_path.exists():
        archive_path.unlink()
    shutil.make_archive(str(archive_base), "zip", root_dir=ROOT / "dist", base_dir=dist_app_dir.name)
    return archive_path


def _find_signtool() -> str | None:
    env_path = os.getenv("SIGNTOOL_PATH", "").strip()
    if env_path and Path(env_path).exists():
        return env_path

    found = shutil.which("signtool")
    if found:
        return found

    kits_dir = Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")) / "Windows Kits" / "10" / "bin"
    if kits_dir.exists():
        candidates = sorted(kits_dir.glob(r"*\x64\signtool.exe"), reverse=True)
        if candidates:
            return str(candidates[0])
    return None


def _sign_executable(exe_path: Path) -> bool:
    if not IS_WIN:
        return True

    pfx_path = os.getenv("CODESIGN_PFX_PATH", "").strip()
    cert_sha1 = os.getenv("CODESIGN_CERT_SHA1", "").strip()
    if not pfx_path and not cert_sha1:
        print(
            "[WARN] 코드서명 인증서가 없어 unsigned exe로 빌드합니다. "
            "Smart App Control/기업 WDAC 환경에서는 실행이 차단될 수 있습니다.",
            file=sys.stderr,
        )
        return False

    signtool = _find_signtool()
    if not signtool:
        print(
            "[WARN] signtool.exe를 찾지 못해 코드서명을 건너뜁니다. "
            "Windows SDK 설치 또는 SIGNTOOL_PATH 설정이 필요합니다.",
            file=sys.stderr,
        )
        return False

    timestamp_url = os.getenv("CODESIGN_TIMESTAMP_URL", "http://timestamp.digicert.com").strip()
    cmd = [signtool, "sign", "/fd", "SHA256", "/tr", timestamp_url, "/td", "SHA256"]
    if pfx_path:
        cmd += ["/f", pfx_path]
        pfx_password = os.getenv("CODESIGN_PFX_PASSWORD", "")
        if pfx_password:
            cmd += ["/p", pfx_password]
    else:
        cmd += ["/sha1", cert_sha1]
    cmd.append(str(exe_path))

    print(f"[BUILD] Signing: {exe_path}")
    result = subprocess.run(cmd)
    if result.returncode != 0:
        print("[WARN] 코드서명 실패 - unsigned exe로 남습니다.", file=sys.stderr)
        return False
    return True


def main() -> int:
    if not ENTRY.exists():
        print(f"[ERROR] entry point 없음: {ENTRY}", file=sys.stderr)
        return 1

    sep = ";" if IS_WIN else ":"

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onedir",
        "--name=" + APP_NAME,
        "--distpath=dist",
        "--workpath=build",
        "--clean",
        "--noconfirm",
        "--noconsole",
        f"--paths={ROOT.parent}",

        # 프로젝트 내 패키지
        "--hidden-import=auth",
        "--hidden-import=aimax_compliance",
        "--hidden-import=browser",
        "--hidden-import=bulk",
        "--hidden-import=content",
        "--hidden-import=content.neighbor_message_ai",
        "--hidden-import=content.ai_text",
        "--hidden-import=content.gemini_text",
        "--hidden-import=content.gemini_image",
        "--hidden-import=content.prompts",
        "--hidden-import=content.markdown_parser",
        "--hidden-import=engagement",
        "--hidden-import=engagement.neighbor_quota",
        "--hidden-import=engagement.auto_neighbor",
        "--hidden-import=local_agent",
        "--hidden-import=local_agent.runtime",
        "--hidden-import=local_agent.single_instance",
        "--hidden-import=posting",
        "--hidden-import=scraper",
        "--hidden-import=scraper.follower_scraper",
        "--hidden-import=utils",
        "--hidden-import=web_agent",
        "--hidden-import=web_agent.client",
        "--hidden-import=web_agent.integration",
        "--hidden-import=diagnostics",
        "--hidden-import=diagnostics.error_reporter",
        # 서브모듈 전체 수집 (런타임 조건부 import 안전 확보)
        "--collect-submodules=content",
        "--collect-submodules=engagement",
        "--collect-submodules=local_agent",
        "--collect-submodules=scraper",
        "--collect-submodules=web_agent",
        "--collect-submodules=diagnostics",

        # 외부 패키지
        "--hidden-import=ttkbootstrap",
        "--hidden-import=ttkbootstrap.themes",
        "--hidden-import=selenium_stealth",
        "--hidden-import=selenium.webdriver",
        "--hidden-import=selenium.webdriver.chrome",
        "--hidden-import=selenium.webdriver.chrome.service",
        "--hidden-import=google.genai",
        "--hidden-import=google.genai.types",
        "--hidden-import=anthropic",
        "--hidden-import=PIL._tkinter_finder",
        "--hidden-import=keyring.backends",
        "--hidden-import=undetected_chromedriver",
        "--hidden-import=undetected_chromedriver.patcher",
        "--hidden-import=setuptools",
        "--hidden-import=setuptools._distutils",
        "--hidden-import=packaging",

        # 전체 데이터 수집
        "--collect-all=ttkbootstrap",
        "--collect-all=selenium",
        "--collect-all=selenium_stealth",
        "--collect-all=undetected_chromedriver",
        "--collect-all=google.genai",
        "--collect-all=anthropic",
        "--exclude-module=google.genai.tests",
        "--exclude-module=pytest",

        # 프로젝트 리소스
        f"--add-data=config.yaml{sep}.",
        f"--add-data=assets{sep}assets",

        str(ENTRY),
    ]

    # 플랫폼별 옵션
    if IS_WIN:
        cmd.append("--hidden-import=keyring.backends.Windows")
        icon = ROOT / "assets" / "app.ico"
        if icon.exists():
            cmd.append(f"--icon={icon}")

    elif IS_MAC:
        cmd.append("--hidden-import=keyring.backends.macOS")
        # macOS 번들에서 Tk deprecation 경고 억제
        cmd += ["--runtime-hook", str(ROOT / "hooks" / "macos_tk_fix.py")] if (ROOT / "hooks" / "macos_tk_fix.py").exists() else []
        icon = ROOT / "assets" / "app.icns"
        if icon.exists():
            cmd.append(f"--icon={icon}")

    print(f"[BUILD] Running PyInstaller ({sys.platform})\n")
    result = subprocess.run(cmd)
    if result.returncode != 0:
        return result.returncode

    dist_app_dir = ROOT / "dist" / APP_NAME
    if not dist_app_dir.exists():
        print(f"[ERROR] 빌드 결과 폴더 없음: {dist_app_dir}", file=sys.stderr)
        return 1

    _sign_executable(dist_app_dir / f"{APP_NAME}.exe")
    launcher_path = _build_agent_launcher(dist_app_dir)
    if launcher_path:
        _sign_executable(launcher_path)
    _copy_release_docs(dist_app_dir)
    archive_path = _make_release_archive(dist_app_dir)
    print(f"\n[BUILD] App folder: {dist_app_dir}")
    print(f"[BUILD] Release zip: {archive_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
