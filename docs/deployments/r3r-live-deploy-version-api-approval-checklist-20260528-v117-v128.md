# AIMAX R3-R Live Deploy / Version API Approval Checklist

Date: 2026-05-28 KST

## Status

R3-Q paid actual user-flow gate passed with an image-provider caveat. This document is an approval checklist only.

Do not live deploy yet. Do not change the Oracle version API yet. Do not run another paid job unless the owner approves a new concrete scope.

## Candidate Installers

- macOS staged installer: `dist/upload_installers/aimax-bundle-macos.dmg`
- macOS candidate version: `v1.0.17`
- macOS SHA256: `b13a9eff47378af827fcb8c0d8207661d5ac06f4b75eebcefcab3eae2ae6db77`
- Windows staged installer: `dist/upload_installers/aimax-bundle-windows.exe`
- Windows candidate version: `v1.0.28`
- Windows SHA256: `c0d95b51750c6994417d859eb864a65b600e66ec5ccf459644866cd8f3a2de54`

## R3-Q Paid Actual Test Evidence

Returned from:

- `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-27-r3q-paid-visible-browser-test/`

Files:

- `WINDOWS_RESULT_20260527_r3q_paid_visible_browser_test.md`
- `aimax_r3q_v128_paid_visible_browser_test_diag.json`
- `NEXT_TRIGGER_20260527_r3q_paid_visible_browser_test.json`

Pass evidence:

- visible production UI was used at `https://api.aimax.ai.kr/app`
- account: `demo@aimax.ai.kr`
- installed Windows runner: `v1.0.28`
- selected flow: Yeri, `gemini-2.5-flash`, 800 chars, image 1, 임시 저장 only
- UI estimate before submit: 62 KRW, below the 500 KRW hard cap
- exactly one paid job was submitted
- job id: `59ce602e-a765-4f67-94a9-28023757a298`
- runner claim ACK, queue ACK, start update, and final completed update were captured
- final server status: `done`
- final runner stage: `completed`
- final metered cost: 137 KRW, below the 500 KRW cap
- Naver automatic login completed
- Smart Editor opened
- title/body/image inserted
- final draft-save path completed
- no `runner_start_timeout` or infinite running
- no duplicate paid retry, publish, schedule, customer credentials, Apify, live deploy, Oracle version API change, or secrets in shared evidence

## Caveat To Accept Before Deploy

Gemini text generation succeeded with `gemini-2.5-flash`, but Gemini image generation returned quota 429. The runner used its configured OpenAI image fallback, then generated/uploaded/inserted one image and stayed under the 500 KRW cap.

This is acceptable for deployment only if the owner accepts that production image generation may fallback when Gemini image quota is unavailable. If not acceptable, stop and add a stricter provider/cost UI notice before rollout.

The Windows runner did not observe the Naver draft-save confirmation message, but it clicked the save button, logged `임시 저장 완료`, and the server final status is `done`.

## Required Owner Approval

Before deployment, the owner should explicitly approve:

- upload staged macOS `v1.0.17` and Windows `v1.0.28` installers to Oracle
- update Oracle version API/env so macOS latest/min points to `v1.0.17` and Windows latest/min points to `v1.0.28`
- accept the R3-Q image-provider fallback caveat
- no customer credential testing or publish/schedule action during deployment verification

## Deployment Checklist After Approval

1. Back up current Oracle `.env` and remote installer files.
2. Upload staged macOS and Windows installers.
3. Verify remote SHA256 values match the local candidate hashes above.
4. Update Oracle version API/env for macOS `v1.0.17` and Windows `v1.0.28`.
5. Restart the Oracle AIMAX service.
6. Verify `/api/version` for macOS old/current and Windows old/current version combinations.
7. Verify download URLs return the new installers and expected hashes.
8. Open production web UI and confirm update/current state is coherent for the approved test account.
9. Do not run another paid generation during deployment verification unless separately approved.

## Rollback Notes

No live deployment was performed while preparing this checklist.

If deployment is approved, keep the pre-deploy Oracle `.env` backup and previous remote installers until post-deploy version checks and at least one no-paid web UI sanity check pass.
