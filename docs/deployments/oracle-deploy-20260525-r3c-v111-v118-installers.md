# Oracle Deploy 20260525 R3-C macOS v1.0.11 / Windows v1.0.18 Installers

- date: `2026-05-25 KST`
- scope: macOS/Windows bundle installers + platform version env
- web/server code: not changed in this deploy pass
- paid/API/Naver tests: not run
- R3-C claim flag: not enabled

## Purpose

Deploy the rebuilt local runners needed for R3-C Yeri Local Artifact Consumer.

R3-C server/web code was already deployed with `AIMAX_YERI_READY_FOR_PUBLISH_CLAIM_ENABLED` default off. This deploy only makes the compatible local runners available and required:

- macOS: `v1.0.11`
- Windows: `v1.0.18`

## Source Artifacts

### macOS

Build report:

```text
docs/deployments/macos-build-20260525-v111-r3c-artifact-consumer.md
```

Local artifact:

```text
dist/upload_installers/aimax-bundle-macos.dmg
```

SHA256:

```text
1a746f909d973a6442bd813a78ed4e3f17972652b9a6f3c0e6539e6f2d071b38
```

Validation:

- `CFBundleShortVersionString`: `1.0.11`
- diagnostics `system.app.version`: `v1.0.11`
- diagnostics `system.runtime.frozen`: `true`
- diagnostics `ai_text_import_smoke.ok`: `true`
- `codesign --verify --deep --strict`: pass
- `hdiutil verify`: checksum valid

### Windows

Windows return:

```text
/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-25-r3c-windows-go-rebuild/WINDOWS_RESULT_20260525_r3c_windows_go_rebuild.md
```

Local artifact staged from Windows return:

```text
dist/upload_installers/aimax-bundle-windows.exe
```

SHA256:

```text
f4730bfa12fefd448c35e4fe66f7146110f3991db3dc79b792eb3bbd9f5c143e
```

Validation from Windows:

- Windows result verdict: `PASS`
- `system.app.version`: `v1.0.18`
- `system.runtime.frozen`: `true`
- `ai_text_import_smoke.ok`: `true`
- `AIMAX.exe`, `aimax-agent-launcher.exe`, and Inno Setup installer created.
- R3-C no-paid smoke set passed.

## Remote Backup

Previous remote bundle installers were backed up to:

```text
/home/ubuntu/aimax-backups/20260525-r3c-v111-v118-installers/
```

Previous remote hashes before deploy:

```text
403cb830a6ff2055e1869801794d0dd6cf80528b841823b8f6de670b86899906  /home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg
5df26513c9cd1e59fe20aeb8e023b7060180db180eea42055560606ee548c31d  /home/ubuntu/aimax-downloads/aimax-bundle-windows.exe
```

## Remote Deployment

Remote target files:

```text
/home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg
/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe
```

Remote hashes after deploy:

```text
1a746f909d973a6442bd813a78ed4e3f17972652b9a6f3c0e6539e6f2d071b38  /home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg
f4730bfa12fefd448c35e4fe66f7146110f3991db3dc79b792eb3bbd9f5c143e  /home/ubuntu/aimax-downloads/aimax-bundle-windows.exe
```

Remote file sizes:

```text
63M  /home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg
131M /home/ubuntu/aimax-downloads/aimax-bundle-windows.exe
```

## Env Changes

Updated platform version policy:

```text
AIMAX_MACOS_LATEST_AGENT_VERSION=v1.0.11
AIMAX_MACOS_MIN_AGENT_VERSION=v1.0.11
AIMAX_WINDOWS_LATEST_AGENT_VERSION=v1.0.18
AIMAX_WINDOWS_MIN_AGENT_VERSION=v1.0.18
```

Updated release notes:

```text
예리 글쓰기 안정화 업데이트입니다. 서버가 만든 글을 보존하고 네이버 입력 단계만 다시 시도할 수 있도록 실행기를 보강했습니다. 설치 후 실행기를 다시 연결해주세요.
```

Not set:

```text
AIMAX_YERI_READY_FOR_PUBLISH_CLAIM_ENABLED
AIMAX_YERI_SERVER_GENERATION_ENABLED
```

Both remain default off.

## Service

Service restarted successfully.

```text
aimax-reports-api.service active
```

## Verification

Internal health:

```text
{"ok":true,"service":"aimax-reports-api","storage":{"ok":true,"checked_files":10,"issues":[],"recent_issues":[]}}
```

Public health:

```text
{"ok":true,"service":"aimax-reports-api","storage":{"ok":true,"checked_files":10,"issues":[],"recent_issues":[]}}
```

Public version API:

```text
macOS current v1.0.10 -> latest/min v1.0.11, update_required=true
macOS current v1.0.11 -> update_required=false
Windows current v1.0.17 -> latest/min v1.0.18, update_required=true
Windows current v1.0.18 -> update_required=false
```

macOS DMG direct check:

```text
hdiutil attach -nobrowse -readonly dist/upload_installers/aimax-bundle-macos.dmg
/Volumes/AIMAX 3/AIMAX.app/Contents/MacOS/AIMAX --diagnostics-probe /private/tmp/aimax_r3c_v111_dmg_diag.json
hdiutil detach /Volumes/AIMAX 3
```

Result:

```text
version=v1.0.11
frozen=true
ai_text_import_smoke_ok=true
```

## Residual Risk / Next Gate

R3-C claim remains inactive.

Before enabling `AIMAX_YERI_READY_FOR_PUBLISH_CLAIM_ENABLED=1`:

1. Windows Codex should install/open the deployed Windows bundle and verify `v1.0.18` install diagnostics. Completed.
2. Optional runner connection/update-banner check was skipped by Windows Codex because only existing local app state was available and it could risk using non-test credentials.
3. R3-C claim flag can be enabled only after explicit user approval.
4. Real paid Gemini server generation remains disabled until separately approved.

## Windows Post-Deploy Result

Return:

```text
/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-25-r3c-windows-post-deploy-install-check/WINDOWS_RESULT_20260525_r3c_windows_post_deploy_install_check.md
```

Verdict:

```text
pass
```

Required checks:

```text
installer SHA256 = F4730BFA12FEFD448C35E4FE66F7146110F3991DB3DC79B792EB3BBD9F5C143E
v1.0.17 -> update_required=true
v1.0.18 -> update_required=false
health storage.ok=true
installed diagnostics system.app.version=v1.0.18
installed diagnostics system.runtime.frozen=true
installed diagnostics ai_text_import_smoke.ok=true
```

Safety:

- Customer account was not used.
- Paid AI / Apify / Naver mutation did not run.
- Raw logs/local identifiers were redacted from returned diagnostics.
