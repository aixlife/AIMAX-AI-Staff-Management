# Windows Handoff: R3-F Yeri Minimal Paid E2E

작성: 2026-05-25

## 목적

Demo 테스트 계정으로 생성된 R3-F 예리 Hybrid job을 Windows 설치 실행기가 claim해서 네이버 에디터에 입력하고 **임시저장**까지 완료하는지 확인한다.

## 이미 완료된 부분

- Safe AIMAX test account: `demo@aimax.ai.kr`
- Windows runner readiness: previously verified on `v1.0.19`
- Server paid text generation: completed once with Gemini 2.5 Flash
- Job id: `d0abdaa5-0e13-41cf-a6b8-69ef613158dc`
- Artifact status: `ready_for_publish`
- Artifact model: `gemini-2.5-flash`
- Artifact visible size: 269 chars
- Payload: `word_count=300`, `image_count=1`, `mode=save`, target platform `windows`

## Safety Rules

- Do not create another job.
- Do not trigger server text generation again.
- Do not run Apify.
- Use only the existing Demo test account and its connected Windows runner.
- Use only the test Naver account already stored in the Windows runner.
- Allowed Naver mutation: **temporary draft save only**.
- Do not publish or schedule.
- Do not use customer credentials.
- Do not write passwords, API keys, cookies, raw browser profile paths, or session tokens to reports.

## Task

1. On Windows, open/start the installed AIMAX runner `v1.0.19`.
2. Make sure the web app is logged in as the Demo test account.
3. Let the runner poll jobs.
4. Confirm it claims job `d0abdaa5-0e13-41cf-a6b8-69ef613158dc`.
5. Let it proceed to Naver editor.
6. Confirm:
   - title entered
   - body entered
   - exactly 1 image generated/inserted
   - image appears in the intended `[이미지]` position
   - post is saved as draft / temporary save
7. Return a sanitized result report.

## Return File

Write:

```text
WINDOWS_RESULT_20260525_r3f_yeri_minimal_paid_e2e.md
```

Required contents:

- verdict: `pass`, `blocked`, or `failed`
- job id
- runner version
- AIMAX account: Demo test account, password redacted
- Naver account: test account, identity redacted unless already approved
- observed job status
- whether title/body were inserted
- image attempted/generated/inserted count
- whether temporary draft save completed
- failure stage and sanitized error if blocked/failed
- explicit confirmation: no second paid text generation, no Apify, no publish/schedule, no customer credentials

If the runner does not claim the job, report the narrow blocker instead of creating a new job.
