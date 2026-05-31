# Windows Result: R2 Worker Registry SSOT

## Verdict

PASS

R2 blocker: none found.

## Environment

- Windows version: `Microsoft Windows NT 10.0.26200.0`
- PowerShell: `7.5.5`
- Browser: Chrome `148.0.7778.179`, Edge `148.0.3967.70`
- AIMAX runner version: `v1.0.17` from live `/api/agent/status?platform=windows`
- AIMAX runner process: running at `C:\Users\likim\AppData\Local\Programs\AIMAX\AIMAX.exe`
- AIMAX launcher process: running at `C:\Users\likim\AppData\Local\Programs\AIMAX\aimax-agent-launcher.exe`
- Account/product used: authenticated saved Windows web-agent session, product `bundle`; email/session value not printed or saved.

## Checks

### Live app `/app`

PASS.

- In-app browser opened `https://api.aimax.ai.kr/app` on Windows and received the AIMAX login page.
- Live app HTTP refresh check passed twice:
  - first `/app`: `200`
  - second `/app`: `200`
  - content type: `text/html; charset=utf-8`
  - HTML markers present: `AI/API 연결`, `오류 보고`, `송이`, `윤미`, `예리`, `현주`
- Authenticated login state was verified through the saved local Windows web-agent session:
  - `/api/auth/me`: OK
  - `can_execute=true`
  - `requires_password_change=false`
  - product `bundle`

Note: I did not copy a raw session token/cookie into the in-app browser. Authenticated checks used the local saved web-agent session and sanitized API responses.

### Runner connection

PASS.

Checked `/api/agent/status?platform=windows` three times, 12 seconds apart:

1. `connected=true`, `status=connected`, `version=v1.0.17`, `update_required=false`, active job absent
2. `connected=true`, `status=connected`, `version=v1.0.17`, `update_required=false`, active job absent
3. `connected=true`, `status=connected`, `version=v1.0.17`, `update_required=false`, active job absent

No infinite loading or stuck busy state observed.

### Version API

PASS.

`/api/version?current=v1.0.17&platform=windows`:

- `latest_version=v1.0.17`
- `min_version=v1.0.17`
- `current_version=v1.0.17`
- `update_required=false`
- `update_available=false`

### Local settings open/save

PASS via no-secret smoke.

- Ran `python verify_v114_local_settings_ux.py`
- Result:
  - `V114_LOCAL_SETTINGS_UX_OK`
  - `modules_checked=2`
  - `secret_values_printed=0`

I did not perform a real GUI save against the user's live local settings, to avoid changing Naver credentials or local secret state. The Windows runner remained connected after the smoke and live refresh checks.

### `/api/workers` catalog

PASS.

Live `/api/workers` returned:

- `catalog_version=1`
- `worker_count=7`
- `job_kind_count=4`

Required job kinds:

- `songi_research`
  - `present=true`
  - `execution=web_module`
  - `api_mode=research_api`
  - `queue=false`
  - `worker_code=songi_data_research`
  - `required_product=songi`
- `yeri_write`
  - `present=true`
  - `execution=local_agent`
  - `api_mode=job_api`
  - `queue=true`
  - `worker_code=yeri_writer`
  - `required_product=yeri`
- `hyunju_find`
  - `present=true`
  - `execution=local_agent`
  - `api_mode=job_api`
  - `queue=true`
  - `worker_code=hyunju_sales`
  - `required_product=hyunju`

Visible worker contract:

- Yeri / 예리
  - `code=yeri_writer`
  - `execution=local_agent`
  - `job_kind=yeri_write`
  - `status=available`
- Hyunju / 현주
  - `code=hyunju_sales`
  - `execution=local_agent`
  - `job_kind=hyunju_find`
  - `status=available`
- Songi / 송이
  - `code=songi_data_research`
  - `execution=web_module`
  - `job_kind=songi_research`
  - `status=available`
- Yunmi / 윤미
  - `code=yunmi_script_writer`
  - `execution=web_module`
  - `job_kind=yunmi_script`
  - `status=beta`
  - Not local-agent-required at worker level.

### Songi web module / research API / queue false

PASS.

`/api/workers` shows `songi_research` as `execution=web_module`, `api_mode=research_api`, `queue=false`.

### Yeri/Hyunju local agent / job API / queue true

PASS.

`/api/workers` shows:

- `yeri_write`: `execution=local_agent`, `api_mode=job_api`, `queue=true`
- `hyunju_find`: `execution=local_agent`, `api_mode=job_api`, `queue=true`

### `/api/jobs` Songi guard

PASS.

Safe precondition was checked first: live catalog said `songi_research` is `web_module`, `research_api`, `queue=false`.

Then a synthetic guard probe attempted to create `songi_research` through `/api/jobs`.

Result:

- HTTP status: `400`
- error: `job_kind_uses_module_api`
- api_mode: `research_api`
- unexpected job created: `false`

No paid API, Apify, or Naver action was triggered.

## Problems Found

None.

## Safety Confirmation

- Paid AI calls: not run
- Paid Apify calls: not run
- Real Naver save/publish/scheduled publish tests: not run
- Installer rebuild: not run
- Build inside shared folder: not done
- API keys/cookies/session values/browser profiles/signed URLs/raw private logs in shared folder: none

## Files/Artifacts Returned

- `C:\Users\likim\Documents\shared-bridge\20_Deploy-To-Windows\2026-05-24-r2-worker-registry-ssot\WINDOWS_RESULT_20260524_r2_worker_registry_ssot.md`
