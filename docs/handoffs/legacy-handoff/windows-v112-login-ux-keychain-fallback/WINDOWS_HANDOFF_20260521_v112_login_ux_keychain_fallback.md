# Windows Handoff - v1.0.12 Login UX + Credential Storage Fallback

Date: 2026-05-21 KST
Scope: Windows unified installer verification/rebuild candidate
Target: `aimax-bundle-windows.exe`

## Why

The macOS local-agent connection dialog still showed:

```text
로그인 실패: invalid_credentials
```

This is the local executable connection step, not the web app page. Server-side checks showed the account was active and entitled, and a sanitized bad-password probe returned the same server code:

```text
401 {"ok":false,"error":"invalid_credentials"}
```

So the immediate root cause is a password mismatch in the local-agent connection dialog, but the product problem is that the executable exposes raw internal codes and gives no next action.

The same local-agent connection code is shared with Windows, so Windows must be checked before treating this as fixed for customers.

## Related Previous Errors

- `AIMAX-RPT-20260520160110-d8808095`: macOS/web app connection report, originally visible as "안전 저장소에 세션 토큰을 저장하지 못했습니다." Web app fallback was deployed separately.
- `AIMAX-RPT-20260520021900-587c9a8c`: Windows 예리 writing report, original `input_content() got an unexpected keyword argument 'image_provider'`. v1.0.11 installer-only hotfix already handled this path.

## Guardrails

- Do not run paid AI calls.
- Do not call Gemini/OpenAI/Claude generation APIs.
- Do not perform Naver publish, save, or draft tests.
- Do not use customer passwords, cookies, API keys, `.env`, browser profiles, signed URLs, or raw private logs.
- Do not print or store passwords in Syncthing.
- Build/test in a local Windows work folder, not inside the shared Syncthing folder.
- Use Claude/Gemini only as advisory reviewers if already authenticated through subscription CLIs; sanitized context only.

## Source Files Provided

Copy these files from `source-files/` into the Windows local working copy, preserving paths:

- `web_agent/client.py`
- `local_agent/runtime.py`
- `app.py`
- `split_version/app.py`

SHA256:

```text
7654c20699290f171ccbc2f3f96aae8565afeb57d6b556607f06eb542a4494d3  source-files/local_agent/runtime.py
a0520db988684a441cc3188fa92de14042f4ebd43d907a30478000d355077ce7  source-files/web_agent/client.py
9ddb1207ddf5477ef9e846867bd9f21260eb1a65e10d1d5f40cd874cb96ef058  source-files/app.py
8a08abd76731cdf73fc5094de1582b8b9432a115e7378422ce16502c2b6c8ebe  source-files/split_version/app.py
```

## Required Behavior

1. `invalid_credentials` must not be shown to users.
   - Show Korean guidance: email/password mismatch, use the same password that works in the web app, recent reset means use the new password.
2. Network failures must show Korean guidance.
3. Login success must not be turned into failure only because Windows Credential Manager/keyring save fails.
   - If token save fails after successful login, continue for the current run and show a warning that the session may need login again after restart.
4. Existing v1.0.11 editor/image contract fixes must remain intact.
5. Windows update/version behavior must remain coherent. If rebuilding, bump Windows installer metadata/version to v1.0.12 using the same mechanism used for v1.0.11.

## Required No-Paid Checks

Run at minimum:

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
```

Also run static checks:

```powershell
Select-String -Path local_agent\runtime.py -Pattern '로그인 실패: \{error\}|invalid_credentials|안전 저장소에 세션 토큰을 저장하지 못했습니다'
Select-String -Path web_agent\client.py -Pattern 'def friendly_error_message|invalid_credentials|network_error'
```

Expected:

- `local_agent\runtime.py` should not contain the old raw `로그인 실패: {error}` behavior.
- `local_agent\runtime.py` should not raise only because token storage fails after successful login.
- `web_agent\client.py` should contain `friendly_error_message`.

Optional no-paid server probe:

```powershell
$body = @{ email = "demo@aimax.ai.kr"; password = "__definitely_wrong_password_probe__"; device_label = "Windows sanitized login probe" } | ConvertTo-Json
Invoke-WebRequest -Uri "https://api.aimax.ai.kr/api/auth/login" -Method POST -ContentType "application/json" -Body $body -SkipHttpErrorCheck
```

Expected HTTP status is `401`; do not use real passwords in commands.

## Required Build

If source checks pass, rebuild the unified Windows installer:

```text
aimax-bundle-windows.exe
```

Return:

- `aimax-bundle-windows.exe`
- `SHA256SUMS.txt`
- `WINDOWS_COMPLETION_20260521_v112_login_ux_keychain_fallback.md`
- exact changed-file list or source patch

## Completion Report Must Include

- Windows work folder used
- whether the work folder is a Git checkout
- exact files changed
- exact commands run and outputs
- whether any paid provider call occurred
- whether any Naver action occurred
- whether Claude/Gemini advisory review was used
- installer size and SHA256 if rebuilt
- confirmation that v1.0.11 image/editor fixes still remain
- residual risks/blockers

