#!/bin/bash
# 네이버 블로그 자동화 툴 - Mac/Linux 초기 설정 및 실행 스크립트
# uv 기반: 시스템 Python 탐색 실패·Tk 버전 문제·venv 깨짐을 제거한다.
# uv 관리형 Python(python-build-standalone)은 tkinter 가 번들로 포함되어
# 별도 python-tk 설치가 필요 없다. uv 경로 실패 시 기존 pip/venv 경로로 폴백한다.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

OS="$(uname -s)"

echo "==================================================="
echo "  NaverBlogAuto - 초기 설정 및 실행 스크립트"
echo "==================================================="
echo ""

# Mac Gatekeeper: 처음 실행 시 격리 속성 해제
if [ "$OS" = "Darwin" ]; then
    xattr -rd com.apple.quarantine "$SCRIPT_DIR" 2>/dev/null || true
fi

# ── 1. 구글 크롬 설치 확인 ──────────────────────────────────────
echo "[1/4] 구글 크롬 설치 확인 중..."

CHROME_FOUND=false
if [ "$OS" = "Darwin" ]; then
    [ -d "/Applications/Google Chrome.app" ] && CHROME_FOUND=true
else
    for cmd in google-chrome google-chrome-stable chromium-browser chromium; do
        command -v "$cmd" &>/dev/null && CHROME_FOUND=true && break
    done
fi

if [ "$CHROME_FOUND" = false ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "[안내] 구글 크롬이 없습니다. 다운로드 페이지를 엽니다."
    echo "  설치 후 이 스크립트를 다시 실행해주세요."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    [ "$OS" = "Darwin" ] && open "https://www.google.com/chrome/" 2>/dev/null || true
    exit 1
fi
echo "- 크롬 확인 완료."
echo ""

# ── .env 준비 (양쪽 경로 공통) ──────────────────────────────────
_prepare_env() {
    if [ ! -f "$SCRIPT_DIR/.env" ] && [ -f "$SCRIPT_DIR/.env.example" ]; then
        cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
        chmod 600 "$SCRIPT_DIR/.env"
    fi
}

# ── 비정상 종료 시 안내 (양쪽 경로 공통) ────────────────────────
_handle_exit() {
    local code="$1"
    if [ "$code" -ne 0 ]; then
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "[오류] 프로그램이 비정상 종료됐습니다 (코드: $code)"
        echo "  위 오류 메시지를 확인하세요."
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        read -p "엔터를 누르면 창이 닫힙니다..."
    fi
}

# ── macOS 접근성 권한 안내 (최초 1회) ───────────────────────────
_accessibility_notice() {
    if [ "$OS" = "Darwin" ] && [ ! -f "$SCRIPT_DIR/.accessibility_notified" ]; then
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  [Mac 필수] 접근성 권한 안내"
        echo "  시스템 설정 > 개인정보 보호 및 보안 > 접근성"
        echo "  → 터미널을 목록에 추가하고 허용"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        touch "$SCRIPT_DIR/.accessibility_notified" 2>/dev/null || true
    fi
}

# ════════════════════════════════════════════════════════════════
#  경로 A — uv (기본)
# ════════════════════════════════════════════════════════════════
_find_uv() {
    if command -v uv &>/dev/null; then command -v uv; return 0; fi
    for cand in "$HOME/.local/bin/uv" "$HOME/.cargo/bin/uv"; do
        [ -x "$cand" ] && echo "$cand" && return 0
    done
    return 1
}

_setup_with_uv() {
    echo "[2/4] uv 확인 중..."
    UV_BIN="$(_find_uv || true)"

    if [ -z "$UV_BIN" ]; then
        echo "- uv 없음 — 설치를 시도합니다... (수십 초 소요)"
        if ! curl -LsSf https://astral.sh/uv/install.sh | sh; then
            echo "- uv 설치 실패."
            return 1
        fi
        UV_BIN="$(_find_uv || true)"
        [ -z "$UV_BIN" ] && { echo "- uv 설치 후에도 실행 파일을 찾지 못함."; return 1; }
    fi
    echo "- uv 확인 완료: $("$UV_BIN" --version)"
    echo ""

    echo "[3/4] Python 및 패키지 설정 중... (최초 1~3분, 인터넷 연결 필요)"
    # uv sync: requires-python 에 맞는 관리형 Python 자동 다운로드(tkinter 포함) + uv.lock 기반 설치.
    # 잠금 파일과 일치하면 --frozen 으로 빠르게, 어긋나면 재해석으로 폴백.
    if ! "$UV_BIN" sync --frozen 2>/dev/null; then
        if ! "$UV_BIN" sync; then
            echo "- uv 패키지 설치 실패."
            return 1
        fi
    fi
    echo "- 설정 완료."

    _prepare_env
    _accessibility_notice

    echo ""
    echo "==================================================="
    echo "  설정 완료! 프로그램을 실행합니다..."
    echo "==================================================="
    sleep 1

    set +e
    TK_SILENCE_DEPRECATION=1 "$UV_BIN" run python "$SCRIPT_DIR/app.py"
    local code=$?
    set -e
    _handle_exit "$code"
    return 0
}

# ════════════════════════════════════════════════════════════════
#  경로 B — pip/venv 폴백 (uv 경로 실패 시)
# ════════════════════════════════════════════════════════════════
_find_python() {
    if [ "$OS" = "Darwin" ]; then
        for brew_py in \
            /opt/homebrew/bin/python3.13 \
            /opt/homebrew/bin/python3.12 \
            /opt/homebrew/bin/python3.11 \
            /usr/local/bin/python3.13 \
            /usr/local/bin/python3.12 \
            /usr/local/bin/python3.11; do
            if [ -x "$brew_py" ]; then echo "$brew_py"; return 0; fi
        done
    fi
    for cmd in python3.13 python3.12 python3.11 python3 python; do
        if command -v "$cmd" &>/dev/null; then
            VER=$("$cmd" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
            MAJ=$(echo "$VER" | cut -d. -f1)
            MIN=$(echo "$VER" | cut -d. -f2)
            if [ "$OS" = "Darwin" ] && [ "${MAJ:-0}" -eq 3 ] && [ "${MIN:-0}" -le 9 ]; then
                continue
            fi
            if [ "${MAJ:-0}" -ge 3 ] && [ "${MIN:-0}" -ge 9 ]; then
                echo "$cmd"; return 0
            fi
        fi
    done
    return 1
}

_setup_with_pip() {
    echo ""
    echo "[폴백] uv 경로 실패 — 기존 pip/venv 방식으로 진행합니다."
    echo ""

    echo "[2/4] Python 확인 중..."
    PYTHON_CMD=$(_find_python 2>/dev/null || true)

    if [ -z "$PYTHON_CMD" ]; then
        echo "- Python 3.10+ 없음 — 자동 설치를 시도합니다..."
        if [ "$OS" = "Darwin" ]; then
            if ! command -v brew &>/dev/null; then
                echo "  Homebrew 설치 중... (관리자 비밀번호 필요, 수 분 소요)"
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
                eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv 2>/dev/null || true)"
            fi
            echo "  Python 3.13 설치 중..."
            brew install python@3.13
            brew install python-tk@3.13 2>/dev/null || true
            eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv 2>/dev/null || true)"
        elif [ "$OS" = "Linux" ]; then
            echo "  apt로 Python 설치 중... (관리자 비밀번호 필요)"
            sudo apt-get update -qq
            sudo apt-get install -y python3 python3-pip python3-venv
        fi
        PYTHON_CMD=$(_find_python 2>/dev/null || true)
        if [ -z "$PYTHON_CMD" ]; then
            echo ""
            echo "[오류] Python 자동 설치에 실패했습니다."
            echo "  https://www.python.org/downloads/ 에서 수동 설치 후 다시 실행해주세요."
            exit 1
        fi
    fi
    echo "- Python 확인 완료: $($PYTHON_CMD --version) ($PYTHON_CMD)"

    if [ "$OS" = "Darwin" ]; then
        if ! "$PYTHON_CMD" -c "import tkinter" 2>/dev/null; then
            echo "- tkinter 없음 — python-tk 설치 중..."
            PY_VER=$("$PYTHON_CMD" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
            brew install "python-tk@${PY_VER}" 2>/dev/null || brew install python-tk 2>/dev/null || true
            if ! "$PYTHON_CMD" -c "import tkinter" 2>/dev/null; then
                echo "[오류] tkinter 설치 실패. 'brew install python-tk@${PY_VER}' 를 직접 실행 후 재시도하세요."
                exit 1
            fi
        fi
    fi
    echo ""

    echo "[3/4] 가상환경 및 패키지 설정 중... (인터넷 연결 필요, 2~5분 소요)"
    # CommandLineTools Python 3.9로 만든 venv는 재생성
    if [ -d "$SCRIPT_DIR/venv" ] && [ -f "$SCRIPT_DIR/venv/bin/python" ]; then
        VENV_REAL=$("$SCRIPT_DIR/venv/bin/python" -c "import sys; print(sys.executable)" 2>/dev/null || true)
        if echo "$VENV_REAL" | grep -q "CommandLineTools"; then
            echo "- 기존 venv가 시스템 Python 3.9로 생성됨 → 재생성합니다..."
            rm -rf "$SCRIPT_DIR/venv"
        fi
    fi
    if [ ! -d "$SCRIPT_DIR/venv" ]; then
        "$PYTHON_CMD" -m venv "$SCRIPT_DIR/venv"
    fi
    source "$SCRIPT_DIR/venv/bin/activate"
    python -m pip install --upgrade pip --quiet

    if ! pip install -r "$SCRIPT_DIR/requirements.txt"; then
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "[오류] 패키지 설치 실패."
        [ "$OS" = "Darwin" ] && echo "  Xcode 도구 설치 후 재시도: xcode-select --install"
        echo "  인터넷 연결을 확인하고 다시 실행해주세요."
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        exit 1
    fi
    echo "- 설정 완료."

    _prepare_env
    _accessibility_notice

    echo ""
    echo "==================================================="
    echo "  설정 완료! 프로그램을 실행합니다..."
    echo "==================================================="
    sleep 1

    set +e
    TK_SILENCE_DEPRECATION=1 python "$SCRIPT_DIR/app.py"
    local code=$?
    set -e
    _handle_exit "$code"
}

# ── 실행: uv 우선, 실패 시 pip 폴백 ─────────────────────────────
if ! _setup_with_uv; then
    _setup_with_pip
fi
