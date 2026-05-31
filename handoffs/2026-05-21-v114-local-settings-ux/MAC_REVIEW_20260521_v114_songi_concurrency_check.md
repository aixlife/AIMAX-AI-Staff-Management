# Mac Review - Windows v1.0.14 + Songi Concurrency Check

Date: 2026-05-21 KST

## Verdict

`OK with documentation cleanup`

The Windows v1.0.14 local-settings UX build and the Songi Windows rebuild/release check appear to have converged to the same final installer SHA:

`B30183FAE963F861FBE876AB5BE4E120192C015663736404801F06FCF595FA5B`

This means the two parallel efforts did not obviously produce competing Windows installers.

## What Was Checked

- `2026-05-21-v114-local-settings-ux/WINDOWS_COMPLETION_20260521_v114_local_settings_ux.md`
- `2026-05-21-v114-local-settings-ux/SHA256SUMS.txt`
- `2026-05-21-songi-windows-release-check/WINDOWS_AI_STATUS_20260521_songi_release_check.md`
- `2026-05-21-songi-windows-release-check/WINDOWS_AI_STATUS_20260521_songi_rebuild_release.md`
- Returned installer hash in `2026-05-21-v114-local-settings-ux/aimax-bundle-windows.exe`

## Good Signals

- v1.0.14 installer version is confirmed.
- Frozen diagnostics reports `v1.0.14`.
- v1.0.13 login IME guard was preserved.
- v1.0.14 local settings UX/key persistence no-secret smoke passed.
- Editor/image-provider contract checks passed.
- Songi rebuilt package includes:
  - `oracle/aimax-reports-api`
  - `yt-dlp.exe`
  - `ffmpeg.exe`
  - `ffprobe.exe`
  - `blog_team` / `블로그팀` / `전체 통합`
  - `research_paid_operation_in_progress`
  - `research_gemini_high_demand`
  - `REDACTED_SENSITIVE_URL`
- Songi no-paid backend checks passed.
- Songi paid-call guard checks returned confirmation-required responses.
- Sensitive/signed media URL redaction passed in the final Songi rebuild check.
- No paid AI, Apify, or Naver publish/save/draft test was reported.

## Remaining Operational Risk

The final installer artifact exists in:

`20_Deploy-To-Windows\2026-05-21-v114-local-settings-ux\aimax-bundle-windows.exe`

The Songi release-check folder does not contain a returned `aimax-bundle-windows.exe`; it only contains the Songi source/media input zips and reports.

Because both reports reference the same final SHA, this is not a code conflict, but it is a deployment-selection risk. A deployer could look in the Songi folder and think the release artifact is missing, or accidentally deploy an older installer from another folder.

## Message To Windows Developer

Please treat this as a final packaging/return cleanup, not a rebuild request unless your local artifact differs.

1. Confirm that the final canonical Windows installer is:

   `20_Deploy-To-Windows\2026-05-21-v114-local-settings-ux\aimax-bundle-windows.exe`

2. Confirm its SHA256 is:

   `B30183FAE963F861FBE876AB5BE4E120192C015663736404801F06FCF595FA5B`

3. Add a short note or copy of the SHA into the Songi release-check folder saying:

   `Songi OK-to-release result uses the same v1.0.14 installer returned in 2026-05-21-v114-local-settings-ux.`

4. If possible, copy the final installer into the Songi release-check folder too, or add a tiny `FINAL_ARTIFACT_POINTER_20260521.md` that points to the v114 folder.

5. Do not rebuild unless the SHA differs. If you do rebuild, rerun both:

   - `python verify_v114_local_settings_ux.py`
   - the final Songi no-paid verification script

6. Keep the same safety boundaries:

   - no paid AI calls
   - no Apify Actor run
   - no real Naver publish/save/draft
   - no secrets or private logs in Syncthing

## Deploy Recommendation

Deploy only the single canonical Windows v1.0.14 installer with SHA:

`B30183FAE963F861FBE876AB5BE4E120192C015663736404801F06FCF595FA5B`

Do not deploy the older v1.0.13 installer:

`BB2510CBB994EEF03EE000E17DD0A678094C02DEC4228E7A351CB634F5B68B38`

