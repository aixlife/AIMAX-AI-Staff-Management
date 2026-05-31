@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ===================================================
echo   네이버 블로그 자동화 툴 - 초기 설정 및 실행 스크립트
echo ===================================================
echo.

:: ── [0/6] 경로 안전성 검증 ──────────────────────────────────
:: 한글/공백/OneDrive/긴경로는 venv activate.bat을 깨뜨리는 주요 원인
:: (CPython #88706, virtualenv #2338, pip #11231)
echo [0/6] 설치 경로 확인 중...
set "CUR_PATH=%CD%"
set "PATH_ISSUES="

:: 공백 감지
echo !CUR_PATH! | findstr " " >nul && set "PATH_ISSUES=!PATH_ISSUES! 공백"

:: OneDrive 감지
echo !CUR_PATH! | findstr /I "OneDrive" >nul && set "PATH_ISSUES=!PATH_ISSUES! OneDrive"

:: 한글/비ASCII + 경로길이 PowerShell로 검사
for /f "delims=" %%I in ('powershell -NoProfile -Command "$p=$env:CUR_PATH; $r=@(); if ($p -match '[^\u0000-\u007F]') { $r += 'NonASCII' }; if ($p.Length -gt 150) { $r += 'Long('+$p.Length+')' }; $r -join ' '" 2^>nul') do set "PS_ISSUES=%%I"
if defined PS_ISSUES set "PATH_ISSUES=!PATH_ISSUES! !PS_ISSUES!"

if defined PATH_ISSUES (
    echo.
    echo [경고] 현재 경로에서 설치 오류가 발생할 수 있습니다.
    echo   현재 위치: !CUR_PATH!
    echo   감지된 문제:!PATH_ISSUES!
    echo.
    echo   원인: Python venv는 한글/공백/OneDrive/긴 경로에서 깨집니다.
    echo.
    echo   [권장] 폴더 전체를 C:\NaverBlogAuto 로 이동 후 재실행
    echo          이 스크립트가 자동으로 복사해 드릴 수 있습니다.
    echo.
    choice /C YN /M "C:\NaverBlogAuto 로 자동 복사 후 거기서 재실행할까요"
    if !errorlevel! equ 1 (
        echo.
        echo - C:\NaverBlogAuto 로 복사 중...
        if exist "C:\NaverBlogAuto" (
            echo   [안내] C:\NaverBlogAuto 폴더가 이미 있습니다.
            choice /C YN /M "   덮어쓰고 복사할까요"
            if !errorlevel! equ 2 (
                echo   취소했습니다. 수동으로 이동 후 재실행해주세요.
                pause
                exit /b
            )
        )
        robocopy "!CUR_PATH!" "C:\NaverBlogAuto" /E /XD venv __pycache__ .git /XF *.pyc .DS_Store /NFL /NDL /NJH /NJS >nul
        if !errorlevel! geq 8 (
            echo   [오류] 복사 실패. 수동으로 C:\NaverBlogAuto 로 이동해주세요.
            pause
            exit /b
        )
        echo - 복사 완료. C:\NaverBlogAuto\setup.bat 를 새 창에서 실행합니다.
        start "" cmd /k "cd /d C:\NaverBlogAuto && setup.bat"
        exit /b
    )
    echo   경고를 무시하고 계속 진행합니다. 실패 시 C:\NaverBlogAuto 로 이동해주세요.
    echo.
)
echo - 경로 확인 완료.
echo.

:: Windows 긴 경로 지원 확인 (pip install 경로 260자 초과 방지)
reg query "HKLM\SYSTEM\CurrentControlSet\Control\FileSystem" /v LongPathsEnabled 2>nul | findstr "0x1" >nul
if !errorlevel! neq 0 (
    echo [참고] Windows 긴 경로 지원이 꺼져 있습니다.
    echo   pip install 시 경로 260자 초과 오류가 나면 관리자 CMD에서 1회 실행:
    echo     reg add "HKLM\SYSTEM\CurrentControlSet\Control\FileSystem" /v LongPathsEnabled /t REG_DWORD /d 1 /f
    echo   이후 재부팅 필요. 지금은 계속 진행합니다.
    echo.
)

:: pip 빌드 임시 디렉토리를 짧은 경로로 고정 (MAX_PATH 회피)
if not exist "C:\Temp" mkdir "C:\Temp" >nul 2>&1
if exist "C:\Temp" (
    set "TMP=C:\Temp"
    set "TEMP=C:\Temp"
)

:: ── 재실행 감지: 이미 설정 완료된 경우 바로 실행 ──────────────
if exist "venv\Scripts\python.exe" (
    venv\Scripts\python.exe -c "import ttkbootstrap" >nul 2>&1
    if !errorlevel! equ 0 (
        echo 이미 설정 완료 - 프로그램을 바로 실행합니다.
        echo.
        venv\Scripts\python.exe app.py
        if !errorlevel! neq 0 pause
        exit /b
    )
)

:: 1. 크롬 설치 확인
echo [1/6] 구글 크롬 설치 확인 중...
reg query "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" >nul 2>&1
if !errorlevel! neq 0 (
    reg query "HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" >nul 2>&1
    if !errorlevel! neq 0 (
        echo [안내] 구글 크롬이 없습니다. 다운로드 페이지를 엽니다.
        echo 설치 후 이 파일을 다시 실행해주세요.
        start https://www.google.com/chrome/
        pause
        exit /b
    )
)
echo - 크롬 확인 완료.
echo.

:: 2. Python 확인 및 자동 설치
echo [2/6] Python 확인 중...

:: Python이 있는지부터 확인
python --version >nul 2>&1
if !errorlevel! neq 0 goto :install_python

:: Python 버전이 3.9 이상인지 확인
python -c "import sys; exit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>&1
if !errorlevel! neq 0 (
    echo - Python 3.9 미만 버전 감지됨 - Python 3.11 설치를 진행합니다...
    goto :install_python
)

:: tkinter 정상 여부 확인 (python.org 설치 시 선택 해제하면 없을 수 있음)
python -c "import tkinter" >nul 2>&1
if !errorlevel! neq 0 (
    echo.
    echo [오류] tkinter 모듈이 없습니다.
    echo   Python을 재설치하고 "tcl/tk and IDLE" 항목을 반드시 체크하세요.
    echo   또는 Python 3.11을 새로 설치합니다...
    goto :install_python
)

goto :python_ok

:install_python
echo - Python 없음 또는 구버전 - winget으로 Python 3.11 설치를 시도합니다...
echo   ^(관리자 권한 팝업이 뜨면 허용해주세요^)
echo.
winget install --id Python.Python.3.11 -e --accept-source-agreements --accept-package-agreements
if !errorlevel! neq 0 (
    echo.
    echo [오류] Python 자동 설치 실패.
    echo   https://www.python.org/downloads/ 에서 수동 설치 후 재실행.
    echo   설치 시 "tcl/tk and IDLE" 와 "Add python.exe to PATH" 를 반드시 체크하세요.
    start https://www.python.org/downloads/
    pause
    exit /b
)
echo - Python 설치 완료. 이 창을 닫고 setup.bat 를 다시 실행해주세요.
echo   ^(PATH 적용을 위해 재실행이 필요합니다^)
pause
exit /b

:python_ok
echo - Python 확인 완료:
python --version
echo.

:: 3. 가상환경 생성
echo [3/6] 가상환경 설정 중...
if not exist "venv" (
    echo - 처음 생성 중...
    python -m venv venv
    if !errorlevel! neq 0 (
        echo [오류] 가상환경 생성 실패.
        echo   경로에 한글/공백이 있거나 권한이 없을 수 있습니다.
        pause
        exit /b
    )
    echo - 가상환경 생성 완료.
) else (
    echo - 기존 가상환경 확인 완료.
)
echo.

:: 4. 패키지 설치 (activate 건너뛰고 venv의 python.exe 직접 호출 → 한글 경로 깨짐 차단)
echo [4/6] 필수 패키지 설치 중... (인터넷 연결 필요, 2~5분 소요)
venv\Scripts\python.exe -m pip install --upgrade pip --quiet
venv\Scripts\python.exe -m pip install -r requirements.txt
if !errorlevel! neq 0 (
    echo.
    echo [오류] 패키지 설치 실패.
    echo   - 인터넷 연결 확인 후 재실행
    echo   - 경로 260자 초과 오류면 위의 LongPathsEnabled 안내 따라 설정
    pause
    exit /b
)

:: venv 안에서 tkinter 재확인
venv\Scripts\python.exe -c "import tkinter" >nul 2>&1
if !errorlevel! neq 0 (
    echo.
    echo [오류] 가상환경에서 tkinter를 찾을 수 없습니다.
    echo   Python을 재설치하고 "tcl/tk and IDLE" 항목을 체크 후 setup.bat 재실행하세요.
    pause
    exit /b
)

echo - 패키지 설치 완료.
echo.

:: 5. .env 파일 생성
echo [5/6] 환경설정 확인...
if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env >nul
    )
)
echo - 완료.
echo.

:: 6. 실행
echo [6/6] 프로그램 실행 준비...
echo ===================================================
echo   설정 완료! 프로그램을 실행합니다...
echo ===================================================
timeout /t 2 >nul

venv\Scripts\python.exe app.py
if !errorlevel! neq 0 (
    echo.
    echo [오류] 프로그램 실행 중 문제가 발생했습니다.
    pause
)
