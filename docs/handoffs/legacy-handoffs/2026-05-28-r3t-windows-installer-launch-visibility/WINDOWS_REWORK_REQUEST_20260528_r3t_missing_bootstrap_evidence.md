# Windows Rework Request: R3-T Missing Bootstrap Evidence

## Verdict

Current R3-T result is **blocked for release/deploy readiness**.

The returned `v1.0.29` artifact exists and launcher visibility work appears partially implemented, but the result does not satisfy the required evidence for the actual user incident.

## Why Blocked

The real incident was:
- `aimax-bundle-windows.exe /LOG=...` produced no log file.
- No installer window appeared.
- The process stayed in the background for 45+ seconds.
- No `aimax://` protocol registration happened.
- No installed-app entry appeared.

The returned result verifies:
- Inno compile succeeded.
- Silent install succeeded.
- registry/protocol exists after silent install.
- launcher smoke cases passed.

But it does **not** provide enough evidence for:

1. Affected `v1.0.28` file triage
- Missing evidence:
  - downloaded/affected v1.0.28 SHA256 checked against `c0d95b51750c6994417d859eb864a65b600e66ec5ccf459644866cd8f3a2de54`
  - `Get-AuthenticodeSignature` output
  - `Zone.Identifier` stream state
  - SmartScreen/security UI status

2. Normal visible installer path
- The result says normal wizard visibility was inferred from Inno script/messages and compile success.
- That is not enough.
- We need an actual normal, non-`/SILENT` launch on Windows with visible evidence.

3. Bootstrap `/LOG` hang reproduction or closure
- Missing evidence:
  - run `v1.0.29` with explicit `/LOG=...` in normal launch mode
  - confirm log file is created before/while wizard appears
  - confirm no titleless/hidden setup process remains
  - if no log appears, capture exact command, PID, elapsed time, signature, Zone.Identifier, security UI state

4. Installed runner heartbeat
- The result reports installed files and registry, but does not provide evidence that production/staging dashboard/settings saw the installed runner heartbeat as current `v1.0.29` with `update_required=false`.

## Required Rework

Do not run paid AI generation. Do not deploy live. Do not change Oracle version API.

Return amended files:
- `WINDOWS_RESULT_20260528_r3t_installer_launch_visibility_REWORK.md`
- `aimax_r3t_v129_installer_launch_visibility_diag_REWORK.json`

Use the same `aimax-bundle-windows.exe` if no code rebuild is needed, or return a rebuilt installer and explain why.

## Minimum Evidence Needed

### A. Affected v1.0.28 triage

On the affected or equivalent downloaded `v1.0.28` installer, capture:

```powershell
Get-FileHash .\aimax-bundle-windows.exe -Algorithm SHA256
Get-AuthenticodeSignature .\aimax-bundle-windows.exe | Format-List *
Get-Item .\aimax-bundle-windows.exe -Stream *
```

Report:
- hash match/mismatch against `c0d95b51750c6994417d859eb864a65b600e66ec5ccf459644866cd8f3a2de54`
- signature status
- Zone.Identifier present/absent
- SmartScreen/security UI shown or not shown

### B. v1.0.29 normal visible install

Run the new installer normally, not silent:

```powershell
.\aimax-bundle-windows.exe /LOG="$env:TEMP\aimax-r3t-v129-normal.log"
```

Confirm:
- setup window appears within 30 seconds
- progress/completion text is visible
- `/LOG` file is created
- no titleless/hidden setup process remains after completion
- `aimax://` protocol is registered
- uninstall entry shows `AIMAX 1.0.29`

Return sanitized visible evidence:
- screenshot path(s) or exact visible window title/text
- sanitized log summary

### C. v1.0.29 runner current heartbeat

After install, open the web UI and confirm:
- dashboard/settings detects installed runner
- version is `v1.0.29`
- `update_required=false`
- `aimax://agent/connect` and `aimax://agent/open-settings` reach current runtime or show the new visible guidance

### D. Launcher visibility

Keep existing launcher smoke evidence, but add whether MessageBox text was actually visible for:
- already running
- core missing
- quick exit

## Pass/Blocked Rule

If all evidence above is present and clean, mark `pass`.

If normal `/LOG` still creates no file or setup remains hidden/titleless, mark `blocked` and include:
- exact command
- PID/process name
- elapsed time
- file SHA256
- Authenticode status
- Zone.Identifier state
- security UI state
- whether this can be resumed without another rebuild
