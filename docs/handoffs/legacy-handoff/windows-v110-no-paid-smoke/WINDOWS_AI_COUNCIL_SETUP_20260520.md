# Windows AI Council Setup - Claude Code + Gemini CLI

Date: 2026-05-20 KST
Purpose: optional independent review during Windows debugging and hotfix verification

## Recommendation

Use Claude Code and Gemini CLI as advisory reviewers, not as automatic decision makers.

Good use cases:

- root-cause review after a failing log is understood
- checking whether a proposed hotfix actually covers the failure mode
- asking for residual risks and no-paid verification ideas
- reviewing customer-facing explanation text

Avoid using them for:

- sending raw customer reports, credentials, cookies, API keys, `.env`, browser profiles, signed URLs, or private logs
- paid API test runs
- automatically editing production code without the Windows developer reviewing the patch

## First Check

Run in PowerShell or Git Bash:

```powershell
where claude
claude --version
claude doctor

where gemini
gemini --version

node --version
npm --version
git --version
```

If either CLI is missing, report that in the completion note. Do not delay urgent verification unless Minsoo explicitly asks to install it.

## Authentication And Subscription Checkpoint

Before using Claude Code or Gemini CLI for advisory review, confirm whether the machine is already authenticated.

Important rule:

- If login, subscription, billing, browser approval, Google account selection, Claude account selection, or API key setup is required, stop and ask Minsoo to handle it directly on the Windows machine.
- Do not ask the Windows AI developer to receive, paste, save, or transmit raw credentials, API keys, tokens, cookies, recovery codes, or passwords.
- Do not put auth screenshots, tokens, account ids, or billing pages into Syncthing.
- Do not switch to API-key mode just to make the review work. API-backed paid usage needs explicit approval first.

Suggested status labels for the completion report:

- `ai_council_ready`: Claude/Gemini CLI already installed and authenticated.
- `ai_council_partial`: one CLI works, the other is missing or not authenticated.
- `ai_council_needs_user_login`: installation exists but user login/subscription confirmation is required.
- `ai_council_skipped`: urgent verification continued without external AI review.

Safe checks:

```powershell
claude doctor
claude --version
gemini --version
```

If `claude doctor` opens or requests login, stop at that screen and ask Minsoo to complete login. If `gemini` opens an authentication flow, stop and ask Minsoo to complete Google login. After Minsoo finishes, rerun only the version/doctor checks and continue.

## Claude Code Setup

Official docs say Claude Code requires Node.js 18+ and supports Windows 10+ using WSL, Git for Windows, or the native Windows installer.

Standard npm install:

```powershell
npm install -g @anthropic-ai/claude-code
claude doctor
claude
```

Native Windows PowerShell installer:

```powershell
irm https://claude.ai/install.ps1 | iex
claude doctor
claude
```

If using Git Bash on native Windows and Claude cannot find Bash:

```powershell
$env:CLAUDE_CODE_GIT_BASH_PATH="C:\Program Files\Git\bin\bash.exe"
```

Authenticate only through the normal Claude login flow. Do not paste API keys into the terminal or store them in Syncthing.

If the login flow asks which account or plan to use, Minsoo must choose it. The Windows AI developer should not decide between personal/company accounts, Pro/Max subscription, Anthropic Console billing, Bedrock, or Vertex.

## Gemini CLI Setup

Official Gemini CLI docs list the npm package as `@google/gemini-cli`.

Install and authenticate:

```powershell
npm install -g @google/gemini-cli
gemini
```

Use the interactive login flow shown by Gemini CLI. Do not paste API keys into Syncthing files.

If Gemini asks for a Google account, project, billing, or API key mode, Minsoo must choose it. The Windows AI developer should not create or select billing-backed API projects unless explicitly instructed.

If `gemini` is not recognized after install, close and reopen PowerShell, then check npm's global bin path:

```powershell
npm bin -g
```

Add that path to the user PATH only if needed.

## Safe Review Flow

Create a sanitized context file in the local Windows work folder:

```powershell
New-Item -ItemType Directory -Force council-runs | Out-Null
$run = "council-runs\" + (Get-Date -Format "yyyyMMdd-HHmmss") + "-hotfix-review"
New-Item -ItemType Directory -Force $run | Out-Null
notepad "$run\context.md"
```

Put only this kind of content in `context.md`:

- redacted error message
- failed stage
- suspected root cause
- proposed patch summary
- commands already run
- exact no-paid verification question

Do not include:

- customer email, account id, personal notes, passwords, API keys
- `.env`, cookies, browser profile paths
- raw paid-provider responses with tokens or signed URLs
- full private logs unless sanitized

Run advisory reviews:

```powershell
Get-Content "$run\context.md" -Raw | claude -p "You are an independent reviewer. Do not edit files. Review this sanitized debugging context and answer: likely root cause, residual risks, and no-paid checks."
```

Save Claude output:

```powershell
Get-Content "$run\context.md" -Raw | claude -p "You are an independent reviewer. Do not edit files. Review this sanitized debugging context and answer: likely root cause, residual risks, and no-paid checks." > "$run\claude.md"
```

Save Gemini output:

```powershell
Get-Content "$run\context.md" -Raw | gemini -p "You are an independent reviewer. Do not edit files. Review this sanitized debugging context and answer: likely root cause, residual risks, and no-paid checks." > "$run\gemini.md"
```

Then create:

```powershell
notepad "$run\synthesis.md"
```

The synthesis should include:

- what Claude and Gemini agreed on
- where they disagreed
- what the Windows developer accepts or rejects and why
- final action list

Return only the `synthesis.md` summary to Syncthing unless Minsoo asks for the raw outputs.

## Cost And Safety Rules

- Use logged-in subscription/OAuth CLI flows where available.
- Do not switch to API-key backed paid calls without explicit approval.
- If a CLI says billing, quota, paid API, project selection, or subscription confirmation is needed, stop and report `ai_council_needs_user_login`.
- Do not ask Claude/Gemini to run paid AI generation, Naver publishing, or real customer workflows.
- Prefer prompts that say: `Do not edit files. Do not run commands. Give review only.`
- Treat the output as advisory. The Windows developer remains responsible for the final patch and verification.

## References

- Claude Code setup: https://docs.anthropic.com/en/docs/claude-code/getting-started
- Claude Code CLI reference: https://code.claude.com/docs/en/cli-usage
- Gemini CLI get started: https://google-gemini.github.io/gemini-cli/docs/get-started/
- Gemini CLI headless mode: https://google-gemini.github.io/gemini-cli/docs/cli/headless.html
