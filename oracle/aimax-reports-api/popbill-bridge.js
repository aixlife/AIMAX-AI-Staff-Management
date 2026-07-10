#!/usr/bin/env node

"use strict";

const path = require("node:path");

const ALLOWED_METHODS = new Set([
  "checkIsMember",
  "joinMember",
  "getUnitCost",
  "getBalance",
  "registInvoice",
  "issueInvoice",
  "getInfo",
]);
const DEADLINE_MS = 45 * 1000;
const MAX_INPUT_BYTES = 1024 * 1024;
const LINK_ID = String(process.env.POPBILL_LINK_ID || "").trim();
const SECRET_KEY = String(process.env.POPBILL_SECRET_KEY || "").trim();

let settled = false;

function redactText(value) {
  let text = String(value ?? "");
  for (const secret of [LINK_ID, SECRET_KEY]) {
    if (secret) text = text.split(secret).join("[redacted]");
  }
  return text.slice(0, 500);
}

function sanitize(value, depth = 0) {
  if (depth > 6) return null;
  if (typeof value === "string") return redactText(value);
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitize(item, depth + 1));
  if (!value || typeof value !== "object") return null;
  const output = {};
  for (const [key, item] of Object.entries(value).slice(0, 100)) {
    if (/secret|password|authorization|token/i.test(key)) continue;
    output[key] = sanitize(item, depth + 1);
  }
  return output;
}

function settle(payload, exitCode = 0) {
  if (settled) return;
  settled = true;
  clearTimeout(deadline);
  const body = `${JSON.stringify(sanitize(payload))}\n`;
  process.stdout.write(body, () => process.exit(exitCode));
}

const deadline = setTimeout(() => {
  settle({ ok: false, error: "bridge_timeout", outcome: "unknown" }, 1);
}, DEADLINE_MS);

process.on("uncaughtException", (error) => {
  settle({ ok: false, error: "bridge_exception", message: redactText(error?.message || "bridge_exception"), outcome: "unknown" }, 1);
});

process.on("unhandledRejection", (error) => {
  settle({ ok: false, error: "bridge_exception", message: redactText(error?.message || error || "bridge_exception"), outcome: "unknown" }, 1);
});

function sdkFailure(error) {
  settle({
    ok: false,
    error: "sdk_error",
    code: Number(error?.code || 0) || undefined,
    message: redactText(error?.message || "sdk_error"),
    outcome: "failed",
  }, 1);
}

function requireArgsObject(args) {
  return args && typeof args === "object" && !Array.isArray(args) ? args : {};
}

function invoke(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    settle({ ok: false, error: "invalid_request" }, 1);
    return;
  }
  const method = String(request.method || "").trim();
  const corpNum = String(request.corpNum || "").trim();
  const args = requireArgsObject(request.args);
  if (!ALLOWED_METHODS.has(method)) {
    settle({ ok: false, error: "method_not_allowed" }, 1);
    return;
  }
  if (!/^\d{10}$/.test(corpNum) || typeof request.isTest !== "boolean") {
    settle({ ok: false, error: "invalid_request" }, 1);
    return;
  }
  if (request.isTest === false && process.env.POPBILL_ALLOW_PRODUCTION !== "1") {
    settle({ ok: false, error: "production_locked" }, 1);
    return;
  }
  if (!LINK_ID || !SECRET_KEY) {
    settle({ ok: false, error: "bridge_not_configured" }, 1);
    return;
  }

  const popbill = require(path.join(__dirname, "vendor/popbill-sdk/node_modules/popbill"));
  popbill.config({
    LinkID: LINK_ID,
    SecretKey: SECRET_KEY,
    IsTest: request.isTest,
    UseLocalTimeYN: true,
    IPRestrictOnOff: true,
    defaultErrorHandler: sdkFailure,
  });
  const service = popbill.TaxinvoiceService();
  const success = (result) => settle({ ok: true, result }, 0);

  if (method === "checkIsMember") {
    service.checkIsMember(corpNum, success, sdkFailure);
    return;
  }
  if (method === "joinMember") {
    const joinForm = args.joinForm && typeof args.joinForm === "object" && !Array.isArray(args.joinForm)
      ? { ...args.joinForm, LinkID: LINK_ID, CorpNum: corpNum }
      : null;
    if (!joinForm) {
      settle({ ok: false, error: "join_form_required", outcome: "failed" }, 1);
      return;
    }
    service.joinMember(joinForm, success, sdkFailure);
    return;
  }
  if (method === "getUnitCost") {
    service.getUnitCost(corpNum, success, sdkFailure);
    return;
  }
  if (method === "getBalance") {
    service.getBalance(corpNum, success, sdkFailure);
    return;
  }
  if (method === "registInvoice") {
    if (!args.invoice || typeof args.invoice !== "object" || Array.isArray(args.invoice)) {
      settle({ ok: false, error: "invoice_required", outcome: "failed" }, 1);
      return;
    }
    service.register(corpNum, args.invoice, success, sdkFailure);
    return;
  }
  const mgtKey = String(args.mgtKey || "").trim();
  if (!/^[A-Za-z0-9_-]{1,24}$/.test(mgtKey)) {
    settle({ ok: false, error: "management_key_invalid", outcome: "failed" }, 1);
    return;
  }
  if (method === "issueInvoice") {
    service.issue(corpNum, "SELL", mgtKey, String(args.memo || "").slice(0, 200), false, "", success, sdkFailure);
    return;
  }
  if (method === "getInfo") {
    service.getInfo(corpNum, "SELL", mgtKey, success, sdkFailure);
  }
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
  if (Buffer.byteLength(input) > MAX_INPUT_BYTES) {
    settle({ ok: false, error: "request_too_large" }, 1);
  }
});
process.stdin.on("end", () => {
  if (settled) return;
  try {
    invoke(JSON.parse(input || "{}"));
  } catch (_error) {
    settle({ ok: false, error: "invalid_json" }, 1);
  }
});
process.stdin.on("error", () => settle({ ok: false, error: "stdin_error" }, 1));

