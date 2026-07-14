#!/usr/bin/env python3
"""Patch Oracle AIMAX Cafe24 partner attribution with Admin API order lookup."""

from __future__ import annotations

import datetime as dt
import shutil
import subprocess
from pathlib import Path


SERVER = Path("/home/ubuntu/aimax-reports-api/server.js")
BACKUP_DIR = Path("/home/ubuntu/aimax-backups/20260624-cafe24-admin-lookup")
SERVICE = "aimax-reports-api.service"


CONST_ANCHOR = 'const CAFE24_PARTNER_NOTION_TIMEOUT_MS = Math.max(1000, Number(process.env.AIMAX_CAFE24_PARTNER_NOTION_TIMEOUT_MS || 7000));\n'
CONST_BLOCK = '''const CAFE24_ADMIN_MALL_ID = String(process.env.AIMAX_CAFE24_ADMIN_MALL_ID || process.env.CAFE24_MALL_ID || "").trim();
const CAFE24_ADMIN_CLIENT_ID = String(process.env.AIMAX_CAFE24_ADMIN_CLIENT_ID || process.env.CAFE24_CLIENT_ID || "").trim();
const CAFE24_ADMIN_CLIENT_SECRET = String(process.env.AIMAX_CAFE24_ADMIN_CLIENT_SECRET || process.env.CAFE24_CLIENT_SECRET || "").trim();
const CAFE24_ADMIN_ACCESS_TOKEN = String(process.env.AIMAX_CAFE24_ADMIN_ACCESS_TOKEN || process.env.CAFE24_ACCESS_TOKEN || "").trim();
const CAFE24_ADMIN_REFRESH_TOKEN = String(process.env.AIMAX_CAFE24_ADMIN_REFRESH_TOKEN || process.env.CAFE24_REFRESH_TOKEN || "").trim();
const CAFE24_ADMIN_TOKEN_FILE = expandHomePath(process.env.AIMAX_CAFE24_ADMIN_TOKEN_FILE || path.join(DATA_DIR, "cafe24-admin-token.json"));
const CAFE24_ADMIN_TIMEOUT_MS = Math.max(1000, Number(process.env.AIMAX_CAFE24_ADMIN_TIMEOUT_MS || 7000));
'''

ADMIN_HELPERS = r'''
function cafe24AdminConfigured() {
  return Boolean(
    CAFE24_ADMIN_MALL_ID
      && (
        CAFE24_ADMIN_ACCESS_TOKEN
        || (CAFE24_ADMIN_REFRESH_TOKEN && CAFE24_ADMIN_CLIENT_ID && CAFE24_ADMIN_CLIENT_SECRET)
        || fs.existsSync(CAFE24_ADMIN_TOKEN_FILE)
      ),
  );
}

function cafe24AdminOrderId(input) {
  const row = cafe24OrderSource(input);
  const keys = [
    "order_id",
    "orderId",
    "order_no",
    "orderNo",
    "order_number",
    "orderNumber",
    "cafe24_order_id",
    "cafe24OrderId",
    "external_id",
    "externalId",
  ];
  for (const source of [input, row]) {
    if (!source || typeof source !== "object") continue;
    for (const key of keys) {
      const value = compactText(source[key], 80);
      if (value && !value.startsWith("derived:")) return value;
    }
  }
  return "";
}

function readCafe24AdminTokenState() {
  const fileState = readJsonFile(CAFE24_ADMIN_TOKEN_FILE, {}, { allowFallbackOnError: true });
  return {
    access_token: compactText(fileState.access_token || CAFE24_ADMIN_ACCESS_TOKEN, 4000),
    refresh_token: compactText(fileState.refresh_token || CAFE24_ADMIN_REFRESH_TOKEN, 4000),
    expires_at: compactText(fileState.expires_at || "", 80),
    refresh_token_expires_at: compactText(fileState.refresh_token_expires_at || "", 80),
    mall_id: compactText(fileState.mall_id || CAFE24_ADMIN_MALL_ID, 80),
    shop_no: compactText(fileState.shop_no || "", 20),
    token_type: compactText(fileState.token_type || "Bearer", 20) || "Bearer",
  };
}

function writeCafe24AdminTokenState(tokenState) {
  if (!tokenState || typeof tokenState !== "object") return;
  const next = {
    access_token: String(tokenState.access_token || "").trim(),
    refresh_token: String(tokenState.refresh_token || "").trim(),
    expires_at: String(tokenState.expires_at || "").trim(),
    refresh_token_expires_at: String(tokenState.refresh_token_expires_at || "").trim(),
    mall_id: String(tokenState.mall_id || CAFE24_ADMIN_MALL_ID || "").trim(),
    shop_no: String(tokenState.shop_no || "").trim(),
    token_type: String(tokenState.token_type || "Bearer").trim() || "Bearer",
    updated_at: nowIso(),
  };
  if (!next.access_token && !next.refresh_token) return;
  writeJsonAtomic(CAFE24_ADMIN_TOKEN_FILE, next);
}

function cafe24AdminTokenExpiredSoon(expiresAt, graceMs = 5 * 60 * 1000) {
  const time = Date.parse(String(expiresAt || ""));
  if (!Number.isFinite(time)) return false;
  return time <= Date.now() + graceMs;
}

function cafe24AdminExtractProductNos(value) {
  const out = new Set();
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (Object.prototype.hasOwnProperty.call(node, "product_no")) {
      const token = cafe24ProductNoToken(`product_no=${node.product_no}`);
      if (token) out.add(token.replace(/^product_no:/, ""));
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    for (const key of ["order", "orders", "items", "item", "products", "product"]) {
      const child = node[key];
      if (child && typeof child === "object") walk(child);
    }
  };
  walk(value);
  return [...out];
}

function withCafe24AdminProductNo(input, productNos, orderId = "") {
  const productNo = Array.isArray(productNos) ? String(productNos[0] || "").trim() : "";
  if (!productNo) return input;
  return {
    ...(input && typeof input === "object" ? input : {}),
    cafe24_order_id: orderId || cafe24AdminOrderId(input),
    product_no: productNo,
    productNo,
    product_nos: productNos,
    cafe24_admin_product_nos: productNos,
  };
}

async function refreshCafe24AdminAccessToken() {
  const current = readCafe24AdminTokenState();
  const refreshToken = current.refresh_token;
  if (!CAFE24_ADMIN_MALL_ID || !CAFE24_ADMIN_CLIENT_ID || !CAFE24_ADMIN_CLIENT_SECRET || !refreshToken) {
    const error = new Error("cafe24_api_credentials_missing");
    error.code = "cafe24_api_credentials_missing";
    throw error;
  }
  const target = `https://${encodeURIComponent(CAFE24_ADMIN_MALL_ID)}.cafe24api.com/api/v2/oauth/token`;
  const auth = Buffer.from(`${CAFE24_ADMIN_CLIENT_ID}:${CAFE24_ADMIN_CLIENT_SECRET}`, "utf8").toString("base64");
  const token = await requestFormUrl(target, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  }, {
    authorization: `Basic ${auth}`,
  }, CAFE24_ADMIN_TIMEOUT_MS);
  writeCafe24AdminTokenState(token);
  return token;
}

async function cafe24AdminAccessToken(forceRefresh = false) {
  const current = readCafe24AdminTokenState();
  if (!forceRefresh && current.access_token && !cafe24AdminTokenExpiredSoon(current.expires_at)) {
    return current.access_token;
  }
  if (current.refresh_token && CAFE24_ADMIN_CLIENT_ID && CAFE24_ADMIN_CLIENT_SECRET) {
    const refreshed = await refreshCafe24AdminAccessToken();
    return String(refreshed.access_token || "").trim();
  }
  return current.access_token || "";
}

async function fetchCafe24AdminOrderProductNos(orderId) {
  const cleanOrderId = compactText(orderId, 80);
  if (!cleanOrderId) return { ok: false, reason: "order_id_missing", order_id: "" };
  if (!cafe24AdminConfigured()) return { ok: false, reason: "cafe24_api_not_configured", order_id: cleanOrderId };
  const path = `/api/v2/admin/orders/${encodeURIComponent(cleanOrderId)}`;
  const query = new URLSearchParams({ embed: "items" });
  const target = `https://${encodeURIComponent(CAFE24_ADMIN_MALL_ID)}.cafe24api.com${path}?${query.toString()}`;

  for (const forceRefresh of [false, true]) {
    const accessToken = await cafe24AdminAccessToken(forceRefresh);
    if (!accessToken) return { ok: false, reason: "cafe24_access_token_missing", order_id: cleanOrderId };
    try {
      const data = await requestJsonUrl(target, {
        method: "GET",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        timeoutMs: CAFE24_ADMIN_TIMEOUT_MS,
      });
      const productNos = cafe24AdminExtractProductNos(data);
      return {
        ok: true,
        reason: productNos.length ? "cafe24_api" : "product_no_missing",
        order_id: cleanOrderId,
        product_no: productNos[0] || "",
        product_nos: productNos,
      };
    } catch (error) {
      if (!forceRefresh && [401, 403].includes(Number(error.statusCode || 0))) continue;
      return {
        ok: false,
        reason: "cafe24_api_order_lookup_failed",
        order_id: cleanOrderId,
        error: String(error.code || error.message || "cafe24_api_order_lookup_failed").slice(0, 120),
      };
    }
  }
  return { ok: false, reason: "cafe24_api_order_lookup_failed", order_id: cleanOrderId };
}

async function enrichCafe24PartnerInputWithAdminProductNo(input) {
  if (collectCafe24PartnerCandidates(input).some((candidate) => cafe24ProductNoToken(candidate))) {
    return { input, lookup: { ok: false, reason: "product_no_already_present", order_id: cafe24AdminOrderId(input) } };
  }
  const orderId = cafe24AdminOrderId(input);
  if (!orderId) return { input, lookup: { ok: false, reason: "order_id_missing", order_id: "" } };
  const lookup = await fetchCafe24AdminOrderProductNos(orderId);
  if (!lookup.ok || !lookup.product_no) return { input, lookup };
  return {
    input: withCafe24AdminProductNo(input, lookup.product_nos, orderId),
    lookup,
  };
}
'''

MATCH_FUNCTION = r'''function matchCafe24PartnerRows(input, partnerRows) {
  const candidates = collectCafe24PartnerCandidates(input);
  if (!candidates.length) return { matched: false, partner: null, reason: "no_partner_hint" };
  const candidateTokens = new Set();
  for (const candidate of candidates) {
    for (const token of partnerUrlTokens(candidate)) {
      if (token) candidateTokens.add(token);
    }
    const compact = compactPartnerToken(candidate);
    if (compact.length >= 3) candidateTokens.add(compact);
  }

  const candidateProductTokens = [...candidateTokens].filter((token) => token.startsWith("product_no:"));
  if (candidateProductTokens.length) {
    for (const row of partnerRows || []) {
      const rowProductNoToken = row.product_no ? `product_no:${row.product_no}` : cafe24ProductNoToken(`${row.url || ""} ${row.note || ""}`);
      if (rowProductNoToken && candidateProductTokens.includes(rowProductNoToken)) {
        const productNo = rowProductNoToken.replace(/^product_no:/, "");
        return { matched: true, partner: { ...row, product_no: row.product_no || productNo }, reason: "product_no" };
      }
    }
    return { matched: false, partner: null, reason: "no_match" };
  }

  for (const row of partnerRows || []) {
    const rowTokens = new Set();
    for (const token of partnerUrlTokens(row.url)) {
      if (token && !token.startsWith("product_no:")) rowTokens.add(token);
    }
    for (const token of String(row.note || "").split(/[\s,;/|]+/)) {
      const compact = compactPartnerToken(token);
      if (compact.length >= 3) rowTokens.add(compact);
    }
    for (const rowToken of rowTokens) {
      if (!rowToken || rowToken.length < 3) continue;
      for (const candidateToken of candidateTokens) {
        if (
          candidateToken === rowToken
          || (rowToken.length >= 8 && candidateToken.includes(rowToken))
          || (candidateToken.length >= 8 && rowToken.includes(candidateToken))
        ) {
          return { matched: true, partner: row, reason: "matched" };
        }
      }
    }
  }
  return { matched: false, partner: null, reason: "no_match" };
}'''

RESOLVE_FUNCTION = r'''async function resolveCafe24PartnerAttribution(input) {
  const enriched = await enrichCafe24PartnerInputWithAdminProductNo(input);
  const targetInput = enriched.input || input;
  const adminLookup = enriched.lookup || {};
  const candidates = collectCafe24PartnerCandidates(targetInput);
  if (!candidates.length) {
    return {
      matched: false,
      partner: null,
      partner_line: "",
      reason: "no_partner_hint",
      candidates: [],
      cafe24_admin_lookup: adminLookup,
    };
  }
  const lookup = await fetchCafe24PartnerRowsFromNotion();
  if (!lookup.ok) {
    return {
      matched: false,
      partner: null,
      partner_line: "",
      reason: lookup.reason,
      error: lookup.error || "",
      candidates,
      cafe24_admin_lookup: adminLookup,
    };
  }
  const match = matchCafe24PartnerRows(targetInput, lookup.rows);
  if (!match.matched) {
    return { ...match, partner_line: "", candidates, lookup_reason: lookup.reason, cafe24_admin_lookup: adminLookup };
  }
  return {
    ...match,
    partner_line: cafe24PartnerLine(match.partner),
    partner_product_no: match.partner?.product_no || "",
    candidates,
    lookup_reason: lookup.reason,
    cafe24_admin_lookup: adminLookup,
  };
}'''

HANDLER_FUNCTION = r'''async function handleCafe24PartnerAttribution(req, res) {
  if (!requireCafe24Webhook(req, res)) return;
  const body = await readJsonBody(req, res);
  if (!body) return;
  try {
    const attribution = await resolveCafe24PartnerAttribution(body);
    json(req, res, 200, {
      ok: true,
      matched: Boolean(attribution.matched),
      partner_line: attribution.partner_line || "",
      partner_name: attribution.partner?.name || "",
      partner_product_no: attribution.partner_product_no || attribution.partner?.product_no || "",
      reason: attribution.reason || attribution.lookup_reason || "",
      cafe24_admin_lookup_reason: attribution.cafe24_admin_lookup?.reason || "",
      cafe24_order_id: attribution.cafe24_admin_lookup?.order_id || "",
    });
  } catch (error) {
    json(req, res, 200, {
      ok: true,
      matched: false,
      partner_line: "",
      partner_name: "",
      partner_product_no: "",
      reason: "partner_attribution_failed",
      cafe24_admin_lookup_reason: "",
      cafe24_order_id: "",
      error: String(error.code || error.message || "partner_attribution_failed").slice(0, 120),
    });
  }
}'''

REQUEST_HELPERS = r'''
function requestUrl(targetUrl, options = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (_error) {
      reject(Object.assign(new Error("invalid_request_url"), { statusCode: 500, code: "invalid_request_url" }));
      return;
    }
    const client = parsed.protocol === "https:" ? https : parsed.protocol === "http:" ? http : null;
    if (!client) {
      reject(Object.assign(new Error("unsupported_request_protocol"), { statusCode: 500, code: "unsupported_request_protocol" }));
      return;
    }
    const body = options.body === undefined || options.body === null ? null : Buffer.from(String(options.body));
    const headers = {
      ...(options.headers || {}),
    };
    if (body && !Object.prototype.hasOwnProperty.call(headers, "content-length")) {
      headers["content-length"] = body.length;
    }
    const request = client.request(
      parsed,
      {
        method: options.method || "GET",
        headers,
      },
      (response) => {
        const chunks = [];
        let total = 0;
        const maxBytes = options.maxBytes || 1024 * 1024;
        response.on("data", (chunk) => {
          total += chunk.length;
          if (total <= maxBytes) chunks.push(chunk);
        });
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if (response.statusCode < 200 || response.statusCode >= 300) {
            const error = new Error(`http_${response.statusCode || 0}`);
            error.statusCode = response.statusCode || 502;
            error.code = `http_${response.statusCode || 0}`;
            error.body = redactText(text).slice(0, 1000);
            reject(error);
            return;
          }
          resolve({ statusCode: response.statusCode || 200, headers: response.headers, text });
        });
      },
    );
    request.setTimeout(options.timeoutMs || 12000, () => {
      request.destroy(Object.assign(new Error("request_timeout"), { code: "request_timeout" }));
    });
    request.on("error", (error) => reject(Object.assign(error, { code: error.code || "request_failed" })));
    if (body) request.write(body);
    request.end();
  });
}

async function requestJsonUrl(targetUrl, options = {}) {
  const result = await requestUrl(targetUrl, {
    ...options,
    headers: {
      accept: "application/json",
      ...(options.headers || {}),
    },
  });
  try {
    return result.text ? JSON.parse(result.text) : {};
  } catch (_error) {
    const error = new Error("invalid_json_response");
    error.statusCode = 502;
    error.code = "invalid_json_response";
    error.body = redactText(result.text).slice(0, 1000);
    throw error;
  }
}

async function requestFormUrl(targetUrl, payload, headers = {}, timeoutMs = 12000) {
  const body = new URLSearchParams(payload || {}).toString();
  return requestJsonUrl(targetUrl, {
    method: "POST",
    body,
    timeoutMs,
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=utf-8",
      ...headers,
    },
  });
}
'''


def function_span(text: str, name: str) -> tuple[int, int]:
    marker = f"async function {name}"
    start = text.find(marker)
    if start < 0:
        marker = f"function {name}"
        start = text.find(marker)
    if start < 0:
        raise RuntimeError(f"function not found: {name}")
    brace = text.find("{", start)
    depth = 0
    in_str = ""
    escape = False
    in_line = False
    in_block = False
    for i in range(brace, len(text)):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""
        if in_line:
            if ch == "\n":
                in_line = False
            continue
        if in_block:
            if ch == "*" and nxt == "/":
                in_block = False
            continue
        if in_str:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == in_str:
                in_str = ""
            continue
        if ch in ('"', "'", "`"):
            in_str = ch
            continue
        if ch == "/" and nxt == "/":
            in_line = True
            continue
        if ch == "/" and nxt == "*":
            in_block = True
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return start, i + 1
    raise RuntimeError(f"function end not found: {name}")


def replace_function(text: str, name: str, replacement: str) -> str:
    start, end = function_span(text, name)
    return text[:start] + replacement + text[end:]


def insert_once(text: str, anchor: str, block: str, marker: str, label: str) -> str:
    if marker in text:
        return text
    if anchor not in text:
        raise RuntimeError(f"anchor not found: {label}")
    return text.replace(anchor, anchor + block, 1)


def insert_before_once(text: str, anchor: str, block: str, marker: str, label: str) -> str:
    if marker in text:
        return text
    if anchor not in text:
        raise RuntimeError(f"anchor not found: {label}")
    return text.replace(anchor, block + anchor, 1)


def main() -> int:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = BACKUP_DIR / f"server.js.before-cafe24-admin-lookup-{stamp}"
    tmp = BACKUP_DIR / f"server.cafe24-admin-lookup-{stamp}.tmp.js"

    text = SERVER.read_text(encoding="utf-8")
    shutil.copy2(SERVER, backup)

    text = insert_once(text, CONST_ANCHOR, CONST_BLOCK, "CAFE24_ADMIN_MALL_ID", "admin const")
    text = insert_before_once(text, "\nfunction notionRichTextPlain(items) {\n", ADMIN_HELPERS + "\n", "function cafe24AdminConfigured", "admin helpers")
    text = insert_before_once(text, "\nfunction guideHtmlFromText(text) {\n", REQUEST_HELPERS + "\n", "function requestJsonUrl", "request helpers")
    text = replace_function(text, "matchCafe24PartnerRows", MATCH_FUNCTION)
    text = replace_function(text, "resolveCafe24PartnerAttribution", RESOLVE_FUNCTION)
    text = replace_function(text, "handleCafe24PartnerAttribution", HANDLER_FUNCTION)

    if "cafe24AdminExtractProductNos" not in text[text.find("__cafe24Test:"):text.find("__yeriHybridTest:")]:
        text = text.replace(
            "    buildCafe24Order,\n",
            "    buildCafe24Order,\n    cafe24AdminExtractProductNos,\n    cafe24AdminOrderId,\n",
            1,
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
