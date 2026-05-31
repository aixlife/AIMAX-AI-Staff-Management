# Windows Handoff: AI/API Local Key Import Bridge

작성일: 2026-05-23 KST

## 목적

Phase 1 `AI/API Local Key Import Bridge`를 Windows 실행기에도 같은 contract로 반영한다. 사용자가 웹 안내 팝업 또는 설정 탭에서 `기존 실행기 키 가져오기`를 누르면, Windows 로컬 실행기에 저장된 provider API keys만 웹 보안 저장소로 복사되어야 한다.

## 현재 Mac/Web 변경 요약

- 서버 `/api/agent/commands`가 `import_local_provider_secrets` command를 지원한다.
- command payload는 `{ providers: ["gemini", "apify", "openai", "claude"] }` 형태다.
- command result는 provider별 `imported`, `missing`, `failed` 상태와 count만 포함한다.
- raw key는 command log/result/stdout/DOM/Shared-Bridge에 남기지 않는다.
- 웹 설정 탭과 안내 팝업에 `기존 실행기 키 가져오기` 버튼이 추가됐다.
- Mac 로컬 실행기는 로컬에 저장된 Gemini/Apify/OpenAI/Claude 키만 읽어 `/api/user/secrets/:provider`로 직접 PUT한다.

## Windows 작업 범위

1. 전달된 source ZIP을 Windows 로컬 작업 폴더에 풀고 기존 Windows 소스에 반영한다.
2. Windows 실행기 command handler가 `import_local_provider_secrets`를 처리하도록 확인한다.
3. 가져오기 대상은 아래 4개로 제한한다.
   - Gemini API Key
   - Apify API Token
   - OpenAI API Key
   - Claude API Key
4. 아래 항목은 절대 가져오지 않는다.
   - Naver password
   - cookies
   - browser profile/session
   - web session token
   - signed URLs, private logs
5. 오래된 Windows 실행기는 unsupported command로 안전하게 실패하고, 웹 UI는 업데이트/직접 입력 안내를 보여야 한다.

## 전달 아티팩트

- `aimax-local-secret-import-source-20260523.zip`
- `WINDOWS_AI_COPYPASTE_PROMPT_20260523_local_secret_import.md`
- 이 handoff 문서

## 검증 기준

- `python -m py_compile app.py split_version/app.py local_agent/runtime.py web_agent/client.py`
- `node --check oracle/aimax-reports-api/server.js`
- `node --check scripts/smoke_local_secret_import.mjs`
- `node scripts/smoke_local_secret_import.mjs`
- 가능하면 Windows 패키징 전/후 실행기에서 실제 command polling을 mock 서버 또는 staging 서버로 확인한다.
- 검증 중 유료 Gemini/OpenAI/Claude/Apify 호출은 실행하지 않는다.
- fake local provider keys가 웹 보안 저장소로 저장되더라도 raw key가 logs/result/stdout/Shared-Bridge에 남지 않아야 한다.

## 반환 기대

Windows 작업 완료 후 이 Syncthing 폴더에 아래를 남긴다.

- `WINDOWS_RESULT_20260523_local_secret_import.md`
- 실행한 검증 명령과 결과
- 패키징/설치본을 만들었다면 파일명, 크기, hash
- blocker가 있으면 원인, 재현 단계, 필요한 Mac/server 변경 요청
