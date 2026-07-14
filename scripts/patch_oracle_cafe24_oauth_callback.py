#!/usr/bin/env python3
"""Patch Oracle AIMAX server with a simple Cafe24 OAuth callback page."""

from __future__ import annotations

import datetime as dt
import shutil
import subprocess
from pathlib import Path


SERVER = Path("/home/ubuntu/aimax-reports-api/server.js")
BACKUP_DIR = Path("/home/ubuntu/aimax-backups/20260624-cafe24-oauth-callback")
SERVICE = "aimax-reports-api.service"


HTML_HELPERS = r'''
function html(req, res, statusCode, body, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...corsHeaders(req),
    ...extraHeaders,
  });
  res.end(body);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
'''

HANDLER = r'''
function handleCafe24OauthCallback(req, res, url) {
  const code = String(url.searchParams.get("code") || "").trim();
  const state = String(url.searchParams.get("state") || "").trim();
  const error = String(url.searchParams.get("error") || "").trim();
  const errorDescription = String(url.searchParams.get("error_description") || "").trim();
  const body = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cafe24 OAuth Callback</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; background: #f7f8f5; color: #1c211f; }
    main { max-width: 720px; margin: 48px auto; padding: 0 20px; }
    section { background: #fff; border: 1px solid #dde2dc; border-radius: 8px; padding: 24px; }
    h1 { margin: 0 0 16px; font-size: 22px; }
    p { line-height: 1.6; }
    code { display: block; overflow-wrap: anywhere; white-space: pre-wrap; background: #f1f4f1; padding: 12px; border-radius: 6px; }
  </style>
</head>
<body>
  <main>
    <section>
      <h1>${error ? "Cafe24 인증 실패" : "Cafe24 인증 코드 수신"}</h1>
      ${error ? `<p>오류가 반환되었습니다.</p><code>${escapeHtml(error)}${errorDescription ? `\n${escapeHtml(errorDescription)}` : ""}</code>` : ""}
      ${code ? `<p>아래 인증 코드를 Codex에게 전달하면 refresh token으로 교환할 수 있습니다.</p><code>${escapeHtml(code)}</code>` : ""}
      ${state ? `<p>state</p><code>${escapeHtml(state)}</code>` : ""}
      ${!code && !error ? "<p>인증 코드가 URL에 포함되지 않았습니다.</p>" : ""}
    </section>
  </main>
</body>
</html>`;
  html(req, res, error ? 400 : 200, body);
}
'''

ROUTE = '''  if (req.method === "GET" && url.pathname === "/api/integrations/cafe24/oauth/callback") {
    handleCafe24OauthCallback(req, res, url);
    return;
  }
'''


def insert_before(text: str, anchor: str, block: str, marker: str, label: str) -> str:
    if marker in text:
        return text
    if anchor not in text:
        raise RuntimeError(f"anchor not found: {label}")
    return text.replace(anchor, block + anchor, 1)


def insert_after(text: str, anchor: str, block: str, marker: str, label: str) -> str:
    if marker in text:
        return text
    if anchor not in text:
        raise RuntimeError(f"anchor not found: {label}")
    return text.replace(anchor, anchor + block, 1)


def main() -> int:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = BACKUP_DIR / f"server.js.before-cafe24-oauth-callback-{stamp}"
    tmp = BACKUP_DIR / f"server.cafe24-oauth-callback-{stamp}.tmp.js"

    text = SERVER.read_text(encoding="utf-8")
    shutil.copy2(SERVER, backup)
    text = insert_after(text, "function json(req, res, statusCode, payload, extraHeaders = {})", "", "function json(req, res, statusCode, payload, extraHeaders = {})", "json noop")
    text = insert_before(text, "\nfunction readBody(req) {\n", HTML_HELPERS + "\n", "function escapeHtml", "html helpers")
    text = insert_before(text, "\nfunction handleAdminListCafe24Orders(req, res) {\n", HANDLER + "\n", "function handleCafe24OauthCallback", "callback handler")
    text = insert_after(
        text,
        '''  if (req.method === "POST" && url.pathname === "/api/integrations/cafe24/partner-attribution") {
    handleCafe24PartnerAttribution(req, res);
    return;
  }
''',
        ROUTE,
        'url.pathname === "/api/integrations/cafe24/oauth/callback"',
        "callback route",
    )

    tmp.write_text(text, encoding="utf-8")
    subprocess.run(["node", "--check", str(tmp)], check=True)
    shutil.copy2(tmp, SERVER)
    subprocess.run(["node", "--check", str(SERVER)], check=True)
    subprocess.run(["systemctl", "--user", "restart", SERVICE], check=True)
    subprocess.run(["systemctl", "--user", "is-active", SERVICE], check=True)
    print("server_patch=applied")
    print(f"server_backup={backup}")
    print(f"server_tmp={tmp}")
    print("service=active")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
