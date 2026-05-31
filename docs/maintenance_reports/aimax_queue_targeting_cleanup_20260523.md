# AIMAX Queue Targeting Cleanup 2026-05-23

- time: `2026-05-23 16:52 KST`
- scope: production report triage + stale running job cleanup
- paid/API/Naver tests: not run

## Context

After the web hotfix deployed at `2026-05-23 16:46 KST`, new local-agent jobs are targeted by platform/device. This cleanup handled already-created stuck jobs and user-facing report statuses.

## Report Status Updates

Updated the following reports from `new` to `waiting_user` / `사용자 확인 필요`:

- `AIMAX-RPT-20260522185718-6fe2df2a`
  - Cause communicated: same-account Mac/Windows job queue routing issue fixed by server hotfix.
  - User action: refresh web app, confirm Windows runner connection, retry with one keyword and draft save.
- `AIMAX-RPT-20260523053651-fafcc06d`
  - Cause communicated: `open_settings` command delivered but completion response was slow; settings window may be hidden or Windows protocol confirmation may be blocking.
  - User action: close AIMAX/browser, reconnect runner, retry local settings, check taskbar.
- `AIMAX-RPT-20260523064721-fcf8d675`
  - Cause communicated: browser still connected to Windows `v1.0.16`; latest failure was Naver captcha/additional verification.
  - User action: fully close AIMAX, reinstall `v1.0.17`, refresh, confirm runner version, complete Naver manual auth, retry one keyword/image/draft save.

## Stale Job Cleanup

Cancelled 7 stale `running` jobs. All were either several hours/days old or had later jobs for the same user, making them orphaned running indicators:

- `cf40bf03-c280-4d2e-bddb-62401e191c04`
- `98e6f8be-fb02-4770-8084-2ef3cef54fe2`
- `b30b8a65-9dae-41cd-92af-b290da90ec59`
- `4f87e198-a330-4978-9401-99afc2b51f53`
- `88c6921a-837b-4e75-b45b-64b917691c06`
- `b04db5ee-7f9e-4b3e-9187-9eaa3f9fe44d`
- `c0f97f2c-8218-4dfb-8187-4bd98a15006f`

Each cancelled job received a warning log:

```text
운영 정리로 오래된 실행 중 표시를 취소했습니다. 필요한 경우 새 작업을 다시 실행해주세요.
```

## Backups

Created before-write backups on Oracle:

- `/home/ubuntu/aimax-reports/data/reports-index.jsonl.bak-20260523075245-queue-targeting-cleanup`
- `/home/ubuntu/aimax-reports/data/jobs.json.bak-20260523075245-queue-targeting-cleanup`
- `/home/ubuntu/aimax-reports/data/reports/2026-05-22/AIMAX-RPT-20260522185718-6fe2df2a.json.bak-20260523075245-queue-targeting-cleanup`
- `/home/ubuntu/aimax-reports/data/reports/2026-05-23/AIMAX-RPT-20260523053651-fafcc06d.json.bak-20260523075245-queue-targeting-cleanup`
- `/home/ubuntu/aimax-reports/data/reports/2026-05-23/AIMAX-RPT-20260523064721-fcf8d675.json.bak-20260523075245-queue-targeting-cleanup`

Earlier pre-script safety copies were also written:

- `/tmp/jobs-before-stale-cleanup-20260523.json`
- `/tmp/reports-index-before-triage-20260523.jsonl`

## Verification

- Report index shows all 3 target reports as `waiting_user`.
- `jobs.json` has `running_count: 0` after cleanup.
- Cancelled jobs have `finished_at: 2026-05-23T07:52:45.911Z`.
- Production health check returned `ok: true`.

## Local Script

- Cleanup script: `scripts/triage_20260523_queue_targeting_cleanup.mjs`
- Dry run before write showed 3 report updates and 7 stale job cancellations.
