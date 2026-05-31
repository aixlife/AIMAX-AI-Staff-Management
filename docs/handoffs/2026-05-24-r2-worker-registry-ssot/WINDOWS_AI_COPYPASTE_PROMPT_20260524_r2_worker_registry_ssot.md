Read first:

`WINDOWS_HANDOFF_20260524_r2_worker_registry_ssot.md`

Task:

Verify the live Oracle R2 worker registry/catalog deployment from the Windows environment. This is mainly a Windows web/runtime verification task, not a rebuild task unless you find a Windows-only local-agent problem.

Safety rules:

- Do not run paid AI calls.
- Do not run paid Apify calls.
- Do not run real Naver save/publish/scheduled publish tests.
- Do not place API keys, cookies, `.env`, browser profiles, signed URLs, or raw private logs in Syncthing/shared folders.
- Do not build inside the shared folder. If source inspection is needed, copy files to a local Windows work folder first.

Check:

1. Open `https://api.aimax.ai.kr/app` on Windows and log in with the available test/operator account.
2. Confirm Windows local runner v1.0.17 connection status.
3. Confirm the app does not hang in infinite loading after login, local settings open/save, or refresh.
4. Confirm visible worker behavior:
   - Yeri/Hyunju remain local-agent-required employees.
   - Songi is web-first/web-module research employee.
   - Yunmi, if the account has access, is web-module and not local-agent-required.
5. Confirm `/api/workers` catalog using the logged-in browser/session if possible:
   - `songi_research`: `execution=web_module`, `api_mode=research_api`, `queue=false`
   - `yeri_write`: `execution=local_agent`, `api_mode=job_api`, `queue=true`
   - `hyunju_find`: `execution=local_agent`, `api_mode=job_api`, `queue=true`
6. If safe and no paid/real job is triggered, confirm `songi_research` cannot be created through `/api/jobs`; expected error is `job_kind_uses_module_api`.

Return file:

`WINDOWS_RESULT_20260524_r2_worker_registry_ssot.md`

Return format:

```md
# Windows Result: R2 Worker Registry SSOT

## Verdict
PASS / FAIL / BLOCKED

## Environment
- Windows version:
- AIMAX runner version:
- Browser:
- Account/product used:

## Checks
- Live app `/app`:
- Runner connection:
- Local settings open/save:
- `/api/workers` catalog:
- Songi web module/research API/queue false:
- Yeri/Hyunju local agent/job API/queue true:
- `/api/jobs` Songi guard, if tested:

## Problems Found
- ...

## Safety Confirmation
- Paid AI calls: not run
- Paid Apify calls: not run
- Naver save/publish tests: not run
- Secrets/private logs in shared folder: none

## Files/Artifacts Returned
- ...
```
