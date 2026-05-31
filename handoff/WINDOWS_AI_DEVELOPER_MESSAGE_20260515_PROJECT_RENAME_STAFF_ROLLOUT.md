# Windows AI Developer Message - 2026-05-15 Project Rename + Staff Rollout Context

Audience: Windows AI developer  
Priority: Context sync / no immediate rebuild unless your current task depends on old paths

## Summary

The Mac-side canonical project folder has been renamed:

```text
Old: /Users/aixlife/Projects/NaverBlogAuto-main-mac
New: /Users/aixlife/Projects/AIMAX-AI-Staff-Management
```

The old path is kept as a compatibility symlink:

```text
/Users/aixlife/Projects/NaverBlogAuto-main-mac -> /Users/aixlife/Projects/AIMAX-AI-Staff-Management
```

This rename reflects the current product direction: AIMAX is no longer just a blog automation project. It is becoming an AI employee production and management system.

## What Changed On Mac Side

1. Canonical folder name changed to `AIMAX-AI-Staff-Management`.
2. Live handoff/runbook references were updated to the new canonical path.
3. Historical deployment reports and build artifacts were intentionally left unchanged.
4. New AI employee rollout language was simplified for non-developers:
   - `회사에서 사용해보기`
   - `기존 사용자들에게 배포`
   - `외부 판매 준비`
5. New schedule document was created:

```text
docs/ai_staff_aggressive_rollout_ai_council_20260515.md
```

## Do You Need To Change Anything On Windows?

### Required

- When writing new Windows handoff/status docs, refer to the product/project as:

```text
AIMAX-AI-Staff-Management
```

- If your local notes or active scripts hardcode the old Mac source path, update them to the new canonical path.
- If you mention the old path in a status report, say it is now a compatibility symlink only.

### Not Required

- Do not rebuild Windows installers only because of this folder rename.
- Do not rename historical Syncthing folders.
- Do not edit old deployment reports just to rewrite history.
- Do not change Windows installer product name, install directory, app IDs, or update behavior unless a separate explicit task asks for rebranding.
- Do not modify Local Agent protocol for the new employees yet.

## Staff Rollout Context

Five new AI employees are already visible as cards in the web service. Their functions are not fully usable yet.

The current rollout language for planning is:

| Easy label | Meaning |
| --- | --- |
| 회사에서 사용해보기 | Internal team can try it first |
| 기존 사용자들에게 배포 | Existing users can use the MVP |
| 외부 판매 준비 | Ready to consider selling externally |

Current target dates:

| Date | Milestone |
| --- | --- |
| 2026-05-18 | Staff management foundation |
| 2026-05-20 | Content/research employees available to existing users |
| 2026-05-22 | PM employee available to existing users |
| 2026-05-25 | Bookkeeping/desktop-app employees available in limited form |
| 2026-05-29 | All five new employees have MVP-level existing-user access |
| 2026-06-05 | Content/research/PM employees reach external-sales preparation |
| 2026-06-12 | Bookkeeping/desktop-app employees reach external-sales review |

## Windows Impact Assessment

For now, this is mostly a naming and coordination update.

Potential future Windows work:

1. If the unified installer later includes new employee access/status text, Windows installer copy may need updates.
2. If desktop app distribution for the whiteboard/annotation employee needs Windows packaging, that should be opened as a separate Windows task.
3. If the web/server staff catalog changes affect Local Agent readiness payloads, wait for a Mac-side source delta before implementing Windows parity.

## Safety Rules

- Do not build inside the Syncthing shared folder.
- Copy any source ZIP into a local Windows work folder first.
- Do not put `.env`, API keys, passphrases, cookies, or decrypted secrets into Syncthing.
- Treat old `NaverBlogAuto-*` names as legacy/historical unless the active task explicitly uses them.
- For current production installer naming, keep `AIMAX` naming stable until a separate installer rebranding task is created.

## What To Return

If you perform any Windows-side update based on this message, return:

```text
WINDOWS_AI_STATUS_20260515_project_rename_staff_rollout.md
```

Include:

- What files or notes were updated
- Whether any old path references remain intentionally
- Whether any build/rebuild was performed
- Any blocker or question

