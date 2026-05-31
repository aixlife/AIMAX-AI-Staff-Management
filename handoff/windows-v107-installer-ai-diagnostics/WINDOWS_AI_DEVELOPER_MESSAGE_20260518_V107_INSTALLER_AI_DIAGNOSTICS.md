# AIMAX Windows v1.0.7 Follow-Up: Installer Lock, Local Timeout, AI Error Diagnostics

Date: 2026-05-18
Owner: Windows AI developer
Shared folder target:
`/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/AIMAX-20260518-windows-v107-installer-ai-diagnostics/`

## Context

Windows `v1.0.6` was deployed to Oracle as a required Windows update. The unified launcher guard is working for the completed evidence set, and public downloads now point to the returned `v1.0.6` installers.

After deployment, four fresh Windows `v1.0.6` error reports arrived from one bundle account:

- `AIMAX-RPT-20260518071933-5e3b43e6`: installer/update failed with `deletefile 실패: 코드 5, 액세스가 거부되었습니다`
- `AIMAX-RPT-20260518072529-c4524800`: Yeri blog writing failed at `content_generation`, usage/cost recorded as zero
- `AIMAX-RPT-20260518072833-17cb362a`: local job failed at `naver_login` with `HTTPConnectionPool(host='localhost', port=8669): Read timed out. (read timeout=120)`
- `AIMAX-RPT-20260518072852-330b6ff3`: same Yeri `content_generation` failure pattern, usage/cost recorded as zero

Mac/server work already completed:

- Oracle web app now includes `system.agent.diagnostics` in user error reports.
- Oracle web app now includes compact `system.jobs_recent[]` diagnostics: job id, kind, status, last log, result stage, failed keyword, error, usage, cost, image counters.
- The four reports above were updated with user-facing status messages.

## Source Baseline

Use one of these, in this order:

1. Your completed local Windows `v1.0.6` work folder, if still intact.
2. Otherwise restore `aimax-unified-launcher-guard-source-20260518.zip`, then apply `windows-source-delta-20260518-unified-launcher-guard-v106.patch` from the previous handoff folder before starting this v1.0.7 task.

Do not build inside the Syncthing shared folder. Copy source to a local Windows work folder first.

## Phase 1: Installer File-Lock Guard

Problem:

- A user attempted to install/update while AIMAX was still running.
- Inno failed replacing an existing file with `deletefile 실패: 코드 5` / access denied.

Required behavior:

- The installer should detect/close currently running AIMAX processes before file replacement where safe.
- If automatic close is not possible, show a clear Korean message telling the user exactly which process/window must be closed.
- The installer must not leave the user with a vague `deletefile 코드 5` failure.

Implementation guidance:

- Use Inno Setup app-closing features where appropriate, and add explicit checks for AIMAX processes if needed.
- Cover at least these executable names:
  - `AIMAX.exe`
  - `aimax-agent-launcher.exe`
  - split/bundle renamed launchers if the final build uses product-specific executable names
- Keep `PrivilegesRequired=lowest` unless there is a proven need to change it.
- Do not kill unrelated browser processes.
- Do not require admin rights unless absolutely necessary.

Verification:

- Start AIMAX, keep it running, then run the new installer over the existing install.
- Confirm no `deletefile 코드 5` appears.
- Confirm either AIMAX closes gracefully or the Korean close-app prompt is clear.
- Confirm post-install launch still works.

## Phase 2: Local `localhost:8669` Timeout Handling

Problem:

- A Yeri write job failed at `naver_login` after the local executor stopped responding:
  `HTTPConnectionPool(host='localhost', port=8669): Read timed out. (read timeout=120)`

Required behavior:

- If local executor/API port `8669` times out, surface a clear actionable error.
- Do not leave jobs stuck as indefinitely `busy`/`running`.
- Prefer a bounded recovery path: health check, restart local executor if safe, then fail with a clear message if still unhealthy.
- Include the stage (`naver_login`, etc.) and local endpoint timeout in job result.

Verification:

- Mock or simulate local executor timeout.
- Confirm job result includes stage and actionable timeout message.
- Confirm the web app receives a failed job/result instead of a vague hang.
- Confirm the next job can run after restart/reconnect.

## Phase 3: AI Content Generation Error Detail

Problem:

- `content_generation` failures currently collapse to `글 생성 실패: <keyword>`.
- Server job result recorded token usage/cost as zero, but the actual provider/model error is hidden.
- This makes the user and operator unable to tell whether the cause is invalid model, quota, API key, network, provider rejection, or empty model output.

Required behavior:

- When text generation fails, include sanitized provider/model/error details in local logs and job result.
- For OpenAI Responses API failures, capture:
  - provider: `openai`
  - model id
  - HTTP status code
  - sanitized API error message/type/code if available
  - request id header if available
  - usage/cost if the provider returns usage
- For Gemini/Claude failures, capture equivalent sanitized details where available.
- Do not expose API keys, auth headers, cookies, raw prompts, or signed media URLs.
- Do not automatically retry paid generation after a submitted paid request unless the provider response is clearly no-charge/transient and the existing retry policy already allows it.
- If a paid provider may have accepted a request, preserve request/result identifiers so the result can be recovered without duplicate submission.

Implementation guidance:

- `content/ai_text.py` already has `AiGenerationError` and `AiQuotaError` classes. Use these or equivalent structured exceptions instead of returning `None, {}` with only a log line.
- Update the write worker so `failed_posts[].error`, top-level `result.error`, and local logs include the sanitized provider/model reason.
- Keep usage/cost accounting intact. If no tokens were used, report zero; if usage is returned, report it.

Verification:

- Use mocked/stubbed provider responses. Do not run real paid generation.
- Test OpenAI HTTP 400 invalid model/key style response.
- Test OpenAI HTTP 429 quota/rate-limit response.
- Test empty provider output.
- Test Gemini/Claude exception paths.
- Confirm job result gives enough information to diagnose without opening local raw logs.

## Phase 4: Version, Build, and Return Artifacts

Version target:

- Runtime `APP_VERSION=v1.0.7`
- Inno `AppVersion=1.0.7`
- Windows version API will be updated by Mac/server side only after returned artifacts are verified.

Build artifacts to return:

- `aimax-bundle-windows.exe`
- `aimax-yeri-windows.exe`
- `aimax-hyunju-windows.exe`
- `SHA256SUMS.txt`
- completion report Markdown
- source delta patch from v1.0.6 to v1.0.7
- evidence JSON with the verification cases above

Return expectations:

- Put returned artifacts in this same Syncthing folder.
- Include SHA256 for every returned executable and patch/evidence file.
- State clearly whether any real paid AI call or real Naver publishing was run. Preferred answer: none; use mocks.

