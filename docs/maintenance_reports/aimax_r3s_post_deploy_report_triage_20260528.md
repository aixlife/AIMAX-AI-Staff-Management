# AIMAX R3-S Post-Deploy Report Triage

Date: 2026-05-28 KST

## Scope

R3-S checked remaining phases and cleaned up production error reports after the R3-R rollout.

No paid job, Apify run, Naver publish, Naver schedule, customer credential test, or live installer redeploy was performed during R3-S.

## Remaining Phase Map

- R3-S: post-deploy monitoring and stale report cleanup. Completed in this pass.
- R3-T: customer update follow-up. Watch whether users on old Mac/Windows runners update successfully and whether "아직 안 돼요" responses arrive.
- R3-U: provider/cost UX hardening. Decide whether Gemini image quota fallback to OpenAI should be surfaced more explicitly in the UI/cost notice.
- R3-V: signing/trust improvement. Windows SmartScreen can still require "추가 정보 -> 실행"; code-signing/trust remains a separate non-blocking hardening track.

## Production Snapshot Before Cleanup

Report index:

```text
total: 51
done: 15
waiting_user: 21
working: 15
new/reviewing: 0
latest report: AIMAX-RPT-20260527103437-209bfd00 at 2026-05-27T10:34:37.870Z
```

R3-R deploy finished after that latest report, so there were no new post-deploy error reports at the time of this check.

Jobs:

```text
total: 327
done: 205
failed: 115
cancelled: 7
running: 0
```

No stuck running job remained.

## Cleanup Applied

Script:

```text
scripts/r3s_post_deploy_report_triage.py
```

Remote execution:

```text
python3 /home/ubuntu/r3s_post_deploy_report_triage.py
```

Applied changes:

- 33 reports updated.
- All 15 `working` reports were moved to `waiting_user` with current R3-R guidance.
- 1 stale internal/demo report attention prompt was moved from `waiting_user` to `done`.
- Existing waiting-user guidance that pointed to old Windows versions such as v1.0.8/v1.0.9/v1.0.15 was refreshed to current Windows `v1.0.28` guidance where applicable.
- Mac local-settings reports now point to macOS `v1.0.17`.
- Smart Editor/image reports now point to Windows `v1.0.28` and the successful image-1 draft-save test, while warning against repeated paid retries.
- SmartScreen remains `waiting_user` with current v1.0.28 "추가 정보 -> 실행" guidance.
- Provider quota/Songi API-key reports were not incorrectly marked as fixed by the runner rollout.

Backup suffix:

```text
.bak-20260527152822-r3s-post-deploy-triage
```

Backups created:

```text
34 files
```

Includes:

```text
/home/ubuntu/aimax-reports/data/reports-index.jsonl.bak-20260527152822-r3s-post-deploy-triage
```

## Production Snapshot After Cleanup

Report index:

```text
total: 51
done: 16
waiting_user: 35
working: 0
new/reviewing: 0
```

Public health:

```text
{"ok":true,"service":"aimax-reports-api","storage":{"ok":true,"checked_files":10,"issues":[],"recent_issues":[]}}
```

## Web UI No-Paid Verification

Ran:

```text
AIMAX_USER_FLOW_SCREENSHOT=/private/tmp/aimax_r3s_post_triage_web_ui.png node scripts/r3m_user_flow_web_smoke.mjs
```

Result:

- logged-in app view loaded for `demo@aimax.ai.kr`
- `reportPrompt`: null
- `webSecretNotice`: shown and dismissed with "나중에 하기"
- dashboard/settings/updates tabs reachable
- macOS current/latest/min all `v1.0.17`
- update notices clear for current macOS `v1.0.17`
- environment diagnostics included `local_state`

Evidence:

```text
docs/testing/evidence/r3s-post-triage-20260528/overview.png
```

## Note

`scripts/r3m_user_flow_web_smoke.mjs` was updated to dismiss the web AI/API security notice when it appears. This keeps future no-paid UI verification from failing on an intended one-time informational modal.

## Next

Proceed to R3-T monitoring:

1. Watch for new reports after users install Mac `v1.0.17` / Windows `v1.0.28`.
2. If any "아직 안 돼요" responses arrive, inspect by report id instead of broadly reopening solved groups.
3. Do not run another paid actual test unless a new concrete paid scope is approved.
4. Keep SmartScreen/code-signing and image-provider fallback messaging as separate hardening tracks.
