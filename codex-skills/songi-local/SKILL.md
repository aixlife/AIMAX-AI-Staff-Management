---
name: songi-local
description: Use when the user asks 송이, 자료조사원, or local research agent to analyze YouTube, Instagram, TikTok, or web links on this Mac. Runs the AIMAX Songi local CLI, keeps results local, and blocks Apify/Gemini paid calls unless explicitly approved.
metadata:
  short-description: Run Songi local link research
---

# Songi Local

Use this skill when the user says things like "송이로 이 링크 분석", "자료조사원으로 봐줘", "로컬 송이", or asks Codex to process video/SNS/web links locally.

## Workflow

1. Run status first when unsure:

```bash
node /Users/aixlife/Projects/AIMAX-AI-Staff-Management/scripts/songi-local.mjs status
```

2. For profile baseline setup or refresh:

```bash
node /Users/aixlife/Projects/AIMAX-AI-Staff-Management/scripts/songi-local.mjs profile "<INSTAGRAM_PROFILE_OR_USERNAME>" --apify --confirm-paid --out /Users/aixlife/Projects/AIMAX-AI-Staff-Management/songi-local-runs
```

3. For normal link research, use the free/local path:

```bash
node /Users/aixlife/Projects/AIMAX-AI-Staff-Management/scripts/songi-local.mjs analyze "<URL>" --project "inbox"
```

4. For Instagram/TikTok/YouTube video benchmarking, prefer local video download and Codex visual analysis. Gemini is optional, not default.

Read the saved baseline first when it exists:

```bash
/Users/aixlife/Projects/AIMAX-AI-Staff-Management/songi-local-runs/profile-baselines/naminsoo_ai/profile-baseline.md
```

Then structure the answer around:

- 영상 요약
- 초반 3초 후킹
- 장면/구도/편집 리듬
- 자막/카피 구조
- 왜 반응할 수 있는지
- @naminsoo_ai 채널로 바꾸면
- 새 릴스 제작안: 훅, 촬영, 자막, CTA
- 비용

5. Only use Apify or Gemini when the user explicitly approves provider, model/action, and cost risk. Then include `--confirm-paid`.

```bash
node /Users/aixlife/Projects/AIMAX-AI-Staff-Management/scripts/songi-local.mjs analyze "<URL>" --gemini --model gemini-2.5-flash --confirm-paid
```

For YouTube/Instagram/TikTok video-aware Gemini analysis:

```bash
node /Users/aixlife/Projects/AIMAX-AI-Staff-Management/scripts/songi-local.mjs analyze "<VIDEO_URL>" --gemini --include-video --model gemini-2.5-flash --confirm-paid
```

If Instagram/TikTok blocks public download, retry only the download path with browser cookies after explaining the privacy scope:

```bash
node /Users/aixlife/Projects/AIMAX-AI-Staff-Management/scripts/songi-local.mjs analyze "<VIDEO_URL>" --gemini --include-video --cookies-from-browser chrome --model gemini-2.5-flash --confirm-paid
```

For Instagram/TikTok Apify collection:

```bash
node /Users/aixlife/Projects/AIMAX-AI-Staff-Management/scripts/songi-local.mjs analyze "<SNS_URL>" --apify --confirm-paid
```

## Safety Rules

- Do not run paid Apify/Gemini commands without explicit user approval in the current conversation.
- If a paid call fails after submit, preserve `run_id`, `status_url`, result paths, and error details. Do not retry by submitting a duplicate paid job unless the user confirms.
- Do not print raw API keys. The CLI reads `GEMINI_API_KEY`, `APIFY_API_TOKEN`, macOS Keychain accounts `AIMAX/gemini_api_key` and `AIMAX/apify_api_token`, plus the existing AIMAX `minsu-api` fallback.
- Results are saved under `~/Documents/AIMAX-Songi-Local/<project>/runs/...` unless `--out` is set.

## Output

Summarize in Korean and link local result files when available. Always include cost. If Apify/Gemini was not used, say `$0`. If Apify reports `usageTotalUsd`, use that. For Gemini, use usage metadata estimate when available.
