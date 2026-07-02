# Mac Review - Jieun v0.1.5 Dual Monitor Fix Artifact Check

## Source Folder

`/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-06-04-jieun-mosaic-v015-dual-monitor-fix`

## Returned Files

- `AIMAX-Office-Manager-Setup-0.1.5.exe`
- `AIMAX-Office-Manager-portable.exe`
- `SHA256SUMS.txt`
- `WINDOWS_AI_STATUS_20260604_jieun_v015_dual_monitor_fix.md`

## Mac SHA256 Recheck

| File | Size | SHA256 |
|---|---:|---|
| `AIMAX-Office-Manager-Setup-0.1.5.exe` | `161147243` | `790c25074cd9d29020868ff5e26e8fae6adad7b8f62dca5d6dc096b42b8ab40d` |
| `AIMAX-Office-Manager-portable.exe` | `160869590` | `6b045fb7d161fa3e3c564f56dddd84ff666f8bf9abf91d82e167d8ab63e6f581` |

The hashes match the returned `SHA256SUMS.txt`.

## Windows Report Summary

- Fix commit claimed: `bab7a57 Support multi-display capture targets`
- Build checks: `npm run build`, `npm run build:win` passed.
- Installed Setup EXE smoke on Windows single-display machine passed for primary monitor capture/mosaic and text capture.
- Remaining blocker in Windows report: physical secondary-monitor validation could not be completed because the machine exposed only `DISPLAY1`.

## GitHub Source Alignment Check

The dual-monitor fix exists when fetching files at commit `bab7a57`.

However, as of this Mac review:

- PR #2 is merged.
- Current `main` still shows `screen.getPrimaryDisplay()` / `sources[0]` in the capture path.
- PR #2 merged diff does not include the dual-monitor fix.

This means the returned EXE appears to have been built from a fix commit that is not currently aligned with the merged GitHub `main` source.

## Status

Do not deploy to Oracle yet.

## Required Gates Before Oracle

1. Push/merge the `bab7a57` dual-monitor source changes into `main`, or open/merge a follow-up PR with the exact source used for the rebuilt EXEs.
2. Run installed-app validation on a real dual-monitor Windows environment:
   - primary monitor capture -> editor -> mosaic -> save
   - secondary monitor capture -> editor -> mosaic -> save
   - secondary monitor text capture if supported
   - spanning-monitor selection should fail clearly or be documented
3. Return updated build artifacts if the source changes after validation.

## PR Comment

Comment added to `aixlife/aimax-viseo#2` on 2026-06-04 KST noting both blockers.
