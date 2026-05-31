# AIMAX R3-T Post-Deploy Report Triage

Date: 2026-05-28 KST

## Summary

After the Windows `v1.0.30` R3-T rollout, production error reports were rechecked and updated to current user-facing guidance.

No paid generation, job submit, Naver work, Apify, customer credentials, live deploy, or duplicate paid retry was performed during this triage.

## Before

Production report index counts:

```text
done: 16
waiting_user: 35
working: 1
new: 3
```

New or working reports checked:

- `AIMAX-RPT-20260527154717-2f9f8f86`: Windows launcher would not open after R3-R; now covered by `v1.0.30` installer/launcher visibility fix.
- `AIMAX-RPT-20260528002749-3f6dd074`: Windows `v1.0.28` local settings open command delivered but completion response was late.
- `AIMAX-RPT-20260528003005-3e18f9d1`: Windows `v1.0.28` local settings open command delivered but completion response was late.
- `AIMAX-RPT-20260528005841-aa3afc1d`: Windows `v1.0.30` local security settings save was canceled by the user.

## Actions

Ran:

```text
DRY_RUN=1 python3 /tmp/r3t_post_deploy_report_triage.py
python3 /tmp/r3t_post_deploy_report_triage.py
```

Local source:

- `scripts/r3t_post_deploy_report_triage.py`

Updates applied:

- 37 report rows/details updated.
- `new` 3 reports moved to `waiting_user`.
- `working` 1 report moved to `waiting_user`.
- Existing Windows guidance that still referenced `v1.0.28` was updated to `v1.0.30`.
- SmartScreen guidance now names `v1.0.30`.
- Local settings cancellation report now says the runner was connected and the user should reopen local settings and complete save.
- Gemini/API-key/quota style reports that are not fixed by installation remained user-action oriented.

Backups created on Oracle:

```text
/home/ubuntu/aimax-reports/data/reports-index.jsonl.bak-20260528010052-r3t-post-deploy-triage
/home/ubuntu/aimax-reports/data/reports/*/*.json.bak-20260528010052-r3t-post-deploy-triage
```

## After

Production report index counts:

```text
done: 16
waiting_user: 39
```

Verification:

```text
new: 0
working: 0
reviewing: 0
stale v1.0.28 text in open report public/next messages: 0
```

Sample updated reports:

- `AIMAX-RPT-20260527154717-2f9f8f86`: `waiting_user`, asks user to refresh, download/install latest Windows `v1.0.30`, close AIMAX/browser windows first, reconnect runner, and avoid repeated paid work.
- `AIMAX-RPT-20260528002749-3f6dd074`: `waiting_user`, asks user to update to `v1.0.30`, retry local settings open, check the AIMAX taskbar window if hidden, and report still failing only if it repeats.
- `AIMAX-RPT-20260528003005-3e18f9d1`: same local settings open guidance.
- `AIMAX-RPT-20260528005841-aa3afc1d`: `waiting_user`, explains the report was a user-canceled local security settings save and asks the user to reopen settings and finish saving.
- `AIMAX-RPT-20260523092205-4a3c9f05`: SmartScreen guidance updated to latest Windows installer `v1.0.30`.

## Policy Note

`waiting_user` is the correct state when the fix has been shipped but the customer still needs to update, retry, confirm, or provide a fresh "아직 안 돼요" signal. These should not be marked `done` just because the code was fixed, unless the user confirms resolution or the report is clearly an internal/demo/stale item with no customer action needed.

