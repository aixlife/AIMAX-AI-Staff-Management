# AIMAX Stabilization Phase Log - 2026-05-17

## Current Gate

Stabilization is moving from Mac/Oracle baseline check into Windows candidate build.

## Phase 1: Mac/Oracle Baseline

Status: partial pass, continue monitoring.

Observed at 2026-05-17 13:46 KST:

- Oracle service: active
- `/health`: ok
- Jobs created after Windows `v1.0.4` deploy: 0
- Failed jobs after deploy: 0
- `measure_visible_char_count` failures after deploy: 0
- Windows agents seen after deploy: 1 on `v1.0.3`
- Windows agents on `v1.0.4`: 0
- Cafe24 open queue: 3 `needs_review`

Interpretation:

- No post-deploy import failure has recurred.
- This does not yet prove `v1.0.4` fixed real usage because no `v1.0.4` Windows heartbeat or post-deploy job sample exists yet.
- Keep 24-72 hour monitoring open.

## Phase 2: Canonical Source Merge

Status: completed on Mac side.

Merged selectively from Windows return delta:

- `content.ai_text` compatibility classes: `AiGenerationError`, `AiQuotaError`
- root and split diagnostics probe import smoke for `content.ai_text`
- browser session recovery markers: `target frame detached`, `frame detached`, `no such window`
- early browser/login retry once
- early single-instance lock handoff
- runtime guard to avoid reacquiring an already preacquired lock
- Windows native launcher source
- Windows installer launcher wiring
- app/installer candidate version set to `v1.0.5`

Intentionally not merged:

- `split_version/content/*` mirror, to avoid future source drift
- Windows-returned `build.py` wholesale replacement, because it would alter Mac DMG behavior too broadly

Local verification:

- Python compile passed for modified root/split/runtime/build files.
- Root diagnostics probe passed.
- Split diagnostics probe passed.
- `ai_text_import_smoke.ok=true`
- `sample_visible_char_count=13`

Local limitation:

- Go is not installed on this Mac, so `aimax-agent-launcher.exe` build must be verified on Windows.

## Phase 3: Windows Candidate Build

Status: completed and deployed.

Prepared source:

```text
aimax-canonical-v105-source-20260517.zip
SHA256: 9be418b6150750c3df3be0c09df85d83aa7bd0da0d111995a30bdf04f1acc6ed
```

Prepared handoff docs:

- `WINDOWS_AI_DEVELOPER_MESSAGE_20260517_CANONICAL_V105_CANDIDATE.md`
- `WINDOWS_AI_COPYPASTE_PROMPT_20260517_CANONICAL_V105_CANDIDATE.md`

Windows must return:

- completion/blocker report
- EXE installers
- source delta ZIP
- SHA256SUMS

Windows returned:

- `WINDOWS_AI_COMPLETION_REPORT_20260517_CANONICAL_V105_CANDIDATE.md`
- `aimax-bundle-windows.exe`
- `aimax-yeri-windows.exe`
- `aimax-hyunju-windows.exe`
- `windows-source-delta-20260517-canonical-v105.zip`
- `SHA256SUMS.txt`

Mac verification:

- SHA256 checks passed.
- Windows report showed no blockers.
- Installed diagnostics, native launcher/protocol, local settings/Tk, no-cost Yeri smoke, and fake queued-job smoke passed.

Deploy result:

- Windows `v1.0.5` installers deployed to Oracle on 2026-05-18 12:09 KST.
- Windows `latest` and `minimum` version set to `v1.0.5`.
- macOS remains on `v1.0.2`.
- Platform-specific release notes were added so Windows notices do not leak into macOS version responses.

Deployment doc:

- `docs/deployments/oracle-deploy-20260518-120925-windows-v105-canonical.md`

## Phase 5: Environment-Aware User Notices

Status: first release implemented and deployed.

Requirement:

- Show login/dashboard notices that match the user's OS, Local Agent version, and update state.
- Do not show Windows-only update notices to macOS users.
- Treat required updates differently from regular announcements.

Notice types:

- Required update: login modal plus persistent dashboard banner until updated.
- Optional update: one-time modal or banner, dismissible per platform/latest-version key.
- Updated successfully / release notes: one-time concise improvement notice for current-version users.
- General announcement: targeted by OS/version/date window, shown as a non-blocking banner or notice inbox.

Candidate Windows `v1.0.5` copy:

```text
Windows 실행기 안정화 업데이트가 필요합니다.
이전 버전에서는 글쓰기 시작 단계에서 실패하거나 설정창이 열리지 않을 수 있습니다.
안전하게 작업하려면 최신 실행기로 업데이트해주세요.
```

Implementation notes:

- Reuse `/api/version` where possible for platform/latest/minimum/update_required.
- Add a lightweight server-side notice config if release notes need OS/version/date targeting beyond version policy.
- Preserve the existing per-platform/latest-version dismissal behavior for non-required notices.
- Required notices should not be dismissible until the Local Agent reports a compliant version.

Completed foundation:

- `/api/version` now returns platform-specific release notes.
- Windows `v1.0.4` and below receive `update_required=true` for `v1.0.5`.
- macOS users remain on `v1.0.2` and do not receive Windows release notes.

Completed web console implementation:

- Required update login/session modal for outdated Local Agent versions.
- Persistent dashboard banner while `update_required` or `update_available` is true.
- Non-required update banners can be dismissed per platform/latest-version key.
- Local Agent card and Updates tab now reuse the same platform-aware update message.
- Job submission, employee actions, dashboard next action, and job blockers now stop outdated required-version agents and route the user to the Updates tab.
- Required update prompt is shown once per browser session and version key, but the dashboard banner remains until a compliant Local Agent version is reported.

Deployed to Oracle:

- `/home/ubuntu/aimax-reports-api/static/app.html`
- SHA256: `d109f3078b7e62c19d4e7f1b6b9e871f4bd4700e50a2d225850a7c0491300e87`
- Backup: `/home/ubuntu/aimax-reports-api/static/app.html.bak-20260518-phase5-update-notice`
- Interim backup: `/home/ubuntu/aimax-reports-api/static/app.html.bak-20260518-phase5-update-notice-v1`

Verified:

- Windows `v1.0.4` + `platform=windows`: `update_available=true`, `update_required=true`, Windows release notes.
- Windows `v1.0.5` + `platform=windows`: no update required.
- macOS `v1.0.2` + `platform=macos`: no update required, no Windows release notes.

Open report status update:

- On 2026-05-18 12:31 KST, 10 open Windows-related reports were moved to `waiting_user` / `사용자 확인 필요`.
- User-facing messages now point affected users to the Windows `v1.0.5` update, then ask them to retry and press "아직 안 돼요" if the issue continues.
- Updated report groups: stale `v1.0.3` launcher guidance, image 3/0 insertion report, `target frame detached`, content generation failures, queued/stuck work, browser-close-after-login, and `content.ai_text.measure_visible_char_count` import errors.
- Backup: `/home/ubuntu/aimax-reports/data/reports-index.jsonl.bak-20260518033128-phase5-v105-status`
- Update helper: `scripts/mark_phase5_report_statuses.mjs`

Remaining implementation candidates:

- Version/OS/date-targeted general notice model if announcements need to be managed outside version policy.
- One-time "updated successfully / release note" announcement for already-compliant users, if customer support wants it.
- Version/OS/date-targeted general notice model if needed beyond version policy.
