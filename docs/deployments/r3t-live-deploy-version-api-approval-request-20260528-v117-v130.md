# AIMAX R3-T Live Deploy / Version API Approval Request

Date: 2026-05-28 KST

## Request

Owner approval is required before any live deployment or Oracle version API change.

Recommended approval:

- upload staged Windows installer `dist/upload_installers/aimax-bundle-windows.exe`
- publish Windows candidate version `v1.0.30`
- set Windows latest version to `v1.0.30`
- set Windows minimum version to `v1.0.30` unless the owner wants a softer rollout
- keep macOS unchanged at the current release line
- run post-deploy no-paid verification only

## Candidate

- Windows staged installer: `dist/upload_installers/aimax-bundle-windows.exe`
- Windows candidate version: `v1.0.30`
- Windows SHA256: `b1176a2a962ce34c36f7fc8bae57e6c22f578c61dcbe99d247ac8cc719716ec1`
- prior staged Windows installer archived at: `dist/upload_installers/archive-windows-20260528-pre-v130-r3t-installer-launch-visibility/aimax-bundle-windows.exe`

## Evidence Basis

See:

- `docs/deployments/r3t-no-paid-deploy-ready-checklist-20260528-v117-v130.md`
- `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-28-r3t-windows-installer-launch-visibility/WINDOWS_RESULT_20260528_r3t_v130_active_connection_RECHECK.md`
- `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-28-r3t-windows-installer-launch-visibility/aimax_r3t_v130_active_connection_recheck_diag.json`

The recheck confirmed visible installer progress/completion, installed app/protocol registration, visible launcher/open-settings behavior, active production UI connection, `v1.0.30`, and `update_required=false`, with no paid or live mutations.

## Explicit Non-Approval

Until the owner approves, do not:

- upload installers to Oracle
- change Oracle version API/env metadata
- restart production services for rollout
- run paid generation
- submit jobs
- mutate Naver drafts/posts/schedules
- use Apify
- test with customer credentials
- perform duplicate paid retries

## Post-Approval Checklist

1. Back up current Oracle `.env`/version metadata and current remote Windows installer.
2. Upload staged Windows `v1.0.30` installer.
3. Verify remote SHA256 equals `b1176a2a962ce34c36f7fc8bae57e6c22f578c61dcbe99d247ac8cc719716ec1`.
4. Update Windows latest/minimum version metadata as approved.
5. Restart only the required production service.
6. Verify `/api/version` for Windows old/current combinations.
7. Verify installer download URL returns the new Windows installer and expected hash.
8. Open production web UI and confirm update/current state is coherent.
9. Do not run paid jobs during post-deploy verification unless separately approved.

