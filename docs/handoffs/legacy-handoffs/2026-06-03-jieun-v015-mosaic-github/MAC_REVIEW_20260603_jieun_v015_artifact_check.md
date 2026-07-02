# Mac Review - Jieun Mosaic v0.1.5 Artifact Check

## Source Folder

`/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-06-03-jieun-mosaic-v015-windows-build`

## Returned Files

- `AIMAX-Office-Manager-Setup-0.1.5.exe`
- `AIMAX-Office-Manager-portable.exe`
- `SHA256SUMS.txt`
- `WINDOWS_AI_STATUS_20260603_jieun_mosaic_v015_build.md`

## Mac SHA256 Recheck

| File | Size | SHA256 |
|---|---:|---|
| `AIMAX-Office-Manager-Setup-0.1.5.exe` | `161146954` | `e13a7ef23ccfe220651fb50beab24c78c221b13696c76c3787d7fd40a7c7070a` |
| `AIMAX-Office-Manager-portable.exe` | `160869288` | `43fcc04e8526327af81e64284fd67a0d8b441e339146b76e66c6b26e5b34f7d8` |

The hashes match the Windows `SHA256SUMS.txt` report.

## GitHub PR

- PR: https://github.com/aixlife/aimax-viseo/pull/2
- Branch: `feature/jieun-mosaic-editor-v015`
- State: open
- Mergeable: true
- Changed files: 11
- Summary: capture editor window, draggable mosaic regions, edited-copy save/copy, unsaved-close confirmation, version bump to `0.1.5`.

## Current Release Gate

Not ready for Oracle/customer-facing rollout yet.

Reason: the Windows report says the smoke test used the `v0.1.5 unpacked app`. AIMAX pre-deploy rules require an installed-user-path check before a customer-facing installer rollout.

## Requested Final Windows Check

PR comment added requesting:

1. Install `AIMAX-Office-Manager-Setup-0.1.5.exe` on Windows.
2. Launch the installed app from Start menu or desktop shortcut.
3. Run capture -> editor opens -> drag mosaic region -> save edited PNG.
4. Confirm original capture is not overwritten by default.
5. Return screenshot/visible status evidence, Windows version, installed app version, saved file path pattern, and blockers if any.

## Oracle Follow-Up After Gate

After the installed-user-path check passes:

1. Copy the two EXEs to `dist/upload_installers/`.
2. Update Jieun URLs/version from `0.1.4` to `0.1.5` in AIMAX web/catalog scripts.
3. Run syntax and worker catalog checks.
4. Deploy external staff files and web catalog to Oracle.
5. Verify public `/downloads/` URLs, `/api/workers`, app employee card, and admin catalog.
