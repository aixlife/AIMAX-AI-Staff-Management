#!/bin/bash
# 네이버 블로그 자동화 툴 - Mac/Linux 초기 설정 및 실행 스크립트

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

# ── Python 탐색: Homebrew 우선, 시스템 Python(3.9/CommandLineTools) 제외 ──
_find_python() {
    # Mac: Homebrew 경로를 먼저 확인 (시스템 Python 3.9는 Tk 버전이 낮아 제외)
    if [ "$OS" = "Darwin" ]; then
        for brew_py in \
            /opt/homebrew/bin/python3.13 \
            /opt/homebrew/bin/python3.12 \
            /opt/homebrew/bin/python3.11 \
            /usr/local/bin/python3.13 \
            /usr/local/bin/python3.12 \
            /usr/local/bin/python3.11; do
            if [ -x "$brew_py" ]; then
                echo "$brew_py"; return 0
            fi
        done
    fi
    # Linux 또는 Mac에 Homebrew Python 없을 때
    for cmd in python3.13 python3.12 python3.11 python3 python; do
        if command -v "$cmd" &>/dev/null; then
            VER=$("$cmd" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
            MAJ=$(echo "$VER" | cut -d. -f1)
            MIN=$(echo "$VER" | cut -d. -f2)
            # Mac 시스템 Python 3.9(CommandLineTools)는 Tk 호환성 문제로 제외
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

_runtime_deps_ok() {
    python - <<'PY'
modules = [
    "ttkbootstrap",
    "selenium",
    "selenium_stealth",
    "undetected_chromedriver",
    "setuptools",
    "distutils",
    "packaging",
    "keyring",
    "google.genai",
    "anthropic",
    "pandas",
    "openpyxl",
    "yaml",
]

missing = []
for module in modules:
    try:
        __import__(module)
    except Exception as exc:
        missing.append(f"{module}: {exc}")

if missing:
    print("- 누락/오류 패키지 감지:")
    for item in missing:
        print(f"  · {item}")
    raise SystemExit(1)
PY
}

# ── 재실행 감지: venv + 패키지 이미 설치된 경우 바로 실행 ──────
if [ -d "$SCRIPT_DIR/venv" ] && [ -f "$SCRIPT_DIR/venv/bin/python" ]; then
    # venv Python이 호환 가능한지 확인 (3.10+ 또는 Homebrew Python)
    VENV_PY="$SCRIPT_DIR/venv/bin/python"
    VENV_REAL=$("$VENV_PY" -c "import sys; print(sys.executable)" 2>/dev/null || true)
    VENV_MIN=$("$VENV_PY" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1 | cut -d. -f2)

    # CommandLineTools Python 3.9로 만든 venv는 삭제 후 재생성
    IS_CMDLINE=false
    echo "$VENV_REAL" | grep -q "CommandLineTools" && IS_CMDLINE=true

    if [ "$IS_CMDLINE" = false ]; then
        source "$SCRIPT_DIR/venv/bin/activate"
        if _runtime_deps_ok; then
            echo "✓ 이미 설정 완료 — 프로그램을 바로 실행합니다."
            echo ""
            TK_SILENCE_DEPRECATION=1 python "$SCRIPT_DIR/app.py"
            exit 0
        else
            echo "- 필수 패키지가 일부 없거나 깨져 있어 설치를 보강합니다..."
        fi
    else
        echo "- 기존 venv가 시스템 Python 3.9로 생성됨 → 재생성합니다..."
        rm -rf "$SCRIPT_DIR/venv"
    fi
fi

# ── 1. 구글 크롬 설치 확인 ──────────────────────────────────────
echo "[1/5] 구글 크롬 설치 확인 중..."

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

# ── 2. Python 확인 및 자동 설치 ─────────────────────────────────
echo "[2/5] Python 확인 중..."

PYTHON_CMD=$(_find_python 2>/dev/null || true)

if [ -z "$PYTHON_CMD" ]; then
    echo "- Python 3.10+ 없음 — 자동 설치를 시도합니다..."
    echo ""

    if [ "$OS" = "Darwin" ]; then
        # Homebrew 확인 및 설치
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
    echo "- Python 설치 완료."
fi

echo "- Python 확인 완료: $($PYTHON_CMD --version) ($PYTHON_CMD)"

# Mac: tkinter 모듈 확인 (Homebrew Python은 python-tk 별도 설치 필요)
if [ "$OS" = "Darwin" ]; then
    if ! "$PYTHON_CMD" -c "import tkinter" 2>/dev/null; then
        echo "- tkinter 없음 — python-tk 설치 중..."
        PY_VER=$("$PYTHON_CMD" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
        brew install "python-tk@${PY_VER}" 2>/dev/null || brew install python-tk 2>/dev/null || true
        if ! "$PYTHON_CMD" -c "import tkinter" 2>/dev/null; then
            echo "[오류] tkinter 설치 실패. 'brew install python-tk@${PY_VER}' 를 직접 실행 후 재시도하세요."
            exit 1
        fi
        echo "- tkinter 설치 완료."
    fi
fi
echo ""

# ── 3. 가상환경 생성 ────────────────────────────────────────────
echo "[3/5] 가상환경 설정 중..."
if [ ! -d "$SCRIPT_DIR/venv" ]; then
    echo "- 처음 생성 중... (약 30초 소요)"
    "$PYTHON_CMD" -m venv "$SCRIPT_DIR/venv"
    echo "- 가상환경 생성 완료."
else
    echo "- 기존 가상환경 확인 완료."
fi
echo ""

# ── 4. 패키지 설치 ──────────────────────────────────────────────
echo "[4/5] 필수 패키지 설치 중... (인터넷 연결 필요, 2~5분 소요)"
source "$SCRIPT_DIR/venv/bin/activate"
python -m pip install --upgrade pip --quiet

if ! pip install -r "$SCRIPT_DIR/requirements.txt"; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "[오류] 패키지 설치 실패."
    if [ "$OS" = "Darwin" ]; then
        echo "  Xcode 도구 설치 후 재시도: xcode-select --install"
    fi
    echo "  인터넷 연결을 확인하고 다시 실행해주세요."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 1
fi

if [ "$OS" = "Darwin" ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  [Mac 필수] 접근성 권한 안내"
    echo "  시스템 설정 > 개인정보 보호 및 보안 > 접근성"
    echo "  → 터미널을 목록에 추가하고 허용"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

echo ""
echo "- 패키지 설치 완료."
echo ""

# ── 5. .env 파일 ────────────────────────────────────────────────
echo "[5/5] 환경설정 확인..."
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    if [ -f "$SCRIPT_DIR/.env.example" ]; then
        cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
        chmod 600 "$SCRIPT_DIR/.env"
    fi
fi
echo "- 완료."
echo ""

echo "==================================================="
echo "  설정 완료! 프로그램을 실행합니다..."
echo "==================================================="
sleep 1

TK_SILENCE_DEPRECATION=1 python "$SCRIPT_DIR/app.py" 2>&1
EXIT_CODE=$?
if [ "$EXIT_CODE" -ne 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "[오류] 프로그램이 비정상 종료됐습니다 (코드: $EXIT_CODE)"
    echo "  위 오류 메시지를 확인하세요."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    read -p "엔터를 누르면 창이 닫힙니다..."
fi
