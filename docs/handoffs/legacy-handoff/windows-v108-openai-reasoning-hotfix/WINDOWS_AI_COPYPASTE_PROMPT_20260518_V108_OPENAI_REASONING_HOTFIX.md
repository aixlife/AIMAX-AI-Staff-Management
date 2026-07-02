아래 공유 폴더의 최신 문서를 먼저 읽고 Windows v1.0.8 핫픽스를 진행해주세요.

공유 폴더:
`/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/AIMAX-20260518-windows-v108-openai-reasoning-hotfix/`

먼저 읽을 파일:

1. `WINDOWS_AI_DEVELOPER_MESSAGE_20260518_V108_OPENAI_REASONING_HOTFIX.md`
2. `aimax-windows-v108-openai-reasoning-hotfix-evidence-20260518.json`
3. `windows-source-delta-20260518-v107-to-v108-openai-reasoning-hotfix.patch`

목표:

- Windows v1.0.7 작업 폴더를 기준으로 `content/ai_text.py`의 OpenAI Responses API 호출에서 `reasoning.effort`를 `minimal`이 아니라 `low`로 변경해주세요.
- `APP_VERSION`은 `v1.0.8`, Inno `AppVersion`은 `1.0.8`로 올려주세요.
- Windows 설치파일 3종을 다시 빌드해주세요.

중요:

- Syncthing 공유 폴더 안에서 직접 빌드하지 말고 Windows 로컬 작업 폴더로 복사해서 작업해주세요.
- `.env`, API 키, 네이버 비밀번호, 쿠키/세션/인증 헤더, 개인 설정 파일은 공유 폴더에 넣지 마세요.
- 실제 유료 AI 생성이나 실제 네이버 발행은 하지 말고 mock/stub으로만 확인해주세요.

검증:

- `py_compile` 통과
- OpenAI `gpt-5.4-mini` 요청 payload가 `reasoning.effort=low`인지 확인
- OpenAI HTTP 400 `unsupported_value` mock이 sanitized `ai_error`로 남는지 확인
- OpenAI success mock에서 usage가 유지되는지 확인
- 기존 v1.0.7 diagnostics smoke 회귀 통과
- bundle/yeri/hyunju frozen probe가 `v1.0.8`을 보고하는지 확인
- Inno 설치파일 3종 빌드 성공

반환 파일:

- `WINDOWS_AI_COMPLETION_REPORT_20260518_V108_OPENAI_REASONING_HOTFIX.md`
- `windows-source-delta-20260518-v107-to-v108-openai-reasoning-hotfix.patch`
- `aimax-windows-v108-openai-reasoning-hotfix-evidence-20260518.json`
- `aimax-bundle-windows.exe`
- `aimax-yeri-windows.exe`
- `aimax-hyunju-windows.exe`
- `SHA256SUMS.txt`

완료 보고서에는 실제 유료 AI 생성/실제 네이버 발행을 했는지 여부와 모든 산출물 SHA256을 반드시 적어주세요.

