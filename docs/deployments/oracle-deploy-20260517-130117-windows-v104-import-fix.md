# Oracle Deploy 20260517-130117 Windows v1.0.4 Import Fix

- mode: `windows-installers`
- host: `oracle-server`
- app_dir: `/home/ubuntu/aimax-reports-api`
- download_dir: `/home/ubuntu/aimax-downloads`
- service: `aimax-reports-api.service` (`systemctl --user`)
- remote_backup: `/home/ubuntu/aimax-backups/20260517-windows-v104-import-fix`
- source_handoff: `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-17-new-error-triage`

## Scope

Deployed the Windows-only `v1.0.4` Local Agent installer rebuilds that fix the `yeri_write` init import failure:

```text
cannot import name 'measure_visible_char_count' from 'content.ai_text'
```

macOS remains on `v1.0.2`.

## Files

| label | remote | sha256 |
|---|---|---|
| bundle windows installer | `/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe` | `4cab22b19464f55ba3f019e3851364263cbb0b69fe4cc63880fad796231c7b69` |
| yeri windows installer | `/home/ubuntu/aimax-downloads/aimax-yeri-windows.exe` | `01744313470f4f94d0015bdf1cd81aa2915fb39410783d8bdd50f2bb5c7f0e30` |
| hyunju windows installer | `/home/ubuntu/aimax-downloads/aimax-hyunju-windows.exe` | `8f3693f42a1304577ef70b7a9ed3ab021bb317dc5310f5f1a44f74a487f685af` |

## Previous Remote Backup

```text
63bc82bf85ea0a03e8149e340586b8f6f765f99f8384dbdce2161626cad29c1d  /home/ubuntu/aimax-backups/20260517-windows-v104-import-fix/aimax-bundle-windows.exe
ebd16bd0738b708797c9320a739fe073c88741a4085001b68806fe2cdd3e5868  /home/ubuntu/aimax-backups/20260517-windows-v104-import-fix/aimax-hyunju-windows.exe
7e14e6476632bc92d97c6c1ef84ae559c24b2e41635ab471bd04e44488815935  /home/ubuntu/aimax-backups/20260517-windows-v104-import-fix/aimax-yeri-windows.exe
```

## Version Config

Updated `/home/ubuntu/aimax-reports-api/.env`:

```text
AIMAX_WINDOWS_LATEST_AGENT_VERSION=v1.0.4
AIMAX_WINDOWS_MIN_AGENT_VERSION=v1.0.4
AIMAX_AGENT_RELEASE_NOTES="Windows 글쓰기 실행 초기화 오류와 브라우저/이미지 안정화 업데이트입니다."
```

Global/macOS version values were left unchanged.

## Verification

```text
GET /api/version?current=v1.0.3&platform=windows
latest=v1.0.4, minimum=v1.0.4, update_available=true, update_required=true

GET /api/version?current=v1.0.4&platform=windows
latest=v1.0.4, minimum=v1.0.4, update_available=false, update_required=false

GET /api/version?current=v1.0.2&platform=macos
latest=v1.0.2, minimum=v1.0.2, update_available=false, update_required=false

GET /health
ok=true
```

Service status after restart:

```text
Active: active (running) since Sun 2026-05-17 13:01:17 KST
Main PID: 2889661
```

Recent service log contained only the expected restart/listen messages.

## Windows-Side Return Verification

Windows AI completion report stated:

- root cause confirmed as stale `content/ai_text.py` in Windows build tree
- import smoke passed for root, split, built onedir, and installed Korean/special-character paths
- mocked Yeri write smoke passed
- Chrome/Whale target-frame-detach recovery passed
- early Naver login window close recovery passed
- image requested 3 / inserted 0 now fails cleanly at `smart_editor_input`
- heartbeat queued-job smoke passed
- repeated native launcher and `aimax://agent/connect` checks passed with one launcher/core process
- repeated local settings/Tk checks passed
- no paid generation or real Naver posting was run
- installers remain unsigned

## Result

Windows `v1.0.4` import-fix rebuild is deployed to Oracle and exposed as a required Windows update. macOS remains unchanged at `v1.0.2`.

## Follow-Up

Monitor Oracle data for:

- `measure_visible_char_count` import errors
- `target frame detached`
- image requested/attached mismatches
- queued/waiting jobs
- `open_settings` failures

