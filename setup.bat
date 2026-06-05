@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

rem NaverBlogAuto - setup and run (Windows)
rem uv 기반: 시스템 Python 탐색 실패/Tcl-Tk 누락/venv 깨짐 제거.
rem uv 관리형 Python 은 tkinter 번들 포함. uv 경로 실패 시 기존 py/venv/pip 폴백.

echo ===================================================
echo   NaverBlogAuto - setup and run
echo ===================================================
echo.
echo Recommended folder: C:\NaverBlogAuto
echo First run may take 1-3 minutes.
echo.

rem ── 1. Chrome 확인 ─────────────────────────────────────────────
echo [1/3] Checking Chrome...
set "CHROME_OK="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME_OK=1"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME_OK=1"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME_OK=1"
if not defined CHROME_OK (
    echo Chrome was not found. Opening Chrome download page.
    start "" "https://www.google.com/chrome/"
    echo Install Chrome, then run RUN_WINDOWS.bat again.
    pause
    exit /b 1
)
echo Chrome OK.
echo.

rem ════════════════════════════════════════════════════════════════
rem  경로 A — uv (기본)
rem ════════════════════════════════════════════════════════════════
echo [2/3] Checking uv...
set "UV_BIN="
where uv >nul 2>&1 && set "UV_BIN=uv"
if not defined UV_BIN if exist "%USERPROFILE%\.local\bin\uv.exe" set "UV_BIN=%USERPROFILE%\.local\bin\uv.exe"
if not defined UV_BIN if exist "%USERPROFILE%\.cargo\bin\uv.exe" set "UV_BIN=%USERPROFILE%\.cargo\bin\uv.exe"

if not defined UV_BIN (
    echo uv not found - installing... ^(takes under a minute^)
    powershell -ExecutionPolicy ByPass -NoProfile -Command "irm https://astral.sh/uv/install.ps1 | iex"
    if exist "%USERPROFILE%\.local\bin\uv.exe" set "UV_BIN=%USERPROFILE%\.local\bin\uv.exe"
    if not defined UV_BIN if exist "%USERPROFILE%\.cargo\bin\uv.exe" set "UV_BIN=%USERPROFILE%\.cargo\bin\uv.exe"
)

if not defined UV_BIN (
    echo uv install failed - falling back to pip/venv path.
    goto pip_fallback
)
echo uv OK:
"!UV_BIN!" --version
echo.

echo [3/3] Setting up Python and packages... ^(first run 1-3 min, internet required^)
rem uv sync: requires-python 에 맞는 관리형 Python 자동 다운로드(tkinter 포함) + uv.lock 기반 설치.
"!UV_BIN!" sync --frozen >nul 2>&1
if !errorlevel! neq 0 (
    "!UV_BIN!" sync
    if !errorlevel! neq 0 (
        echo uv package install failed - falling back to pip/venv path.
        goto pip_fallback
    )
)
echo Setup OK.

if not exist ".env" (
    if exist ".env.example" copy ".env.example" ".env" >nul
)

echo.
echo ===================================================
echo   Setup complete! Starting NaverBlogAuto...
echo ===================================================
"!UV_BIN!" run python app.py
if !errorlevel! neq 0 (
    echo.
    echo NaverBlogAuto exited with an error.
    echo See logs under %%APPDATA%%\NaverBlogAuto\logs if needed.
    pause
    exit /b 1
)
exit /b 0

rem ════════════════════════════════════════════════════════════════
rem  경로 B — py/venv/pip 폴백
rem ════════════════════════════════════════════════════════════════
:pip_fallback
echo.
echo [fallback] Using py/venv/pip path.
echo.

if exist "venv\Scripts\python.exe" (
    "venv\Scripts\python.exe" -c "import ttkbootstrap" >nul 2>&1
    if !errorlevel! equ 0 goto run_app
)

echo Checking Python...
set "PYTHON_CMD="
py -3.12 -c "import sys; exit(0 if (3, 9) <= sys.version_info[:2] < (3, 14) else 1)" >nul 2>&1
if !errorlevel! equ 0 set "PYTHON_CMD=py -3.12"

if not defined PYTHON_CMD (
    py -3.11 -c "import sys; exit(0 if (3, 9) <= sys.version_info[:2] < (3, 14) else 1)" >nul 2>&1
    if !errorlevel! equ 0 set "PYTHON_CMD=py -3.11"
)

if not defined PYTHON_CMD (
    python -c "import sys; exit(0 if (3, 9) <= sys.version_info[:2] < (3, 14) else 1)" >nul 2>&1
    if !errorlevel! equ 0 set "PYTHON_CMD=python"
)

if not defined PYTHON_CMD (
    echo Python 3.11 or 3.12 was not found.
    echo Trying to install Python 3.11 with winget...
    winget install --id Python.Python.3.11 -e --accept-source-agreements --accept-package-agreements
    if !errorlevel! neq 0 (
        echo Python install failed. Please install Python 3.11 manually:
        echo https://www.python.org/downloads/
        pause
        exit /b 1
    )
    echo Python was installed. Close this window and run RUN_WINDOWS.bat again.
    pause
    exit /b 0
)

!PYTHON_CMD! -c "import tkinter" >nul 2>&1
if !errorlevel! neq 0 (
    echo Python tkinter module was not found.
    echo Reinstall Python 3.11 from python.org and include Tcl/Tk.
    pause
    exit /b 1
)

echo Python OK:
!PYTHON_CMD! --version
echo.

echo Creating virtual environment...
if not exist "venv" (
    !PYTHON_CMD! -m venv venv
    if !errorlevel! neq 0 (
        echo Failed to create venv.
        echo Move this folder to C:\NaverBlogAuto and run again.
        pause
        exit /b 1
    )
)
echo venv OK.
echo.

echo Installing packages...
"venv\Scripts\python.exe" -m pip install --upgrade pip --quiet
"venv\Scripts\python.exe" -m pip install -r requirements.txt
if !errorlevel! neq 0 (
    echo Package install failed.
    echo Check your internet connection and run again.
    pause
    exit /b 1
)
echo Packages OK.
echo.

if not exist ".env" (
    if exist ".env.example" copy ".env.example" ".env" >nul
)

:run_app
echo Starting NaverBlogAuto...
"venv\Scripts\python.exe" app.py
if !errorlevel! neq 0 (
    echo.
    echo NaverBlogAuto exited with an error.
    echo See logs under %%APPDATA%%\NaverBlogAuto\logs if needed.
    pause
    exit /b 1
)
exit /b 0
