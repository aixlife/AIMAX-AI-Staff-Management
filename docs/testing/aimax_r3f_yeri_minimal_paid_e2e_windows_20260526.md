# AIMAX R3-F 예리 최소 유료 E2E - Windows 결과

작성: 2026-05-26

## Verdict

`pass`

Windows 설치본 기준 실제 사용자 흐름까지 확인됐다.

## Environment

- OS: Windows 11
- Installed runner: `v1.0.21`
- Diagnostics: passed
- `runtime.frozen`: true
- `ai_text_import_smoke.ok`: true

## Key Findings

기존 Windows `v1.0.20`은 NID fix 소스 검증은 통과했지만, 실제 E2E에서 Chrome 시작 전 멈췄다.

추가 원인:

- Windows Chrome version detection이 `chrome.exe --version` 경로에서 text decoding/subprocess 문제를 만들 수 있음

추가 패치:

- `browser/stealth_driver.py`
  - Windows에서는 FileVersionInfo를 우선 사용
  - subprocess output은 `encoding="utf-8", errors="replace"`로 decode

## Attempts

1. `v1.0.20` hidden runner
   - job: `ee7a1a12-8c35-4e49-8f61-7a1d7077a598`
   - result: failed
   - stage: `browser_start_timeout_before_chrome_spawn`
   - cost: 0 KRW
   - Naver mutation: none

2. `v1.0.20` normal runner
   - job: `faa92403-b244-4843-8e03-ec06ce9289b1`
   - result: failed
   - stage: `browser_version_detection_or_browser_start_timeout`
   - cost: 0 KRW
   - Naver mutation: none

3. `v1.0.21` generated short text path
   - job: `497529a7-aa1f-42f3-b282-85f9ad06c1dc`
   - result: failed
   - stage: `smart_editor_input`
   - NID loop escape: pass
   - fresh login fallback: pass
   - Smart Editor entry: pass
   - title input: pass
   - text generation: pass
   - image failed because generated markdown had an empty image prompt
   - cost: 65 KRW

4. `v1.0.21` explicit Markdown image prompt
   - job: `fc132ee6-5863-4499-817a-e6e4d631e106`
   - result: done
   - mode: save
   - NID loop escape: pass
   - fresh login fallback: pass
   - Smart Editor entry: pass
   - title/body input: pass
   - image generated: pass
   - image inserted: pass
   - draft save: pass
   - publish/schedule: not executed
   - image provider: OpenAI fallback after Gemini image quota 429
   - cost: 62 KRW

## Final E2E Snapshot

```text
job_id: fc132ee6-5863-4499-817a-e6e4d631e106
status: done
mode: save
images.attempted: 1
images.generated: 1
images.inserted: 1
image_provider_counts.openai: 1
cost_won: 62
```

## Safety

- Paid AI calls: yes, minimal and user-approved
- Apify: none
- Naver publish: none
- Naver scheduled publish: none
- Naver draft save: one successful test draft only
- Customer account: not used
- Shared secrets/logs: none

## Artifacts

Shared folder:

`/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-25-r3f-nid-login-fix`

Returned files:

- `WINDOWS_RESULT_20260526_r3f_nid_login_fix_e2e.md`
- `aimax_r3f_v121_installed_diag.json`
- `aimax-bundle-windows-v1.0.21-r3f-nid-login-fix.exe`
- `SHA256SUMS_r3f_v121_windows_nid_login_fix.txt`

## Follow-up

Generated short-text path can produce an empty `[이미지]` prompt. Add validation/retry before Smart Editor input or before image insertion.
