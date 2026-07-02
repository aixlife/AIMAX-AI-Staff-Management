# Previous Error Context - v1.0.9 Editor Contract Failure

Date: 2026-05-20 KST
Purpose: explain why the v1.0.10 no-paid smoke verification is needed

## Sanitized Customer Scenario

- Platform: Windows
- App version reported by web app: v1.0.9
- Product entitlement: bundle
- Workflow: Yeri blog writing
- Selected text model: Gemini 2.5 Flash
- AI key status: Gemini ready
- Naver account status: ready
- Local agent status at report time: connected and busy

No raw customer email, password, API key, cookie, token, or browser profile is included here.

## Visible Error

```text
신용취약소상공인자금 처리 실패: input_content() got an unexpected keyword argument 'image_provider'
실패: 신용취약소상공인자금 · smart_editor_input · input_content() got an unexpected keyword argument 'image_provider'
```

## Failed Stage

```text
smart_editor_input
```

Meaning: AI text generation had already progressed, but the local agent failed while inserting the generated content into the Naver SmartEditor body.

## Confirmed Root Cause

This was not a customer Gemini API key problem.

The v1.0.9 Windows bundle mixed a newer caller with an older bundled `posting/editor.py` contract:

- caller passed `image_provider` and `fallback_api_key`
- bundled `input_content()` did not accept `image_provider`
- Python raised:

```text
TypeError: input_content() got an unexpected keyword argument 'image_provider'
```

## Cost/Retry Note

At least two user attempts failed at the editor-input stage after text generation work had progressed.

Observed reported text costs were small, but real:

- failed job 1: about 66 KRW
- failed job 2: about 94 KRW

Because costs can occur before editor insertion fails, do not ask the customer to repeatedly retry until v1.0.10 is installed and verified.

## Separate Older Issue

Older reports from the same general period also included Gemini 2.5 Pro `429/quota exceeded` errors.

Do not confuse that with this v1.0.9 editor contract failure:

- `429/quota exceeded`: user/provider quota or billing issue
- `image_provider TypeError`: Windows bundle/editor contract mismatch

The v1.0.10 smoke verification in this folder is focused on the second issue.

## What v1.0.10 Is Expected To Fix

The Windows v1.0.10 candidate should include:

- `input_content(driver, content_list, api_key, image_provider="gemini", fallback_api_key="")`
- `_input_image(..., image_provider="gemini", fallback_api_key="")`
- provider-aware image generation helper
- OpenAI image fallback module included in the frozen bundle
- existing v1.0.9 Chrome-start recovery logic retained

## Verification Goal

The no-paid smoke should prove that the editor input path can be called with:

```python
image_provider="gemini"
fallback_api_key="dummy-fallback"
```

without raising the original TypeError, without calling paid AI APIs, and without interacting with a real Naver editor session.
