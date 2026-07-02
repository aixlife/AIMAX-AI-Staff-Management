아래 Syncthing 폴더의 최신 handoff 문서를 먼저 읽고 Windows 작업을 진행해주세요.

Syncthing 폴더:
`20_Deploy-To-Windows/2026-05-23-local-secret-import/`

작업 목표:
Phase 1 `AI/API Local Key Import Bridge`를 Windows 실행기에 반영하고 검증합니다. 웹에서 `기존 실행기 키 가져오기`를 누르면 Windows 로컬 실행기에 저장된 Gemini/Apify/OpenAI/Claude provider keys만 웹 보안 저장소로 복사되어야 합니다.

중요 규칙:
- Syncthing 공유 폴더 안에서 직접 빌드하지 말고, `aimax-local-secret-import-source-20260523.zip`을 Windows 로컬 작업 폴더로 복사한 뒤 풀어서 작업하세요.
- `.env`, passphrase, 실제 API key, 비밀번호, 쿠키, 세션 토큰, signed URL은 Syncthing에 넣지 마세요.
- Naver password/cookies/browser profile/session은 절대 웹으로 가져오지 않습니다.
- 유료 Gemini/OpenAI/Claude/Apify 호출을 실행하지 마세요. 검증은 fake key와 no-paid smoke만 사용하세요.
- 최신 handoff 문서와 ZIP의 파일 목록을 기준으로 작업하고, 기존 Windows 빌드/패키징 절차가 있으면 그 절차를 따르세요.

반영해야 할 핵심 contract:
- 서버 command type: `import_local_provider_secrets`
- command payload: `{ providers: ["gemini", "apify", "openai", "claude"] }`
- 로컬 실행기 처리:
  - 로컬 설정에서 provider keys만 읽기
  - 각 provider를 `/api/user/secrets/:provider`로 PUT
  - command update에는 raw key 없이 provider별 `imported/missing/failed`와 count만 전송
- 오래된 실행기는 unsupported command로 안전하게 실패해야 하며, 웹은 업데이트/직접 입력 안내를 보여야 합니다.

검증:
1. `python -m py_compile app.py split_version/app.py local_agent/runtime.py web_agent/client.py`
2. `node --check oracle/aimax-reports-api/server.js`
3. `node --check scripts/smoke_local_secret_import.mjs`
4. `node scripts/smoke_local_secret_import.mjs`
5. 가능하면 Windows 실행기에서 command polling을 실제로 확인하세요.

완료 후 Syncthing 폴더에 `WINDOWS_RESULT_20260523_local_secret_import.md`를 만들어 아래를 적어주세요.
- 반영한 파일 목록
- 실행한 검증 명령과 결과
- 패키징/설치본 생성 여부, 파일명, 크기, hash
- blocker가 있으면 재현 단계와 Mac/server 쪽 요청사항
