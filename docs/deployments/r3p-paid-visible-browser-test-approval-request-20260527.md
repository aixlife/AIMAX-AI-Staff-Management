# R3-P Paid Visible-Browser Test Approval Request

Date: 2026-05-27 KST

## Request

Request owner approval for one bounded Windows paid actual user-flow test after R3-P no-paid checks passed.

## Approved Only If Owner Says Yes

- account: `demo@aimax.ai.kr`
- platform: Windows installed runner `v1.0.28`
- UI: production web UI `https://api.aimax.ai.kr/app`
- browser: visible Chrome or Edge, not API-only/headless-only
- employee: Yeri
- model: Gemini 2.5 Flash / `gemini-2.5-flash`
- text length: 800자
- image count: 1
- mode: 임시 저장 only
- expected UI estimate: about 62 KRW
- hard cost cap: 500 KRW
- number of submissions: exactly one

## Must Verify

- dashboard/settings show installed Windows runner `v1.0.28` connected/current
- job is created from real web UI controls
- runner claims job and emits claim/start evidence
- Naver automatic login passes on safe test account
- Smart Editor opens
- title/body inserted
- image generated/uploaded/inserted
- final Naver draft save completes
- final server status is `done`
- cost/result metadata captured without secrets

## Forbidden

- duplicate paid retry before checking the existing job/result
- Naver publish
- Naver schedule
- customer credentials or customer Naver account
- Apify
- live deploy
- Oracle version API change
- raw secrets, cookies, browser profiles, or signed URLs in evidence

## If It Fails After Submit

Do not submit another job automatically.

Capture:

- job id
- visible status
- runner claim/start/done/failed evidence
- failed stage and reason
- sanitized logs/result
- whether text/image artifacts can be resumed without another paid text generation

