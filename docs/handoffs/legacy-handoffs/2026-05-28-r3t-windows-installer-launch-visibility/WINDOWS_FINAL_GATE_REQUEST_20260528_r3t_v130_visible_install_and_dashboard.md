# Windows Final Gate Request: R3-T v1.0.30 Visible Install And Dashboard Check

## Current Status

R3-T rework returned a rebuilt Windows installer:

- Version: `v1.0.30`
- Installer: `aimax-bundle-windows.exe`
- SHA256: `B1176A2A962CE34C36F7FC8BAE57E6C22F578C61DCBE99D247AC8CC719716EC1`

This fixes the prior launcher visibility path in code and confirms an installed launcher can open a visible `AIMAX 실행기 연결됨` dialog.

However, this is **not yet deploy-ready** because the final user-visible gate is incomplete.

## Remaining Blockers

1. The final `v1.0.30` install was verified with `/SILENT`, not normal visible wizard mode.
2. The result does not show a real normal installer window appearing within 30 seconds for `v1.0.30`.
3. The result does not provide visible progress/completion evidence for the normal installer wizard.
4. Production dashboard/settings heartbeat was not verified because Windows Chrome automation failed.

## Required Final Gate

Use the returned `v1.0.30` installer unless you explicitly need a rebuild.

Do not run paid AI generation. Do not publish/schedule/edit/save to Naver. Do not use customer credentials. Do not deploy live. Do not change Oracle version API.

## Required Steps

### 1. Normal visible install

Run the installer normally, not silent:

```powershell
.\aimax-bundle-windows.exe /LOG="$env:TEMP\aimax-r3t-v130-normal.log"
```

Verify and return evidence:

- Setup window appears within 30 seconds.
- Visible text confirms AIMAX install start/progress/completion.
- `/LOG` file is created and has a successful install summary.
- No hidden/titleless setup process remains after completion.
- `aimax://` protocol is registered.
- Uninstall entry shows `AIMAX 1.0.30`, or LocalAppData/per-user representation is clearly explained.

Evidence can be:
- screenshot path(s), or
- exact visible window title/text plus process/window timing data.

### 2. Final launcher checkbox / connect visibility

Keep the final run-launcher checkbox checked or manually run:

```powershell
aimax://agent/connect
```

Verify:

- Visible `AIMAX 실행기 연결됨` dialog appears.
- Launcher diagnostics show `v1.0.30`.
- No raw `aimax://` URL or secrets are written to diagnostics.

### 3. Production web UI runner status

Open production web UI with the approved test/admin session only.

Verify:

- Dashboard/settings detects the installed Windows runner.
- Runner version is `v1.0.30`.
- `update_required=false`.
- `aimax://agent/connect` and `aimax://agent/open-settings` reach current runtime or show clear visible guidance.

Do not start a paid job.

## Return Files

Return:

- `WINDOWS_RESULT_20260528_r3t_v130_final_visible_gate.md`
- `aimax_r3t_v130_final_visible_gate_diag.json`

If blocked, return:

- exact blocker
- whether the existing `v1.0.30` installer can be reused
- whether a rebuild is needed
- whether the issue can be resumed without another install attempt

## Pass Rule

Only mark pass if all three gates pass:

1. Normal visible installer wizard
2. Visible launcher/connect dialog
3. Production dashboard/settings runner current status
