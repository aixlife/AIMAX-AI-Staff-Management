# Windows Continuous Tiki-Taka Protocol

Date: 2026-05-26 KST

## Purpose

Windows Codex and Mac-side Codex should work as a continuous handoff loop, not as one-off tasks.

Each Windows phase should return:

1. a completion/blocker report,
2. sanitized diagnostics,
3. any release artifact or source patch,
4. a machine-readable trigger file that tells Mac-side Codex what to do next.

## Standard Return Files

For every Windows task, return these files to the same Syncthing task folder:

```text
WINDOWS_RESULT_YYYYMMDD_<phase>.md
aimax_<phase>_diag.json
NEXT_TRIGGER_YYYYMMDD_<phase>.json
```

If an installer or patch is produced, also return it using the exact name requested in the handoff.

## NEXT_TRIGGER JSON Shape

```json
{
  "verdict": "pass",
  "phase": "r3f_release_rollout",
  "next_recommended_action": "mac_prepare_v1012_release",
  "requires_mac_action": true,
  "requires_windows_action": false,
  "safe_to_continue_without_user": true,
  "requires_user_approval": false,
  "artifacts": [
    "aimax-bundle-windows.exe",
    "WINDOWS_RESULT_20260526_r3f_release_rollout.md",
    "aimax_r3f_v121_release_ready_diag.json"
  ],
  "forbidden_actions_confirmed": {
    "paid_ai": true,
    "apify": true,
    "naver_publish_or_schedule": true,
    "customer_credentials": true,
    "shared_secrets": true
  },
  "notes": "Short summary for Mac-side Codex."
}
```

If blocked:

```json
{
  "verdict": "blocked",
  "phase": "r3g_empty_image_prompt_guard",
  "blocker": "Narrow blocker here",
  "requires_mac_action": true,
  "requires_user_approval": false,
  "safe_to_continue_without_user": false,
  "notes": "What Mac-side should inspect next."
}
```

## Safety Rules

- Never put secrets, tokens, cookies, browser profiles, `.env`, or raw private logs into Syncthing.
- Report sanitized facts only.
- No paid AI unless the handoff explicitly says the user approved that exact paid scope.
- No Apify unless explicitly approved.
- No Naver publish/schedule.
- Draft-save E2E is allowed only when the handoff explicitly permits it.
- Work in a local Windows folder, not inside Syncthing.

## Mac-Side Behavior

Mac-side Codex monitors task folders. When it sees `NEXT_TRIGGER_*.json`, it should:

1. read the result report,
2. validate diagnostics/artifacts,
3. decide whether the next phase can continue under the current approval scope,
4. either proceed or notify the user with the narrow approval/blocker.

## Current Approval Scope

As of 2026-05-26 KST:

- R3-F live deployment is approved through completion.
- R3-G empty image prompt guard is approved for implementation, no-paid validation, Windows handoff, and Windows result verification.
- R3-G paid test is approved only if genuinely needed:
  - one run maximum,
  - short text,
  - one image,
  - draft-save only.
- Forbidden:
  - customer credentials,
  - Apify,
  - Naver publish/schedule,
  - unlimited paid retries.
- Stop and report before R3-H.
