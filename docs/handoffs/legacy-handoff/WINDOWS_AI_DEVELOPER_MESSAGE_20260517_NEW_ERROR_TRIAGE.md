# Windows AI Developer Message - 2026-05-17 New Error Triage

Audience: Windows AI developer

## Situation

Oracle production data was checked on 2026-05-17 KST after new AIMAX user reports came in.
The AIMAX web/API service is healthy, but Windows users are still producing new `yeri_write`
failures.

Production snapshot:

- AIMAX API user service: `systemctl --user status aimax-reports-api.service` is active.
- Public checks: `/health`, `/app`, `/admin` returned 200.
- Since 2026-05-16, recent jobs: 64 total, 29 failed.
- All 29 failed jobs are `yeri_write`.
- Failed stages:
  - `init`: 26
  - `smart_editor_input`: 1
  - `content_generation`: 1
  - missing stage: 1
- Current user error reports in `new`: 7.
- The dominant Windows failure is:

```text
cannot import name 'measure_visible_char_count' from 'content.ai_text'
```

Observed installed paths:

```text
C:\Users\USER\AppData\Local\Programs\AIMAX\_internal\content\ai_text.py
C:\NaverBlogAuto\AIMAX\_internal\content\ai_text.py
```

## Most Important Finding

The Mac-side current source has `measure_visible_char_count` in `content/ai_text.py`, and
`split_version/app.py` imports it during the Yeri writing flow.

However, the previous Windows source handoff zip `aimax-windows-agent-connect-open-settings-source-20260515.zip`
contained only 8 files and did not include `content/ai_text.py`.

This means the Windows installer was likely rebuilt with a newer `split_version/app.py` that imports
`measure_visible_char_count`, but with an older packaged `content/ai_text.py` that does not export it.

## Required Windows Checks

### 1. Fix the import/runtime packaging mismatch

Required:

- Confirm the Windows build source contains the current `content/ai_text.py`.
- Confirm `content.ai_text.measure_visible_char_count` exists in the installed EXE bundle.
- Rebuild the three Windows installers after syncing this file.
- Do not only patch `split_version/app.py`; the packaged module itself must include the function.

Verification:

```powershell
python - <<'PY'
from content.ai_text import generate_blog_content, measure_visible_char_count
print("ok", callable(measure_visible_char_count))
PY
```

Also verify in the installed PyInstaller output if possible:

- `_internal/content/ai_text.py` contains `def measure_visible_char_count`.
- Running a Yeri writing job no longer fails at `stage=init`.

### 2. Re-test Yeri writing on Windows without paid duplicate generation

Paid API safety:

- Do not submit paid AI generation repeatedly just to test the import fix.
- First run a no-cost import/startup smoke.
- If a real generation test is needed, use only one approved test and record model/provider/cost expectation first.
- If a paid request already has a request/job ID, poll/resume that ID instead of submitting a duplicate.

Suggested staged verification:

1. Import smoke for `content.ai_text`.
2. App/agent startup smoke.
3. One local Yeri job with a mock/stubbed generation path if available.
4. Only after approval, one real small Yeri job.

Expected:

- No `cannot import name 'measure_visible_char_count'`.
- Job progresses beyond `init`.
- Failure, if any, reports a real later stage and keyword.

### 3. Check Chrome/Whale target frame detach

One new report shows:

```text
unknown error: cannot determine loading status from target frame detached
chrome=148.0.7778.167
```

Required:

- Reproduce on Windows with Chrome and Whale if available.
- Check whether browser session recovery catches target-frame detach and restarts the browser/session cleanly.
- Verify the result status includes failed keyword/stage instead of `키워드 미확인`.

Expected:

- Browser frame detach should trigger browser-session recovery or a clear retryable failure.
- It should not leave the user in a vague no-progress state.

### 4. Check image attachment flow

One new Windows report says:

```text
이미지 3장을 요청했지만 0장만 첨부되었습니다.
```

Required:

- Verify image prompt generation, image file creation/download, and Naver Smart Editor upload path on Windows.
- Confirm missing image artifacts are reported distinctly:
  - image API/generation failure
  - local file missing
  - upload selector/UI failure
  - Naver editor rejected upload

Expected:

- If image generation fails, show generation-stage cause.
- If upload fails, preserve local generated image paths in diagnostics without exposing signed URLs or secrets.

### 5. Continue previous Windows Local Agent checks

The 2026-05-15 handoff about `실행기 연결` and `로컬 설정 열기` still matters.
New reports also include:

- `대기중상태에서 작업이 안됩니다.`
- `네이버로 가서 로그인까지 했다가 창이 꺼집니다.`

Required:

- Re-run repeated `aimax://agent/connect` checks.
- Re-run repeated `open_settings` checks.
- Confirm exactly one agent process remains.
- Confirm heartbeat/job polling resumes after browser/login window closes.
- Confirm v1.0.3 installed users are not stuck at queued/waiting.

## Mac/Oracle Notes

Mac/Oracle side observed:

- Server syntax checks passed.
- Web HTML inline scripts parsed.
- Local no-mail smoke passed for:
  - Cafe24 webhook
  - admin login
  - Cafe24 provision
  - no-mail guide send returning `mail_not_configured`
  - report submit
  - report status update
- Production n8n had one transient IMAP/socket line:

```text
This socket has been ended by the other party. Will try to reactivate.
```

Current Cafe24 queue has 2 `needs_review` rows with `unknown_product`, both appear to be non-AIMAX products:

- `[5월 오프라인/회원전용] AI로 직원 만드는법`
- `[구독제] 일본구매대행 사이트`

This is likely an operational filter/mapping issue, not a Windows installer issue.

## Source Bundle

Use the source bundle in the same shared folder:

```text
aimax-windows-new-error-triage-source-20260517.zip
```

It includes the current files most relevant to this failure:

- `content/ai_text.py`
- `content/prompts.py`
- `content/seo_brief.py`
- `split_version/app.py`
- `app.py`
- `local_agent/runtime.py`
- `local_agent/single_instance.py`
- `web_agent/client.py`
- `packaging/windows/aimax_installer.iss`
- `requirements.txt`

## Expected Return Report

Write a completion or blocker report back to the shared folder with:

1. Root cause confirmed or rejected for the `measure_visible_char_count` import error.
2. Exact files changed.
3. Windows build outputs and SHA256:
   - `aimax-bundle-windows.exe`
   - `aimax-yeri-windows.exe`
   - `aimax-hyunju-windows.exe`
4. Import smoke result.
5. Yeri writing smoke result.
6. Chrome/Whale frame-detach recovery result.
7. Image attachment flow result.
8. `aimax://agent/connect` and `open_settings` repeated-click results.
9. Any Mac/Oracle follow-up needed.

