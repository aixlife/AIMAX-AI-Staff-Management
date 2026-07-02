# Copy-Paste Prompt For Windows AI Developer - Environment Rules

You are the Windows AI developer for AIMAX-AI-Staff-Management.

Your task is to set up your Windows-side operating rules so future work can safely mirror the Mac-side workflow:

- completed work is recorded into the shared Obsidian vault;
- Syncthing is used for handoff/status, not as a build folder;
- Oracle can be inspected safely when production evidence is needed;
- AI Council can be used for strategy/tradeoff decisions with sanitized prompts;
- secrets, paid API calls, and production operations are protected.

First, read the latest handoff files in the shared Syncthing folder, especially:

1. `WINDOWS_AI_COLLABORATION_RULES_20260507.md`
2. `WINDOWS_AI_DEVELOPER_MESSAGE_20260515_PROJECT_RENAME_STAFF_ROLLOUT.md`
3. `WINDOWS_AI_ENVIRONMENT_RULES_20260515.md`
4. `WINDOWS_AI_AGENTS_BOOTSTRAP_TEMPLATE_20260515.md`
5. Any newer `WINDOWS_AI_DEVELOPER_MESSAGE_*.md`

Important safety rules:

- Do not build inside Syncthing.
- Do not modify product code unless needed for the environment setup.
- Do not rebuild installers for this task.
- Do not deploy, restart, upload, or delete anything on Oracle.
- Do not put `.env`, API keys, passwords, cookies, session tokens, private keys, passphrases, decrypted secrets, signed URLs, or paid API credentials into Syncthing or Obsidian.
- Do not write notes into `%APPDATA%\Obsidian`; that is Obsidian app data, not the notes vault.
- Do not assume Bash, `sed`, `grep`, `head`, `tail`, `/Users/...`, or `/tmp` exist locally on Windows.
- If Oracle SSH alias `oracle-server` is missing, do not guess connection details. Report that secure SSH setup is needed.
- If AI Council helper/scripts are missing on Windows, write the rule and report what is missing. Do not install tools or run paid/external model calls without approval.

Work to perform:

1. Locate your Windows local project folder and any existing AI rules file such as `AGENTS.md`, `.codex/instructions.md`, `.claude/CLAUDE.md`, or equivalent.
2. Locate the shared Obsidian vault and Syncthing handoff folder. Check likely roots such as `Documents`, `OneDrive\Documents`, `Syncthing`, and `Sync`. If Syncthing paths are unclear, inspect `%LOCALAPPDATA%\Syncthing\config.xml`. If still not found, ask the user for the local Windows paths.
3. Merge the bootstrap rules into your Windows AI rules file. Preserve existing useful rules.
4. Create a small sample/dry-run session note path for Obsidian, or write the actual session note if the vault is available.
5. Check whether OpenSSH is available with `where.exe ssh` and `ssh -V`, then check whether `ssh oracle-server` is configured using a read-only/no-change command only.
6. Check whether an AI Council helper exists locally. If not, record the missing setup and fallback rule.
7. Write a completion report back to the Syncthing handoff folder:

```text
WINDOWS_AI_STATUS_20260515_environment_rules.md
```

Include:

- rules file path created/updated;
- detected Obsidian vault path;
- detected Syncthing handoff path;
- Obsidian session note path created or proposed;
- Oracle alias check result, without secrets;
- AI Council helper status, without secrets;
- any blockers or questions;
- confirmation that no secrets were written and no production changes were made.

When you finish, report completion to the user and point to the status file.
