# Windows AI Developer Addendum - Dashboard Payload Contract

Date: 2026-05-07
Project: AIMAX / NaverBlogAuto
Audience: Windows AI developer working on the Local Agent hotfix

## Why This Addendum Exists

Mac/Oracle side has started the web dashboard hotfix for the user feedback reported by the Windows tester.

The dashboard can now display failed blog keywords and failure stages, but it depends on the Windows Local Agent sending failure details in a predictable result payload.

Please treat this note as the payload contract between the Windows Local Agent and the Oracle/web dashboard.

## Boundary

Please keep your work focused on the Windows Local Agent and Windows build.

Do not modify or deploy these files from the Windows side:

- `oracle/aimax-reports-api/server.js`
- `oracle/aimax-reports-api/static/app.html`
- `oracle/aimax-reports-api/static/admin.html`

Those files are being handled from the Mac/Oracle side.

## Result Payload Contract

When a job finishes, the Windows Local Agent should continue sending the usual job update to:

`POST /api/agent/jobs/update`

If a blog keyword fails, include enough detail for the dashboard to show the user:

- which keyword failed
- at which stage it failed
- the sanitized error summary
- which keywords still succeeded

Minimum fields expected for failed items:

- `keyword`
- `source`
- `status`
- `stage`
- `error`

`status` should be `"failed"` for failed items.

The dashboard accepts failed items in either of these arrays:

- `failed_posts`
- `failures`

Prefer `failed_posts` for clarity.

## Recommended Payload Shape

Use this shape when a multi-keyword blog job partially fails:

```json
{
  "ok": false,
  "success": 1,
  "total": 3,
  "mode": "publish",
  "stage": "naver_editor_login",
  "failed_keyword": "강남 피부관리",
  "error": "invalid session: browser closed",
  "posts": [
    {
      "keyword": "서초 피부관리",
      "source": "서초 피부관리",
      "title": "서초 피부관리 추천...",
      "status": "done",
      "char_count": 1420,
      "target_char_count": 1500
    }
  ],
  "failed_posts": [
    {
      "keyword": "강남 피부관리",
      "source": "강남 피부관리",
      "status": "failed",
      "stage": "naver_editor_login",
      "error": "invalid session: browser closed"
    },
    {
      "keyword": "리프팅 후기",
      "source": "리프팅 후기",
      "status": "failed",
      "stage": "smart_editor_publish",
      "error": "publish button not found after retry"
    }
  ]
}
```

For a single-keyword total failure, still send the same shape:

```json
{
  "ok": false,
  "success": 0,
  "total": 1,
  "mode": "publish",
  "stage": "smart_editor_input",
  "failed_keyword": "강남 피부관리",
  "error": "invalid session: browser closed",
  "posts": [],
  "failed_posts": [
    {
      "keyword": "강남 피부관리",
      "source": "강남 피부관리",
      "status": "failed",
      "stage": "smart_editor_input",
      "error": "invalid session: browser closed"
    }
  ]
}
```

## Stage Names

Please use short, stable English identifiers for `stage`.

Recommended values:

- `job_start`
- `content_generation`
- `image_generation`
- `browser_start`
- `naver_login`
- `naver_editor_login`
- `smart_editor_open`
- `smart_editor_input`
- `smart_editor_publish`
- `smart_editor_save`
- `smart_editor_schedule`
- `result_report`

If you need a new stage, add it as a short snake_case value. Avoid long exception text in `stage`; put exception details in `error`.

## Error Sanitization

The server redacts obvious secrets, but the Windows Local Agent should still avoid sending raw credentials, cookies, API keys, signed URLs, or full local paths.

Good:

`invalid session: browser closed`

Good:

`DevTools disconnected while opening SmartEditor`

Avoid:

- full Naver cookies
- API keys
- passwords
- full Chrome profile paths
- raw signed image URLs
- huge Selenium stack traces

If the original exception is long, send a short first-line summary.

## Important Retry Rule

For `invalid session`, `DevTools disconnected`, or browser-closed recovery:

Do not automatically regenerate AI text or images.

If text/images were already generated, reuse the existing generated content and only recreate the browser driver once.

Reason: AI generation can incur paid API cost. A browser recovery should not duplicate paid generation.

## Dashboard Compatibility Notes

Mac/Oracle side now accepts these fields:

- `result.stage`
- `result.failed_keyword`
- `result.error`
- `result.posts[].keyword`
- `result.posts[].stage`
- `result.posts[].error`
- `result.failed_posts[]`
- `result.failures[]`

The dashboard will show failed keyword details in:

- recent jobs
- job table recent log column
- staff recent jobs

## Completion Report Requested

When you finish the Windows hotfix, please include:

- changed file list
- Windows installer filenames and version
- commands/tests you ran
- single-instance / duplicate `aimax://agent/connect` test result
- `invalid session` recovery test result
- bold-input duplicate keyword test result
- one sample failed job payload
- whether any paid API call or real blog publishing was used

Please do not run paid API generation or real blog publishing unless the user explicitly approves the provider, model, action, and expected cost.

