# Windows Handoff - v1.0.40 Post-Deploy Verification

Date: 2026-06-02 KST
From: Mac/Oracle Codex
To: Windows AI developer

## Context

Windows runner `v1.0.40` has now been uploaded to Oracle production and activated in the version API.

Production Oracle changes completed:

- `/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe`
  - SHA256: `fe4e51537f8df34876b896d8cdbb12ff64c91f60f7ccce739f4d698b64214427`
  - Size: `35,677,124` bytes
- `AIMAX_WINDOWS_LATEST_AGENT_VERSION=v1.0.40`
- `AIMAX_WINDOWS_MIN_AGENT_VERSION=v1.0.40`
- Release notes: `Windows 실행기 v1.0.40 업데이트입니다. runner_start_timeout 진단을 강화하고 작업 시작 단계 보고를 보강했습니다.`
- Server sanitizer now preserves active job stage diagnostics.

Mac-side verification already passed:

- Health API ok.
- Internal and public version API:
  - `current=v1.0.39` -> `latest/min=v1.0.40`, `update_required=true`
  - `current=v1.0.40` -> `latest/min=v1.0.40`, `update_required=false`
- Remote installer SHA matches the Windows build artifact.

## Required Windows post-deploy checks

Run from Windows, using the installed-user path where possible.

1. Verify production version API:
   - `https://api.aimax.ai.kr/api/version?current=v1.0.39&platform=windows`
   - Expect `latest_version=v1.0.40`, `min_version=v1.0.40`, `update_required=true`.
2. Verify production version API:
   - `https://api.aimax.ai.kr/api/version?current=v1.0.40&platform=windows`
   - Expect `update_required=false`.
3. From the production web UI, confirm the update/download flow offers the v1.0.40 Windows bundle.
4. Download the production Windows bundle if the UI exposes the download path.
5. Confirm downloaded file SHA256 equals:
   - `FE4E51537F8DF34876B896D8CDBB12FF64C91F60F7CCCE739F4D698B64214427`
6. Launch/connect the installed Windows runner.
7. Confirm the production web UI or API sees:
   - connected Windows runner
   - version `v1.0.40`
   - no required update prompt for `v1.0.40`
8. If a safe no-paid/fake/local job path is available, confirm stage diagnostics include:
   - `claimed`
   - `queued_to_ui`
   - `worker_thread_started`
   - `worker_running`

If no installed fake/local job path is available, report that clearly. Do not run a real paid Yeri content-generation job without explicit owner approval.

## Safety

Do not run:

- paid AI generation
- Apify
- YouTube Data API
- Naver publish/schedule/edit/save
- customer credentials
- duplicate paid retries

Keep secrets, cookies, keychains, `.env`, signed URLs, and session files out of Syncthing.

## Return file

Write back:

- `WINDOWS_RESULT_20260602_v1040_postdeploy_verify.md`

Include screenshots or visible text evidence when possible, plus command output summaries and any blockers.

Do not mark report `AIMAX-RPT-20260601143313-9085ebda` complete until this post-deploy verification passes.
