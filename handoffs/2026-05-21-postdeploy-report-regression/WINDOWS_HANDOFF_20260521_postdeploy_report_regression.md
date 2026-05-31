# Windows Handoff 20260521 Post-Deploy Report Regression

## Goal

Verify that the deployed Windows `v1.0.14` installer actually resolves the customer-reported failures, not only that the installer was built and uploaded.

Use only sanitized test data. Do not use customer accounts, customer logs, real API keys, browser profiles, cookies, `.env`, signed URLs, or raw private logs.

## Production Facts To Confirm

- Canonical deployed installer:
  - `20_Deploy-To-Windows\2026-05-21-v114-local-settings-ux\aimax-bundle-windows.exe`
- Expected SHA256:
  - `B30183FAE963F861FBE876AB5BE4E120192C015663736404801F06FCF595FA5B`
- Public version API should report:
  - Windows `v1.0.13` -> latest/min `v1.0.14`, `update_required=true`
  - Windows `v1.0.14` -> `update_required=false`

## Reported Error Cases

### 1. Smart Editor Input Contract

Representative reports:

- `AIMAX-RPT-20260520021900-587c9a8c`
- `AIMAX-RPT-20260520075108-ad949f22`

Reported symptom:

```text
input_content() got an unexpected keyword argument 'image_provider'
```

Expected result:

- Calling `input_content(..., image_provider=..., fallback_api_key=...)` no longer raises `TypeError`.
- Provider routing reaches the image insert path with the requested provider.
- No paid image/text generation call is required for this regression test.

### 2. Local Agent Web Login / Safe Storage

Representative report:

- `AIMAX-RPT-20260520160110-d8808095`

Reported symptom:

```text
로그인 실패: 안전 저장소에 세션 토큰을 저장하지 못했습니다.
```

Expected result:

- Session save fallback works when OS credential storage/keychain is unavailable.
- A storage failure does not turn a successful login into a hard login failure.
- Korean/Hangul password input is rejected before HTTP login, with a Korean guide message.
- ASCII test password input proceeds normally.

### 3. Local Security Settings UX

Reported operator/user symptom:

- Local settings window felt stuck/slow.
- Existing API keys appeared blank.
- Bottom save controls could be cut off on smaller screens.

Expected result:

- The settings window opens with immediate "opening" feedback.
- The dialog is resizable/scrollable.
- Save/Cancel/API-guide buttons remain visible or reachable on a smaller viewport.
- Fake saved secrets survive reload through fallback storage with keychain disabled.
- Blank fields intentionally clear fallback values and do not silently resurrect old values.

### 4. Songi Packaging Regression

Expected result:

- The same final `v1.0.14` installer includes Songi web/runtime files and Windows media tools.
- `bundle` can see/use Songi; `blog_team` cannot.
- No Gemini or Apify paid operation runs without explicit confirmation.
- Signed/private media URL values are redacted in error reports.

## Required Windows Checks

Run from a local Windows work folder, not from inside Syncthing.

### A. Artifact And Public Version Check

```powershell
$installer = "C:\Users\likim\Documents\shared-bridge\20_Deploy-To-Windows\2026-05-21-v114-local-settings-ux\aimax-bundle-windows.exe"
Get-FileHash -Algorithm SHA256 -LiteralPath $installer

Invoke-RestMethod "https://api.aimax.ai.kr/api/version?current=v1.0.13&platform=windows" |
  ConvertTo-Json -Depth 5

Invoke-RestMethod "https://api.aimax.ai.kr/api/version?current=v1.0.14&platform=windows" |
  ConvertTo-Json -Depth 5
```

Pass criteria:

- SHA matches `B30183FAE963F861FBE876AB5BE4E120192C015663736404801F06FCF595FA5B`.
- `v1.0.13` is forced to update.
- `v1.0.14` is not forced to update.

### B. Source/Build Regression Checks

In the local Windows source folder that produced the final artifact:

```powershell
python -m py_compile web_agent\client.py app.py split_version\app.py local_agent\runtime.py posting\editor.py scripts\verify_editor_image_provider_contract.py verify_v113_login_ime_guard.py verify_v114_local_settings_ux.py
python scripts\verify_editor_image_provider_contract.py
python verify_v110_no_paid_editor_smoke.py
python verify_v113_login_ime_guard.py
python verify_v114_local_settings_ux.py
```

Pass criteria:

- `EDITOR_IMAGE_PROVIDER_CONTRACT_OK`
- `V110_NO_PAID_EDITOR_SMOKE_OK`
- `V113_LOGIN_IME_GUARD_OK`
- `V114_LOCAL_SETTINGS_UX_OK`
- No secret values printed.

### C. Frozen Installed App Check

After installing the exact deployed installer locally:

```powershell
$probe = "$env:TEMP\aimax-v114-postdeploy-diagnostics.json"
if (Test-Path -LiteralPath $probe) { Remove-Item -LiteralPath $probe -Force }
$exe = "C:\Program Files\AIMAX\AIMAX.exe"
if (!(Test-Path -LiteralPath $exe)) { $exe = "$env:LOCALAPPDATA\Programs\AIMAX\AIMAX.exe" }
$p = Start-Process -FilePath $exe -ArgumentList @("--diagnostics-probe", $probe) -Wait -PassThru -WindowStyle Hidden
"ExitCode=$($p.ExitCode)"
Get-Content -LiteralPath $probe -Raw
```

Pass criteria:

- Exit code `0`.
- Diagnostics show `version: v1.0.14`.
- Frozen runtime is `true`.
- `ai_text_import_smoke.ok` is `true`.

### D. Interactive No-Paid UX Checks

Use a synthetic/test AIMAX account only. If a usable test account is unavailable, stop and report `BLOCKED: test account unavailable`.

Do not enter real customer API keys. Do not run a real Naver publish/save/draft.

Checks:

1. Launch installed AIMAX.
2. In the web-login connection dialog, type a Hangul password such as `가나다`.
   - Expected: local Korean validation message appears before HTTP login.
   - Expected: no `invalid_credentials` roundtrip is needed for this invalid local input.
3. With an ASCII test password, confirm the login flow does not fail with "안전 저장소에 세션 토큰".
4. From the web dashboard, click local settings.
   - Expected: button text changes to an opening/progress state.
   - Expected: settings window opens.
   - Expected: window is resizable/scrollable.
   - Expected: Save/Cancel/API guide controls are visible or reachable at a smaller window size.
5. Save fake placeholders only:
   - Naver ID: `test-user`
   - Naver password: `Ascii123!`
   - API fields: fake strings that cannot be real keys, such as `fake-gemini-key`
6. Reopen settings.
   - Expected: no crash.
   - Expected: local settings readiness updates.

### E. Songi No-Paid Packaging Checks

Use the final Songi no-paid verification script from the rebuilt Windows workspace if present.

Pass criteria:

- Songi runtime files exist under packaged `oracle\aimax-reports-api`.
- `yt-dlp.exe`, `ffmpeg.exe`, `ffprobe.exe` exist under the packaged media-tools path.
- `bundle` has Songi access.
- `blog_team` does not have Songi access.
- Gemini/Apify calls without `confirm_paid` return `402 research_paid_confirmation_required`.
- Sensitive/signed URL probes are redacted.

## Return Files

Write results back to:

```text
C:\Users\likim\Documents\shared-bridge\20_Deploy-To-Windows\2026-05-21-postdeploy-report-regression
```

Required return file:

```text
WINDOWS_COMPLETION_20260521_postdeploy_report_regression.md
```

Include:

- artifact SHA
- public version API results
- source/build regression command outputs
- frozen diagnostics result
- interactive no-paid UX result
- Songi no-paid packaging result
- pass/fail per reported error case
- blockers, if any

## Safety

- No paid AI call.
- No Apify Actor run.
- No real Naver publish/save/draft.
- No customer data or customer account use.
- No secrets in Syncthing.
