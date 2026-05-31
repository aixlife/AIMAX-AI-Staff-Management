"""기능별 분리 앱 빌드 스크립트.

사용 예:
  python build_split.py find
  python build_split.py engage_write
  python build_split.py all
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import plistlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parent
IS_WIN = sys.platform.startswith("win")
IS_MAC = sys.platform == "darwin"

APPS = {
    "find": {
        "entry": ROOT / "app_find.py",
        "build_name": "AIMAX-Find",
        "name": "AIMAX-현주씨-영업사원",
        "label": "찾아볼게요",
    },
    "engage_write": {
        "entry": ROOT / "app_engage_write.py",
        "build_name": "AIMAX-EngageWrite",
        "name": "AIMAX-예리씨-블로그글쓰기",
        "label": "친해질게요 + 설득할게요",
    },
}


def _apply_macos_url_scheme(info: dict) -> None:
    info["CFBundleURLTypes"] = [
        {
            "CFBundleURLName": "AIMAX Local Agent",
            "CFBundleURLSchemes": ["aimax"],
        }
    ]


def _data_arg(src: Path, dest: str) -> str:
    sep = ";" if IS_WIN else ":"
    return f"{src}{sep}{dest}"


def _copy_release_docs(dist_app_dir: Path) -> None:
    for base in (ROOT, PROJECT_ROOT):
        for name in ("처음_읽어주세요.txt", "업데이트_내역.txt"):
            src = base / name
            if src.exists():
                shutil.copy2(src, dist_app_dir / name)


def _build_agent_launcher(dist_app_dir: Path) -> Path | None:
    if not IS_WIN:
        return None

    go = os.getenv("AIMAX_GO_EXE", "").strip() or shutil.which("go")
    if not go:
        raise RuntimeError("Go compiler not found; install Go to build aimax-agent-launcher.exe")

    src = PROJECT_ROOT / "packaging" / "windows" / "aimax_agent_launcher.go"
    if not src.exists():
        raise RuntimeError(f"Go launcher source not found: {src}")

    output = dist_app_dir / "aimax-agent-launcher.exe"
    go_cache = PROJECT_ROOT / ".tmp" / "go-build-cache"
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
    result = subprocess.run(cmd, cwd=PROJECT_ROOT, env=env)
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


def _make_archive(app_name: str, dist_app_dir: Path) -> Path:
    platform_tag = "windows" if IS_WIN else "macos" if IS_MAC else sys.platform
    if IS_MAC:
        return _make_macos_dmg(app_name, dist_app_dir)
    if IS_WIN:
        return dist_app_dir

    archive_base = ROOT / "dist" / f"{app_name}-{platform_tag}"
    archive_path = archive_base.with_suffix(".zip")
    if archive_path.exists():
        archive_path.unlink()
    shutil.make_archive(
        str(archive_base),
        "zip",
        root_dir=ROOT / "dist",
        base_dir=dist_app_dir.name,
    )
    return archive_path


def _make_release_payload(app_name: str, app_artifact: Path) -> Path:
    """릴리스 zip에 넣을 폴더를 준비한다.

    macOS에서는 Unix 실행 파일 폴더 대신 .app 번들을 배포해야 Finder에서
    Terminal 없이 바로 실행된다.
    """
    if IS_MAC and app_artifact.suffix == ".app":
        release_dir = ROOT / "dist" / f"{app_name}-macos"
        if release_dir.exists():
            shutil.rmtree(release_dir)
        release_dir.mkdir(parents=True)
        shutil.copytree(app_artifact, release_dir / f"{app_name}.app", symlinks=True)
        _copy_release_docs(release_dir)
        return release_dir

    _copy_release_docs(app_artifact)
    return app_artifact


def _patch_macos_bundle_metadata(app_name: str, mode: str, app_artifact: Path) -> None:
    if not IS_MAC or app_artifact.suffix != ".app":
        return
    plist_path = app_artifact / "Contents" / "Info.plist"
    if not plist_path.exists():
        return
    bundle_suffix = "find" if mode == "find" else "engagewrite"
    from aimax_compliance import APP_VERSION

    bundle_version = APP_VERSION.removeprefix("v")
    with plist_path.open("rb") as f:
        info = plistlib.load(f)
    info["CFBundleShortVersionString"] = bundle_version
    info["CFBundleVersion"] = bundle_version
    info["CFBundleIdentifier"] = f"kr.makefamily.aimax.{bundle_suffix}"
    info["CFBundleDisplayName"] = app_name
    info["CFBundleName"] = app_name
    _apply_macos_url_scheme(info)
    with plist_path.open("wb") as f:
        plistlib.dump(info, f)
    subprocess.run(
        ["/usr/bin/codesign", "-s", "-", "--force", "--deep", str(app_artifact)],
        check=False,
    )


def build_one(mode: str) -> int:
    spec = APPS[mode]
    entry = spec["entry"]
    app_name = spec["name"]
    build_name = spec.get("build_name", app_name)
    if not entry.exists():
        print(f"[ERROR] entry point 없음: {entry}", file=sys.stderr)
        return 1

    for stale_path in (
        ROOT / "dist" / app_name,
        ROOT / "dist" / f"{app_name}.app",
        ROOT / "dist" / build_name,
        ROOT / "dist" / f"{build_name}.app",
    ):
        if stale_path.exists():
            if stale_path.is_dir():
                shutil.rmtree(stale_path)
            else:
                stale_path.unlink()

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onedir",
        "--name=" + build_name,
        "--distpath=" + str(ROOT / "dist"),
        "--workpath=" + str(ROOT / "build"),
        "--specpath=" + str(ROOT / "build"),
        "--clean",
        "--noconfirm",
        "--noconsole",
        "--paths=" + str(ROOT),
        "--paths=" + str(PROJECT_ROOT),

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
        "--hidden-import=setuptools",
        "--hidden-import=setuptools._distutils",
        "--hidden-import=packaging",
        "--collect-all=ttkbootstrap",
        "--collect-submodules=undetected_chromedriver",
        "--collect-submodules=google.genai",
        "--collect-submodules=anthropic",
        "--exclude-module=IPython",
        "--exclude-module=jupyter",
        "--exclude-module=matplotlib",
        "--exclude-module=numpy",
        "--exclude-module=pandas",
        "--exclude-module=pytest",
        "--exclude-module=tkinter.test",
        "--exclude-module=unittest",

        # 프로젝트 리소스
        "--add-data=" + _data_arg(PROJECT_ROOT / "config.yaml", "."),
        "--add-data=" + _data_arg(PROJECT_ROOT / "assets", "assets"),
        str(entry),
    ]

    if IS_WIN:
        cmd.append("--hidden-import=keyring.backends.Windows")
        icon = PROJECT_ROOT / "assets" / "app.ico"
        if icon.exists():
            cmd.append("--icon=" + str(icon))
    elif IS_MAC:
        cmd.append("--hidden-import=keyring.backends.macOS")
        runtime_hook = PROJECT_ROOT / "hooks" / "macos_tk_fix.py"
        if runtime_hook.exists():
            cmd += ["--runtime-hook", str(runtime_hook)]
        icon = PROJECT_ROOT / "assets" / "app.icns"
        if icon.exists():
            cmd.append("--icon=" + str(icon))

    print(f"[BUILD] {spec['label']} ({mode}) 빌드 시작\n")
    result = subprocess.run(cmd)
    if result.returncode != 0:
        return result.returncode

    onedir_dir = ROOT / "dist" / build_name
    app_bundle = ROOT / "dist" / f"{build_name}.app"
    app_artifact = app_bundle if IS_MAC and app_bundle.exists() else onedir_dir
    if not app_artifact.exists():
        print(f"[ERROR] 빌드 결과 폴더 없음: {app_artifact}", file=sys.stderr)
        return 1

    if IS_WIN:
        _build_agent_launcher(onedir_dir)
    _patch_macos_bundle_metadata(app_name, mode, app_artifact)
    release_payload = _make_release_payload(app_name, app_artifact)
    package_path = _make_archive(app_name, release_payload)
    print(f"[BUILD] App artifact: {app_artifact}")
    print(f"[BUILD] Release payload: {release_payload}")
    print(f"[BUILD] Release package: {package_path}\n")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="기능별 분리 앱을 빌드합니다.")
    parser.add_argument(
        "target",
        choices=["find", "engage_write", "engagewrite", "all"],
        help="빌드 대상: find, engage_write, all",
    )
    args = parser.parse_args(argv)

    target_aliases = {"engagewrite": "engage_write"}
    targets = list(APPS) if args.target == "all" else [target_aliases.get(args.target, args.target)]
    for target in targets:
        code = build_one(target)
        if code != 0:
            return code
    return 0


if __name__ == "__main__":
    sys.exit(main())
