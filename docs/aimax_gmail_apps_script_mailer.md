# AIMAX Gmail Apps Script Mailer

Purpose: let the AIMAX Oracle admin page send buyer onboarding guides through the Gmail account that owns the Apps Script deployment, e.g. `naminsoo@aixlife.co.kr`.

## Server Environment

Set these on the Oracle service environment:

```text
AIMAX_MAIL_FROM=AIMAX <naminsoo@aixlife.co.kr>
AIMAX_MAIL_REPLY_TO=naminsoo@aixlife.co.kr
AIMAX_MAIL_WEBHOOK_URL=<Google Apps Script Web App URL>
AIMAX_MAIL_WEBHOOK_SECRET=<long random secret>
```

## Apps Script

Deploy as a Web App:

- Execute as: `Me`
- Who has access: only callers with the URL are acceptable if the shared secret below is long and private.

```javascript
const AIMAX_MAIL_WEBHOOK_SECRET = 'replace-with-the-same-secret-as-oracle-env';

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    if (payload.secret !== AIMAX_MAIL_WEBHOOK_SECRET) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }

    const to = String(payload.to || '').trim();
    const subject = String(payload.subject || '').trim();
    const text = String(payload.text || '').trim();
    const html = String(payload.html || '').trim();
    const replyTo = String(payload.reply_to || '').trim();

    if (!to || !subject || !text) {
      return json({ ok: false, error: 'missing_required_fields' }, 400);
    }

    GmailApp.sendEmail(to, subject, text, {
      htmlBody: html || undefined,
      replyTo: replyTo || undefined,
      name: 'AIMAX',
    });

    return json({
      ok: true,
      provider: 'gmail_app_script',
      id: Utilities.getUuid(),
      sent_at: new Date().toISOString(),
    }, 200);
  } catch (error) {
    return json({ ok: false, error: String(error && error.message || error) }, 500);
  }
}

function json(payload, status) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
```

Note: Apps Script `ContentService` cannot set HTTP status codes reliably for every deployment mode; AIMAX still treats `{ ok: false }` as failure.
