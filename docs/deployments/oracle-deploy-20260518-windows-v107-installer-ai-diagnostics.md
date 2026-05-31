# Oracle Deploy 20260518 Windows v1.0.7 Installer/AI Diagnostics

## Scope

Deploy Windows Local Agent `v1.0.7` as the required Windows version after Windows-side completion of the installer lock guard, local executor timeout diagnostics, and AI provider error diagnostics.

No macOS version policy was changed.

## Windows Intake

Shared folder:

```text
/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/AIMAX-20260518-windows-v107-installer-ai-diagnostics/
```

Returned files verified:

```text
aimax-bundle-windows.exe
aimax-yeri-windows.exe
aimax-hyunju-windows.exe
windows-source-delta-20260518-v106-to-v107-installer-ai-diagnostics.patch
aimax-windows-v107-installer-ai-diagnostics-evidence-20260518.json
WINDOWS_AI_COMPLETION_REPORT_20260518_V107_INSTALLER_AI_DIAGNOSTICS.md
SHA256SUMS.txt
```

`shasum -a 256 -c SHA256SUMS.txt` passed for all returned files.

## Returned SHA256

```text
ac32de957a85f09b64558fd4a16f9e25df0c06ab3511a531656fc0cf8b7c3340  aimax-bundle-windows.exe
88090d9672a59e85cc443f44768eb4f2658e5b2101f744b08e66195ad5e5205e  aimax-yeri-windows.exe
cae05072a96aacb158a2dcba2c60da052195160aa64590ff6e24510fa9d0bfd2  aimax-hyunju-windows.exe
45248c78ee2ec105ef8bd31fce7f31b32aeb15cb8389bc8ee0b3f74028959359  windows-source-delta-20260518-v106-to-v107-installer-ai-diagnostics.patch
9df2370cc546335ba84915b1753796d186518a8fbf9ec60ac9802f3f5e7b9cc3  aimax-windows-v107-installer-ai-diagnostics-evidence-20260518.json
eaddf0ed929f9a95a8bda40e3264395580773ef459b0f0281f49a2a8870d1d06  WINDOWS_AI_COMPLETION_REPORT_20260518_V107_INSTALLER_AI_DIAGNOSTICS.md
```

## Windows Evidence Summary

- Runtime `APP_VERSION=v1.0.7`
- Inno `AppVersion=1.0.7`
- Installer now attempts AIMAX-only graceful process close before replacing files and stops with a Korean process-close prompt if AIMAX is still running.
- `localhost:8669` timeout paths now record structured `local_executor` details.
- `content_generation` failures now propagate sanitized `ai_error` diagnostics for OpenAI, Gemini, and Claude.
- Mock/stub validation passed; no paid AI generation and no real Naver publishing were run.

## Download Replacement

Remote backup:

```text
/home/ubuntu/aimax-downloads/archive-windows-20260518-pre-v107-installer-ai-diagnostics/
```

Backed-up v1.0.6 hashes:

```text
13172d1cc162da7189f15e0d724574a4e730b4835d5a79b1d681f1d92296e272  aimax-bundle-windows.exe
d9fa2cb2932994d23d3ae0c38768c5494581d5ce104b16f64edd7b8382d16ebb  aimax-yeri-windows.exe
b167656f3e1c0795c1d7b48fc59273b1e1a786b2c642d719930d8a1609f84962  aimax-hyunju-windows.exe
```

New remote hashes:

```text
ac32de957a85f09b64558fd4a16f9e25df0c06ab3511a531656fc0cf8b7c3340  /home/ubuntu/aimax-downloads/aimax-bundle-windows.exe
88090d9672a59e85cc443f44768eb4f2658e5b2101f744b08e66195ad5e5205e  /home/ubuntu/aimax-downloads/aimax-yeri-windows.exe
cae05072a96aacb158a2dcba2c60da052195160aa64590ff6e24510fa9d0bfd2  /home/ubuntu/aimax-downloads/aimax-hyunju-windows.exe
```

## Version Config

Backed up production env:

```text
/home/ubuntu/aimax-reports-api/.env.bak-20260518-windows-v107-installer-ai-diagnostics
```

Updated:

```text
AIMAX_WINDOWS_LATEST_AGENT_VERSION="v1.0.7"
AIMAX_WINDOWS_MIN_AGENT_VERSION="v1.0.7"
AIMAX_WINDOWS_AGENT_RELEASE_NOTES="Windows 실행기 안정화 업데이트입니다. 설치 중 파일 잠김 안내, 로컬 실행기 타임아웃 복구 안내, AI 생성 오류 진단이 개선되었습니다."
```

Service restart:

```text
aimax-reports-api.service active
```

## Verification

```text
GET /api/reports/health
ok=true

GET /api/version?current=v1.0.6&platform=windows
latest=v1.0.7, minimum=v1.0.7, update_available=true, update_required=true

GET /api/version?current=v1.0.7&platform=windows
latest=v1.0.7, minimum=v1.0.7, update_available=false, update_required=false

GET /api/version?current=v1.0.6&platform=macos
latest=v1.0.2, minimum=v1.0.2, update_available=false, update_required=false
```

## Error Report Statuses

Updated 12 Windows report user messages to v1.0.7 wording.

Fresh v1.0.6 follow-up reports changed to user action:

```text
AIMAX-RPT-20260518071933-5e3b43e6 -> waiting_user
AIMAX-RPT-20260518072529-c4524800 -> waiting_user
AIMAX-RPT-20260518072833-17cb362a -> waiting_user
AIMAX-RPT-20260518072852-330b6ff3 -> waiting_user
```

Report index backup:

```text
/home/ubuntu/aimax-reports/data/reports-index.jsonl.bak-20260518093334-windows-v107-status
```

Verified no `v1.0.6` remains in report user-facing `public_message` or `next_update_message` fields.

