# Windows AI Developer Message

아래 지시를 그대로 따르세요.

## 핵심 상황

기존 Windows 폴더 `C:\Users\likim\Desktop\NaverBlogAuto-main-wincheck`는 L1J 필수 파일이 빠진 stale 폴더였습니다. 그 폴더를 그대로 빌드하면 안 됩니다.

Mac 쪽에서 최신 L1J source와 테스트용 encrypted secrets를 Syncthing 공유 폴더에 올려두었습니다.

Syncthing 공유 폴더에서 아래 경로를 찾으세요.

```text
20_Deploy-To-Windows/AIMAX-L1J-20260506
```

그 안에 있어야 하는 파일:

```text
aimax-l1j-windows-transfer-20260506.zip
aimax-l1j-windows-transfer-20260506.sha256
SYNCTHING_WINDOWS_TRANSFER_README.md
WINDOWS_AI_DEVELOPER_MESSAGE_20260506.md
```

## 절대 하지 말 것

- 기존 `NaverBlogAuto-main-wincheck` 폴더를 그대로 빌드하지 마세요.
- Syncthing 공유 폴더 안에서 직접 빌드하지 마세요.
- 복호화된 `.env` 파일이나 API key 원문을 Syncthing에 다시 올리지 마세요.
- passphrase를 transfer zip과 같은 채널/폴더에 저장하지 마세요.
- 네이버 비밀번호/API key를 서버나 웹앱 DB에 저장하는 코드를 만들지 마세요.
- Windows에서만 동작하는 별도 구현으로 갈라지게 만들지 마세요. 가능한 공통 코드에 넣어야 합니다.

## 첫 작업

Windows 로컬에 새 작업 폴더를 만드세요.

예:

```powershell
mkdir C:\Users\likim\Desktop\AIMAX-L1J-20260506
```

Syncthing 폴더의 `aimax-l1j-windows-transfer-20260506.zip`을 새 작업 폴더로 복사한 뒤 압축을 푸세요.

압축을 풀면 내부에 다음 파일이 있어야 합니다.

```text
aimax-l1j-windows-source-20260506.zip
aimax-l1j-test-secrets-20260506.env.enc
aimax-l1j-test-secrets-20260506.README.md
```

다시 `aimax-l1j-windows-source-20260506.zip`을 풀고, 그 source 폴더에서 작업하세요.

## SHA 확인

Syncthing 폴더의 SHA 파일과 로컬 파일이 일치하는지 확인하세요.

```powershell
Get-FileHash .\aimax-l1j-windows-transfer-20260506.zip -Algorithm SHA256
```

Mac에서 기록한 현재 SHA:

```text
874113eea0f5e8b8babdd17038688f4cb6a60d32c4d2d239547ada5d44adfe59  aimax-l1j-windows-transfer-20260506.zip
```

## 테스트 API key 복호화

encrypted secrets에는 OpenAI/Gemini/Anthropic 테스트 API key가 들어 있습니다. 네이버 비밀번호는 들어 있지 않습니다.

passphrase는 이 폴더에 없습니다. 사용자에게 별도 채널로 받아야 합니다.

복호화:

```powershell
openssl enc -d -aes-256-cbc -pbkdf2 `
  -in aimax-l1j-test-secrets-20260506.env.enc `
  -out aimax-l1j-test-secrets.env `
  -pass pass:<PASSPHRASE>
```

현재 사용자 환경변수로 주입:

```powershell
Get-Content .\aimax-l1j-test-secrets.env | ForEach-Object {
  if ($_ -match "^([^#=]+)=(.*)$") {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "User")
  }
}
```

테스트가 끝나면 복호화된 `aimax-l1j-test-secrets.env`는 삭제하세요.

## 반드시 먼저 읽을 문서

source 폴더 안에서 아래 문서를 먼저 읽고 그대로 진행하세요.

```text
docs/windows_build_v1_0_1_handoff.md
docs/windows_ai_build_prompt.md
```

## 이번 Windows 작업 목표

1. 최신 L1J 코드가 들어간 Windows EXE 3종을 재빌드합니다.
2. 설치 후 기존 전체 Tkinter UI가 뜨지 않아야 합니다.
3. 저장된 session token이 없는 첫 실행에서는 작은 `AIMAX 웹앱 연결` 창이 떠야 합니다.
4. 웹앱 로그인 성공 후 session token이 Windows Credential Manager/keyring에 저장되어야 합니다.
5. 이어서 작은 `AIMAX 로컬 보안 설정` 창에서 네이버 ID/PW와 API key를 저장해야 합니다.
6. 이후 background/headless Local Agent로 heartbeat/job polling을 시작해야 합니다.
7. 웹앱 설정/대시보드에서 readiness가 갱신되어야 합니다.

## 현재 중요한 기능 변경

L1J에는 아래 기능이 포함되어야 합니다.

- GPT 모델 선택:
  - `gpt-5.4-mini`
  - `gpt-5-mini`
- OpenAI 글 생성 경로
- OpenAI 이미지 생성 경로
- OpenAI/Gemini/Anthropic key를 사용자 PC 안전 저장소에서 읽는 구조
- 개발자 개인 keychain fallback 제거
- 작은 `AIMAX 웹앱 연결` 창
- 작은 `AIMAX 로컬 보안 설정` 창
- 글자수 ±5% 보정
- `char_count`, `target_char_count` job result 저장
- 원화 비용 표시
- image provider count 저장

## 구현 주의

첫 실행 연결 UX를 구현/수정했다면 가능하면 공통 `local_agent/runtime.py`에 넣으세요.

Windows에서만 별도 구현하면 다음 macOS 빌드 때 다시 문제가 생깁니다. 수정 파일 목록과 diff를 반드시 보고하세요. Mac 쪽 공통 source에 되가져와야 합니다.

서버 웹앱 파일을 수정했다면 별도로 표시하세요.

아래 파일을 건드렸다면 Windows EXE 빌드만으로 운영 반영되지 않습니다.

```text
oracle/aimax-reports-api/server.js
oracle/aimax-reports-api/static/app.html
```

이 경우 Mac/Oracle 운영 배포가 별도 필요합니다.

## 검증 순서

1. 최신 코드 포함 검색
2. dev fallback 제거 검색
3. `python -m py_compile ...`
4. `python scripts\headless_agent_polling_smoke.py`
5. 가능하면 `python scripts\agent_heartbeat_only_smoke.py`
6. `python build.py`
7. `cd split_version; python build.py; cd ..`
8. PyInstaller xref 확인
9. Inno Setup 설치파일 3종 생성
10. 설치 후 first-run 연결 창 확인
11. 로컬 보안 설정 창 확인
12. heartbeat/readiness 확인
13. 가능하면 실제 `바이브코딩`, `gpt-5-mini`, `800자`, 이미지 1장, `save` 테스트

## 완료 보고에 반드시 포함

- 사용한 source 폴더 경로
- SHA 확인 결과
- 정적 검증 결과
- smoke test 결과
- 수정 파일 목록
- 서버/웹앱 파일 수정 여부
- first-run `AIMAX 웹앱 연결` 창 동작 여부
- session token 안전 저장소 저장 여부
- `AIMAX 로컬 보안 설정` 창 동작 여부
- EXE 3종 파일명/크기/SHA-256
- 실제 네이버 테스트를 했다면 job id, 모델, 글자수, 이미지 수, 결과

