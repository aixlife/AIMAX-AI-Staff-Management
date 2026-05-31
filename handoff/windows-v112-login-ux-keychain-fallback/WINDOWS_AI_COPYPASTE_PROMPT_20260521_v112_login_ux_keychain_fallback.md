Read first:
`WINDOWS_HANDOFF_20260521_v112_login_ux_keychain_fallback.md`

Task:
Verify whether the Windows executable has the same local-agent connection issue seen on macOS:

```text
로그인 실패: invalid_credentials
```

This is the AIMAX local executable connection dialog, not the web page. The account can be active and still fail here if the typed password is not the current web-app password. The product problem is that the executable exposes raw internal error codes and gives no helpful next step.

Use the provided sanitized source files from `source-files/`:

- `web_agent/client.py`
- `local_agent/runtime.py`
- `app.py`
- `split_version/app.py`

Work rules:

- Copy source out of Syncthing into a local Windows work folder before editing/building.
- Do not build inside the shared folder.
- Do not send or store customer data, API keys, cookies, `.env`, browser profiles, signed URLs, passwords, or raw private logs.
- Do not run paid AI calls.
- Do not run real Naver publish/save/draft tests.
- Do not use real passwords in shell commands.
- Claude/Gemini may be used only as advisory reviewers if already available through authenticated subscription CLIs; sanitized context only.

Required verification:

```powershell
python -m py_compile web_agent\client.py local_agent\runtime.py app.py split_version\app.py

python - <<'PY'
from web_agent.client import AimaxApiError, friendly_error_message

checks = [
    (AimaxApiError(401, "invalid_credentials", {}), "이메일 또는 비밀번호"),
    (AimaxApiError(0, "network_error: timeout", {}), "서버에 연결하지 못했습니다"),
    (RuntimeError("안전 저장소에 세션 토큰을 저장하지 못했습니다."), "안전 저장소"),
]

for error, expected in checks:
    message = friendly_error_message(error)
    print(message)
    assert expected in message, (expected, message)

print("LOGIN_FRIENDLY_ERROR_MESSAGES_OK")
PY

Select-String -Path local_agent\runtime.py -Pattern '로그인 실패: \{error\}|invalid_credentials|안전 저장소에 세션 토큰을 저장하지 못했습니다'
Select-String -Path web_agent\client.py -Pattern 'def friendly_error_message|invalid_credentials|network_error'
```

Expected:

- `invalid_credentials` is translated to Korean user guidance.
- The dialog no longer displays raw `로그인 실패: {error}`.
- A successful login is not failed only because token storage/Windows Credential Manager save fails.
- v1.0.11 image/editor fixes are not regressed.

If checks pass, rebuild only the unified Windows installer and return:

- `aimax-bundle-windows.exe`
- `SHA256SUMS.txt`
- `WINDOWS_COMPLETION_20260521_v112_login_ux_keychain_fallback.md`
- source patch or exact changed-file list

Completion report must include:

- work folder
- whether the folder is a Git checkout
- commands and outputs
- files changed
- paid calls: yes/no
- Naver actions: yes/no
- Claude/Gemini advisory review status
- installer size/SHA256 if rebuilt
- residual risks/blockers

