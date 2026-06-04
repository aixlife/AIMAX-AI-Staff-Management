# AIMAX error report triage - Windows v1.0.44 follow-up

Date: 2026-06-02 KST

## Context

Windows Local Agent `v1.0.44` was verified by Windows with a live paid Naver draft-save smoke and deployed to Oracle as the required/latest Windows release.

Confirmed deployment state before triage:

- Remote installer SHA256: `6fda2ee6ae3f4f3961e2e5a4555b084717a91d8a8d0900e92a7a09d08e5af93a`
- `/api/version?current=v1.0.43&platform=windows`: `latest=min=v1.0.44`, `update_required=true`
- `/api/version?current=v1.0.44&platform=windows`: `latest=min=v1.0.44`, `update_required=false`
- `/api/reports/health`: `ok=true`, storage ok
- Active jobs before triage: `0`

## Triage Applied

Script:

- `scripts/triage_20260602_v1044_open_reports.mjs`

Dry run result:

- Before: `done=28`, `waiting_user=43`, `reviewing=2`, `new=11`
- Planned after: `done=28`, `waiting_user=56`
- Missing targets: `0`

Applied result:

- Updated 13 report records from `new` / `reviewing` to `waiting_user`
- Final counts: `done=28`, `waiting_user=56`, `new/reviewing/working=0`
- Active jobs after triage: `0`

## Categories

- `update`: older Windows v1.0.35-v1.0.39 update, local settings, local agent connection, and web AI/API key recognition reports. Users were asked to install v1.0.44, reconnect the runner, and re-check web `AI/API 연결`.
- `windows10_spec`: one Windows 10 x64 hardware concern. The device profile was treated as supported; user was guided to retry v1.0.44 install and SmartScreen flow.
- `queued_or_draft`: one v1.0.41 worker/start/draft-save related report. User was guided to update to v1.0.44 and retry only a bounded draft-save check.
- `api_key`: v1.0.44 reports where the visible failure indicates provider API key, model permission, or usage-limit issues. Users were guided to verify provider keys/quotas and avoid duplicate paid retries.

## Remote Backups

The script created backups with suffix:

`bak-20260602052925-v1044-open-report-triage`

Backed up:

- `/home/ubuntu/aimax-reports/data/reports-index.jsonl`
- 13 affected report JSON files under `/home/ubuntu/aimax-reports/data/reports/`

## Final Verification

- Report counts: `done=28`, `waiting_user=56`, `open_count=0`
- Jobs: `total=395`, `active=0`
- Version API: Windows `v1.0.44` current has no update required
- Health: `ok=true`, storage ok, no recent issues

No paid AI generation, Apify run, YouTube Data API call, Naver publish/schedule/edit, customer credential use, or duplicate paid retry was performed during this triage.
