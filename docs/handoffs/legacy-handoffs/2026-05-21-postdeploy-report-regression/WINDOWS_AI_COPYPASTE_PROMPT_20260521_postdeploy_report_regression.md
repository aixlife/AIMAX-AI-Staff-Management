Read first:

`WINDOWS_HANDOFF_20260521_postdeploy_report_regression.md`

Goal:

Verify whether the deployed Windows `v1.0.14` installer actually resolves the reported customer errors. This is a post-deploy regression check, not a rebuild request.

Rules:

- Work in a local Windows folder, not inside Syncthing.
- Use the canonical installer:
  `C:\Users\likim\Documents\shared-bridge\20_Deploy-To-Windows\2026-05-21-v114-local-settings-ux\aimax-bundle-windows.exe`
- Expected SHA256:
  `B30183FAE963F861FBE876AB5BE4E120192C015663736404801F06FCF595FA5B`
- Do not use customer accounts, raw logs, `.env`, API keys, cookies, browser profiles, signed URLs, or private data.
- Do not run paid Gemini/OpenAI/Claude calls.
- Do not run Apify Actor calls.
- Do not run real Naver publish/save/draft.

Run:

```powershell
$installer = "C:\Users\likim\Documents\shared-bridge\20_Deploy-To-Windows\2026-05-21-v114-local-settings-ux\aimax-bundle-windows.exe"
Get-FileHash -Algorithm SHA256 -LiteralPath $installer

Invoke-RestMethod "https://api.aimax.ai.kr/api/version?current=v1.0.13&platform=windows" |
  ConvertTo-Json -Depth 5
Invoke-RestMethod "https://api.aimax.ai.kr/api/version?current=v1.0.14&platform=windows" |
  ConvertTo-Json -Depth 5

python -m py_compile web_agent\client.py app.py split_version\app.py local_agent\runtime.py posting\editor.py scripts\verify_editor_image_provider_contract.py verify_v113_login_ime_guard.py verify_v114_local_settings_ux.py
python scripts\verify_editor_image_provider_contract.py
python verify_v110_no_paid_editor_smoke.py
python verify_v113_login_ime_guard.py
python verify_v114_local_settings_ux.py
```

After installing the exact v1.0.14 installer locally, run:

```powershell
$probe = "$env:TEMP\aimax-v114-postdeploy-diagnostics.json"
if (Test-Path -LiteralPath $probe) { Remove-Item -LiteralPath $probe -Force }
$exe = "C:\Program Files\AIMAX\AIMAX.exe"
if (!(Test-Path -LiteralPath $exe)) { $exe = "$env:LOCALAPPDATA\Programs\AIMAX\AIMAX.exe" }
$p = Start-Process -FilePath $exe -ArgumentList @("--diagnostics-probe", $probe) -Wait -PassThru -WindowStyle Hidden
"ExitCode=$($p.ExitCode)"
Get-Content -LiteralPath $probe -Raw
```

Then do one interactive no-paid UX pass with a synthetic/test AIMAX account only:

1. Type a Hangul password in the AIMAX web-login connection dialog and confirm local Korean validation blocks it before HTTP login.
2. Type an ASCII test password and confirm the login path does not fail with "안전 저장소에 세션 토큰".
3. From the web dashboard, click local settings and confirm opening feedback, window opens, resizable/scrollable behavior, and save buttons/API guide remain visible or reachable.
4. Save fake placeholder values only, reopen settings, and confirm no crash/readiness regression.
5. If a test account is unavailable, stop and return `BLOCKED: test account unavailable`.

For Songi, rerun the final no-paid packaging verification if the script is available in the rebuilt Windows workspace. Confirm bundle access, blog_team denial, media tools, paid-confirmation guards, and signed URL redaction. No paid calls.

Return:

`C:\Users\likim\Documents\shared-bridge\20_Deploy-To-Windows\2026-05-21-postdeploy-report-regression\WINDOWS_COMPLETION_20260521_postdeploy_report_regression.md`

The report must include pass/fail per original report category:

- Smart Editor `image_provider` input contract
- Local Agent web login/safe storage
- Hangul/IME password guard
- Local security settings UX/key persistence
- Songi packaging/no-paid guards

