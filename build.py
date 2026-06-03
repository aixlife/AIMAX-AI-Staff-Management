"""PyInstaller 빌드 스크립트 — Windows / macOS standalone 빌드.

로컬 빌드: python build.py
CI 빌드:  GitHub Actions 에서 동일 명령 실행

산출물:
  Windows: dist/AIMAX/          → Windows에서 설치 파일로 패키징
  macOS:   dist/AIMAX.app/      → dist/AIMAX-macos.dmg
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import plistlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ENTRY = ROOT / "app.py"
APP_NAME = "AIMAX"
IS_WIN = sys.platform.startswith("win")
IS_MAC = sys.platform == "darwin"


def _apply_macos_url_scheme(info: dict) -> None:
    info["CFBundleURLTypes"] = [
        {
            "CFBundleURLName": "AIMAX Local Agent",
            "CFBundleURLSchemes": ["aimax"],
        }
    ]


def _copy_release_docs(dist_app_dir: Path) -> None:
    for name in ("처음_읽어주세요.txt", "업데이트_내역.txt"):
        src = ROOT / name
        if src.exists():
            shutil.copy2(src, dist_app_dir / name)


def _build_agent_launcher(dist_app_dir: Path) -> Path | None:
    if not IS_WIN:
        return None

    go = os.getenv("AIMAX_GO_EXE", "").strip() or shutil.which("go") or r"C:\Program Files\Go\bin\go.exe"
    if not go or not os.path.exists(go):
        raise RuntimeError("Go compiler not found; install Go to build aimax-agent-launcher.exe")

    src = ROOT / "packaging" / "windows" / "aimax_agent_launcher.go"
    if not src.exists():
        raise RuntimeError(f"Go launcher source not found: {src}")

    output = dist_app_dir / "aimax-agent-launcher.exe"
    go_cache = ROOT / ".tmp" / "go-build-cache"
    go_cache.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env.setdefault("GOCACHE", str(go_cache))
    # 런처에 설치 버전을 주입한다(main.launcherVersion). 런처는 실행 중인 옛 코어의
    # 버전(lock 기록)과 이 값을 비교해 버전 불일치 시 옛 코어를 종료한다.
    from aimax_compliance import APP_VERSION
    cmd = [
        go,
        "build",
        f"-ldflags=-s -w -H=windowsgui -X main.launcherVersion={APP_VERSION}",
        "-o",
        str(output),
        str(src),
    ]
    print(f"[BUILD] Building native launcher: {output}")
    result = subprocess.run(cmd, cwd=ROOT, env=env)
    if result.returncode != 0:
        raise RuntimeError("Go launcher build failed")
    return output


def _copy_tree_contents(src_dir: Path, dst_dir: Path) -> None:
    for item in src_dir.iterdir():
        target = dst_dir / item.name
        if item.is_dir():
            shutil.copytree(item, target, symlinks=True)
        else:
            shutil.copy2(item, target)


def _make_macos_dmg(app_name: str, release_dir: Path) -> Path:
    dmg_path = ROOT / "dist" / f"{app_name}-macos.dmg"
    staging_dir = ROOT / "dist" / f".{app_name}-dmg-staging"
    if staging_dir.exists():
        shutil.rmtree(staging_dir)
    staging_dir.mkdir(parents=True)
    _copy_tree_contents(release_dir, staging_dir)
    applications_link = staging_dir / "Applications"
    if not applications_link.exists():
        os.symlink("/Applications", applications_link)
    if dmg_path.exists():
        dmg_path.unlink()
    subprocess.run(
        [
            "/usr/bin/hdiutil",
            "create",
            "-volname",
            app_name,
            "-srcfolder",
            str(staging_dir),
            "-ov",
            "-format",
            "UDZO",
            str(dmg_path),
        ],
        check=True,
    )
    shutil.rmtree(staging_dir, ignore_errors=True)
    return dmg_path


def _make_release_package(dist_app_dir: Path) -> Path:
    platform_tag = "windows" if IS_WIN else "macos" if IS_MAC else sys.platform
    if IS_MAC:
        return _make_macos_dmg(APP_NAME, dist_app_dir)
    if IS_WIN:
        return dist_app_dir

    archive_base = ROOT / "dist" / f"{APP_NAME}-{platform_tag}"
    archive_path = archive_base.with_suffix(".zip")
    if archive_path.exists():
        archive_path.unlink()
    shutil.make_archive(str(archive_base), "zip", root_dir=ROOT / "dist", base_dir=dist_app_dir.name)
    return archive_path


def _make_release_payload(app_artifact: Path) -> Path:
    if IS_MAC and app_artifact.suffix == ".app":
        release_dir = ROOT / "dist" / f"{APP_NAME}-macos"
        if release_dir.exists():
            shutil.rmtree(release_dir)
        release_dir.mkdir(parents=True)
        shutil.copytree(app_artifact, release_dir / app_artifact.name, symlinks=True)
        _copy_release_docs(release_dir)
        return release_dir

    _copy_release_docs(app_artifact)
    return app_artifact


def _patch_macos_bundle_metadata(app_artifact: Path) -> None:
    if not IS_MAC or app_artifact.suffix != ".app":
        return
    plist_path = app_artifact / "Contents" / "Info.plist"
    if not plist_path.exists():
        return
    from aimax_compliance import APP_VERSION

    bundle_version = APP_VERSION.removeprefix("v")
    with plist_path.open("rb") as f:
        info = plistlib.load(f)
    info["CFBundleShortVersionString"] = bundle_version
    info["CFBundleVersion"] = bundle_version
    info["CFBundleIdentifier"] = "kr.makefamily.aimax"
    _apply_macos_url_scheme(info)
    with plist_path.open("wb") as f:
        plistlib.dump(info, f)
    subprocess.run(
        ["/usr/bin/codesign", "-s", "-", "--force", "--deep", str(app_artifact)],
        check=False,
    )


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
        "--specpath=build",
        "--clean",
        "--noconfirm",
        "--noconsole",

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
        "--hidden-import=content.openai_image",
        "--hidden-import=content.prompts",
        "--hidden-import=content.markdown_parser",
        "--hidden-import=engagement",
        "--hidden-import=engagement.neighbor_quota",
        "--hidden-import=engagement.auto_neighbor",
        "--hidden-import=local_agent",
        "--hidden-import=local_agent.runtime",
        "--hidden-import=local_agent.single_instance",
        "--hidden-import=diagnostics",
        "--hidden-import=diagnostics.error_reporter",
        "--hidden-import=diagnostics.redaction",
        "--hidden-import=diagnostics.system_info",
        "--hidden-import=posting",
        "--hidden-import=scraper",
        "--hidden-import=scraper.follower_scraper",
        "--hidden-import=utils",
        "--hidden-import=web_agent",
        "--hidden-import=web_agent.client",
        # 서브모듈 전체 수집 (런타임 조건부 import 안전 확보)
        "--collect-submodules=content",
        "--collect-submodules=diagnostics",
        "--collect-submodules=engagement",
        "--collect-submodules=local_agent",
        "--collect-submodules=scraper",
        "--collect-submodules=web_agent",

        # 외부 패키지
        "--hidden-import=ttkbootstrap",
        "--hidden-import=ttkbootstrap.themes",
        "--hidden-import=selenium_stealth",
        "--hidden-import=google.genai",
        "--hidden-import=google.genai.types",
        "--hidden-import=anthropic",
        "--hidden-import=PIL._tkinter_finder",
        "--hidden-import=keyring.backends",
        "--hidden-import=undetected_chromedriver",
        "--hidden-import=undetected_chromedriver.patcher",
        "--hidden-import=yt_dlp",
        "--hidden-import=setuptools",
        "--hidden-import=setuptools._distutils",
        "--hidden-import=packaging",

        # 전체 데이터 수집은 런타임 리소스가 필요한 패키지만 유지한다.
        "--collect-all=ttkbootstrap",
        # selenium_stealth 는 js/utils.js 데이터가 필요(미포함 시 'stealth 미적용' → 네이버 탐지 위험).
        # AIMAX.spec 의 collect_all('selenium_stealth') 와 동일하게 build.py 에서도 데이터까지 수집.
        "--collect-all=selenium_stealth",
        "--collect-submodules=undetected_chromedriver",
        "--collect-submodules=google.genai",
        "--collect-submodules=anthropic",
        "--collect-submodules=yt_dlp",
        "--collect-data=yt_dlp",
        "--exclude-module=IPython",
        "--exclude-module=jupyter",
        "--exclude-module=matplotlib",
        "--exclude-module=numpy",
        "--exclude-module=pandas",
        "--exclude-module=pytest",
        "--exclude-module=tkinter.test",
        "--exclude-module=unittest",

        # 프로젝트 리소스
        f"--add-data={ROOT / 'config.yaml'}{sep}.",
        f"--add-data={ROOT / 'assets'}{sep}assets",

        str(ENTRY),
    ]

    # 플랫폼별 옵션
    if IS_WIN:
        cmd.append("--hidden-import=keyring.backends.Windows")
        # 클립보드 이미지 업로드(posting/editor.py _try_upload_via_clipboard)에 필요.
        # pywin32 의 win32clipboard 는 동적 import 라 PyInstaller 가 자동 수집하지 못한다.
        cmd.append("--hidden-import=win32clipboard")
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

    onedir_dir = ROOT / "dist" / APP_NAME
    app_bundle = ROOT / "dist" / f"{APP_NAME}.app"
    app_artifact = app_bundle if IS_MAC and app_bundle.exists() else onedir_dir
    if not app_artifact.exists():
        print(f"[ERROR] 빌드 결과 폴더 없음: {app_artifact}", file=sys.stderr)
        return 1

    if IS_WIN:
        _build_agent_launcher(onedir_dir)
    _patch_macos_bundle_metadata(app_artifact)
    release_payload = _make_release_payload(app_artifact)
    package_path = _make_release_package(release_payload)
    print(f"\n[BUILD] App artifact: {app_artifact}")
    print(f"[BUILD] Release payload: {release_payload}")
    print(f"[BUILD] Release package: {package_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
