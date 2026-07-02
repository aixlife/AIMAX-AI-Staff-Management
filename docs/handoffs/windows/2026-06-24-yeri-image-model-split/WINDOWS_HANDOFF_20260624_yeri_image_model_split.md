# Windows Handoff - Yeri Image Model Split

Date: 2026-06-24 15:36 KST
Status: Web deployed, Windows runner rebuild required

## Summary

The Oracle web app now separates Yeri's writing model and image model in the job form.

Live web markers verified:

- `글쓰기 모델`
- `이미지 모델`
- `yeriImageModel`
- `gpt-image-2`
- `gemini-3-pro-image`
- `Gemini Nano Banana Pro`

Deployment report:

- `docs/deployments/oracle-deploy-20260624-153411-yeri-image-model-split.md`

## Why Windows Rebuild Is Required

The web job payload now sends:

- `ai_model`: text/writing model
- `image_model`: image generation model

Current deployed Windows runner builds may ignore `image_model` unless rebuilt from the patched source. Rebuild the Windows local agent so the selected image model is passed into image generation.

## Required Source Patch

Patch file in this folder:

- `yeri_image_model_split.patch`

Main changed files:

- `oracle/aimax-reports-api/static/app.html`
- `app.py`
- `posting/editor.py`
- `content/openai_image.py`
- `content/gemini_image.py`

## Expected Behavior

Yeri job form:

- Writing model select controls text generation only.
- Image model select controls image generation only.

Image model options:

- OpenAI `gpt-image-1`
- OpenAI `gpt-image-2`
- Gemini Nano Banana `gemini-2.5-flash-image`
- Gemini Nano Banana 2 `gemini-3.1-flash-image`
- Gemini Nano Banana Pro `gemini-3-pro-image`

Runner behavior:

- Payload `image_model` is normalized in `app.py`.
- Provider is selected from `image_model`, not from text `ai_model`.
- `posting/editor.py` passes `image_model` to `content/openai_image.py` or `content/gemini_image.py`.
- Result cost includes `image_model_counts` and `image_model_costs`.

## Verification Already Passed On Server Source

```bash
python3 -m py_compile app.py content/openai_image.py content/gemini_image.py posting/editor.py
python3 - <<'PY' | node --check -
from pathlib import Path
html=Path('oracle/aimax-reports-api/static/app.html').read_text(encoding='utf-8')
start=html.find('<script>')
end=html.rfind('</script>')
print(html[start+len('<script>'):end])
PY
node --check oracle/aimax-reports-api/server.js
```

## Windows Rebuild Gate

Before returning a result, confirm:

```powershell
rg -n "image_model|yeriImageModel|gpt-image-2|gemini-3-pro-image|image_model_counts" app.py posting/editor.py content oracle
python -m py_compile app.py content/openai_image.py content/gemini_image.py posting/editor.py
python build.py
```

Then run a no-paid smoke proving that a mocked web job payload with `image_model=gpt-image-2` reaches runner kwargs and editor image generation call path without falling back to text `ai_model`.

If doing a paid live smoke, keep it to one draft-save image only.

## Windows Build Instructions

Goal: produce a new Windows installer that includes the `image_model` runner patch, then return enough evidence for Mac/Ops to upload it safely.

Use a local Windows working folder, not a Syncthing/shared folder:

```powershell
cd C:\Users\likim\Desktop
git clone https://github.com/aixlife/AIMAX-AI-Staff-Management.git AIMAX-yeri-image-model-split
cd AIMAX-yeri-image-model-split
git fetch origin
git checkout codex/triage-transient-ai-errors
git pull --ff-only origin codex/triage-transient-ai-errors
```

If that branch is unavailable, start from the current Windows build source and apply the patch in this shared folder:

```powershell
git apply "C:\Users\likim\Documents\Shared-Bridge\20_Deploy-To-Windows\2026-06-24-yeri-image-model-split\yeri_image_model_split.patch"
```

Before building, bump `aimax_compliance.py` to the next Windows release version, for example `v1.0.53`, so users can clearly confirm they installed the patched runner. Do not lower the server minimum version.

Required local tools:

- Python environment already used for AIMAX Windows builds.
- PyInstaller build dependencies from the repo.
- Go compiler, because `build.py` rebuilds `aimax-agent-launcher.exe`.
- Inno Setup `ISCC.exe` for the final `aimax-bundle-windows.exe` installer.

Run source gates:

```powershell
rg -n "image_model|yeriImageModel|gpt-image-2|gemini-3-pro-image|image_model_counts" app.py posting\editor.py content oracle
python -m py_compile app.py content\openai_image.py content\gemini_image.py posting\editor.py build.py
python -c "import build; build._preflight_build_guard()"
```

Build the app payload:

```powershell
python build.py
```

Then package the Windows installer. Use the same Inno Setup command pattern as the last successful Windows bundle build, but set the app version to the bumped version:

```powershell
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" packaging\windows\aimax_installer.iss /DSourceDir="$PWD\dist\AIMAX" /DOutputDir="$PWD\dist\upload" /DOutputBaseFilename="aimax-bundle-windows" /DAppVersion="1.0.53"
```

Expected artifact:

```text
dist\upload\aimax-bundle-windows.exe
```

## No-Paid Smoke Required

Before any live draft-save test, run a no-paid smoke proving the selected image model reaches the local runner and editor call path.

Minimum proof:

- Mock or capture a Yeri web job payload with `ai_model=gemini-2.5-flash` and `image_model=gpt-image-2`.
- Confirm `_remote_job_kwargs` / worker kwargs include `image_model=gpt-image-2`.
- Confirm `posting/editor.py input_content(..., image_model="gpt-image-2")` passes that value to `content/openai_image.generate_image(..., model="gpt-image-2")`.
- Confirm cost/result structures can include `image_model_counts` or `image_models`.

This can be done without real API calls by monkeypatching image generation and editor upload methods.

## Paid Draft-Save Smoke

After the no-paid smoke passes, run at most one paid internal test:

- Web app: `https://api.aimax.ai.kr/app`
- Target platform: Windows
- Job: Yeri blog writing
- Mode: draft/save only
- Keyword: `AIMAX 이미지 모델 분리 테스트`
- Shortest available word count
- Image count: `1`
- Writing model: any valid writing model, preferably `gemini-2.5-flash`
- Image model: `gpt-image-2` first. If account/model access fails, retry once with `gpt-image-1` and record the failure code.

Pass criteria:

- Job reaches `done`.
- Result has `images.attempted=1`, `images.generated=1`, `images.inserted=1`, `failure_count=0`.
- Result/cost includes the selected image model, not only the writing model.
- Actual Smart Editor body contains a real image/image block, not only `[이미지] ...` placeholder text.
- Save/reopen keeps the image visible.
- Web UI changes from running to done without hard refresh within about 3-10 seconds.

If image generation/upload was attempted but no real editor image appears, the correct result is failure/soft-failure with `images.inserted=0` and diagnostic stage `image_insert_verification`, not a false inserted count.

## Return Files

Return these files to this same shared folder:

- `WINDOWS_RESULT_20260624_yeri_image_model_split.md`
- `aimax_yeri_image_model_split_diag.json`
- `NEXT_TRIGGER_20260624_yeri_image_model_split.json`
- `aimax-bundle-windows.exe` or a clear pointer to the built artifact location if the file is too large for the bridge sync.

The result document must include:

- final release version
- artifact size and SHA256
- source branch/commit or patch source
- exact build commands used
- all verification command results
- no-paid smoke PASS/FAIL
- paid draft-save smoke PASS/FAIL, if run
- exact job ID for any live job
- selected writing model and selected image model
- whether the visible content was a real image or placeholder text
- sanitized log lines around generation/upload/insert
- whether any secrets, cookies, browser profiles, `.env`, or raw private logs were excluded

## Upload Ownership

Windows does not need Oracle SSH access.

Windows responsibility:

- Build the patched Windows installer.
- Verify it locally.
- Put `aimax-bundle-windows.exe` or a clear local/shared-bridge artifact pointer in this folder.
- Report artifact size and SHA256.
- Report the final release version and all verification results.

Mac/Ops responsibility after Windows result lands:

- Read `WINDOWS_RESULT_20260624_yeri_image_model_split.md`.
- Verify the artifact SHA256 matches the Windows report.
- Back up the current Oracle download file.
- Upload the new artifact to `/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe`.
- Verify remote SHA256 matches the Windows artifact SHA256.
- Update production Windows latest version only after artifact verification, for example `AIMAX_WINDOWS_LATEST_AGENT_VERSION=v1.0.53`.
- Restart `aimax-reports-api.service` if env/version configuration changed.
- Verify:
  - `https://api.aimax.ai.kr/health`
  - `https://api.aimax.ai.kr/api/version?current=<previous_version>&platform=windows`
  - download options expose the new Windows bundle.
- Report upload result back to the Telegram thread.

Do not copy Oracle SSH private keys into the Windows build machine or shared folders. If Windows direct upload is ever needed, create a restricted upload-only path instead of giving full shell access.

## User Guidance For Blocked Windows Users

If a user says the Windows app does not open or cannot proceed, guide them in this exact order:

1. Download the latest Windows installer from AIMAX again. The filename must be `aimax-bundle-windows.exe`.
2. Run the installer once.
3. If nothing appears, check V3 Lite, SmartScreen, and any company security program's security history for blocked/quarantined AIMAX or Setup entries.
4. If it is the official AIMAX file, allow it or add an exception, then run the installer one more time.
5. Refresh the web app, click `실행기 연결`, and confirm the local runner version is the new release version.
6. If still blocked, do not keep retrying. Send screenshots of the security history and Task Manager showing whether AIMAX or Setup is running.
