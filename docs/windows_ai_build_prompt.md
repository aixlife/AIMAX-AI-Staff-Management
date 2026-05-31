# Windows AI Build Prompt

아래 내용을 Windows 데스크탑의 AI 개발자에게 그대로 전달한다.

---

당신의 목표는 AIMAX Windows v1.0.1 설치파일 3종을 최신 L1J 코드로 재빌드하고 Oracle 서버에 업로드하는 것입니다.

반드시 먼저 이 문서를 읽고 그대로 따르세요.

`docs/windows_build_v1_0_1_handoff.md`

중요한 전제:

- 기존 네이버 자동화 로직은 임의로 바꾸지 않습니다.
- 이번 작업은 macOS에서 검증된 L1J 변경사항을 Windows EXE에 포함해 빌드/패키징/업로드하는 것입니다.
- 서버에 기존 Windows v1.0.1 EXE가 있더라도 L1J 이전 파일이면 stale입니다. 이번 빌드로 교체해야 합니다.
- macOS 쪽에서는 GPT/OpenAI 모델, OpenAI 이미지 경로, 사용자 입력 API key 저장 경로, 작은 로컬 보안 설정 창, 글자수 ±5% 보정, 원화 비용 표시, headless smoke, macOS DMG 3종 재빌드/업로드가 완료되었습니다.
- Windows 실행기도 같은 `web_agent` 계약과 같은 headless 동작을 포함해야 합니다.
- 다운로드 버튼은 자동 연결이 아닙니다. 저장된 session token이 없는 첫 실행에서는 작은 `AIMAX 웹앱 연결` 창을 띄워 웹앱 로그인 token을 Windows 안전 저장소에 저장해야 합니다.
- 이 first-run 연결 UX를 Windows 전용으로 갈라지게 만들지 말고, 가능하면 `local_agent/runtime.py` 공통 코드에 넣어 macOS에도 같은 patch를 되돌려 주세요.
- 서버 웹앱 파일을 수정했다면 그것은 Windows 빌드만으로 운영 반영되지 않습니다. `oracle/aimax-reports-api/static/app.html` 또는 `server.js` 변경은 별도 배포/검증 대상으로 보고하세요.

해야 할 일:

1. Windows 프로젝트가 macOS 최신 소스와 동기화되어 있는지 확인합니다. 오래된 Windows 폴더를 그대로 빌드하지 마세요.
   - 가능하면 `handoff/aimax-l1j-windows-transfer-20260506.zip` 안의 source zip을 새 폴더에 풀어 사용하세요.
   - 이 transfer zip에는 encrypted test secrets도 들어 있습니다.
2. `aimax_compliance.py`의 `APP_VERSION`이 `v1.0.1`인지 확인합니다.
3. `app.py`, `split_version/app.py`, `local_agent/runtime.py`, `content/ai_text.py`, `content/openai_image.py`, `web_agent/client.py`에 L1J 코드가 있는지 확인합니다.
4. `minsu-api`, `find-generic-password`, `security find` 같은 개발자 개인 key fallback이 남아 있지 않은지 확인합니다.
5. `python -m py_compile ...` 정적 검증을 통과시킵니다.
6. `python scripts\headless_agent_polling_smoke.py`를 통과시킵니다.
7. 가능하면 `python scripts\save_web_agent_session.py --email <이메일>` 후 `python scripts\agent_heartbeat_only_smoke.py`로 운영 heartbeat-only smoke를 확인합니다.
   - 테스트 API key는 `aimax-l1j-test-secrets-20260506.env.enc`를 별도 passphrase로 복호화해 사용하세요.
   - passphrase는 transfer zip 안에 없습니다. macOS 로컬 전용 파일에만 있습니다.
   - 복호화된 env 파일은 테스트 후 삭제하세요.
8. `python build.py`로 통합 앱을 빌드합니다.
9. `cd split_version; python build.py; cd ..`로 예리/현주 분리 앱을 빌드합니다.
10. PyInstaller xref에서 `web_agent.client`, `local_agent.runtime`, `content.openai_image`, `diagnostics.error_reporter` 포함 여부를 확인합니다.
11. Inno Setup으로 아래 설치파일 3개를 만듭니다.
    - `dist/upload/aimax-bundle-windows.exe`
    - `dist/upload/aimax-yeri-windows.exe`
    - `dist/upload/aimax-hyunju-windows.exe`
12. 설치 후 실행했을 때 기존 전체 Tkinter UI가 뜨지 않는지 확인합니다.
13. 저장된 session token이 없는 첫 실행에서 작은 `AIMAX 웹앱 연결` 창이 뜨고, 로그인 후 token이 Windows 안전 저장소에 저장되는지 확인합니다.
14. 웹앱의 “로컬 설정 열기”가 작은 `AIMAX 로컬 보안 설정` 창을 여는지 확인합니다.
15. 서버 `/home/ubuntu/aimax-downloads`의 기존 Windows EXE를 archive 폴더로 백업합니다.
16. 새 `.exe` 3개를 `/home/ubuntu/aimax-downloads/`에 업로드합니다.
    - SSH alias `oracle-server`가 없으면 `scp -P 3333 ... ubuntu@100.69.85.89:/home/ubuntu/aimax-downloads/` 형식을 사용합니다.
    - `ssh ubuntu@api.aimax.ai.kr`는 기본 22번 포트라 실패할 수 있습니다. SSH 기준은 `100.69.85.89:3333`입니다.
17. 로컬 `Get-FileHash`와 서버 `sha256sum`이 일치하는지 확인합니다.
18. 업로드 후 웹앱에서 Windows 다운로드 버튼이 활성화되는지 확인합니다.

가능하면 마지막 실전 테스트:

- 키워드: `바이브코딩`
- 모델: `gpt-5-mini`
- 글자수: `800자`
- 이미지: `1장`
- 모드: `save`
- 확인: 네이버 임시저장, `char_count` 760~840자, 원화 비용, OpenAI image provider count

완료 보고에는 아래를 포함하세요.

- 사용한 프로젝트 경로와 최신 소스 동기화 방식
- 정적 검증 결과
- L1J 코드 포함 확인 결과
- dev fallback 제거 확인 결과
- smoke test 결과
- xref 포함 확인 결과
- 빌드한 파일명/크기/SHA-256
- 설치 후 전체 UI 미노출 확인
- `open_settings` 작은 설정 창 확인
- 서버 백업 경로
- 서버 업로드 및 SHA-256 일치 결과
- Windows 다운로드 버튼 확인 결과
- 실패한 단계가 있다면 정확한 에러 로그
