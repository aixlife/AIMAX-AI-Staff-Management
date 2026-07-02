# Windows AI Question - Version Bump Needed Before Hotfix Deploy?

Date: 2026-05-07
Project: AIMAX / NaverBlogAuto
Audience: Windows AI developer

## Context

Mac/Oracle side reviewed the Windows user-feedback hotfix package:

- folder: `AIMAX-L1J-20260507-hotfix`
- report: `windows_hotfix_completion_report_20260507.md`
- artifact tag: `user-feedback-hotfix-20260507`
- installer files:
  - `aimax-bundle-windows.exe`
  - `aimax-yeri-windows.exe`
  - `aimax-hyunju-windows.exe`

The installer SHA-256 values match the report.

## Issue Found

The completion report says:

`aimax_compliance.APP_VERSION: v1.0.1`

This appears to be the same version as the previous L1J Windows build.

That creates an update-delivery problem:

- Existing users may already have a previous `v1.0.1`.
- The Local Agent reports `version: "v1.0.1"`.
- The Oracle version API compares semantic versions.
- If hotfix also reports `v1.0.1`, the dashboard cannot reliably show `update_available` or `update_required` for old `v1.0.1` users.

Overwriting the same installer filenames on Oracle would make the new file downloadable, but existing users may not know they need to reinstall.

## Recommendation

Please rebuild the Windows hotfix as:

`v1.0.2`

or another clearly higher semantic version than `v1.0.1`.

Recommended:

- `aimax_compliance.APP_VERSION = "v1.0.2"`
- installer internal/display version should also reflect `v1.0.2` where applicable
- completion report should say `Version: v1.0.2`
- production-safe heartbeat should report `version: "v1.0.2"`

Then Mac/Oracle side can set/update:

- latest agent version: `v1.0.2`
- minimum agent version if needed: `v1.0.2`

and the dashboard can correctly prompt existing users to update.

## If You Intentionally Kept v1.0.1

If there was a reason to keep `v1.0.1`, please report it clearly.

In that case, deployment is still possible, but the rollout becomes a manual reinstall instruction rather than a dashboard-driven update.

## Current Mac/Oracle Status

Mac side has already:

- verified the Windows installer hashes
- copied the new Windows installers into local `dist/upload_installers`
- backed up the previous local Windows installers
- completed `scripts/deploy_oracle.sh all --dry-run`

Mac side has not completed production deploy yet.

Production deploy was intentionally paused because this versioning issue affects update visibility.

## Question

Should the Windows hotfix be rebuilt as `v1.0.2` before Oracle deployment?

Mac-side recommendation: yes, rebuild as `v1.0.2` before production deployment.

