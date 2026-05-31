# Windows AI Developer Message - 2026-05-14 Image Missing Hotfix

## Context

AIMAX error report `AIMAX-RPT-20260511073622-5ae4d8f0` says a Yeri blog draft was saved without images even though the web job requested images.

Server job history showed:

- job kind: `yeri_write`
- mode: `save`
- requested image count: 3
- result status: `done`
- result images: `attempted=3`, `generated=0`, `inserted=0`

So the local agent treated text-only draft save as success even when all requested image generation/insertion failed.

## Mac-side source changes already made

Files changed:

- `app.py`
- `oracle/aimax-reports-api/server.js`

In `app.py`, `_worker_write()` now:

- records failed-post image stats,
- fails before save/publish when the generated content has fewer image prompts than requested,
- fails before save/publish when requested image blocks were not all inserted,
- returns a clear error telling the user to check Gemini/OpenAI image limits or Naver image upload state.

In `server.js`, `handleAgentJobUpdate()` now:

- checks completed `yeri_write` job results,
- if `payload.image_count > 0` but `result.images.inserted < payload.image_count`, converts the job from `done` to `failed`,
- adds a clear error log to prevent silent success for already-installed agents.

## Windows work needed

1. Pull/apply the updated `app.py` source.
2. Rebuild the three Windows installers:
   - `aimax-bundle-windows.exe`
   - `aimax-yeri-windows.exe`
   - `aimax-hyunju-windows.exe`
3. Put the rebuilt files in `dist/upload_installers/`.
4. Run the normal installer verification:
   - install/update over an existing v1.0.2 install,
   - confirm the app launches and connects to the web app,
   - confirm local security settings can open,
   - run a no-paid smoke path only; do not run paid image generation without explicit approval.
5. Report back with SHA256 hashes and any blocker.

## Important test expectation

Do not run a real paid image generation test without explicit approval.

For code-level verification, mock/stub `posting.editor.input_content()` to return:

```python
{
    "image_attempted": 3,
    "image_generated": 0,
    "image_inserted": 0,
    "image_providers": {"gemini": 0, "openai": 0},
}
```

Expected local result: the write job fails before `save_draft()` / `publish_now()` / `schedule_publish()`.

