# Oracle Deploy 20260522 Windows v1.0.16 Web Secret Notice

작성 시각: 2026-05-22 20:54 KST

## Summary

Windows AIMAX installer `v1.0.16` was returned from the Windows rebuild lane, verified on Mac by artifact hash, then deployed to Oracle download storage.

The live Windows version gate was updated from `v1.0.15` to `v1.0.16`.

## Source

- Shared-Bridge folder: `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-22-v116-web-secret-notice-rebuild`
- Completion report: `WINDOWS_COMPLETION_20260522_v116_web_secret_notice_rebuild.md`
- Returned artifact: `aimax-bundle-windows.exe`

## Artifact

| item | value |
|---|---|
| file | `aimax-bundle-windows.exe` |
| size | `136706705` bytes |
| sha256 | `fe3c698e9f58f3f3f58fd84f909f73530ca9a659f67c9bbac6a47ae5285f7734` |
| Authenticode | `NotSigned` |

## Local Staging

- New artifact copied to: `dist/upload_installers/aimax-bundle-windows.exe`
- Previous local artifact archived to: `dist/upload_installers/archive-windows-20260522-pre-v116-web-secret-notice/aimax-bundle-windows.exe`
- Previous local sha256: `1b1fd34e1a3dc8f3bcaf4fcb7738eaece43b6a74670dacb5a198e5fe3c35be4f`

## Oracle Deploy

- Previous remote artifact backed up to:
  - `/home/ubuntu/aimax-backups/20260522-windows-v116-web-secret-notice/aimax-bundle-windows.exe`
- Previous remote sha256:
  - `daf0451d9e9f372e5509d78feac143bcb1d084ddbe1bada3019f81fc20f75def`
- New remote artifact:
  - `/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe`
- New remote sha256:
  - `fe3c698e9f58f3f3f58fd84f909f73530ca9a659f67c9bbac6a47ae5285f7734`

## Version Gate

Updated `/home/ubuntu/aimax-reports-api/.env`:

```text
AIMAX_WINDOWS_LATEST_AGENT_VERSION="v1.0.16"
AIMAX_WINDOWS_MIN_AGENT_VERSION="v1.0.16"
AIMAX_WINDOWS_AGENT_RELEASE_NOTES="Windows 실행기 v1.0.16 업데이트입니다. 송이 AI/API 키는 웹 설정 탭의 AI/API 연결에서 관리하고, 로컬 설정 안내와 다운로드/설정 열기 흐름을 보강했습니다."
```

`.env` backup:

- `/home/ubuntu/aimax-reports-api/.env.backup-20260522-windows-v116`

Service restart:

- `aimax-reports-api.service` active
- Main PID after restart: `3208852`

## Public Verification

Health:

```json
{"ok":true,"service":"aimax-reports-api"}
```

Windows `v1.0.15` version API:

```json
{
  "latest_version": "v1.0.16",
  "min_version": "v1.0.16",
  "current_version": "v1.0.15",
  "platform": "windows",
  "update_available": true,
  "update_required": true
}
```

Windows `v1.0.16` version API:

```json
{
  "latest_version": "v1.0.16",
  "min_version": "v1.0.16",
  "current_version": "v1.0.16",
  "platform": "windows",
  "update_available": false,
  "update_required": false
}
```

Remote artifact:

```text
fe3c698e9f58f3f3f58fd84f909f73530ca9a659f67c9bbac6a47ae5285f7734  /home/ubuntu/aimax-downloads/aimax-bundle-windows.exe
136706705
```

## Notes

- No paid AI calls were run.
- No Apify Actor was run.
- No real Naver save/publish/draft test was run.
- The installer is still unsigned, so SmartScreen/Edge reputation warnings can remain until code signing and reputation are handled.
