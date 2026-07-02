# Windows AI Rules Bootstrap Template

Use this as the Windows-side `AGENTS.md` or equivalent AI instruction file. Merge with existing local rules instead of blindly replacing them.

```markdown
# AIMAX Windows AI Operating Rules

## Language
- Default to Korean unless the user asks for another language.

## Project Identity
- Current project/product name: AIMAX-AI-Staff-Management.
- Legacy names may appear in old paths and logs: NaverBlogAuto-main-mac, NaverBlogAuto-main-wincheck, NaverBlogAuto.
- Do not rewrite historical notes only to rename them.

## Session Start
1. Read local project memory before broad exploration if it exists.
2. Read the latest 1-2 relevant session notes from the shared Obsidian vault.
3. Read the newest Syncthing handoff docs before Windows build, installer, Local Agent, or parity work.
4. If paths are unknown on Windows, discover them first or ask the user. Do not assume Mac paths.
5. Remember that `%APPDATA%\Obsidian` is Obsidian app data, not the notes vault. Do not write session notes there.

## Phase Rule
- Small tasks may be a single phase and proceed immediately.
- Medium, large, risky, production, or behavior-changing work should define purpose, scope, deliverable, and verification before editing.
- Pause before major phase gates when the next step affects production, paid API usage, or cross-OS delivery.

## Windows Ownership
- Windows owns Local Agent behavior, Windows Selenium/Chrome behavior, Windows Credential Manager/local secure storage, Windows protocol launch, Windows single-instance behavior, Windows installer/build, and Windows verification.
- Mac/Oracle side owns Oracle web/dashboard deployment unless explicitly reassigned.

## Syncthing Handoff
- Treat Syncthing as transfer/status only, never as the build folder.
- Copy source out to a local Windows work folder before building.
- Check likely local roots such as `Documents\Shared-Bridge`, `Syncthing\Shared-Bridge`, and `Sync\Shared-Bridge`; if missing, inspect `%LOCALAPPDATA%\Syncthing\config.xml` or ask the user.
- Return `WINDOWS_AI_STATUS_YYYYMMDD_<topic>.md` or `WINDOWS_AI_QUESTION_YYYYMMDD_<topic>.md`.
- Never put `.env`, API keys, passwords, cookies, session tokens, private keys, passphrases, decrypted secrets, or signed URLs into Syncthing.

## Obsidian Session Capture
- At the end of meaningful work, write a session note into the shared Obsidian vault.
- Preferred path: `sessions/AIMAX-AI-Staff-Management/YYYY-MM-DD_AIMAX-AI-Staff-Management_windows-ai_HHMMSS.md`.
- If only legacy project folders exist, use the existing legacy folder and mention AIMAX-AI-Staff-Management in the note.
- Include summary, completed work, evidence, decisions, risks/blockers, and connection context.
- Update the project MOC with one concise link only when safe.
- Promote only durable decisions and recurring insights into project memory.

## Oracle Production Safety
- Use Oracle only when the task requires production evidence, deployment status, logs, or health checks.
- Prefer read-only checks through SSH alias `oracle-server`.
- First verify Windows has OpenSSH with `where.exe ssh` and `ssh -V`.
- If the alias is missing, ask the user for secure SSH setup. Do not guess host/IP/key details.
- Before any Oracle write, deploy, restart, upload, or delete, get explicit user approval unless the active task already authorizes that exact operation.
- Never expose Oracle `.env`, admin tokens, setup links, private keys, cookies, or passwords.

## PowerShell Compatibility
- Use PowerShell-native commands for local Windows discovery.
- Do not assume Bash, `sed`, `grep`, `head`, `tail`, `/tmp`, or `/Users/...` exist locally.
- Linux commands are okay only inside quoted `ssh oracle-server "..."` commands.
- Do not change global PowerShell execution policy for this project. If a local `.ps1` script is blocked, check `Get-ExecutionPolicy -List` and ask before any process-scope bypass.

## AI Council
- AI Council is an external advisory workflow, not a project feature.
- Use it for strategy, architecture tradeoffs, high uncertainty, or important decisions.
- Do not use it for routine coding/build/debug tasks.
- Sanitize prompts before external model use: remove secrets, raw transcripts, personal data, organization identifiers, private paths, and customer samples.
- Store outputs in `council-runs/` under the current local project and summarize agreement/disagreement/risk in the final answer.
- Mac helper paths and Homebrew binary paths do not work on Windows. If no Windows-local helper exists, write the rule and ask before porting/installing anything.

## Paid API And Publishing Safety
- Treat paid model calls, generation jobs, email sending, real blog publishing, and production retries as high-risk.
- Do not run them unless the user approves provider, model/action, expected cost, and external side effect.
- After an error following paid submit, recover by request/job ID before considering any duplicate submit.

## Review Standard
- When asked to review, lead with findings ordered by severity.
- Focus on regressions, bugs, security issues, missing tests, and operational risk.

## Final Report
- State what changed, what was verified, artifact names/SHA256 if any, Obsidian session note path, Syncthing report path, Oracle checks if any, AI Council run path if any, and remaining blockers.
```
