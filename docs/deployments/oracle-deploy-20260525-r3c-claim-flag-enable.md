# Oracle Deploy 20260525 R3-C Claim Flag Enable

- date: `2026-05-25 KST`
- scope: enable R3-C ready-for-publish claim only
- paid server generation: not enabled
- paid/API/Naver tests: not run

## Purpose

Enable the local runner to claim `ready_for_publish` Yeri jobs after both OS runner gates passed:

- macOS `v1.0.11`
- Windows `v1.0.19`

This does **not** enable paid server-side Gemini/OpenAI generation. It only allows compatible local runners to pick up jobs whose text artifact is already prepared.

## Pre-Checks

No-paid local smoke:

```text
YERI_READY_CLAIM_GATE_SMOKE_OK
```

Note: first attempt failed because the local sandbox blocked `127.0.0.1` listen with `EPERM`; rerun with approved local listen permission passed.

## Env Change

Added/updated:

```text
AIMAX_YERI_READY_FOR_PUBLISH_CLAIM_ENABLED=1
```

Confirmed not enabled:

```text
AIMAX_YERI_SERVER_GENERATION_ENABLED
```

Version policy retained:

```text
AIMAX_MACOS_LATEST_AGENT_VERSION=v1.0.11
AIMAX_MACOS_MIN_AGENT_VERSION=v1.0.11
AIMAX_WINDOWS_LATEST_AGENT_VERSION=v1.0.19
AIMAX_WINDOWS_MIN_AGENT_VERSION=v1.0.19
```

## Backup

Previous env backup:

```text
/home/ubuntu/aimax-backups/20260525-r3c-claim-enable/.env.prev
```

## Service

Restarted user service:

```text
systemctl --user restart aimax-reports-api.service
systemctl --user is-active aimax-reports-api.service -> active
```

## Verification

Internal health:

```json
{"ok":true,"service":"aimax-reports-api","storage":{"ok":true,"checked_files":10,"issues":[],"recent_issues":[]}}
```

Public health:

```json
{"ok":true,"service":"aimax-reports-api","storage":{"ok":true,"checked_files":10,"issues":[]}}
```

Public version policy:

```text
macOS current v1.0.11 -> update_required=false
Windows current v1.0.19 -> update_required=false
```

## Next Gate

R3-C claim is now active, but paid generation remains inactive.

Next safe test should use a no-paid or prebuilt artifact path:

1. Create/identify a safe non-customer Yeri job with an existing artifact/`ready_for_publish` state.
2. Confirm compatible macOS/Windows runner can claim only that prepared job state.
3. Confirm no paid server generation is triggered.
4. Confirm no Naver publish/save/schedule mutation unless separately approved.

Only after this gate should paid server generation be considered separately.
