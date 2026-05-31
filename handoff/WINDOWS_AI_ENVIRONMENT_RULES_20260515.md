# Windows AI Environment Rules - Obsidian / Oracle / AI Council

Date: 2026-05-15 KST
Project: AIMAX-AI-Staff-Management
Audience: Windows AI developer
Purpose: Set up Windows-side operating rules so finished work is recorded into the shared Obsidian vault, Oracle can be inspected safely when needed, and AI Council can be used as an advisory workflow.

## Scope

This is an environment/rules setup task, not a product feature task.

Do not rebuild AIMAX, modify installer behavior, edit Oracle web files, or deploy anything just because of this document. If you discover a product bug while setting up the environment, write a question/status report first.

## Phase 1 Deliverable

Create or update Windows-side AI developer rules so future Windows sessions follow these behaviors:

- Read latest project memory/session logs before broad exploration.
- When work is completed, write a session summary into the shared Obsidian vault.
- Bridge only durable decisions and reusable insights into project memory.
- Use Syncthing handoff folders for Mac/Windows transfer, not as build folders.
- Inspect Oracle only when the task requires production evidence or deployment status.
- Use AI Council only for strategy, uncertain architecture, or important tradeoff decisions.
- Never place secrets, passphrases, cookies, private keys, decrypted env files, or paid API credentials into Obsidian or Syncthing.

Verification is complete when you can show:

- which Windows AGENTS/rules file was created or updated;
- the detected local paths for the shared Obsidian vault and Syncthing handoff folder;
- a dry-run or sample session-summary path that does not expose secrets;
- whether `ssh oracle-server` exists on Windows, or what secure setup is still missing;
- whether an AI Council helper exists on Windows, or what safe fallback rule was written.

## Source / Artifact Package

No source ZIP, build artifact, installer, or patch is required for this task.

Use these documents only:

- `WINDOWS_AI_ENVIRONMENT_RULES_20260515.md`
- `WINDOWS_AI_AGENTS_BOOTSTRAP_TEMPLATE_20260515.md`
- `WINDOWS_AI_COPYPASTE_PROMPT_20260515_ENVIRONMENT_RULES.md`

Return one status document:

- `WINDOWS_AI_STATUS_20260515_environment_rules.md`

## Web-Checked Windows Differences

Checked against official docs on 2026-05-15 KST:

- Obsidian vaults are normal local folders of Markdown files. Do not write notes into Obsidian's Windows system folder `%APPDATA%\Obsidian`; that folder is for global app data and Obsidian warns not to create a vault there.
- Obsidian creates `.obsidian` inside the vault root for vault-specific settings. This folder may be hidden on Windows.
- Obsidian documents Syncthing as a supported sync method for Windows/macOS/Linux, and OneDrive as common on Windows when files are kept available offline.
- Syncthing's Windows configuration/database directory defaults to `%LOCALAPPDATA%\Syncthing`, and its default synced folder may be under `%USERPROFILE%\Sync`.
- Windows OpenSSH availability depends on Windows version/install state. Confirm `ssh.exe` exists before relying on the `oracle-server` alias.
- PowerShell execution policy applies on Windows. Do not change the global policy just for this setup; prefer inline commands, audited local scripts, or process-scope execution only after user approval.

## Required Reading Before Editing

Read the newest relevant handoff documents first:

- `WINDOWS_AI_COLLABORATION_RULES_20260507.md`
- `WINDOWS_AI_DEVELOPER_MESSAGE_20260515_PROJECT_RENAME_STAFF_ROLLOUT.md`
- any newer `WINDOWS_AI_DEVELOPER_MESSAGE_*.md`
- this document

If the Windows local project has an existing `AGENTS.md`, `.codex/instructions.md`, `.claude/CLAUDE.md`, or similar AI rule file, read it before editing. Preserve useful existing rules and append/merge the new rules carefully.

## Canonical Project Naming

Use current product/project name in new notes:

```text
AIMAX-AI-Staff-Management
```

Historical names may still appear in paths or old logs:

```text
NaverBlogAuto-main-mac
NaverBlogAuto-main-wincheck
NaverBlogAuto
```

Do not rewrite old history just to rename it. For new Windows reports, mention old names only as legacy context.

## Windows Path Discovery

Do not assume Mac paths exist on Windows. Detect the local equivalents.

Recommended Windows discovery checklist:

```powershell
$candidateVaults = @(
  "$env:USERPROFILE\Documents\creator-os-vault",
  "$env:USERPROFILE\OneDrive\Documents\creator-os-vault",
  "$env:USERPROFILE\Syncthing\creator-os-vault",
  "$env:USERPROFILE\Sync\creator-os-vault"
)
$candidateVaults | ForEach-Object { if (Test-Path $_) { "FOUND_VAULT=$_" } }

$candidateHandoffs = @(
  "$env:USERPROFILE\Documents\Shared-Bridge\20_Deploy-To-Windows",
  "$env:USERPROFILE\Syncthing\Shared-Bridge\20_Deploy-To-Windows",
  "$env:USERPROFILE\Shared-Bridge\20_Deploy-To-Windows",
  "$env:USERPROFILE\Sync\Shared-Bridge\20_Deploy-To-Windows"
)
$candidateHandoffs | ForEach-Object { if (Test-Path $_) { "FOUND_HANDOFF=$_" } }

$syncthingConfig = Join-Path $env:LOCALAPPDATA "Syncthing\config.xml"
if (Test-Path $syncthingConfig) {
  [xml]$cfg = Get-Content $syncthingConfig
  $cfg.configuration.folder | ForEach-Object { "SYNCTHING_FOLDER=$($_.label) => $($_.path)" }
}
```

If paths are not found, ask the user for the Windows local Syncthing/Obsidian folder locations. Do not create a new vault unless explicitly asked.

Important Obsidian distinction:

- Vault path: where notes should be written, for example `...\creator-os-vault\`.
- App system path: `%APPDATA%\Obsidian\`. Do not write project/session notes here.

## Obsidian Recording Rule

At the end of meaningful Windows work, write a session note to the shared Obsidian vault before reporting final completion.

Preferred path pattern:

```text
<VAULT>\sessions\AIMAX-AI-Staff-Management\YYYY-MM-DD_AIMAX-AI-Staff-Management_windows-ai_<HHMMSS>.md
```

If the vault already uses the legacy folder `sessions\NaverBlogAuto-main-wincheck`, use the existing convention and mention the current project name in the note title/frontmatter.

Minimum session note structure:

```markdown
---
type: windows-ai-session
project: AIMAX-AI-Staff-Management
created: YYYY-MM-DDTHH:mm:ss+09:00
source: windows-ai
---

# YYYY-MM-DD AIMAX Windows AI Session

> One-line summary.

## Completed
- What changed or was verified.

## Evidence
- Commands/tests run.
- Build artifact names and SHA256, if any.
- Handoff/status files written.

## Decisions
- Durable decisions only.

## Risks / Blockers
- Open issues or user approvals needed.

## Connection Context
- Why this session connects to project MOCs, prior sessions, or decisions.
```

Also update the project MOC only when safe and small:

```text
<VAULT>\projects\AIMAX-AI-Staff-Management.md
```

If the MOC does not exist, use the existing legacy project MOC such as:

```text
<VAULT>\projects\NaverBlogAuto-main-wincheck.md
```

Do not bulk-edit old notes. Add one concise session link if you are confident.

## Memory Bridge Rule

Treat Obsidian session notes as chronological evidence. Treat project memory as durable reusable context.

Only promote these into project memory/rules:

- decisions that will affect future implementation;
- recurring operational lessons;
- source-of-truth paths or deployment contracts;
- user direction changes.

Do not promote one-off logs, temporary command output, or large build details into memory.

## Syncthing Handoff Rule

The Syncthing folder is a transfer and status folder, not a working folder.

Windows developer must:

- copy source ZIPs out of Syncthing into a local work folder before building;
- never build inside the shared folder;
- return completion/blocker reports to the handoff folder;
- include artifacts only when requested;
- keep secrets and decrypted files out of Syncthing.

Completion report filename pattern:

```text
WINDOWS_AI_STATUS_YYYYMMDD_<topic>.md
```

Include:

- task summary;
- files changed;
- commands/tests run;
- artifacts and SHA256;
- whether paid API calls or real publishing were used;
- Obsidian session note path;
- Oracle checks run, if any;
- AI Council run location, if any;
- blockers/questions.

## Oracle Access Rule

Oracle is production-adjacent. Inspect it only when needed for production evidence, deployment status, logs, or health checks.

First confirm that Windows has an SSH client:

```powershell
where.exe ssh
ssh -V
```

Default safe access:

```powershell
ssh -o BatchMode=yes oracle-server "hostname && systemctl --user status aimax-reports-api.service --no-pager | head"
```

If `oracle-server` does not resolve on Windows:

- do not guess host/IP/key details;
- ask the user to provide or confirm SSH config through a secure local setup;
- never paste private keys into chat, Obsidian, or Syncthing;
- never store server passwords in project files.

Allowed read-only checks when relevant:

```powershell
ssh -o BatchMode=yes oracle-server "systemctl --user status aimax-reports-api.service --no-pager | sed -n '1,12p'"
ssh -o BatchMode=yes oracle-server "find /home/ubuntu/aimax-downloads -maxdepth 1 -type f -name 'aimax-*-windows.exe' -printf '%P %s\n' | sort"
ssh -o BatchMode=yes oracle-server "tail -n 80 /home/ubuntu/aimax-reports-api/logs/*.log 2>/dev/null"
```

Before any Oracle write/deploy/restart/delete:

- stop and confirm with the user unless the active task explicitly authorizes that exact action;
- create or identify a backup/rollback path;
- write the intended command into the status report;
- never expose `.env` contents, tokens, admin passwords, cookies, or setup links.

Do not edit or deploy Oracle/web files from Windows unless explicitly assigned. Mac/Oracle ownership remains the default.

## PowerShell Compatibility Rule

Prefer PowerShell-native discovery commands on Windows. Avoid assuming Bash, `sed`, `grep`, `head`, `tail`, `chmod`, `/tmp`, or `/Users/...` exist locally.

Linux commands are acceptable inside quoted `ssh oracle-server "..."` commands because those run on the Oracle Linux host, not on Windows.

If a `.ps1` script is blocked:

```powershell
Get-ExecutionPolicy -List
```

Do not loosen `LocalMachine` or `CurrentUser` execution policy without user approval. For one audited local command, ask before using process-scope execution such as:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\script.ps1
```

## AI Council Rule

AI Council is an advisory workflow, not a product feature.

Use it for:

- high-uncertainty strategy;
- architecture tradeoffs;
- roadmap sequencing;
- costly or risky decisions;
- cases where independent disagreement is useful.

Do not use it for:

- straightforward code edits;
- routine Windows builds;
- simple bug fixes;
- anything that requires sharing secrets, raw user data, private file paths, credentials, or proprietary samples.

Before sending prompts to outside models:

- sanitize product/user/company identifiers unless truly necessary;
- remove local absolute paths, tokens, keys, cookies, personal data, and private customer samples;
- ask the user first if the context is sensitive.

Store AI Council outputs under the current local project:

```text
council-runs\YYYYMMDD-HHMMSS-<short-topic>\
```

If there is no Windows helper script, write this rule first and ask whether to port the Mac helper. Do not improvise by installing tools or using paid APIs without approval.

Mac-specific caution:

- The Mac helper path `/Users/aixlife/.codex/bin/ai-council.mjs` and binary paths such as `/opt/homebrew/bin/codex` do not work on Windows.
- If porting is requested later, create a Windows-local helper that discovers `claude`, `codex`, `gemini`, and `node` with Windows commands, stores outputs under `council-runs\`, and keeps the same sanitization rules.

## Official References Checked

- Obsidian data storage: https://obsidian.md/help/data-storage
- Obsidian vault management: https://help.obsidian.md/Files%20and%20folders/Manage%20vaults
- Obsidian sync methods: https://obsidian.md/help/sync-notes
- Syncthing configuration paths: https://docs.syncthing.net/users/config.html
- Microsoft OpenSSH for Windows: https://learn.microsoft.com/en-us/windows-server/administration/OpenSSH/openssh-overview
- PowerShell execution policies: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_execution_policies

## Paid API / Publishing Rule

Treat paid model calls, image generation, real blog publishing, email sending, and production retries as high-risk.

Do not run them unless the user explicitly approves:

- provider;
- model/action;
- expected cost;
- whether this may publish or send anything externally.

If a paid request may already have been submitted and failed, preserve request/job IDs and try status/result recovery before considering another submit.

## Safety Checklist Before Final Report

Before reporting this environment setup complete, verify:

- Windows rules file exists and includes Obsidian, Syncthing, Oracle, AI Council, paid API, and secret handling rules.
- No private key, passphrase, API key, `.env`, cookie, session token, or admin password was copied into Obsidian/Syncthing.
- You did not deploy, restart, upload, or delete anything on Oracle unless explicitly authorized.
- You wrote a `WINDOWS_AI_STATUS_*.md` report back to the shared handoff folder.
- You wrote or prepared the Obsidian session note path.
