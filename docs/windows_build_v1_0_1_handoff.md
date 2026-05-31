# AIMAX Windows v1.0.1 L1J Rebuild Handoff

작성일: 2026-05-06

이 문서는 Windows 데스크탑의 AI/개발자가 macOS에서 검증된 AIMAX L1J 변경사항을 놓치지 않고 Windows `.exe` 3종에 그대로 반영하기 위한 실행 지시서다.

짧은 실행 프롬프트만 필요하면 `docs/windows_ai_build_prompt.md`를 함께 전달한다. 실제 작업자는 이 문서를 먼저 끝까지 읽고 진행해야 한다.

## 1. 현재 phase 위치

현재 작업은 Local Agent 전용화 흐름의 Windows 반영 게이트다.

- L0: 제품 경계/보안 계약 동결 완료
- L1A~L1D: macOS headless Local Agent, packaging, smoke 완료
- L1E~L1G: macOS 운영 다운로드 반영, 웹 작업 설정 복원, Gemini 기본값/키워드 반복 완화 완료
- L1H~L1I: 원화 비용 표시, 실제 usage token 기반 비용 저장, SEO 브리프 구조, Gemini Flash 실제 네이버 임시저장 테스트 완료
- L1J: GPT/OpenAI 모델, OpenAI 이미지, 로컬 보안 설정 창, 글자수 ±5% 보정, macOS DMG 3종 재빌드/운영 업로드 완료
- 지금 남은 게이트: Windows EXE 3종을 같은 코드로 재빌드/업로드하고 Windows smoke test를 통과시키는 것

중요: 서버에는 기존 Windows v1.0.1 EXE 3종이 있을 수 있다. 하지만 L1J 이전 빌드라면 stale이다. 이번 작업의 목표는 같은 파일명으로 최신 L1J 코드가 포함된 Windows 설치파일을 다시 만들어 교체하는 것이다.

## 2. 운영 기준

- 웹앱: `https://api.aimax.ai.kr/app`
- API 서버: `https://api.aimax.ai.kr/api`
- 운영 서버 코드 경로: `/home/ubuntu/aimax-reports-api`
- 운영 다운로드 경로: `/home/ubuntu/aimax-downloads`
- SSH alias가 있으면: `oracle-server`
- 직접 SSH 기준: `ubuntu@100.69.85.89`, port `3333`
- 현재 앱 버전: `v1.0.1`
- Windows 최종 업로드 파일명:
  - `aimax-bundle-windows.exe`
  - `aimax-yeri-windows.exe`
  - `aimax-hyunju-windows.exe`

## 3. 반드시 지킬 보안 경계

서버나 웹앱 DB에 저장하면 안 되는 값:

- 네이버 비밀번호
- 네이버 쿠키/세션
- Gemini API Key
- Claude API Key
- OpenAI API Key
- 긴 인증 토큰 원문
- Chrome profile 내부 민감 데이터

Windows 실행기는 사용자 PC의 안전 저장소를 사용해야 한다.

- 권장: Windows Credential Manager 또는 keyring의 Windows backend
- 금지: 평문 JSON에 네이버 PW/API key 저장
- 금지: 개발자 개인 macOS Keychain, `minsu-api`, `security find-generic-password` 같은 dev fallback 이식
- 허용: 사용자가 로컬 보안 설정 창에서 직접 입력한 값을 OS 안전 저장소에 저장

## 4. source of truth

Windows 쪽에 오래된 프로젝트 폴더가 있다면 그대로 빌드하지 말고, macOS의 최신 프로젝트 내용을 먼저 동기화한다.

macOS 최신 기준 프로젝트:

```text
/Users/aixlife/Projects/AIMAX-AI-Staff-Management
```

Windows 작업자는 다음 중 하나를 선택한다.

1. 최신 프로젝트 전체를 Windows로 복사한 뒤 Windows에서 빌드한다.
2. 기존 Windows 폴더가 있다면 아래 파일/폴더를 반드시 최신으로 덮어쓴다.

최소 동기화 대상:

- `app.py`
- `split_version/app.py`
- `split_version/app_find.py`
- `split_version/app_engage_write.py`
- `build.py`
- `split_version/build.py`
- `split_version/build_split.py`
- `local_agent/runtime.py`
- `web_agent/`
- `content/`
- `engagement/`
- `posting/`
- `diagnostics/`
- `scripts/`
- `oracle/aimax-reports-api/server.js`
- `oracle/aimax-reports-api/static/app.html`
- `packaging/windows/aimax_installer.iss`
- `aimax_compliance.py`
- `requirements.txt`

서버 웹앱 파일은 macOS에서 이미 운영 배포되어 있다. Windows 작업자는 보통 서버 재배포를 하지 않는다. 단, 로컬 정적 검증에서 소스가 최신인지 확인하기 위해 `oracle/aimax-reports-api` 파일도 같이 보관한다.

### 4.1 2026-05-06 전달 패키지

macOS에서 Windows 전달용 bundle을 별도로 만들었다.

- 전체 전달 zip: `handoff/aimax-l1j-windows-transfer-20260506.zip`
- 포함 파일:
  - `aimax-l1j-windows-source-20260506.zip`
  - `aimax-l1j-test-secrets-20260506.env.enc`
  - `aimax-l1j-test-secrets-20260506.README.md`
- SHA-256 기록:
  - `handoff/aimax-l1j-windows-transfer-20260506.sha256`

주의:

- encrypted secrets 파일에는 Windows 테스트용 OpenAI/Gemini/Anthropic API key가 들어 있다.
- 네이버 비밀번호, 네이버 쿠키/세션은 포함하지 않았다.
- 복호화 비밀번호는 `handoff/aimax-l1j-test-secrets-20260506.passphrase.local-only.txt`에만 있고, transfer zip에는 넣지 않았다.
- 복호화 비밀번호 파일은 encrypted file과 같은 채팅/업로드로 보내지 말고 별도 채널로 전달한다.
- Windows AI는 source zip을 새 작업 폴더로 풀고, 기존 `C:\Users\likim\Desktop\NaverBlogAuto-main-wincheck` stale 폴더를 그대로 빌드하지 않는다.

### 4.2 Syncthing 전달 규칙

macOS와 Windows가 Syncthing으로 공유되는 경우, 공유 폴더를 작업 폴더로 쓰지 말고 전달 폴더로만 쓴다.

macOS 기준 권장 위치:

```text
/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/AIMAX-L1J-20260506
```

넣어도 되는 것:

- source/transfer zip
- encrypted secrets
- SHA manifest
- README/handoff 문서
- Windows 빌드 완료 보고서
- 최종 `.exe` 산출물

넣으면 안 되는 것:

- 복호화 passphrase
- 복호화된 `.env`
- 네이버 비밀번호/쿠키/세션
- `venv`, `build`, `dist` 같은 중간 산출물 전체
- 양쪽 OS가 동시에 수정하는 live source folder

권장 흐름:

1. macOS가 transfer zip과 SHA를 Syncthing folder에 올린다.
2. Windows는 해당 zip을 자기 로컬 작업 폴더로 복사한 뒤 압축을 푼다.
3. Windows는 빌드/테스트를 로컬 작업 폴더에서만 한다.
4. 완료 후 `.exe`, SHA, 완료 보고서를 Syncthing folder의 새 날짜 폴더로 올린다.
5. macOS는 결과물을 검토하고 필요 시 서버 업로드를 진행한다.

## 5. L1J에서 추가/변경된 기능

### 5.1 GPT/OpenAI 모델

모델 선택에 아래 GPT 모델이 추가되어야 한다.

- `gpt-5.4-mini`
- `gpt-5-mini`

적용 파일:

- `app.py`
- `split_version/app.py`
- `content/ai_text.py`
- `content/neighbor_message_ai.py`
- `engagement/auto_comment.py`
- `oracle/aimax-reports-api/static/app.html`

확인 포인트:

- OpenAI 글 생성은 OpenAI Responses API를 사용한다.
- OpenAI text usage token을 기존 비용 계산에 합산한다.
- `reasoning: {"effort": "minimal"}`가 적용되어야 한다.
- 댓글/서로이웃 멘트 생성도 GPT 모델을 선택하면 OpenAI 경로를 사용해야 한다.

### 5.2 OpenAI 이미지 생성

OpenAI 이미지 생성 파일이 있어야 한다.

- `content/openai_image.py`

동작 기준:

- GPT 모델 선택 시 OpenAI 이미지 생성을 우선 사용한다.
- Gemini 모델에서 Gemini 이미지 생성이 실패하고 OpenAI key가 있으면 OpenAI fallback이 가능하다.
- 이미지 provider count는 `providers.gemini`, `providers.openai`로 job result에 남는다.

### 5.3 사용자 입력 API key 경로

제품 코드는 모든 사용자 환경에서 동작해야 한다.

정상 흐름:

1. 사용자가 로컬 보안 설정 창에서 API key를 직접 입력한다.
2. Windows 안전 저장소에 저장된다.
3. Local Agent가 해당 PC의 저장값을 읽어 작업한다.
4. 서버에는 readiness와 redacted 상태만 보낸다.

확인 포인트:

- `save_settings(..., openai_key=...)`가 있어야 한다.
- `load_settings()`가 `naver_id, naver_pw, gemini_key, ai_model, claude_key, openai_key` 6개 값을 반환해야 한다.
- readiness `ai_keys`에 `openai`, `selected_model`, `selected_model_ready`가 있어야 한다.
- `minsu-api`, `find-generic-password`, `security find` 문자열이 제품 코드에 남아 있으면 안 된다.

### 5.4 headless Local Agent 설정 창

사용자 설치파일을 실행하면 기존 전체 Tkinter 앱이 뜨면 안 된다.

현재 기준:

- frozen/PyInstaller 앱은 기본적으로 headless agent mode로 실행된다.
- `--legacy-ui` 또는 `AIMAX_LEGACY_UI=1`일 때만 기존 전체 UI를 연다.
- `--agent` 또는 `AIMAX_AGENT_MODE=1`로도 headless 실행 가능하다.
- 웹앱에서 `open_settings` command를 보내면 기존 전체 UI가 아니라 작은 `AIMAX 로컬 보안 설정` 창을 열어야 한다.

작은 설정 창 필드:

- Naver ID
- Naver password
- Gemini API Key
- Claude API Key
- OpenAI API Key
- AI model

적용 파일:

- `local_agent/runtime.py`
- `app.py`
- `split_version/app.py`
- `split_version/app_find.py`
- `split_version/app_engage_write.py`

### 5.4.1 첫 실행 웹앱 연결 창

다운로드 버튼은 자동 페어링이 아니다. 새 사용자 PC에는 아직 AIMAX 웹앱 session token이 없으므로, 설치파일 실행 직후 연결 UX가 필요하다.

Windows EXE 기준 요구사항:

- frozen 앱은 기본 headless로 시작한다.
- 저장된 session token이 없으면 작은 `AIMAX 웹앱 연결` 창을 띄운다.
- 사용자는 AIMAX 웹앱 이메일/비밀번호를 입력한다.
- 실행기는 `/api/auth/login`을 호출하고 session token을 Windows Credential Manager/keyring에 저장한다.
- 로그인 성공 후 작은 `AIMAX 로컬 보안 설정` 창으로 이어진다.
- 네이버 ID/PW와 AI API key는 서버가 아니라 로컬 안전 저장소에 저장한다.
- 연결/설정 후 heartbeat가 시작되어 웹앱 대시보드/설정 탭에서 연결 상태가 보여야 한다.

금지:

- session token을 평문 파일에 저장
- 네이버 비밀번호/API key를 서버로 전송
- first-run 연결을 위해 기존 전체 Tkinter UI를 여는 것
- Windows에서만 동작하는 별도 코드로 갈라지는 것

권장 구현 위치:

- 공통 `local_agent/runtime.py`에 first-run connection dialog를 둔다.
- `app.py`, `split_version/app.py`는 settings loader/saver와 web agent client factory만 넘긴다.
- Windows에서 먼저 구현했더라도 같은 patch를 macOS source에도 반영해야 한다.

### 5.5 글자수 ±5% 보정

사용자가 `800자`를 요청하면 2,000자 가까이 쓰면 안 된다.

기준:

- `word_count` 필드는 하위 호환 때문에 이름은 유지하지만 의미는 목표 글자수다.
- 최종 노출 글자 수 기준이다.
- 제목 + 본문 기준이다.
- 공백 포함이다.
- 마크다운 기호와 `[이미지]` 프롬프트 줄은 제외한다.
- 허용 범위는 목표의 ±5%다.
- 800자 요청 시 허용 범위는 760~840자다.
- 범위를 벗어나면 최대 2회 재작성한다.

적용 파일:

- `content/prompts.py`
- `content/ai_text.py`
- `app.py`
- `split_version/app.py`
- `oracle/aimax-reports-api/server.js`
- `oracle/aimax-reports-api/static/app.html`

job result 기준:

- `result.posts[].char_count`
- `result.posts[].target_char_count`
- 웹앱 작업 목록에는 `글자 수 N자 / 요청 M자`가 표시되어야 한다.

검증 완료된 모델 경로:

- `gemini-2.5-pro`
- `gemini-2.5-flash`
- `claude`
- `gpt-5-mini`
- `gpt-5.4-mini`

### 5.6 원화 비용 표시

사용자에게 비용은 달러가 아니라 원화로 보여야 한다.

현재 기준:

- job result에는 `currency: "KRW"`를 저장한다.
- `text_won`, `image_won`, `total_won`을 저장한다.
- USD raw amount는 사용자 표시/result 저장에 넣지 않는다.
- 환율 기준은 문서/코드 기준 `1 USD = 1,476 KRW`다.
- OpenAI 이미지 추정 기준은 `$0.042`/장이다.
- Gemini 이미지 추정 기준은 `$0.039`/장이다.

### 5.7 이미지 개수 옵션

웹앱 작업 폼에는 이미지 개수 옵션이 있어야 한다.

- 0장
- 1장
- 2장
- 3장
- 4장

이미지가 필수인 운영 품질을 위해 GPT + OpenAI 이미지 조합 실전 테스트가 남아 있다.

### 5.8 SEO/상위노출 분석 준비

상위노출 글 분석/SEO 브리프는 아직 자동 실행 phase가 아니다.

현재 완료된 것은 설계와 데이터 구조 방향이다.

- 검색 상위 글의 제목/구성/이미지 개수/이미지 유형/반복 키워드/CTA/본문 구조를 분석한다.
- 분석 결과를 글쓰기 prompt에 직접 섞기 전에 별도 브리프 구조로 저장한다.
- 실제 자동 검색/수집/SEO 반영은 다음 phase에서 안전하게 분리한다.

Windows 빌드 작업자는 SEO 기능을 새로 구현하지 않는다. 이번 범위는 이미 macOS 코드에 들어간 L1J 변경을 Windows 설치파일에 담는 것이다.

## 6. 최신 코드 포함 여부 빠른 확인

PowerShell에서 프로젝트 루트로 이동한다.

```powershell
cd C:\path\to\NaverBlogAuto-main
```

아래 검색이 모두 의도대로 나와야 한다.

```powershell
Select-String -Path app.py,split_version\app.py -Pattern "gpt-5-mini","gpt-5.4-mini","openai_api_key","OPENAI_IMAGE_PRICE_USD","_normalize_target_char_count"
Select-String -Path local_agent\runtime.py -Pattern "AIMAX 로컬 보안 설정","openai_key","settings_saver"
Select-String -Path content\ai_text.py -Pattern "measure_visible_char_count","_generate_with_openai","reasoning"
Select-String -Path content\openai_image.py -Pattern "images/generations","gpt-image-1"
Select-String -Path oracle\aimax-reports-api\static\app.html -Pattern "800자","GPT-5 mini","글자 수","OPENAI_IMAGE_PRICE_USD"
Select-String -Path oracle\aimax-reports-api\server.js -Pattern "char_count","target_char_count","openai"
```

아래 검색은 결과가 없어야 한다.

```powershell
Select-String -Path app.py,split_version\app.py,local_agent\*.py,content\*.py -Pattern "minsu-api","find-generic-password","security find"
```

버전 확인:

```powershell
python -c "import aimax_compliance as a; print(a.APP_VERSION)"
```

반드시 `v1.0.1`이어야 한다.

## 7. Windows 개발 환경 준비

PowerShell:

```powershell
py -3.11 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install pyinstaller
```

Inno Setup 6가 없으면 설치한다.

```powershell
winget install --id JRSoftware.InnoSetup -e
$env:Path += ";C:\Program Files (x86)\Inno Setup 6"
```

## 8. 정적 검증

PowerShell:

```powershell
python -m py_compile `
  app.py `
  split_version\app.py `
  split_version\app_find.py `
  split_version\app_engage_write.py `
  build.py `
  split_version\build.py `
  split_version\build_split.py `
  web_agent\client.py `
  local_agent\runtime.py `
  content\prompts.py `
  content\ai_text.py `
  content\openai_image.py `
  content\neighbor_message_ai.py `
  engagement\auto_comment.py `
  posting\editor.py `
  scripts\headless_agent_polling_smoke.py `
  scripts\agent_heartbeat_only_smoke.py `
  scripts\save_web_agent_session.py `
  aimax_compliance.py
```

Node가 있으면 웹앱 서버/프론트 문법도 확인한다.

```powershell
node --check oracle\aimax-reports-api\server.js
node -e "const fs=require('fs'); const html=fs.readFileSync('oracle/aimax-reports-api/static/app.html','utf8'); for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Function(m[1]); console.log('app.html script ok')"
```

Node 검증이 Windows PowerShell quoting 문제로 실패하면 문법 오류인지 quoting 오류인지 구분해서 보고한다. 서버 파일은 macOS에서 이미 `node --check`와 inline script check를 통과했다.

## 9. local smoke test

실제 운영 API를 건드리지 않는 fake smoke:

```powershell
python scripts\headless_agent_polling_smoke.py
```

통과 기준:

- heartbeat 3회
- `open_settings` command status `done`
- fake 예리 job result에 `KRW` 비용과 `char_count`, `target_char_count` 포함
- fake 현주 job dispatch가 기존 실패/성공 기준대로 보고됨
- heartbeat-only 모드가 queued work를 소비하지 않음

운영 heartbeat만 확인하는 안전 smoke:

```powershell
python scripts\save_web_agent_session.py --email <AIMAX_웹앱_이메일>
python scripts\agent_heartbeat_only_smoke.py
```

주의:

- 첫 명령은 웹앱 비밀번호를 물어본다.
- `agent_heartbeat_only_smoke.py`는 `AIMAX_AGENT_HEARTBEAT_ONLY=1`을 사용하므로 queued command/job을 소비하지 않는다.
- 성공 시 `connected: true`, `version: "v1.0.1"`이어야 한다.

### 9.1 테스트 API key 복호화

전달 패키지에 포함된 encrypted secrets를 같은 폴더에 둔 뒤, 별도 전달받은 passphrase로 복호화한다.

```powershell
openssl enc -d -aes-256-cbc -pbkdf2 `
  -in aimax-l1j-test-secrets-20260506.env.enc `
  -out aimax-l1j-test-secrets.env `
  -pass pass:<PASSPHRASE>
```

현재 사용자 환경변수로 주입하려면:

```powershell
Get-Content .\aimax-l1j-test-secrets.env | ForEach-Object {
  if ($_ -match "^([^#=]+)=(.*)$") {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "User")
  }
}
```

권장 검증:

- 환경변수만 믿고 끝내지 않는다.
- 웹앱 `로컬 설정 열기`로 작은 `AIMAX 로컬 보안 설정` 창을 띄운다.
- 같은 API key를 저장해서 Windows Credential Manager/keyring 저장 경로까지 검증한다.
- 복호화된 `aimax-l1j-test-secrets.env`는 테스트 후 삭제한다.

## 10. 빌드

통합 앱:

```powershell
python build.py
```

분리 앱 2종:

```powershell
cd split_version
python build.py
cd ..
```

동일한 명령:

```powershell
cd split_version
python build_split.py all
cd ..
```

중간 산출물:

- `dist\AIMAX\AIMAX.exe`
- `split_version\dist\AIMAX-EngageWrite\AIMAX-EngageWrite.exe`
- `split_version\dist\AIMAX-Find\AIMAX-Find.exe`

빌드 스크립트가 아래 hidden import/collect-submodules를 포함해야 한다.

- `content.openai_image`
- `local_agent.runtime`
- `web_agent.client`
- `diagnostics.error_reporter`
- `content`
- `engagement`
- `local_agent`
- `web_agent`

## 11. PyInstaller 포함 확인

```powershell
findstr /i "web_agent.client diagnostics.error_reporter content.openai_image local_agent.runtime" build\AIMAX\xref-AIMAX.html
findstr /i "web_agent.client diagnostics.error_reporter content.openai_image local_agent.runtime" split_version\build\AIMAX-Find\xref-AIMAX-Find.html
findstr /i "web_agent.client diagnostics.error_reporter content.openai_image local_agent.runtime" split_version\build\AIMAX-EngageWrite\xref-AIMAX-EngageWrite.html
```

세 앱 모두 `web_agent.client`, `local_agent.runtime`, `content.openai_image`가 보여야 한다.

## 12. 설치파일 생성

프로젝트 루트에서 실행한다.

```powershell
mkdir dist\upload -Force

iscc packaging\windows\aimax_installer.iss `
  /DAppDisplayName="AIMAX" `
  /DAppId="kr.makefamily.aimax" `
  /DAppExeName="AIMAX.exe" `
  /DSourceDir="dist\AIMAX" `
  /DOutputDir="dist\upload" `
  /DOutputBaseFilename="aimax-bundle-windows"

iscc packaging\windows\aimax_installer.iss `
  /DAppDisplayName="AIMAX-예리씨-소통글쓰기" `
  /DAppId="kr.makefamily.aimax.yeri" `
  /DAppExeName="AIMAX-EngageWrite.exe" `
  /DSourceDir="split_version\dist\AIMAX-EngageWrite" `
  /DOutputDir="dist\upload" `
  /DOutputBaseFilename="aimax-yeri-windows"

iscc packaging\windows\aimax_installer.iss `
  /DAppDisplayName="AIMAX-현주씨-영업사원" `
  /DAppId="kr.makefamily.aimax.hyunju" `
  /DAppExeName="AIMAX-Find.exe" `
  /DSourceDir="split_version\dist\AIMAX-Find" `
  /DOutputDir="dist\upload" `
  /DOutputBaseFilename="aimax-hyunju-windows"
```

확인:

```powershell
Get-ChildItem dist\upload\*.exe | Select-Object Name,Length,LastWriteTime
Get-FileHash dist\upload\*.exe -Algorithm SHA256
```

## 13. 설치파일 동작 확인

설치 후 실행 기준:

1. 설치 완료 후 실행 옵션을 켠 상태에서 앱을 실행한다.
2. 기존 전체 Tkinter UI가 뜨지 않아야 한다.
3. 저장된 웹앱 session token이 없으면 작은 `AIMAX 웹앱 연결` 창이 떠야 한다.
4. 웹앱 로그인 성공 후 session token이 Windows 안전 저장소에 저장되어야 한다.
5. 이어서 작은 `AIMAX 로컬 보안 설정` 창이 떠야 한다.
6. 설정 창 저장 후 네이버/API key가 Windows 안전 저장소에 저장되어야 한다.
7. 프로세스는 background/headless Local Agent로 heartbeat/job polling을 시작해야 한다.
8. 웹앱 설정/대시보드에서 readiness가 갱신되어야 한다.

개발자용 legacy UI 확인:

```powershell
python app.py --legacy-ui
python split_version\app_find.py --legacy-ui
python split_version\app_engage_write.py --legacy-ui
```

위 명령은 기존 전체 UI를 여는 것이 정상이다. 일반 설치파일 사용 흐름에서는 전체 UI가 뜨면 안 된다.

## 14. 실제 네이버 자동화 안전 테스트

Windows EXE 교체 전 가능하면 아래 순서로 테스트한다.

1. 웹앱 로그인
2. Windows 실행기 설치/실행
3. 웹앱에서 로컬 설정 열기
4. 네이버 ID/PW, Gemini/Claude/OpenAI key, 모델 저장
5. 작업 탭에서 예리 글쓰기 job 생성

권장 첫 실전 테스트:

- 키워드: `바이브코딩`
- 모델: `gpt-5-mini`
- 글자수: `800자`
- 이미지: `1장`
- 모드: `save`

확인:

- 네이버 임시저장 성공
- 웹앱 job result에 `char_count`, `target_char_count` 표시
- `char_count`가 760~840 범위
- 비용이 원화로 표시
- 이미지 provider count에 `openai`가 반영

이미 macOS에서 통과한 실전 테스트:

- Gemini Flash + `바이브코딩` + `save` 네이버 임시저장 통과
- GPT `gpt-5-mini` + 800자 + 이미지 0장 OpenAI 실호출 통과

아직 남은 실전 테스트:

- GPT `gpt-5-mini` + OpenAI 이미지 1장 + 네이버 임시저장

## 15. 업로드 전 운영 백업

기존 Windows EXE가 운영 폴더에 있으면 먼저 백업한다.

SSH alias가 있는 경우:

```powershell
ssh oracle-server 'TS=$(date +%Y%m%d-%H%M%S); mkdir -p /home/ubuntu/aimax-downloads/archive-windows-$TS-pre-l1j; mv /home/ubuntu/aimax-downloads/aimax-*-windows.exe /home/ubuntu/aimax-downloads/archive-windows-$TS-pre-l1j/ 2>/dev/null || true; ls -la /home/ubuntu/aimax-downloads/archive-windows-$TS-pre-l1j'
```

직접 접속:

```powershell
ssh -p 3333 ubuntu@100.69.85.89 'TS=$(date +%Y%m%d-%H%M%S); mkdir -p /home/ubuntu/aimax-downloads/archive-windows-$TS-pre-l1j; mv /home/ubuntu/aimax-downloads/aimax-*-windows.exe /home/ubuntu/aimax-downloads/archive-windows-$TS-pre-l1j/ 2>/dev/null || true; ls -la /home/ubuntu/aimax-downloads/archive-windows-$TS-pre-l1j'
```

PowerShell quoting 문제로 위 한 줄이 실패하면, SSH 접속 후 서버 안에서 아래를 직접 실행한다.

```bash
TS=$(date +%Y%m%d-%H%M%S)
mkdir -p "/home/ubuntu/aimax-downloads/archive-windows-$TS-pre-l1j"
mv /home/ubuntu/aimax-downloads/aimax-*-windows.exe "/home/ubuntu/aimax-downloads/archive-windows-$TS-pre-l1j/" 2>/dev/null || true
ls -la "/home/ubuntu/aimax-downloads/archive-windows-$TS-pre-l1j"
```

## 16. 업로드

SSH alias가 있는 경우:

```powershell
scp dist\upload\aimax-bundle-windows.exe dist\upload\aimax-yeri-windows.exe dist\upload\aimax-hyunju-windows.exe oracle-server:/home/ubuntu/aimax-downloads/
```

직접 접속:

```powershell
scp -P 3333 `
  dist\upload\aimax-bundle-windows.exe `
  dist\upload\aimax-yeri-windows.exe `
  dist\upload\aimax-hyunju-windows.exe `
  ubuntu@100.69.85.89:/home/ubuntu/aimax-downloads/
```

주의:

- `ssh` 포트 옵션은 소문자 `-p`다.
- `scp` 포트 옵션은 대문자 `-P`다.
- `api.aimax.ai.kr`은 웹/API 도메인이다. SSH 기준은 `100.69.85.89:3333`이다.

업로드 후 서버 확인:

```powershell
ssh oracle-server "find /home/ubuntu/aimax-downloads -maxdepth 1 -type f -name 'aimax-*-windows.exe' -printf '%P %s\n' | sort && sha256sum /home/ubuntu/aimax-downloads/aimax-*-windows.exe"
```

직접 접속:

```powershell
ssh -p 3333 ubuntu@100.69.85.89 "find /home/ubuntu/aimax-downloads -maxdepth 1 -type f -name 'aimax-*-windows.exe' -printf '%P %s\n' | sort && sha256sum /home/ubuntu/aimax-downloads/aimax-*-windows.exe"
```

로컬 `Get-FileHash` 값과 서버 `sha256sum` 값이 일치해야 한다.

## 17. 웹앱 다운로드/API 확인

버전 API:

```powershell
curl.exe -sS "https://api.aimax.ai.kr/api/version?current=v1.0.1"
```

정상 기준:

- `latest_version: "v1.0.1"`
- `min_version: "v1.0.1"`
- `update_available: false`
- `update_required: false`

다운로드 옵션은 로그인 세션이 있어야 정확히 보인다. Windows `.exe` 3개가 `/home/ubuntu/aimax-downloads` 바로 아래에 있으면 웹앱의 Windows 다운로드 버튼이 활성화되어야 한다.

## 18. 완료 보고 형식

Windows 작업 완료 보고에는 아래를 반드시 포함한다.

- 사용한 프로젝트 경로
- 최신 코드 동기화 방식
- `APP_VERSION` 확인 결과
- L1J 코드 포함 검색 결과
- dev fallback 제거 검색 결과
- `py_compile` 결과
- `headless_agent_polling_smoke.py` 결과
- 가능하면 `agent_heartbeat_only_smoke.py` 결과
- 빌드 명령 결과
- xref 포함 확인 결과
- 설치파일 3종 파일명/크기/SHA-256
- 설치 후 전체 UI가 뜨지 않았는지 여부
- session token이 없는 첫 실행에서 `AIMAX 웹앱 연결` 창이 떴는지 여부
- 웹앱 로그인 성공 후 session token이 Windows 안전 저장소에 저장됐는지 여부
- `open_settings` 작은 설정 창 동작 여부
- 서버 업로드 전 백업 경로
- 서버 업로드 후 SHA-256 일치 여부
- Windows 다운로드 버튼 활성화 확인 여부
- 실제 네이버 테스트를 했다면 job id, 모델, 글자수, 이미지 수, 결과

## 19. 실패 시 우선순위

1. 빌드 실패
   - hidden import 누락인지 먼저 확인한다.
   - 특히 `content.openai_image`, `local_agent.runtime`, `web_agent.client` 누락을 확인한다.
2. 실행 시 전체 UI가 뜸
   - `local_agent.runtime.agent_mode_requested()`가 frozen 앱에서 true인지 확인한다.
   - Inno `[Run]`은 인자 없이 EXE를 실행해도 headless여야 한다.
3. 웹앱 연결이 안 됨
   - `scripts/save_web_agent_session.py`로 세션 저장을 먼저 확인한다.
   - `agent_heartbeat_only_smoke.py`로 heartbeat-only 확인한다.
4. 로컬 설정 열기가 안 됨
   - `/api/agent/next-command` polling과 `open_settings` command update를 확인한다.
   - headless에서 작은 설정 창을 열고 `done`을 보내야 한다.
5. GPT 모델이 안 됨
   - OpenAI key가 Windows 안전 저장소에 저장되어 있는지 확인한다.
   - 모델명이 `gpt-5-mini` 또는 `gpt-5.4-mini`인지 확인한다.
6. 글자수가 벗어남
   - `content.ai_text.measure_visible_char_count()`와 재작성 루프가 빌드에 포함됐는지 확인한다.
   - job result의 `char_count`, `target_char_count`를 확인한다.
