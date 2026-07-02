# Windows Handoff — R3-C Post-Deploy Install Check

Date: 2026-05-25

## Purpose

Verify the deployed Windows bundle installer `v1.0.18` from the user/update perspective before Mac/server enables R3-C `ready_for_publish` claim.

This is a post-deploy verification task. Do not change source code unless a real blocker is found.

## Context

R3-C deployment completed:

- macOS bundle: `v1.0.11`
- Windows bundle: `v1.0.18`
- Public version API now requires:
  - macOS `v1.0.11`
  - Windows `v1.0.18`
- R3-C flags remain off:
  - `AIMAX_YERI_READY_FOR_PUBLISH_CLAIM_ENABLED`
  - `AIMAX_YERI_SERVER_GENERATION_ENABLED`

Deployment report:

```text
docs/deployments/oracle-deploy-20260525-r3c-v111-v118-installers.md
```

## Windows Task

1. Use the deployed/returned `aimax-bundle-windows.exe` installer.
2. Install/update AIMAX in the Windows environment.
3. Run diagnostics probe against the installed app, not only the build folder.
4. Verify the public version API:
   - `platform=windows&current=v1.0.17` should require update.
   - `platform=windows&current=v1.0.18` should not require update.
5. Launch the installed runner if safe in that environment.
6. If a non-customer test account is already available in the Windows environment, check agent connection status after install.
7. Do not use customer credentials and do not run Naver save/publish.

## Verification Commands

Adjust installed path if Windows installed elsewhere.

```powershell
Get-FileHash .\aimax-bundle-windows.exe -Algorithm SHA256

curl.exe -fsS "https://api.aimax.ai.kr/api/version?platform=windows&current=v1.0.17"
curl.exe -fsS "https://api.aimax.ai.kr/api/version?platform=windows&current=v1.0.18"
curl.exe -fsS "https://api.aimax.ai.kr/api/reports/health"

& "$env:LOCALAPPDATA\Programs\AIMAX\AIMAX.exe" --diagnostics-probe "$env:TEMP\aimax_r3c_v118_installed_diag.json"
```

Expected:

```text
installer sha256 = F4730BFA12FEFD448C35E4FE66F7146110F3991DB3DC79B792EB3BBD9F5C143E
v1.0.17 -> update_required=true
v1.0.18 -> update_required=false
health ok=true
diagnostics system.app.version=v1.0.18
diagnostics system.runtime.frozen=true
diagnostics ai_text_import_smoke.ok=true
```

Optional safe launch check:

```powershell
Start-Process "$env:LOCALAPPDATA\Programs\AIMAX\aimax-agent-launcher.exe"
```

Then, if no customer credentials are used:

- Open the web app with a test account only.
- Confirm the update-required banner disappears after v1.0.18 runner connects.
- Confirm no job execution, no Naver login, and no paid provider call is triggered.

## No-Paid / No-Mutation Rules

- Do not run real Gemini/OpenAI/Claude/Apify calls.
- Do not run Naver login, save, publish, scheduled publish, or browser automation.
- Do not use customer credentials.
- Do not include API keys, cookies, `.env`, browser profiles, signed URLs, or private logs in Syncthing.

## Return Files

Return to:

```text
20_Deploy-To-Windows\2026-05-25-r3c-windows-post-deploy-install-check
```

Required:

```text
WINDOWS_RESULT_20260525_r3c_windows_post_deploy_install_check.md
aimax_r3c_v118_installed_diag.json
```

Report must include:

- verdict: `pass`, `blocked`, or `fail`
- installed app path
- installer SHA256
- public version API outputs
- diagnostics summary
- whether runner launch/agent connection was checked
- whether any customer credential, paid API, or Naver mutation was avoided

