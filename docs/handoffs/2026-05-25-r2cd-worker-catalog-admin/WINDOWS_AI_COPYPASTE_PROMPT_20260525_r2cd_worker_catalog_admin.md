Read first:

`WINDOWS_HANDOFF_20260525_r2cd_worker_catalog_admin.md`

Task:

Verify the live Oracle R2-C/D deployment from Windows. This is a web/admin/runtime verification task. Do not rebuild installers unless you find a Windows-only local-agent regression.

Safety rules:

- Do not run paid AI calls.
- Do not run paid Apify calls.
- Do not run real Naver save/publish/scheduled publish tests.
- Do not place API keys, cookies, `.env`, browser profiles, signed URLs, or raw private logs in Syncthing/shared folders.
- Do not build inside the shared folder.

Check:

1. Open `https://api.aimax.ai.kr/app` on Windows and log in.
2. Confirm the app does not hang in infinite loading.
3. Confirm worker display:
   - Yeri/Hyunju remain local-agent-based employees.
   - Songi is web-first/web-module research employee.
   - Yunmi, if available to the account, is web-module.
   - Planned employees are not shown as ready-to-use employees.
4. Open `https://api.aimax.ai.kr/admin`.
5. Confirm the admin page includes the new `직원 카탈로그` section.
6. If admin login is available, confirm the rendered catalog:
   - summary around `7명 · 작업 4개 · 로컬 2 · 웹 2`
   - Songi: `웹 실행`, `research_api`, `큐 아님`, `songi_research`
   - Yeri/Hyunju: `로컬 실행기`, `job_api`, `큐 사용`
   - Yunmi, if visible: `웹 실행`, `job_api`, `큐 사용`, `yunmi_script`
7. If authenticated session access is available, confirm `/api/workers`.
8. If admin session access is available, confirm `/api/admin/catalog` has `products.songi.job_kinds` including `songi_research`.

Return:

`WINDOWS_RESULT_20260525_r2cd_worker_catalog_admin.md`

Return format:

```md
# Windows Result: R2-C/D Worker Catalog Admin

## Verdict
PASS / FAIL / BLOCKED

## Environment
- Windows version:
- AIMAX runner version:
- Browser:
- Account/product used:
- Admin session available: yes/no

## Checks
- Live app `/app`:
- Runner connection:
- Worker display:
- Admin `/admin` page:
- Admin worker catalog section:
- `/api/workers` catalog:
- `/api/admin/catalog`, if tested:

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
