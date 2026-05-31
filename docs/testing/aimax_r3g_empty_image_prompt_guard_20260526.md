# AIMAX R3-G Empty Image Prompt Guard

Date: 2026-05-26 KST

## Purpose

Prevent Yeori image generation from failing when generated markdown contains an empty or placeholder image line such as:

```markdown
[이미지]
[이미지] 프롬프트:
[이미지] 이미지
```

## Changed Files

```text
app.py
split_version/app.py
posting/editor.py
aimax_compliance.py
split_version/aimax_compliance.py
```

## Behavior

- Empty or placeholder image prompts are repaired before image generation.
- The fallback prompt is derived from the blog title or source keyword.
- Existing valid image prompts are preserved.
- The final image insertion layer still refuses to call an image provider when the prompt is empty.

Example fallback:

```text
AIMAX 예리 테스트 주제를 시각적으로 설명하는 네이버 블로그용 이미지 1, 자연스러운 사진 스타일, 밝고 선명한 분위기, 텍스트나 로고 없이
```

## No-Paid Verification

```text
python -m py_compile aimax_compliance.py split_version/aimax_compliance.py app.py split_version/app.py posting/editor.py
pass

R3-G no-paid image prompt repair smoke passed
```

The smoke verified:

- parser still returns an empty image block for `[이미지]`,
- repair layer converts the empty prompt into a fallback prompt,
- valid prompts are left unchanged,
- no paid AI/API call is made.

## Mac Build Evidence

Mac R3-G build:

```text
version: v1.0.13
bundle version: 1.0.13
diagnostics: /private/tmp/aimax_v113_r3g_diag.json
frozen runtime: true
codesign --verify --deep --strict: pass
hdiutil verify dist/AIMAX-macos.dmg: pass
sha256: 333a8fce6ae2662faea919c0ec0fb3a391e67caec99fcb43b6ee09fbb7c65d71
```

## Safety

- No paid AI call.
- No Apify call.
- No Naver publish/schedule.
- No customer credentials.
- No live Oracle version API update yet for R3-G.

## Next

Send the same fix to Windows Codex for Windows `v1.0.22` implementation and no-paid verification.
