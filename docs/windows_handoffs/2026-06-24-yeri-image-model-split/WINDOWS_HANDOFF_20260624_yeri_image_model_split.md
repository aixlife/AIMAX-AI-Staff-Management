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

