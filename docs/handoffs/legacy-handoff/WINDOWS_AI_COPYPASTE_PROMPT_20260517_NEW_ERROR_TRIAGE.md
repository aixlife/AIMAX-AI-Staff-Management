# Copy/Paste Prompt for Windows AI Developer - 2026-05-17

You are the Windows AI developer for AIMAX.

First read the latest shared-folder handoff docs, especially:

- `WINDOWS_AI_DEVELOPER_MESSAGE_20260517_NEW_ERROR_TRIAGE.md`
- `WINDOWS_AI_DEVELOPER_MESSAGE_20260515_AGENT_CONNECT_OPEN_SETTINGS_HOTFIX.md`
- `WINDOWS_AI_COLLABORATION_RULES_20260507.md`

Work from a local Windows work folder. Copy source/artifacts out of the Syncthing shared folder first.
Do not build inside the shared folder. Do not put secrets, passphrases, `.env`, decrypted files,
venv/build/dist caches, or private credentials back into Syncthing.

Use this source bundle:

`aimax-windows-new-error-triage-source-20260517.zip`

Task:

1. Investigate and fix the Windows `yeri_write` init failure:

```text
cannot import name 'measure_visible_char_count' from 'content.ai_text'
```

The current Mac-side source has `def measure_visible_char_count` in `content/ai_text.py`, but the earlier Windows handoff zip did not include `content/ai_text.py`. Confirm whether the Windows build packaged a stale `content/ai_text.py` while using a newer `split_version/app.py`.

2. Verify the installed Windows bundle can import:

```python
from content.ai_text import generate_blog_content, measure_visible_char_count
```

3. Rebuild and test the three Windows installers:

- `aimax-bundle-windows.exe`
- `aimax-yeri-windows.exe`
- `aimax-hyunju-windows.exe`

4. Also check the new Windows reports:

- Chrome/Whale error: `cannot determine loading status from target frame detached`
- Image issue: `이미지 3장을 요청했지만 0장만 첨부되었습니다`
- Queued/waiting symptom: `대기중상태에서 작업이 안됩니다`
- Browser/login-close symptom: `네이버로 가서 로그인까지 했다가 창이 꺼집니다`

5. Continue the previous Windows Local Agent checks:

- repeated `aimax://agent/connect`
- repeated `로컬 설정 열기`
- exactly one AIMAX agent process
- heartbeat/job polling resumes
- Tk/Tcl is packaged and usable

Paid API safety:

- Do not run repeated paid generation tests.
- Start with import/no-cost smoke checks.
- If a real AI generation test is required, ask for approval of provider/model/action/expected cost first.
- If a paid request/job ID already exists, poll/resume it instead of submitting a duplicate.

Return a completion or blocker report to the shared folder with:

- root cause
- files changed
- build outputs + SHA256
- import smoke result
- Yeri writing smoke result
- Chrome/Whale recovery result
- image attachment result
- repeated connect/settings results
- any Mac/Oracle follow-up needed

