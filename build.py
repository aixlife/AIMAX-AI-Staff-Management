"""PyInstaller 빌드 스크립트 — Windows / macOS standalone 빌드.

로컬 빌드: python build.py
CI 빌드:  GitHub Actions 에서 동일 명령 실행

산출물:
  Windows: dist/AIMAX/          → Windows에서 설치 파일로 패키징
  macOS:   dist/AIMAX.app/      → dist/AIMAX-macos.dmg
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import plistlib
from pathlib import Path

# Windows cp949 콘솔에서 한글/em-dash(—) 출력이 UnicodeEncodeError 로 빌드를 크래시시키지
# 않도록 stdout/stderr 를 UTF-8 로 강제한다(PYTHONUTF8=1 환경변수 없이도 안전).
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

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


def _write_bundle_manifest(runtime_root: Path) -> Path:
    """onedir 전체 파일의 {경로, sha256, size} 매니페스트를 onedir 루트에 생성한다.

    app.py 가 시작 시(_verify_bundle_integrity) 이 매니페스트와 대조해 '업데이트 부분 교체'
    혼합 상태(구버전 잔재/미교체 파일)를 실행 전에 감지한다. 매니페스트가 없는 산출물
    (구버전, 맥 .app)은 검사에서 그냥 통과하므로 하위호환 걱정 없이 항상 생성한다.
    반드시 런처/배포 문서까지 onedir 에 다 들어간 뒤(payload 확정 후) 호출해야 한다.
    """
    from aimax_compliance import APP_VERSION
    from diagnostics.bundle_manifest import write_manifest

    path = write_manifest(runtime_root, APP_VERSION)
    import json as _json
    file_count = _json.loads(path.read_text(encoding="utf-8")).get("file_count")
    print(f"[BUILD] Bundle manifest: {path} ({file_count} files, {APP_VERSION})")
    return path


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


# 빌드 산출물이 이 버전 미만이면 라이브 min_version(win v1.0.44 / mac v1.0.36) 정책에
# 막혀 강제 업데이트 루프가 발생한다. 통합 정본 미만 빌드(예: 옛 fix 브랜치 v1.0.36)를 차단.
_MIN_BUILD_VERSION = (1, 0, 44)


def _parse_semver(value: str):
    nums = re.findall(r"\d+", str(value or ""))
    return tuple(int(n) for n in nums[:3]) + (0,) * (3 - len(nums[:3]))


def _preflight_build_guard() -> None:
    """잘못된 브랜치(러너 하드닝/통합 정본 누락)에서 회귀 번들이 출하되는 것을 막는 내용 기반 가드.

    브랜치 이름은 바뀌므로 이름이 아니라 '소스에 하드닝 마커가 있는지'를 검증한다.
    긴급 우회: AIMAX_BUILD_SKIP_GUARD=1 (경고 후 진행).
    """
    if os.getenv("AIMAX_BUILD_SKIP_GUARD", "").strip() in ("1", "true", "TRUE", "yes"):
        print("[BUILD][WARN] AIMAX_BUILD_SKIP_GUARD 설정 — 빌드 가드를 건너뜁니다. 회귀 출하 위험을 직접 확인하세요.")
        return

    from aimax_compliance import APP_VERSION

    failures = []

    # 1) 버전 floor: 라이브 min_version 미만 빌드 차단
    if _parse_semver(APP_VERSION) < _MIN_BUILD_VERSION:
        failures.append(
            f"APP_VERSION({APP_VERSION}) 이 최소 빌드 버전(v{'.'.join(map(str, _MIN_BUILD_VERSION))}) 미만 "
            "— 옛/분기 브랜치를 빌드 중일 수 있습니다. 통합 정본 브랜치에서 빌드하세요."
        )

    # 2) 러너 하드닝/통합 마커 — 하나라도 없으면 옛 브랜치
    checks = [
        (ROOT / "local_agent" / "single_instance.py", "_lock_payload",
         "single_instance 버전락(옛 코어 종료용) 누락"),
        (ROOT / "app.py", "_auto_migrate_local_secrets_to_web",
         "키 웹 자동이전 누락(전부 웹키 구조 깨짐)"),
        (ROOT / "app.py", "_update_popup_open",
         "업데이트 팝업 재진입 가드 누락(무한로딩 회귀)"),
        (ROOT / "content" / "ai_text.py", "_normalize_gemini_model_id",
         "모델 정규화 누락(Pro 모델 계약 불일치)"),
        (ROOT / "app.py", "AIMAXAgentAppMutex",
         "설치기 AppMutex 뮤텍스 생성 누락(설치기가 실행 중 앱을 감지 못해 부분 교체 회귀)"),
        (ROOT / "app.py", "_verify_bundle_integrity",
         "시작 시 번들 무결성 자기검사 누락(부분 교체 혼합 상태 실행 회귀)"),
        (ROOT / "diagnostics" / "bundle_manifest.py", "def verify_manifest",
         "번들 매니페스트 검증 모듈 누락(무결성 자기검사 무력화)"),
        (ROOT / "app.py", "_probe_critical_imports",
         "핵심 모듈 임포트 조기 감지 누락(부분 교체 시 잡 실행 중 ImportError 회귀)"),
        (ROOT / "local_agent" / "worker_watchdog.py", "evaluate_worker_watchdog",
         "워커 기동 감시(2차 좀비보호) 판정 누락"),
        (ROOT / "app.py", "_restart_runner_process",
         "워커 미기동 시 실행기 자체 재시작(2차 좀비보호) 누락"),
    ]
    for path, marker, why in checks:
        try:
            text = path.read_text(encoding="utf-8")
        except Exception as e:  # noqa: BLE001
            failures.append(f"{path.name} 읽기 실패: {e}")
            continue
        if marker not in text:
            failures.append(f"{path.name}: '{marker}' 없음 — {why}")

    # 3) build.py 자기검증: 런처 버전 주입 ldflags / 번들 매니페스트 생성이 있는지
    build_py_text = Path(__file__).read_text(encoding="utf-8")
    if "main.launcherVersion" not in build_py_text:
        failures.append("build.py: 런처 ldflags(main.launcherVersion) 주입 누락 — 옛 코어 종료 무력화")
    if "_write_bundle_manifest" not in build_py_text:
        failures.append("build.py: 번들 매니페스트 생성(_write_bundle_manifest) 누락 — 무결성 자기검사 무력화")

    # git 브랜치/커밋 로깅(추적용, 실패해도 비차단)
    try:
        branch = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=ROOT,
                                capture_output=True, text=True).stdout.strip()
        commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT,
                                capture_output=True, text=True).stdout.strip()
        print(f"[BUILD] 소스 브랜치={branch or '?'} 커밋={commit or '?'} APP_VERSION={APP_VERSION}")
    except Exception:
        pass

    if failures:
        print("[BUILD][ABORT] 빌드 가드 실패 — 잘못된/옛 브랜치에서 빌드 중일 수 있습니다:", file=sys.stderr)
        for f in failures:
            print(f"  - {f}", file=sys.stderr)
        print("  통합 정본 브랜치를 체크아웃하세요. (긴급 우회: AIMAX_BUILD_SKIP_GUARD=1)", file=sys.stderr)
        raise SystemExit(2)
    print("[BUILD] 빌드 가드 통과 — 러너 하드닝/모델 계약/버전 정상.")


def main() -> int:
    if not ENTRY.exists():
        print(f"[ERROR] entry point 없음: {ENTRY}", file=sys.stderr)
        return 1

    _preflight_build_guard()

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
        # aimax:// (GetURL Apple Event) 수신용 PyObjC Foundation. local_agent/runtime.py 가
        # lazy import 라 정적 분석으로 안 잡히므로 명시 수집(미포함 시 맥 계정 불일치 자동감지 불능).
        cmd.append("--hidden-import=Foundation")
        cmd.append("--hidden-import=objc")
        cmd.append("--collect-submodules=objc")
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
    # 매니페스트는 payload 확정(런처 빌드 + 배포 문서 복사) 후, 패키징 직전에 생성한다.
    # 맥 .app 은 codesign 이후 파일 추가가 서명을 깨므로 onedir(dist/AIMAX)에만 생성 —
    # 맥 런타임은 매니페스트가 없어 검사를 통과한다(구버전 호환 경로와 동일).
    if onedir_dir.exists():
        _write_bundle_manifest(onedir_dir)
    package_path = _make_release_package(release_payload)
    print(f"\n[BUILD] App artifact: {app_artifact}")
    print(f"[BUILD] Release payload: {release_payload}")
    print(f"[BUILD] Release package: {package_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
