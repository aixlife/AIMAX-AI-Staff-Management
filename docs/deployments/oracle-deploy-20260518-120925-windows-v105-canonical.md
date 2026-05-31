# Oracle Deploy 20260518-120925 Windows v1.0.5 Canonical Candidate

- mode: `windows-installers + version-api`
- host: `oracle-server`
- app_dir: `/home/ubuntu/aimax-reports-api`
- download_dir: `/home/ubuntu/aimax-downloads`
- service: `aimax-reports-api.service` (`systemctl --user`)
- remote_backup: `/home/ubuntu/aimax-backups/20260518-windows-v105-canonical`
- source_handoff: `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-17-canonical-v105-candidate`

## Scope

Deployed the Windows-only `v1.0.5` Local Agent installer rebuilds from canonical source.

This release carries forward the `v1.0.4` import fix and adds the canonical merge of:

- `content.ai_text` import diagnostics
- early single-instance lock handoff
- native Go launcher packaging
- browser/login window recovery markers
- version/API release notes separation by platform

macOS remains on `v1.0.2`.

## Windows Return Verification

Windows AI completion report stated:

- clean local build outside Syncthing
- app runtime `v1.0.5`
- Inno `AppVersion=1.0.5`
- Go launcher built and included
- installed Korean/special-character path probes passed for all three apps
- `ai_text_import_smoke.ok=true`
- `sample_visible_char_count=13`
- native launcher/protocol repeated checks passed
- local settings/Tk repeated checks passed
- no paid generation and no real Naver posting were run
- no blockers
- installers remain unsigned

## Files

| label | remote | sha256 |
|---|---|---|
| bundle windows installer | `/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe` | `ccd07ee0ced0af09fd890271710a132517503d9afd59fe2007720b0f3d2ead77` |
| yeri windows installer | `/home/ubuntu/aimax-downloads/aimax-yeri-windows.exe` | `8fcdd5762ee9ec34e752d550184bc0508cd3aec5d8ea2464fe1a75cc459dc082` |
| hyunju windows installer | `/home/ubuntu/aimax-downloads/aimax-hyunju-windows.exe` | `163521b43b9212accbcad8ee3d6f25bb2f66853c596a51be09e85d5392a1281e` |
| api server | `/home/ubuntu/aimax-reports-api/server.js` | `3f9a60ffa33ba33244bbd06daf48f5d1ca3b3c18de6fdad8e975f031af83cbed` |
| web console | `/home/ubuntu/aimax-reports-api/static/app.html` | `d109f3078b7e62c19d4e7f1b6b9e871f4bd4700e50a2d225850a7c0491300e87` |

## Previous Remote Backup

```text
4cab22b19464f55ba3f019e3851364263cbb0b69fe4cc63880fad796231c7b69  /home/ubuntu/aimax-backups/20260518-windows-v105-canonical/aimax-bundle-windows.exe
01744313470f4f94d0015bdf1cd81aa2915fb39410783d8ea2464fe1a75cc459dc082  /home/ubuntu/aimax-backups/20260518-windows-v105-canonical/aimax-yeri-windows.exe
8f3693f42a1304577ef70b7a9ed3ab021bb317dc5310f5f1a44f74a487f685af  /home/ubuntu/aimax-backups/20260518-windows-v105-canonical/aimax-hyunju-windows.exe
```

Additional backups:

- `/home/ubuntu/aimax-reports-api/.env.bak-20260518-windows-v105-canonical`
- `/home/ubuntu/aimax-reports-api/server.js.bak-20260518-platform-release-notes`
- `/home/ubuntu/aimax-reports-api/static/app.html.bak-20260518-phase5-update-notice`
- `/home/ubuntu/aimax-reports-api/static/app.html.bak-20260518-phase5-update-notice-v1`

## Version Config

Updated `/home/ubuntu/aimax-reports-api/.env`:

```text
AIMAX_WINDOWS_LATEST_AGENT_VERSION="v1.0.5"
AIMAX_WINDOWS_MIN_AGENT_VERSION="v1.0.5"
AIMAX_AGENT_RELEASE_NOTES="AIMAX 실행기 업데이트를 확인해주세요."
AIMAX_WINDOWS_AGENT_RELEASE_NOTES="Windows 실행기 안정화 업데이트입니다. 글쓰기 초기화, 브라우저 창 복구, 설정창/연결 안정성이 개선되었습니다."
```

Server change:

- `release_notes` is now platform-specific.
- Windows uses `AIMAX_WINDOWS_AGENT_RELEASE_NOTES` if present.
- macOS no longer receives Windows-only release notes.

## Verification

```text
GET /api/version?current=v1.0.4&platform=windows
latest=v1.0.5, minimum=v1.0.5, update_available=true, update_required=true
release_notes="Windows 실행기 안정화 업데이트입니다. 글쓰기 초기화, 브라우저 창 복구, 설정창/연결 안정성이 개선되었습니다."

GET /api/version?current=v1.0.5&platform=windows
latest=v1.0.5, minimum=v1.0.5, update_available=false, update_required=false

GET /api/version?current=v1.0.2&platform=macos
latest=v1.0.2, minimum=v1.0.2, update_available=false, update_required=false
release_notes="macOS 실행기는 최신 상태입니다."

GET /health
ok=true
```

Service status after restart:

```text
Active: active (running) since Mon 2026-05-18 12:08:57 KST
Main PID: 2931236
```

## Result

Windows `v1.0.5` is deployed to Oracle and exposed as the required Windows update. macOS remains unchanged at `v1.0.2`.

Phase 5 first-release update notices were also deployed to the web console:

- outdated required-version Local Agents get a login/session modal
- the dashboard shows a persistent platform-aware update banner until the version is compliant
- non-required update banners can be dismissed per platform/latest-version key
- job submission and employee action buttons route outdated required-version users to the Updates tab
- Windows release notes stay Windows-only; macOS users do not see the Windows update copy

Open Windows-related error reports were also updated on 2026-05-18 12:31 KST:

- 10 open reports are now `waiting_user` / `사용자 확인 필요`
- messages direct users to install Windows `v1.0.5`, retry, and press "아직 안 돼요" if the issue continues
- report index backup: `/home/ubuntu/aimax-reports/data/reports-index.jsonl.bak-20260518033128-phase5-v105-status`
- update helper: `scripts/mark_phase5_report_statuses.mjs`

## Follow-Up

Monitor Oracle data for:

- `v1.0.5` Windows Agent heartbeat
- `measure_visible_char_count` import errors
- `target frame detached`
- image requested/inserted mismatches
- stuck queued/waiting jobs
- `open_settings` failures

Next implementation phase:

- optional general announcements outside version policy, if support needs notice campaigns not tied to Local Agent versions
