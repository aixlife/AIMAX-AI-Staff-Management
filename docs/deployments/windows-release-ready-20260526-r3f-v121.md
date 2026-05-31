# Windows Release Ready - R3-F v1.0.21

Date: 2026-05-26 KST

## Verdict

`pass`

Windows R3-F release rollout readiness was returned and verified.

## Release Candidate

- Version: `v1.0.21`
- Official upload filename: `aimax-bundle-windows.exe`
- Shared folder:
  `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-26-r3f-release-rollout`
- SHA256:
  `9886C05275355A9548CA7DCA36D2804C096A734BEC7336DC05BFB3DC4084CB2F`
- Size: `136672768` bytes

Local Mac-side SHA256 verification matched the report.

## Same Artifact Check

The returned release installer is byte-for-byte the same package as the Windows `v1.0.21` installer used after the real E2E pass.

E2E reference:

- Job: `fc132ee6-5863-4499-817a-e6e4d631e106`
- Final status: `done`
- Mode: `save`
- Image generated/inserted: `1/1`
- Publish/schedule: not executed

## Diagnostics

- `system.app.version`: `v1.0.21`
- `system.runtime.frozen`: `true`
- `ai_text_import_smoke.ok`: `true`
- `browser_version_detection.ok`: `true`
- Chrome major: `148`

## Safety

Release-readiness task did not run:

- paid AI
- new job create/claim/execute
- Apify
- Naver publish/schedule/edit
- customer credentials

No secrets/tokens/cookies/browser profiles/raw private logs were copied to the shared folder.

## Automation

Heartbeat monitor `r3-f-windows-release-rollout-monitor` was deleted after pass verification.

## Next Gate

Prepare Mac release version `v1.0.12`, then stage Oracle installer upload/version API deployment checklist.
