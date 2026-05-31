# AIMAX Error Fix / Release Phase Template

Use this phase order for production errors, new features, and cross-OS fixes.

## Phase 1 - Classify

- Purpose: identify whether the issue can be solved by web/Oracle, macOS app, Windows app, or all of them.
- Scope: read latest memory/session notes, error report JSON, Oracle data, and current app status.
- Deliverable: short root-cause summary and impacted platforms.
- Verification: one reproducible signal such as server data, local log, diagnostic probe, or UI state.

## Phase 2 - Mac / Oracle First

- Purpose: fix anything that can be handled from the Mac-side source, web console, API, downloads, or deployment config.
- Scope: web UX, entitlement rules, report status, macOS bundle, Oracle files, version API.
- Deliverable: patched source, rebuilt artifact if needed, Oracle deployment record.
- Verification: syntax/build checks, local diagnostic probe, Oracle hash, health/version API, and a demo-account readiness check when relevant.

## Phase 3 - Windows Handoff

- Purpose: move Windows-only runtime, installer, protocol, registry, and OS-level tasks to the Windows developer.
- Scope: prepare Syncthing handoff with exact task, source ZIP or patch, validation list, artifact return names, and no-secret rules.
- Deliverable: handoff Markdown, copy-paste prompt, sanitized source ZIP or patch, SHA256.
- Verification: shared folder contains all files and the prompt tells Windows to copy source out of Syncthing before building.

## Phase 4 - Windows Return Intake

- Purpose: verify returned Windows work before replacing Oracle downloads.
- Scope: completion report, patch/source delta, installers, SHA256, evidence JSON.
- Deliverable: accepted or blocked Windows release decision.
- Verification: hashes match, report covers required scenarios, and evidence proves no paid generation or real publishing was used.

## Phase 5 - Deploy

- Purpose: expose only verified files to users.
- Scope: backup current Oracle downloads/config, upload changed artifacts only, update platform-specific version config if needed.
- Deliverable: deployment record under `docs/deployments/`.
- Verification: remote SHA256, health API, version API, download availability, and platform-specific update notice behavior.

## Phase 6 - User Confirmation Loop

- Purpose: make users feel guided instead of stuck.
- Scope: dashboard notice, error report status, retry instructions, "resolved / still failing" state.
- Deliverable: user-facing status and next action.
- Verification: affected account shows a clear action, no misleading ready/unavailable state remains, and unresolved reports stay traceable.

## Default Order

1. Classify from evidence.
2. Fix Mac/Oracle-side blockers immediately when possible.
3. Rebuild/deploy macOS only if the Mac artifact is affected.
4. Prepare Windows handoff for OS/runtime/installer/protocol work.
5. Accept Windows return only after evidence and hashes.
6. Replace Oracle downloads one platform at a time.
7. Update user-facing guidance and error reports.
