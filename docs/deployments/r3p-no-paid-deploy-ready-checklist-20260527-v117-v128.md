# AIMAX R3-P No-Paid Deploy-Ready Checklist

Date: 2026-05-27 KST

## Status

R3-P is no-paid deploy-ready, pending owner approval for the next gated step.

Do not live deploy yet. Do not change Oracle version API yet. Do not run the next paid visible-browser test without explicit approval.

## Candidate Installers

- macOS staged installer: `dist/upload_installers/aimax-bundle-macos.dmg`
- Windows staged installer: `dist/upload_installers/aimax-bundle-windows.exe`
- Windows version: `v1.0.28`
- Windows SHA256: `c0d95b51750c6994417d859eb864a65b600e66ec5ccf459644866cd8f3a2de54`

Previous Windows staged installer archived:

- `dist/upload_installers/archive-windows-20260527-pre-v128-r3p-runner-start-watchdog/aimax-bundle-windows.exe`

## Windows R3-P Evidence

Returned from:

- `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-27-r3p-runner-start-watchdog/`

Files:

- `WINDOWS_RESULT_20260527_r3p_runner_start_watchdog.md`
- `aimax_r3p_v128_runner_start_watchdog_diag.json`
- `aimax-bundle-windows.exe`
- `NEXT_TRIGGER_20260527_r3p_runner_start_watchdog.json`

Pass evidence:

- Windows version `v1.0.28`
- runner-start timeout smoke passed
- delivered-but-not-started job fails with `runner_start_timeout`
- genuinely started job is not falsely timed out
- installed runner sends claim ACK and start update evidence
- frozen runtime true
- `ai_text_import_smoke.ok=true`
- `browser_version_detection.ok=true`
- no DeleteFile code 5 / access denied
- protocol connect/open-settings reaches v1.0.28
- update recognition reports current v1.0.28 with `update_required=false`
- local settings save/open-settings still passes
- legacy AppData self-heal still passes
- visible production UI readiness passed without job submission
- no paid AI, Apify, Naver mutation, customer credentials, live deploy, Oracle version API change, or duplicate paid retry

## Current Known Gate

The prior Windows R3-O paid test exposed a real issue:

- job id: `9f282e93-7ca7-402b-8965-85c95ea14b52`
- issue: job delivered to runner, but no start/done/failed update
- current state: safely cancelled by Mac-side triage
- duplicate paid retry: not performed

R3-P specifically fixes this no-paid failure mode. The next step is one explicitly approved paid visible-browser test, not automatic deployment.

## Required Next Gate

Before any live deploy or Oracle version API update:

1. Confirm owner approval for the paid visible-browser test scope in `docs/deployments/r3p-paid-visible-browser-test-approval-request-20260527.md`.
2. Run exactly one paid Windows visible-browser test if approved.
3. Verify final status reaches `done` and Naver draft save completes.
4. Preserve evidence without secrets.
5. Only then prepare the live deploy/version API change.

## Rollback Notes

No live deployment was performed during R3-P processing.

If deployment is later approved, keep the previous live Oracle installer/version env backup before upload and API version changes.

