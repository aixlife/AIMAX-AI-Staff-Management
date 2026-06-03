@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo ===================================================
echo   NaverBlogAuto - setup and run
echo ===================================================
echo.
echo Recommended folder: C:\NaverBlogAuto
echo First run may take 2-5 minutes.
echo.

if exist "venv\Scripts\python.exe" (
    "venv\Scripts\python.exe" -c "import ttkbootstrap" >nul 2>&1
    if !errorlevel! equ 0 goto run_app
)

echo [1/5] Checking Chrome...
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

echo [2/5] Checking Python...
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

echo [3/5] Creating virtual environment...
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

echo [4/5] Installing packages...
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

echo [5/5] Preparing settings...
if not exist ".env" (
    if exist ".env.example" copy ".env.example" ".env" >nul
)
echo Settings OK.
echo.

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
