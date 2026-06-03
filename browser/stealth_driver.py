import os
import platform
import random
import re
import shutil
import subprocess
import time
from glob import glob
from pathlib import Path

import undetected_chromedriver as uc
from selenium import webdriver
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium_stealth import stealth

from config import (
    BROWSER_DRIVER_MODE,
    BROWSER_DRIVER_PATH,
    BROWSER_EXECUTABLE_PATH,
    HEADLESS,
    PROXY,
    VIEWPORT_MIN,
    VIEWPORT_MAX,
)
from paths import APP_DATA_DIR, BROWSER_PROFILES_DIR, BUNDLE_DIR
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
_APP_CONTROL_MARKERS = (
    "winerror 4551",
    "application control policy",
    "애플리케이션 제어 정책",
)


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


def _exception_text(error):
    parts = [str(error)]
    for attr in ("__cause__", "__context__"):
        nested = getattr(error, attr, None)
        if nested:
            parts.append(str(nested))
    return " ".join(parts)


def _is_application_control_block(error):
    text = _exception_text(error).lower()
    return any(marker in text for marker in _APP_CONTROL_MARKERS)


def _is_writable_dir(path):
    try:
        path.mkdir(parents=True, exist_ok=True)
        probe = path / ".write_test"
        probe.write_text("ok", encoding="utf-8")
        try:
            probe.unlink()
        except OSError:
            pass
        return True
    except OSError as e:
        logger.debug(f"드라이버 캐시 디렉토리 쓰기 불가 ({path}): {e}")
        return False


def _iter_driver_cache_dirs():
    env_cache_dir = os.getenv("CHROMEDRIVER_CACHE_DIR", "").strip()
    if env_cache_dir:
        yield Path(os.path.expandvars(env_cache_dir))
    yield APP_DATA_DIR / "driver_cache"
    yield BUNDLE_DIR / "driver_cache"


def _get_uc_driver_cache_dir():
    """undetected-chromedriver가 기본 %APPDATA% 캐시를 쓰지 않도록 경로 지정."""
    for cache_dir in _iter_driver_cache_dirs():
        if _is_writable_dir(cache_dir):
            logger.info(f"undetected 드라이버 캐시 사용: {cache_dir}")
            return cache_dir
    logger.warning("undetected 드라이버 캐시 디렉토리를 준비하지 못해 기본 캐시를 사용합니다.")
    return None


def _configure_uc_driver_cache_dir():
    cache_dir = _get_uc_driver_cache_dir()
    if not cache_dir:
        return
    try:
        import undetected_chromedriver.patcher as uc_patcher

        uc_patcher.Patcher.data_path = str(cache_dir)
    except Exception as e:
        logger.debug(f"undetected 드라이버 캐시 경로 설정 실패: {e}")


def _iter_chromedriver_candidates():
    exe_name = "chromedriver.exe" if _OS == "Windows" else "chromedriver"
    configured = BROWSER_DRIVER_PATH
    if configured:
        yield configured

    for base in (BUNDLE_DIR, BUNDLE_DIR / "drivers", BUNDLE_DIR / "driver_cache"):
        yield str(base / exe_name)

    resolved = shutil.which("chromedriver")
    if resolved:
        yield resolved


def _find_chromedriver_executable():
    seen = set()
    for candidate in _iter_chromedriver_candidates():
        expanded = os.path.expandvars(candidate)
        norm = os.path.normcase(os.path.abspath(expanded))
        if norm in seen:
            continue
        seen.add(norm)
        if os.path.exists(expanded):
            logger.info(f"공식 ChromeDriver 실행 파일 감지: {expanded}")
            return expanded
        if candidate == BROWSER_DRIVER_PATH:
            logger.warning(f"설정된 chromedriver 경로를 찾지 못했습니다: {expanded}")
    return None


def _get_chrome_major_version(browser_path=None):
    """설치된 Chromium 계열 브라우저의 메이저 버전 번호 반환."""
    commands = []
    if browser_path:
        if _OS == "Windows":
            escaped = browser_path.replace("'", "''")
            commands.append([
                "powershell",
                "-NoProfile",
                "-Command",
                f"[System.Diagnostics.FileVersionInfo]::GetVersionInfo('{escaped}').FileVersion",
            ])
        commands.append([browser_path, "--version"])

    for cmd in commands:
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=10,
            )
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
            "} | "
            "Select-Object -ExpandProperty ProcessId"
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


def _build_chrome_options(proxy=None, headless=None, chrome_ver=None, options_cls=None):
    options_cls = options_cls or uc.ChromeOptions
    options = options_cls()

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


def _attach_profile_options(options, profile_dir):
    options.add_argument(f"--user-data-dir={profile_dir}")
    options.add_argument("--profile-directory=Default")
    return options


def _create_undetected_driver(browser_path, proxy, headless, chrome_ver, profile_dir):
    _configure_uc_driver_cache_dir()
    options = _build_chrome_options(proxy=proxy, headless=headless, chrome_ver=chrome_ver)
    _attach_profile_options(options, profile_dir)

    launch_kwargs = {"browser_executable_path": browser_path}
    if chrome_ver:
        launch_kwargs["version_main"] = chrome_ver

    logger.info("스텔스 브라우저 시작 중...")
    try:
        return uc.Chrome(options=options, **launch_kwargs)
    except Exception as e:
        if _is_application_control_block(e) or not chrome_ver:
            raise
        logger.warning(f"브라우저 시작 실패 ({e}), version_main 없이 재시도...")
        retry_options = _build_chrome_options(proxy=proxy, headless=headless, chrome_ver=chrome_ver)
        _attach_profile_options(retry_options, profile_dir)
        retry_kwargs = {"browser_executable_path": browser_path}
        return uc.Chrome(options=retry_options, **retry_kwargs)


def _create_selenium_driver(browser_path, proxy, headless, chrome_ver, profile_dir):
    options = _build_chrome_options(
        proxy=proxy,
        headless=headless,
        chrome_ver=chrome_ver,
        options_cls=webdriver.ChromeOptions,
    )
    if browser_path:
        options.binary_location = browser_path
    _attach_profile_options(options, profile_dir)
    try:
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)
    except Exception:
        pass

    driver_path = _find_chromedriver_executable()
    if driver_path:
        service = ChromeService(executable_path=driver_path)
    else:
        logger.info("공식 ChromeDriver 경로 미지정 - Selenium Manager 자동 탐지/다운로드 사용")
        service = ChromeService()

    logger.info("일반 Selenium 브라우저 시작 중...")
    return webdriver.Chrome(service=service, options=options)


def _policy_block_message():
    return (
        "Windows 애플리케이션 제어 정책이 브라우저 드라이버 실행을 차단했습니다. "
        "config.yaml의 browser.driver_mode를 \"selenium\"으로 두고, "
        "Chrome 버전에 맞는 공식 chromedriver.exe를 허용된 폴더에 둔 뒤 "
        "browser.driver_path에 전체 경로를 지정해 주세요. "
        "환경변수 CHROMEDRIVER_PATH로도 지정할 수 있습니다."
    )


def _is_browser_start_failure(error):
    text = _exception_text(error).lower()
    markers = (
        "chrome not reachable",
        "cannot connect to chrome",
        "connectionreseterror",
        "connection aborted",
        "devtoolsactiveport",
        "user data directory is already in use",
        "session not created",
        "target frame detached",
        "browser has closed",
    )
    return any(marker in text for marker in markers)


def _browser_start_failure_message(error, browser_path=None, profile_dir=None):
    lines = [
        "브라우저 시작 실패: Chrome 프로필/디버그 연결 복구 후에도 시작할 수 없습니다.",
        "Chrome은 감지됐지만 실행 직후 닫혔거나, 드라이버가 Chrome에 연결하기 전에 연결이 끊겼습니다.",
    ]
    if browser_path:
        lines.append(f"- 감지된 Chrome: {browser_path}")
    if profile_dir:
        lines.append(f"- 사용한 브라우저 프로필: {profile_dir}")
    lines.extend([
        "",
        "지금 해볼 순서:",
        "1. 열려 있는 Chrome 창을 모두 닫고 프로그램을 다시 실행합니다.",
        "2. Ctrl + Shift + Esc를 눌러 작업 관리자를 엽니다.",
        "3. chrome.exe, chromedriver.exe, undetected_chromedriver.exe가 보이면 각각 선택 후 [작업 끝내기]를 누릅니다.",
        "4. Chrome을 열어 오른쪽 위 점 3개 > 도움말 > Chrome 정보에서 최신 버전으로 업데이트합니다.",
        "5. 프로그램 폴더가 OneDrive, 바탕 화면, 다운로드 폴더에 있다면 C:\\NaverBlogAuto 같은 일반 로컬 폴더로 옮긴 뒤 실행합니다.",
        "6. Windows 보안 > 보호 기록에서 NaverBlogAuto, chromedriver, undetected_chromedriver 차단 내역이 있으면 허용 또는 복원합니다.",
        "7. 계속 실패하면 Windows 키 + R을 누르고 %APPDATA%\\NaverBlogAuto 를 입력한 뒤 browser_profiles 폴더를 삭제하고 다시 실행합니다.",
        "   이 경우 브라우저 로그인 세션은 초기화되어 다시 로그인해야 할 수 있습니다.",
    ])
    logger.debug(f"browser start raw error: {_exception_text(error)}")
    return "\n".join(lines)


def _get_recovery_profile_dir(profile_key=None):
    profile_name = _sanitize_profile_key(profile_key)
    recovery_name = f"{profile_name}_recovery_{int(time.time())}"
    profile_dir = BROWSER_PROFILES_DIR / recovery_name
    profile_dir.mkdir(parents=True, exist_ok=True)
    return str(profile_dir)


def _create_driver_for_mode(driver_mode, browser_path, proxy, headless, chrome_ver, profile_dir):
    if driver_mode == "selenium":
        try:
            return _create_selenium_driver(browser_path, proxy, headless, chrome_ver, profile_dir)
        except Exception as e:
            if _is_application_control_block(e):
                raise RuntimeError(_policy_block_message()) from e
            raise

    try:
        return _create_undetected_driver(browser_path, proxy, headless, chrome_ver, profile_dir)
    except Exception as e:
        if driver_mode == "undetected":
            if _is_application_control_block(e):
                raise RuntimeError(_policy_block_message()) from e
            raise

        if _is_application_control_block(e):
            logger.warning("undetected 드라이버가 Windows 정책에 차단되어 일반 Selenium으로 전환합니다.")
        else:
            logger.warning(f"undetected 드라이버 시작 실패 ({e}); 일반 Selenium으로 전환합니다.")
        try:
            return _create_selenium_driver(browser_path, proxy, headless, chrome_ver, profile_dir)
        except Exception as fallback_error:
            if _is_application_control_block(e) or _is_application_control_block(fallback_error):
                raise RuntimeError(_policy_block_message()) from fallback_error
            raise RuntimeError(
                "브라우저 드라이버 시작 실패: "
                f"undetected={e}; selenium fallback={fallback_error}"
            ) from fallback_error


def create_stealth_driver(proxy=None, headless=None, profile_key=None):
    """정책 차단 환경을 고려해 undetected/공식 Selenium 드라이버로 브라우저 생성."""
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

    profile_dir = _get_profile_dir(profile_key)
    _prepare_profile_dir(profile_dir)
    logger.info(f"브라우저 프로필 사용: {profile_dir}")

    driver_mode = BROWSER_DRIVER_MODE or "auto"
    if driver_mode not in {"auto", "undetected", "selenium"}:
        logger.warning(f"알 수 없는 browser.driver_mode={driver_mode!r}; auto 모드로 진행합니다.")
        driver_mode = "auto"

    try:
        driver = _create_driver_for_mode(driver_mode, browser_path, proxy, headless, chrome_ver, profile_dir)
    except Exception as e:
        if _is_application_control_block(e):
            raise
        if not _is_browser_start_failure(e):
            raise

        logger.warning("브라우저 시작 실패 - Chrome 프로필/디버그 연결 복구 후 1회 재시도합니다.")
        _reset_profile_dir(profile_dir)
        logger.info(f"복구 후 브라우저 프로필 사용: {profile_dir}")
        try:
            driver = _create_driver_for_mode(
                driver_mode,
                browser_path,
                proxy,
                headless,
                chrome_ver,
                profile_dir,
            )
        except Exception as recovery_error:
            if _is_application_control_block(recovery_error):
                raise RuntimeError(_policy_block_message()) from recovery_error
            raise RuntimeError(
                _browser_start_failure_message(
                    recovery_error,
                    browser_path=browser_path,
                    profile_dir=profile_dir,
                )
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
