# Oracle Deploy 20260602-153937 - Yunmi Shortform Script

## Scope

- Targeted web deploy for Yunmi shortform script generation and UI rendering.
- Updated files:
  - `/home/ubuntu/aimax-reports-api/server.js`
  - `/home/ubuntu/aimax-reports-api/static/app.html`
- No paid AI/API generation was run.

## User-Facing Changes

- Yunmi now returns shortform-script structured output:
  - hook method candidates
  - `숏폼 스크립트 1안`
  - `숏폼 스크립트 2안`
  - time-coded screen/action, dialogue, subtitles
  - anchor/bridge suggestions
  - shooting guide
  - CTA candidates
  - final recommendation
- Yunmi form now includes platform and content-purpose inputs.
- Yunmi result UI renders structured sections instead of a long preformatted block.
- Completed Yunmi jobs no longer show the failure-summary UI only because `result.stage` exists.

## Backup

- Remote backup directory:
  - `/home/ubuntu/aimax-backups/20260602-153937-yunmi-shortform`
- Remote upload staging directory:
  - `/tmp/aimax-yunmi-shortform-20260602-153937`

## Hash Verification

Before install, remote staging hashes matched the local files.

After install:

```text
fede0a0df4501de6412a282c4bee592a80d9f7d287afb3aaf9753145bbbe3ee0  /home/ubuntu/aimax-reports-api/server.js
fe68d55f38a72d5702097837f7103a76cc28e8a716538f82df04fe2649da242a  /home/ubuntu/aimax-reports-api/static/app.html
```

## Service Verification

```text
systemctl --user is-active aimax-reports-api.service
active
```

Service status after restart:

```text
Active: active (running) since Tue 2026-06-02 15:46:54 KST
Main PID: 237955
aimax-reports-api listening on http://127.0.0.1:18988
```

Internal health:

```json
{"ok":true,"service":"aimax-reports-api","storage":{"ok":true,"checked_files":10,"issues":[],"recent_issues":[]}}
```

Public health:

```json
{"ok":true,"service":"aimax-reports-api","storage":{"ok":true,"checked_files":10,"issues":[],"recent_issues":[]}}
```

Public app HTML contains:

- `yunmiPlatform`
- `윤미 숏폼 스크립트`
- `숏폼 스크립트 1안/2안`
- fixed failure gate:
  - `result.error || result.failed_keyword || (isFailedJob && result.stage)`

## Local Verification Before Deploy

- `node --check oracle/aimax-reports-api/server.js`
- `node scripts/smoke_worker_catalog_contract.mjs`
- `node scripts/smoke_yunmi_alpha.mjs`
- `node scripts/smoke_songi_to_yunmi_bridge.mjs`
- Browser user-flow check on local test server:
  - login
  - select Yunmi
  - submit shortform script job
  - verify structured sections render
  - verify completed job row does not render as failure

## Production Auth Note

- Public no-auth `/api/workers` intentionally does not expose Yunmi because Yunmi is gated by `AIMAX_YUNMI_PUBLIC_ENABLED` or allowed users.
- A production authenticated worker check was not completed because the local smoke demo password is not valid on production (`401 invalid_credentials`).
