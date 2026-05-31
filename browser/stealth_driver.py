import os
import platform
import random
import re
import shutil
import subprocess
import time
from glob import glob

import undetected_chromedriver as uc
from selenium_stealth import stealth

from config import (
    BROWSER_EXECUTABLE_PATH,
    HEADLESS,
    PROXY,
    VIEWPORT_MIN,
    VIEWPORT_MAX,
)
from paths import BROWSER_PROFILES_DIR
from utils.logger import get_logger

try:
    import certifi
    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
    os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
except ImportError:
    pass

logger = get_logger(__name__)

_OS = platform.system()
_FALLBACK_HEADLESS_UA_VERSION = 124


def _iter_browser_candidates():
    """실행 가능한 Chromium 계열 브라우저 경로를 우선순위대로 반환."""
    env_candidates = [
        BROWSER_EXECUTABLE_PATH,
        os.getenv("CHROME_PATH", ""),
        os.getenv("CHROMIUM_PATH", ""),
    ]

    command_candidates = {
        "Windows": ["chrome", "chromium", "brave"],
        "Darwin": ["google-chrome", "chromium", "brave-browser"],
        "Linux": ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"],
    }

    path_patterns = {
        "Windows": [
            r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe",
            r"%ProgramFiles%\Google\Chrome\Application\chrome.exe",
            r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe",
            r"%LOCALAPPDATA%\Chromium\Application\chrome.exe",
            r"%ProgramFiles%\Chromium\Application\chrome.exe",
            r"%ProgramFiles(x86)%\Chromium\Application\chrome.exe",
            r"%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe",
            r"%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe",
            r"%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe",
            r"%LOCALAPPDATA%\ms-playwright\chromium-*\chrome-win\chrome.exe",
            r"%LOCALAPPDATA%\ms-playwright\chromium-*\chrome-win64\chrome.exe",
        ],
        "Darwin": [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
            "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        ],
        "Linux": [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
            "/snap/bin/chromium",
        ],
    }

    seen = set()

    def _yield(path):
        if not path:
            return
        if "*" in path:
            matches = sorted(glob(path), reverse=True)
        else:
            matches = [path]
        for match in matches:
            expanded = os.path.expandvars(match)
            if not os.path.exists(expanded):
                continue
            norm = os.path.normcase(os.path.abspath(expanded))
            if norm in seen:
                continue
            seen.add(norm)
            yield expanded

    for candidate in env_candidates:
        yield from _yield(candidate)

    for command_name in command_candidates.get(_OS, []):
        resolved = shutil.which(command_name)
        yield from _yield(resolved or "")

    for pattern in path_patterns.get(_OS, []):
        yield from _yield(pattern)


def _find_browser_executable():
    for candidate in _iter_browser_candidates():
        logger.info(f"브라우저 실행 파일 감지: {candidate}")
        return candidate
    return None


def _get_chrome_major_version(browser_path=None):
    """설치된 Chromium 계열 브라우저의 메이저 버전 번호 반환."""
    commands = []
    if browser_path:
        commands.append([browser_path, "--version"])
        if _OS == "Windows":
            escaped = browser_path.replace("'", "''")
            commands.append([
                "powershell",
                "-NoProfile",
                "-Command",
                f"[System.Diagnostics.FileVersionInfo]::GetVersionInfo('{escaped}').FileVersion",
            ])

    for cmd in commands:
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            output = (result.stdout or result.stderr or "").strip()
            if result.returncode == 0 and output:
                match = re.search(r"(\d+)\.\d+\.\d+", output)
                if match:
                    major = int(match.group(1))
                    logger.info(f"브라우저 버전 감지: {output[:60]} (메이저: {major})")
                    return major
        except Exception as e:
            logger.debug(f"크롬 버전 감지 시도 실패 ({cmd[0]}): {e}")

    logger.debug("브라우저 버전 자동 감지 불가 - undetected-chromedriver 자동 선택 사용")
    return None


def _sanitize_profile_key(profile_key):
    raw = (profile_key or "default").strip()
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", raw).strip("._-")
    return safe[:64] or "default"


def _get_profile_dir(profile_key=None):
    profile_name = _sanitize_profile_key(profile_key)
    profile_dir = BROWSER_PROFILES_DIR / profile_name
    profile_dir.mkdir(parents=True, exist_ok=True)
    return str(profile_dir)


def _profile_lock_paths(profile_dir):
    return [
        os.path.join(profile_dir, "SingletonLock"),
        os.path.join(profile_dir, "SingletonSocket"),
        os.path.join(profile_dir, "SingletonCookie"),
    ]


def _profile_process_pids(profile_dir):
    """현재 앱 프로필을 물고 있는 Chrome/driver 프로세스 PID 목록."""
    if _OS == "Windows":
        escaped_profile = profile_dir.lower().replace("'", "''")
        script = (
            "$profile = '" + escaped_profile + "'\n"
            "Get-CimInstance Win32_Process | Where-Object {\n"
            "  $_.CommandLine -and $_.CommandLine.ToLower().Contains($profile) -and\n"
            "  ($_.Name -match 'chrome|chromedriver')\n"
            "} | Select-Object -ExpandProperty ProcessId"
        )
        try:
            result = subprocess.run(
                ["powershell", "-NoProfile", "-Command", script],
                capture_output=True,
                text=True,
                timeout=5,
            )
        except Exception:
            return []

        pids = []
        current_pid = os.getpid()
        for line in (result.stdout or "").splitlines():
            try:
                pid = int(line.strip())
            except ValueError:
                continue
            if pid != current_pid:
                pids.append(pid)
        return pids

    if _OS != "Darwin":
        return []
    try:
        result = subprocess.run(
            ["pgrep", "-f", re.escape(profile_dir)],
            capture_output=True,
            text=True,
            timeout=3,
        )
    except Exception:
        return []

    pids = []
    current_pid = os.getpid()
    for line in (result.stdout or "").splitlines():
        try:
            pid = int(line.strip())
        except ValueError:
            continue
        if pid != current_pid:
            pids.append(pid)
    return pids


def _terminate_pid(pid, force=False):
    if _OS == "Windows":
        cmd = ["taskkill", "/PID", str(pid), "/T"]
        if force:
            cmd.append("/F")
        try:
            subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        except Exception:
            pass
        return

    try:
        os.kill(pid, 9 if force else 15)
    except OSError:
        pass


def _stop_profile_processes(profile_dir):
    pids = _profile_process_pids(profile_dir)
    if not pids:
        return

    logger.info(f"이전 브라우저 프로세스 정리 중: {len(pids)}개")
    for pid in pids:
        _terminate_pid(pid, force=False)

    deadline = time.time() + 5
    while time.time() < deadline:
        if not _profile_process_pids(profile_dir):
            return
        time.sleep(0.2)

    for pid in _profile_process_pids(profile_dir):
        _terminate_pid(pid, force=True)


def _clear_profile_locks(profile_dir):
    for path in _profile_lock_paths(profile_dir):
        try:
            if os.path.lexists(path):
                os.unlink(path)
                logger.info(f"브라우저 프로필 잠금 파일 정리: {os.path.basename(path)}")
        except OSError as e:
            logger.debug(f"브라우저 프로필 잠금 파일 정리 실패 ({path}): {e}")


def _prepare_profile_dir(profile_dir):
    # 이전 실행이 비정상 종료되면 Singleton* 파일과 Chrome 프로세스가
    # 남아 다음 실행의 키워드 검색/로그인 브라우저 시작을 막는다.
    _stop_profile_processes(profile_dir)
    _clear_profile_locks(profile_dir)


def _is_chrome_launch_error(error):
    text = str(error or "").lower()
    return any(
        marker in text
        for marker in (
            "chrome not reachable",
            "cannot connect to chrome",
            "session not created",
            "devtools",
            "target frame detached",
            "browser has closed",
        )
    )


def _reset_profile_dir(profile_dir):
    _stop_profile_processes(profile_dir)
    _clear_profile_locks(profile_dir)
    if not os.path.exists(profile_dir):
        os.makedirs(profile_dir, exist_ok=True)
        return

    backup_path = f"{profile_dir}.recover-{time.strftime('%Y%m%d%H%M%S')}"
    try:
        shutil.move(profile_dir, backup_path)
        logger.warning(f"손상 가능성이 있는 브라우저 프로필을 백업했습니다: {backup_path}")
    except Exception as e:
        logger.warning(f"브라우저 프로필 백업 실패, 기존 프로필로 재시도합니다: {e}")
    os.makedirs(profile_dir, exist_ok=True)


def _build_chrome_options(proxy=None, headless=None, chrome_ver=None):
    options = uc.ChromeOptions()

    width = random.randint(VIEWPORT_MIN[0], VIEWPORT_MAX[0])
    height = random.randint(VIEWPORT_MIN[1], VIEWPORT_MAX[1])
    options.add_argument(f"--window-size={width},{height}")

    if headless:
        options.add_argument("--headless=new")
        ua_version = chrome_ver or _FALLBACK_HEADLESS_UA_VERSION
        options.add_argument(
            "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            f"Chrome/{ua_version}.0.0.0 Safari/537.36"
        )

    if proxy:
        options.add_argument(f"--proxy-server={proxy}")

    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--no-first-run")
    options.add_argument("--no-default-browser-check")
    options.add_argument("--lang=ko-KR")
    if os.path.exists("/.dockerenv"):
        options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    return options


def create_stealth_driver(proxy=None, headless=None, profile_key=None):
    """undetected-chromedriver + selenium-stealth로 탐지 우회 브라우저 생성"""
    if headless is None:
        headless = HEADLESS
    if proxy is None:
        proxy = PROXY

    browser_path = _find_browser_executable()
    if not browser_path:
        raise RuntimeError(
            "Chrome/Chromium/Brave 실행 파일을 찾지 못했습니다. "
            "Chrome, Chromium, Brave 중 하나를 설치하거나 "
            "BROWSER_EXECUTABLE_PATH 환경변수 또는 config.yaml의 browser.executable_path를 설정해주세요."
        )

    chrome_ver = _get_chrome_major_version(browser_path)
    options = _build_chrome_options(proxy=proxy, headless=headless, chrome_ver=chrome_ver)

    profile_dir = _get_profile_dir(profile_key)
    _prepare_profile_dir(profile_dir)
    options.add_argument(f"--user-data-dir={profile_dir}")
    options.add_argument("--profile-directory=Default")
    logger.info(f"브라우저 프로필 사용: {profile_dir}")

    launch_kwargs = {
        "browser_executable_path": browser_path,
        # PyInstaller macOS 번들에서는 multiprocessing 기반 detached launch가
        # 앱 본체를 한 번 더 띄우는 현상을 만들 수 있어 subprocess 경로를 명시한다.
        "use_subprocess": True,
    }
    if chrome_ver:
        launch_kwargs["version_main"] = chrome_ver

    logger.info("스텔스 브라우저 시작 중...")
    try:
        driver = uc.Chrome(options=options, **launch_kwargs)
    except Exception as e:
        logger.warning(f"브라우저 시작 실패 ({e}), version_main 없이 재시도...")
        retry_options = _build_chrome_options(proxy=proxy, headless=headless, chrome_ver=chrome_ver)
        retry_options.add_argument(f"--user-data-dir={profile_dir}")
        retry_options.add_argument("--profile-directory=Default")
        try:
            driver = uc.Chrome(
                options=retry_options,
                browser_executable_path=browser_path,
                use_subprocess=True,
            )
        except Exception as retry_error:
            if not (_is_chrome_launch_error(e) or _is_chrome_launch_error(retry_error)):
                raise
            logger.warning("브라우저 프로필/디버그 연결 복구 후 한 번 더 재시도합니다.")
            _reset_profile_dir(profile_dir)
            recovery_options = _build_chrome_options(proxy=proxy, headless=headless, chrome_ver=chrome_ver)
            recovery_options.add_argument(f"--user-data-dir={profile_dir}")
            recovery_options.add_argument("--profile-directory=Default")
            try:
                driver = uc.Chrome(
                    options=recovery_options,
                    browser_executable_path=browser_path,
                    use_subprocess=True,
                )
            except Exception as recovery_error:
                raise RuntimeError(
                    "브라우저 시작 실패: Chrome 프로필/디버그 연결 복구 후에도 시작할 수 없습니다. "
                    f"원인: {recovery_error}"
                ) from recovery_error

    stealth_platform = {"Darwin": "MacIntel", "Linux": "Linux x86_64"}.get(_OS, "Win32")
    try:
        stealth(
            driver,
            languages=["ko-KR", "ko", "en-US", "en"],
            vendor="Google Inc.",
            platform=stealth_platform,
            webgl_vendor="Intel Inc.",
            renderer="Intel Iris OpenGL Engine",
            fix_hairline=True,
        )
        logger.info("스텔스 브라우저 준비 완료")
    except Exception as e:
        logger.warning(f"selenium-stealth 적용 실패 (계속 진행): {e}")
        logger.info("스텔스 브라우저 준비 완료 (stealth 미적용)")
    return driver
