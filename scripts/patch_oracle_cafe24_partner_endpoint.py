#!/usr/bin/env python3
"""Patch the Oracle AIMAX server with the Cafe24 partner attribution endpoint.

This intentionally patches the current production server.js in place instead of
deploying the whole local web bundle, because the local worktree can contain
unrelated unreleased changes. The script creates a backup, checks syntax before
and after install, and restarts the user systemd service.
"""

from __future__ import annotations

import datetime as dt
import shutil
import subprocess
from pathlib import Path


SERVER = Path("/home/ubuntu/aimax-reports-api/server.js")
BACKUP_DIR = Path("/home/ubuntu/aimax-backups/20260615-cafe24-partner-attribution")
SERVICE = "aimax-reports-api.service"


CONST_ANCHOR = 'const CAFE24_AUTO_PROCESS_LOCK_MS = Number(process.env.AIMAX_CAFE24_AUTO_PROCESS_LOCK_MS || 10 * 60 * 1000);\n'
CONST_BLOCK = '''const CAFE24_PARTNER_NOTION_TOKEN = String(process.env.AIMAX_CAFE24_PARTNER_NOTION_TOKEN || process.env.NOTION_MAKEFAMILY_API_KEY || "").trim();
const CAFE24_PARTNER_NOTION_DATABASE_ID = String(process.env.AIMAX_CAFE24_PARTNER_NOTION_DATABASE_ID || "37bb31f1da5580bfb5d2f5980e223377").trim();
const CAFE24_PARTNER_NOTION_DATA_SOURCE_ID = String(process.env.AIMAX_CAFE24_PARTNER_NOTION_DATA_SOURCE_ID || "").trim();
const CAFE24_PARTNER_NOTION_VERSION = String(process.env.AIMAX_CAFE24_PARTNER_NOTION_VERSION || "2022-06-28").trim();
const CAFE24_PARTNER_NOTION_CACHE_MS = Math.max(0, Number(process.env.AIMAX_CAFE24_PARTNER_NOTION_CACHE_MS || 0));
const CAFE24_PARTNER_NOTION_TIMEOUT_MS = Math.max(1000, Number(process.env.AIMAX_CAFE24_PARTNER_NOTION_TIMEOUT_MS || 7000));
'''

CACHE_ANCHOR = "const eunseoLaunchTickets = new Map();\n"
CACHE_BLOCK = "let cafe24PartnerNotionCache = { fetched_at: 0, rows: [] };\n"

HELPER_BLOCK = r'''
function cleanPartnerCompareText(value) {
  let text = String(value || "").trim();
  if (!text) return "";
  try {
    text = decodeURIComponent(text);
  } catch (_error) {}
  return text
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
    .trim();
}

function partnerUrlTokens(value) {
  const raw = String(value || "").trim();
  const tokens = new Set();
  if (!raw) return tokens;
  const productNoToken = cafe24ProductNoToken(raw);
  if (productNoToken) {
    tokens.add(productNoToken);
    return tokens;
  }
  tokens.add(raw);
  tokens.add(cleanPartnerCompareText(raw));
  try {
    const parsed = new URL(raw);
    tokens.add(cleanPartnerCompareText(`${parsed.hostname}${parsed.pathname}`));
    for (const key of ["product_no", "partner", "ref", "utm_source", "utm_campaign", "coupon", "code"]) {
      const item = parsed.searchParams.get(key);
      if (key === "product_no") {
        const itemToken = cafe24ProductNoToken(`product_no=${item || ""}`);
        if (itemToken) tokens.add(itemToken);
      } else if (item && String(item).trim().length >= 3) {
        tokens.add(String(item).trim().toLowerCase());
      }
    }
  } catch (_error) {}
  return tokens;
}

function cafe24ProductNoToken(value) {
  let text = String(value || "").trim();
  if (!text) return "";
  for (let i = 0; i < 2; i += 1) {
    try {
      const decoded = decodeURIComponent(text);
      if (decoded === text) break;
      text = decoded;
    } catch (_error) {
      break;
    }
  }
  const match = text.match(/(?:^|[?&#/\s])product_no\s*=?\s*([0-9]{1,10})(?:\D|$)/i)
    || text.match(/\bproduct_no(?:%3D|=)([0-9]{1,10})\b/i);
  return match ? `product_no:${match[1]}` : "";
}

function compactPartnerToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^[#?&]+/, "")
    .replace(/\s+/g, "");
}

function collectCafe24PartnerCandidates(input) {
  const row = cafe24OrderSource(input);
  const keys = [
    "partner_url",
    "partnerUrl",
    "partner_page_url",
    "partnerPageUrl",
    "referral_url",
    "referralUrl",
    "landing_url",
    "landingUrl",
    "source_url",
    "sourceUrl",
    "page_url",
    "pageUrl",
    "product_url",
    "productUrl",
    "product_page_url",
    "productPageUrl",
    "referer",
    "referrer",
    "product_no",
    "productNo",
    "partner_ref",
    "partnerRef",
    "ref",
    "coupon",
    "coupon_code",
    "couponCode",
    "utm_source",
    "utm_campaign",
  ];
  const values = [];
  for (const source of [input, row]) {
    if (!source || typeof source !== "object") continue;
    for (const key of keys) {
      const value = source[key];
      if (value !== null && value !== undefined && String(value).trim()) {
        const text = String(value).trim();
        values.push((key === "product_no" || key === "productNo") ? `product_no=${text}` : text);
      }
    }
  }
  return [...new Set(values)].slice(0, 30);
}

function notionRichTextPlain(items) {
  return Array.isArray(items) ? items.map((item) => item?.plain_text || item?.text?.content || "").join("").trim() : "";
}

function notionPropertyText(prop) {
  if (!prop || typeof prop !== "object") return "";
  if (prop.type === "title") return notionRichTextPlain(prop.title);
  if (prop.type === "rich_text") return notionRichTextPlain(prop.rich_text);
  if (prop.type === "url") return String(prop.url || "").trim();
  if (prop.type === "email") return String(prop.email || "").trim();
  if (prop.type === "phone_number") return String(prop.phone_number || "").trim();
  if (prop.type === "select") return String(prop.select?.name || "").trim();
  if (prop.type === "multi_select") return (prop.multi_select || []).map((item) => item?.name || "").filter(Boolean).join(", ");
  if (prop.type === "formula") {
    const formula = prop.formula || {};
    if (formula.type === "string") return String(formula.string || "").trim();
    if (formula.type === "number") return String(formula.number || "").trim();
    if (formula.type === "boolean") return formula.boolean ? "true" : "false";
  }
  return "";
}

function partnerRowsFromNotionResults(results) {
  return (Array.isArray(results) ? results : [])
    .map((page) => {
      const props = page?.properties || {};
      const name = compactText(notionPropertyText(props["성함"]) || notionPropertyText(props["Name"]) || notionPropertyText(props["이름"]), 120);
      const url = compactText(notionPropertyText(props["URL"]) || notionPropertyText(props["url"]) || notionPropertyText(props["userDefined:URL"]), 1000);
      const note = compactText(notionPropertyText(props["비고"]) || notionPropertyText(props["메모"]) || notionPropertyText(props["코드"]), 300);
      const productNo = cafe24ProductNoToken(`${url} ${note}`);
      return { name, url, note, product_no: productNo.replace(/^product_no:/, "") };
    })
    .filter((row) => row.name && (row.url || row.note));
}

function matchCafe24PartnerRows(input, partnerRows) {
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

  for (const row of partnerRows || []) {
    const rowTokens = new Set();
    const rowProductNoToken = row.product_no ? `product_no:${row.product_no}` : cafe24ProductNoToken(`${row.url || ""} ${row.note || ""}`);
    if (rowProductNoToken) rowTokens.add(rowProductNoToken);
    for (const token of partnerUrlTokens(row.url)) {
      if (token) rowTokens.add(token);
    }
    for (const token of String(row.note || "").split(/[\s,;/|]+/)) {
      const compact = compactPartnerToken(token);
      if (compact.length >= 3) rowTokens.add(compact);
    }
    for (const rowToken of rowTokens) {
      if (!rowToken || rowToken.length < 3) continue;
      for (const candidateToken of candidateTokens) {
        if (rowToken.startsWith("product_no:") || candidateToken.startsWith("product_no:")) {
          if (candidateToken === rowToken) {
            const productNo = rowToken.replace(/^product_no:/, "");
            return { matched: true, partner: { ...row, product_no: row.product_no || productNo }, reason: "product_no" };
          }
          continue;
        }
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
}

function cafe24PartnerLine(partner) {
  const name = compactText(partner?.name || "", 80);
  if (!name) return "";
  const productNo = compactText(partner?.product_no || "", 20);
  return productNo ? `파트너: ${name} (product_no=${productNo})` : `${name} 페이지에서 결제`;
}

async function fetchCafe24PartnerRowsFromNotion() {
  if (!CAFE24_PARTNER_NOTION_TOKEN) {
    return { ok: false, rows: [], reason: "notion_token_missing" };
  }
  const now = Date.now();
  if (
    CAFE24_PARTNER_NOTION_CACHE_MS > 0
    && cafe24PartnerNotionCache.rows.length
    && now - cafe24PartnerNotionCache.fetched_at < CAFE24_PARTNER_NOTION_CACHE_MS
  ) {
    return { ok: true, rows: cafe24PartnerNotionCache.rows, reason: "cache" };
  }

  const headers = {
    authorization: `Bearer ${CAFE24_PARTNER_NOTION_TOKEN}`,
    "notion-version": CAFE24_PARTNER_NOTION_VERSION,
  };
  const targets = CAFE24_PARTNER_NOTION_DATA_SOURCE_ID
    ? [`https://api.notion.com/v1/data_sources/${encodeURIComponent(CAFE24_PARTNER_NOTION_DATA_SOURCE_ID)}/query`]
    : [`https://api.notion.com/v1/databases/${encodeURIComponent(CAFE24_PARTNER_NOTION_DATABASE_ID)}/query`];
  let lastError = null;
  for (const target of targets) {
    try {
      const results = [];
      let startCursor = "";
      for (let page = 0; page < 10; page += 1) {
        const body = startCursor ? { page_size: 100, start_cursor: startCursor } : { page_size: 100 };
        const data = await postJsonUrl(target, body, headers, CAFE24_PARTNER_NOTION_TIMEOUT_MS);
        results.push(...(Array.isArray(data.results) ? data.results : []));
        if (!data.has_more || !data.next_cursor) break;
        startCursor = data.next_cursor;
      }
      const rows = partnerRowsFromNotionResults(results);
      cafe24PartnerNotionCache = { fetched_at: now, rows };
      return { ok: true, rows, reason: "notion" };
    } catch (error) {
      lastError = error;
    }
  }
  return {
    ok: false,
    rows: [],
    reason: "notion_query_failed",
    error: String(lastError?.code || lastError?.message || "notion_query_failed").slice(0, 120),
  };
}

async function resolveCafe24PartnerAttribution(input) {
  const candidates = collectCafe24PartnerCandidates(input);
  if (!candidates.length) {
    return { matched: false, partner: null, partner_line: "", reason: "no_partner_hint", candidates: [] };
  }
  const lookup = await fetchCafe24PartnerRowsFromNotion();
  if (!lookup.ok) {
    return { matched: false, partner: null, partner_line: "", reason: lookup.reason, error: lookup.error || "", candidates };
  }
  const match = matchCafe24PartnerRows(input, lookup.rows);
  if (!match.matched) {
    return { ...match, partner_line: "", candidates, lookup_reason: lookup.reason };
  }
  return {
    ...match,
    partner_line: cafe24PartnerLine(match.partner),
    partner_product_no: match.partner?.product_no || "",
    candidates,
    lookup_reason: lookup.reason,
  };
}
'''

HANDLER_BLOCK = r'''
async function handleCafe24PartnerAttribution(req, res) {
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
    });
  } catch (error) {
    json(req, res, 200, {
      ok: true,
      matched: false,
      partner_line: "",
      partner_name: "",
      partner_product_no: "",
      reason: "partner_attribution_failed",
      error: String(error.code || error.message || "partner_attribution_failed").slice(0, 120),
    });
  }
}
'''

ROUTE_ANCHOR = '''  if (req.method === "POST" && url.pathname === "/api/integrations/cafe24/orders") {
    handleCafe24OrderWebhook(req, res);
    return;
  }
'''
ROUTE_BLOCK = '''  if (req.method === "POST" && url.pathname === "/api/integrations/cafe24/partner-attribution") {
    handleCafe24PartnerAttribution(req, res);
    return;
  }
'''


def replace_once(text: str, anchor: str, replacement: str, label: str) -> str:
    if anchor not in text:
        raise RuntimeError(f"{label} anchor not found")
    return text.replace(anchor, replacement, 1)


def main() -> int:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = BACKUP_DIR / f"server.js.before-partner-attribution-{stamp}"
    tmp = BACKUP_DIR / f"server.partner-attribution-{stamp}.tmp.js"

    text = SERVER.read_text(encoding="utf-8")
    if "/api/integrations/cafe24/partner-attribution" in text:
      print("server_patch=already_present")
      print(f"server_backup_skipped=true")
      return 0

    shutil.copy2(SERVER, backup)
    text = replace_once(text, CONST_ANCHOR, CONST_ANCHOR + CONST_BLOCK, "const")
    text = replace_once(text, CACHE_ANCHOR, CACHE_ANCHOR + CACHE_BLOCK, "cache")
    text = replace_once(text, "\nfunction buildCafe24Order(body, now) {", "\n" + HELPER_BLOCK + "\nfunction buildCafe24Order(body, now) {", "buildCafe24Order")
    text = replace_once(text, "\nfunction handleAdminListCafe24Orders(req, res) {", "\n" + HANDLER_BLOCK + "\nfunction handleAdminListCafe24Orders(req, res) {", "handleAdminListCafe24Orders")
    text = replace_once(text, ROUTE_ANCHOR, ROUTE_ANCHOR + ROUTE_BLOCK, "route")

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
