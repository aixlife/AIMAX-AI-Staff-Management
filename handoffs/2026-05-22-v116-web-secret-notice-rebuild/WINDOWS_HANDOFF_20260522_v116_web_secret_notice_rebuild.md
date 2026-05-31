# Windows Handoff - v116 Web Secret Notice Rebuild

작성 시각: 2026-05-22 20:00 KST

## 목표

Windows 설치본을 재빌드할 수 있게 현재 Mac/Oracle 기준 변경을 Windows 작업 폴더에 반영하고, 무비용 검증 후 재빌드 산출물을 반환해주세요.

## 먼저 읽을 문서

- `20_Deploy-To-Windows\2026-05-22-web-secret-songi-followup\WINDOWS_COMPLETION_20260522_web_secret_songi_followup.md`
- `20_Deploy-To-Windows\2026-05-22-apify-local-settings-runtime-mismatch\WINDOWS_AI_DEVELOPER_MESSAGE_20260522_apify_local_settings_mismatch.md`
- 현재 폴더의 `MAC_COMPLETION_20260522_v116_web_secret_notice_ready.md`

## 포함된 소스

현재 폴더의 `source-files` 아래 파일을 참고하세요.

- `source-files\app.py`
- `source-files\split_version\app.py`
- `source-files\local_agent\runtime.py`
- `source-files\oracle\aimax-reports-api\static\app.html`
- `source-files\oracle\aimax-reports-api\server.js`

## 적용 기준

1. Syncthing 공유 폴더 안에서 직접 빌드하지 말고, 로컬 Windows 작업 폴더로 복사해서 작업하세요.
2. Windows 작업 폴더가 Git checkout이면 먼저 현재 변경분을 확인하세요.
3. `app.py`, `split_version\app.py`, `local_agent\runtime.py`의 로컬 설정 안내 문구를 반영하세요.
4. 웹앱을 설치본에 포함하거나 Windows 패키지 검증에 쓰는 구조라면 `app.html`, `server.js`도 최신 상태와 맞춰주세요.
5. Windows 쪽 현재 버전이 `v1.0.15`라면 재빌드 버전은 `v1.0.16`으로 올리는 것을 권장합니다.
6. Mac 로컬 `aimax_compliance.py`의 오래된 버전값을 복사해서 Windows 버전을 낮추지 마세요.

## 필수 확인 포인트

- 로컬 설정창:
  - 하단 버튼이 잘리지 않아야 합니다.
  - 창 크기/스크롤 흐름이 사용자가 저장 버튼을 찾기 쉬워야 합니다.
  - AI/API 키 안내가 `블로그팀 로컬 작업용`과 `송이는 웹 설정 탭의 AI/API 연결`을 구분해야 합니다.
- AIMAX 웹앱 연결:
  - 비밀번호 입력 필드가 한글 IME 때문에 잘못 입력되는 문제에 대한 기존 v1.0.15 수정이 유지되어야 합니다.
  - 로그인 성공 후 무한 로딩 재발이 없어야 합니다.
- 웹앱:
  - `https://api.aimax.ai.kr/app`에는 이미 안내 팝업과 `AI/API 연결`이 배포되어 있습니다.
  - Windows 설치본이 웹앱 파일을 별도로 포함한다면 같은 마커가 들어 있어야 합니다.
- 다운로드/로컬 설정 UX:
  - v1.0.15에서 처리한 즉시 다운로드 시작, 로컬 설정 fallback, unsigned exe 안내가 유지되어야 합니다.

## 금지

- 고객 원문 데이터, API 키, 쿠키, `.env`, 브라우저 프로필, signed URL, raw private log를 Syncthing에 넣지 마세요.
- 실제 Naver 저장/발행 테스트를 하지 마세요.
- Apify Actor를 실행하지 마세요.
- Gemini/OpenAI/Claude 등 유료 API 호출을 하지 마세요.
- Mac 소스의 오래된 버전 파일을 그대로 복사해 Windows 설치본 버전을 낮추지 마세요.

## 무비용 검증 예시

PowerShell 기준 예시입니다. 프로젝트 구조에 맞게 경로만 조정하세요.

```powershell
python -m py_compile .\app.py .\split_version\app.py .\local_agent\runtime.py
node --check .\oracle\aimax-reports-api\server.js
```

웹앱 HTML 스크립트 문법 확인:

```powershell
node -e "const fs=require('fs'),vm=require('vm'); const html=fs.readFileSync('oracle/aimax-reports-api/static/app.html','utf8'); const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]); for (const script of scripts) new vm.Script(script); console.log('APP_HTML_SCRIPT_SYNTAX_OK');"
```

마커 확인:

```powershell
Select-String -Path .\app.py,.\split_version\app.py,.\local_agent\runtime.py -Pattern "로컬 실행기 작업용","웹 설정 탭의 AI/API 연결"
Select-String -Path .\oracle\aimax-reports-api\static\app.html -Pattern "AIMAX 설정 방식이 더 쉬워졌습니다","WEB_SECRET_NOTICE_KEY","AI/API 연결"
```

기존 smoke가 있으면 유료 호출 없이 실행:

```powershell
python .\scripts\verify_editor_image_provider_contract.py
python .\scripts\headless_agent_polling_smoke.py
```

## 반환 요청

현재 공유 폴더 아래에 아래 파일을 반환해주세요.

- `WINDOWS_COMPLETION_20260522_v116_web_secret_notice_rebuild.md`
- 재빌드한 installer artifact 또는 artifact 위치
- artifact SHA256
- 빌드 로그 요약
- 위 검증 명령 결과
- 설치 후 수동 확인 결과

완료 판정은 아래를 모두 만족해야 합니다.

- Windows 설치본 재빌드 완료
- 설치 후 앱 버전이 내려가지 않음
- 로컬 설정창 UX 확인 완료
- 웹앱 연결/비밀번호 입력 기존 수정 유지 확인
- 다운로드/로컬 설정 fallback 기존 수정 유지 확인
- 유료 API, Apify Actor, Naver 저장/발행 미실행
