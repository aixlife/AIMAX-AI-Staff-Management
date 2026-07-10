#!/usr/bin/env node

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-tax-invoice-smoke-"));
const fakeBridgePath = path.join(tmpDir, "fake-popbill-bridge.mjs");
const fakeBridgeStatePath = path.join(tmpDir, "fake-popbill-state.json");
const serverChildren = [];
const password = "SmokePassword123!";
const require = createRequire(import.meta.url);
let directRoute = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hashPassword(value, salt = crypto.randomBytes(16)) {
  const params = { N: 16384, r: 8, p: 1, keylen: 64 };
  const derived = crypto.scryptSync(String(value), salt, params.keylen, params);
  return `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeUsers(dataDir) {
  const now = new Date().toISOString();
  writeJson(path.join(dataDir, "users.json"), {
    version: 1,
    users: [
      {
        id: "tax-smoke-user-a",
        email: "tax-a@example.test",
        name: "Tax Smoke A",
        status: "active",
        must_change_password: false,
        password_hash: hashPassword(password),
        entitlements: { product: "semu", products: ["semu"], status: "active" },
        created_at: now,
        updated_at: now,
      },
      {
        id: "tax-smoke-user-b",
        email: "tax-b@example.test",
        name: "Tax Smoke B",
        status: "active",
        must_change_password: false,
        password_hash: hashPassword(password),
        entitlements: { product: "semu", products: ["semu"], status: "active" },
        created_at: now,
        updated_at: now,
      },
    ],
  });
}

fs.writeFileSync(fakeBridgePath, `#!/usr/bin/env node
import fs from "node:fs";

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  const request = JSON.parse(input || "{}");
  const statePath = process.env.FAKE_POPBILL_STATE_PATH;
  let state = { timeout_keys: [], slow_keys: [] };
  try { state = JSON.parse(fs.readFileSync(statePath, "utf8")); } catch (_error) {}
  const write = (payload, code = 0) => {
    process.stdout.write(JSON.stringify(payload) + "\\n", () => process.exit(code));
  };
  if (request.isTest === false) return write({ ok: false, error: "production_locked" }, 1);
  if (request.method === "checkIsMember") {
    const connected = request.corpNum !== "1111111111";
    return write({ ok: true, result: { code: connected ? 1 : -1, message: connected ? "connected" : "not connected" } });
  }
  if (request.method === "joinMember") return write({ ok: true, result: { code: 1, message: "joined" } });
  if (request.method === "getUnitCost") return write({ ok: true, result: 12 });
  if (request.method === "getBalance") return write({ ok: true, result: 500 });
  if (request.method === "registInvoice") {
    const invoice = request.args?.invoice || {};
    const timeout = (invoice.detailList || []).some((item) => String(item.itemName || "").includes("timeout-case"));
    const slow = (invoice.detailList || []).some((item) => String(item.itemName || "").includes("slow-case"));
    if (timeout && !state.timeout_keys.includes(invoice.invoicerMgtKey)) state.timeout_keys.push(invoice.invoicerMgtKey);
    if (slow && !state.slow_keys.includes(invoice.invoicerMgtKey)) state.slow_keys.push(invoice.invoicerMgtKey);
    fs.writeFileSync(statePath, JSON.stringify(state));
    return write({ ok: true, result: { code: 1, message: "registered", itemKey: "SMOKE-ITEM" } });
  }
  if (request.method === "issueInvoice") {
    if (state.timeout_keys.includes(request.args?.mgtKey)) return write({ ok: false, error: "bridge_timeout", outcome: "unknown" }, 1);
    if (state.slow_keys.includes(request.args?.mgtKey)) {
      return setTimeout(() => write({ ok: true, result: { code: 1, message: "issued", itemKey: "SMOKE-SLOW", stateCode: 300 } }), 400);
    }
    return write({ ok: true, result: { code: 1, message: "issued", itemKey: "SMOKE-ITEM", stateCode: 300 } });
  }
  if (request.method === "getInfo") {
    return write({ ok: true, result: { itemKey: "SMOKE-ITEM", stateCode: 300, stateMemo: "발행완료" } });
  }
  return write({ ok: false, error: "method_not_allowed" }, 1);
});
`, "utf8");
fs.chmodSync(fakeBridgePath, 0o755);
writeJson(fakeBridgeStatePath, { timeout_keys: [], slow_keys: [] });

function startServer({ dataDir, port, configured }) {
  writeUsers(dataDir);
  const child = childProcess.spawn(process.execPath, ["oracle/aimax-reports-api/server.js"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      AIMAX_REPORT_HOST: "127.0.0.1",
      AIMAX_REPORT_PORT: String(port),
      AIMAX_REPORT_DATA_DIR: dataDir,
      AIMAX_RESEARCH_DATA_DIR: path.join(dataDir, "research"),
      AIMAX_USER_SECRET_ENCRYPTION_KEY: `base64:${crypto.randomBytes(32).toString("base64")}`,
      AIMAX_KEYCHAIN_ACCOUNT: "smoke-no-keychain-account",
      AIMAX_KEYRING_SERVICE: "smoke-no-keyring-service",
      AIMAX_LEGACY_KEYRING_SERVICE: "smoke-no-legacy-keyring",
      POPBILL_BRIDGE_PATH: fakeBridgePath,
      FAKE_POPBILL_STATE_PATH: fakeBridgeStatePath,
      POPBILL_LINK_ID: configured ? "SMOKE_LINK_ID" : "",
      POPBILL_SECRET_KEY: configured ? "SMOKE_SECRET_KEY" : "",
      POPBILL_ALLOW_PRODUCTION: "",
      AIMAX_SONGI_SERVER_YTDLP_DISCOVERY_ENABLED: "0",
      AIMAX_TELEGRAM_BOT_TOKEN: "",
      TELEGRAM_BOT_TOKEN: "",
      RESEND_API_KEY: "",
      AIMAX_RESEND_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const record = { child, stderr: "", port };
  child.stderr.on("data", (chunk) => { record.stderr += chunk.toString(); });
  serverChildren.push(record);
  return record;
}

async function httpRequest(baseUrl, pathname, options = {}) {
  if (baseUrl === "direct://aimax") return directRequest(pathname, options);
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  let body = {};
  try { body = await response.json(); } catch (_error) {}
  return { status: response.status, body };
}

function directRequest(pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const input = options.body === undefined ? "" : String(options.body);
    const req = Readable.from(input ? [Buffer.from(input)] : []);
    req.method = String(options.method || "GET").toUpperCase();
    req.url = pathname;
    req.headers = { host: "localhost", ...(options.headers || {}) };
    let status = 200;
    let headers = {};
    let finished = false;
    const timeout = setTimeout(() => {
      if (!finished) reject(new Error(`direct route timeout: ${req.method} ${pathname}`));
    }, 5000);
    const res = {
      headersSent: false,
      writeHead(code, nextHeaders = {}) {
        status = code;
        headers = nextHeaders;
        this.headersSent = true;
      },
      end(payload = "") {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        const text = Buffer.isBuffer(payload) ? payload.toString("utf8") : String(payload || "");
        const contentType = String(headers["content-type"] || "");
        if (contentType.includes("application/json")) {
          let body = {};
          try { body = JSON.parse(text || "{}"); } catch (_error) {}
          resolve({ status, body, text, headers });
          return;
        }
        resolve({ status, body: {}, text, headers });
      },
    };
    try {
      directRoute(req, res);
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

function enableDirectHarness(dataDir) {
  process.env.AIMAX_REPORT_DATA_DIR = dataDir;
  process.env.AIMAX_RESEARCH_DATA_DIR = path.join(dataDir, "research");
  process.env.AIMAX_USER_SECRET_ENCRYPTION_KEY = `base64:${crypto.randomBytes(32).toString("base64")}`;
  process.env.AIMAX_KEYCHAIN_ACCOUNT = "smoke-no-keychain-account";
  process.env.AIMAX_KEYRING_SERVICE = "smoke-no-keyring-service";
  process.env.AIMAX_LEGACY_KEYRING_SERVICE = "smoke-no-legacy-keyring";
  process.env.POPBILL_BRIDGE_PATH = fakeBridgePath;
  process.env.FAKE_POPBILL_STATE_PATH = fakeBridgeStatePath;
  process.env.POPBILL_LINK_ID = "SMOKE_LINK_ID";
  process.env.POPBILL_SECRET_KEY = "SMOKE_SECRET_KEY";
  process.env.POPBILL_ALLOW_PRODUCTION = "";
  const { __taxTest } = require("../oracle/aimax-reports-api/server.js");
  __taxTest.ensureDirs();
  directRoute = __taxTest.route;
}

async function waitForServer(record) {
  const baseUrl = `http://127.0.0.1:${record.port}`;
  for (let index = 0; index < 100; index += 1) {
    try {
      const response = await httpRequest(baseUrl, "/api/reports/health");
      if (response.status === 200) return baseUrl;
    } catch (_error) {}
    if (record.child.exitCode !== null && record.stderr.includes("listen EPERM")) {
      const error = new Error("listen_not_permitted");
      error.code = "LISTEN_EPERM";
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`server did not start: ${record.stderr}`);
}

async function login(baseUrl, email) {
  const response = await httpRequest(baseUrl, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  assert(response.status === 200 && response.body.session_token, `login failed: ${JSON.stringify(response)}`);
  return { authorization: `Bearer ${response.body.session_token}` };
}

function invoicePayload(itemName = "테스트 컨설팅") {
  return {
    corp_num: "9999999999",
    invoicee: {
      corp_num: "0987654321",
      corp_name: "거래처 테스트",
      ceo_name: "김대표",
      email: "invoicee@example.test",
    },
    items: [{ item_name: itemName, quantity: 2, unit_price: 1000, supply_cost: 2000, tax: 200 }],
    write_date: "20260710",
    purpose_type: "청구",
    totals: { supply_cost_total: 2000, tax_total: 200, total_amount: 2200 },
  };
}

function runBridgeProductionLockSmoke() {
  return new Promise((resolve, reject) => {
    const bridgePath = path.join(repoRoot, "oracle/aimax-reports-api/popbill-bridge.js");
    const child = childProcess.spawn(process.execPath, [bridgePath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        POPBILL_LINK_ID: "SMOKE_LINK_ID",
        POPBILL_SECRET_KEY: "SMOKE_SECRET_KEY",
        POPBILL_ALLOW_PRODUCTION: "",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", () => {
      try {
        const result = JSON.parse(stdout.trim());
        assert(result.error === "production_locked", `production lock missing: ${stdout} ${stderr}`);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(JSON.stringify({ method: "getBalance", corpNum: "1234567890", args: {}, isTest: false }));
  });
}

function cleanup() {
  for (const { child } of serverChildren) {
    try { child.kill("SIGTERM"); } catch (_error) {}
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

const portBase = 19900 + Math.floor(Math.random() * 400);

try {
  const configuredDataDir = path.join(tmpDir, "configured");
  const configuredRecord = startServer({ dataDir: configuredDataDir, port: portBase, configured: true });
  let baseUrl = "";
  try {
    baseUrl = await waitForServer(configuredRecord);
    console.log("TRANSPORT: temporary HTTP server");
  } catch (error) {
    if (error.code !== "LISTEN_EPERM") throw error;
    enableDirectHarness(configuredDataDir);
    baseUrl = "direct://aimax";
    console.log("TRANSPORT: in-process route harness (sandbox listen EPERM fallback)");
  }
  const authA = await login(baseUrl, "tax-a@example.test");
  const authB = await login(baseUrl, "tax-b@example.test");

  const workerResponse = await httpRequest(baseUrl, "/api/workers", { headers: authA });
  const taxWorker = workerResponse.body.workers?.find((worker) => worker.staff_code === "semu");
  assert(taxWorker?.execution === "web_module" && taxWorker?.module_key === "tax", "tax worker catalog missing");
  const appResponse = baseUrl === "direct://aimax"
    ? await httpRequest(baseUrl, "/app")
    : { status: 200, text: await (await fetch(`${baseUrl}/app`)).text() };
  const appHtml = appResponse.text;
  assert(appHtml.includes('id="taxJobForm"') && appHtml.includes("테스트베드 — 실제 국세청 전송 아님"), "tax UI markers missing");

  const settings = await httpRequest(baseUrl, "/api/tax/settings", {
    method: "PUT",
    headers: authA,
    body: JSON.stringify({ corp_num: "1234567890", corp_name: "공급자 테스트", ceo_name: "박대표" }),
  });
  assert(settings.status === 200 && settings.body.settings?.member_connected, `settings failed: ${JSON.stringify(settings)}`);
  const deferredJoin = await httpRequest(baseUrl, "/api/tax/settings", {
    method: "PUT",
    headers: authB,
    body: JSON.stringify({ corp_num: "1111111111", corp_name: "미가입 테스트", ceo_name: "이대표" }),
  });
  assert(deferredJoin.status === 409 && deferredJoin.body.error === "member_join_fields_required", `deferred join guard failed: ${JSON.stringify(deferredJoin)}`);
  console.log("PASS HOLD: 미가입 사업자 자동가입은 필수 JoinForm 입력 부족으로 안전 보류");

  const draft = await httpRequest(baseUrl, "/api/tax/invoices", {
    method: "POST",
    headers: authA,
    body: JSON.stringify(invoicePayload()),
  });
  assert(draft.status === 201 && draft.body.invoice?.status === "draft", `draft failed: ${JSON.stringify(draft)}`);
  assert(draft.body.invoice.supplier.corp_num === "1234567890", "request corpNum crossed supplier invariant");
  assert(/^[A-Z0-9]{1,24}$/.test(draft.body.invoice.mgt_key), `invalid MgtKey: ${draft.body.invoice.mgt_key}`);

  const preflight = await httpRequest(baseUrl, `/api/tax/invoices/${draft.body.invoice.id}/preflight`, {
    method: "POST",
    headers: authA,
    body: "{}",
  });
  assert(preflight.status === 200 && preflight.body.unit_cost === 12 && preflight.body.balance === 500, `preflight failed: ${JSON.stringify(preflight)}`);
  const issued = await httpRequest(baseUrl, `/api/tax/invoices/${draft.body.invoice.id}/issue`, {
    method: "POST",
    headers: authA,
    body: JSON.stringify({ confirm_paid: true }),
  });
  assert(issued.status === 200 && issued.body.invoice?.status === "issued", `issue failed: ${JSON.stringify(issued)}`);
  const list = await httpRequest(baseUrl, "/api/tax/invoices", { headers: authA });
  assert(list.status === 200 && list.body.invoices?.some((item) => item.id === draft.body.invoice.id && item.status === "issued"), "issued invoice missing from history");
  console.log("PASS 1: 설정 → 초안 → 단가/잔액 확인 → 명시 승인 발행 → 발행 이력");

  const confirmationDraft = await httpRequest(baseUrl, "/api/tax/invoices", {
    method: "POST", headers: authA, body: JSON.stringify(invoicePayload("승인 게이트 테스트")),
  });
  const noConfirmation = await httpRequest(baseUrl, `/api/tax/invoices/${confirmationDraft.body.invoice.id}/issue`, {
    method: "POST", headers: authA, body: "{}",
  });
  assert(noConfirmation.status === 402 && noConfirmation.body.error === "tax_paid_confirmation_required", `402 gate failed: ${JSON.stringify(noConfirmation)}`);
  const noPreflight = await httpRequest(baseUrl, `/api/tax/invoices/${confirmationDraft.body.invoice.id}/issue`, {
    method: "POST", headers: authA, body: JSON.stringify({ confirm_paid: true }),
  });
  assert(noPreflight.status === 409 && noPreflight.body.error === "invoice_preflight_required", `preflight bypass accepted: ${JSON.stringify(noPreflight)}`);
  console.log("PASS 2: confirm_paid 없는 발행 402 차단, 비용 preflight 우회 차단");

  let health;
  let unavailable;
  if (baseUrl === "direct://aimax") {
    const previousLinkId = process.env.POPBILL_LINK_ID;
    const previousSecretKey = process.env.POPBILL_SECRET_KEY;
    process.env.POPBILL_LINK_ID = "";
    process.env.POPBILL_SECRET_KEY = "";
    health = await httpRequest(baseUrl, "/api/reports/health");
    unavailable = await httpRequest(baseUrl, "/api/tax/settings");
    process.env.POPBILL_LINK_ID = previousLinkId;
    process.env.POPBILL_SECRET_KEY = previousSecretKey;
  } else {
    const unconfiguredRecord = startServer({ dataDir: path.join(tmpDir, "unconfigured"), port: portBase + 1, configured: false });
    const unconfiguredUrl = await waitForServer(unconfiguredRecord);
    health = await httpRequest(unconfiguredUrl, "/api/reports/health");
    unavailable = await httpRequest(unconfiguredUrl, "/api/tax/settings");
  }
  assert(health.status === 200 && unavailable.status === 503 && unavailable.body.error === "tax_not_configured", "unconfigured server gate failed");
  console.log("PASS 3: 파트너 키 없이 서버 정상 기동, /api/tax/* 503");

  const timeoutDraft = await httpRequest(baseUrl, "/api/tax/invoices", {
    method: "POST", headers: authA, body: JSON.stringify(invoicePayload("timeout-case")),
  });
  const timeoutPreflight = await httpRequest(baseUrl, `/api/tax/invoices/${timeoutDraft.body.invoice.id}/preflight`, {
    method: "POST", headers: authA, body: "{}",
  });
  assert(timeoutPreflight.status === 200 && timeoutPreflight.body.can_issue === true, `timeout preflight failed: ${JSON.stringify(timeoutPreflight)}`);
  const unknown = await httpRequest(baseUrl, `/api/tax/invoices/${timeoutDraft.body.invoice.id}/issue`, {
    method: "POST", headers: authA, body: JSON.stringify({ confirm_paid: true }),
  });
  assert(unknown.status === 502 && unknown.body.error === "issue_unknown" && unknown.body.invoice?.status === "unknown", `unknown state missing: ${JSON.stringify(unknown)}`);
  const synced = await httpRequest(baseUrl, `/api/tax/invoices/${timeoutDraft.body.invoice.id}/sync`, {
    method: "POST", headers: authA, body: "{}",
  });
  assert(synced.status === 200 && synced.body.invoice?.status === "issued", `sync recovery failed: ${JSON.stringify(synced)}`);
  console.log("PASS 4: 발행 타임아웃 unknown 저장 후 getInfo sync로 issued 복구");

  const slowDraft = await httpRequest(baseUrl, "/api/tax/invoices", {
    method: "POST", headers: authA, body: JSON.stringify(invoicePayload("slow-case")),
  });
  const otherCorpDraft = await httpRequest(baseUrl, "/api/tax/invoices", {
    method: "POST", headers: authA, body: JSON.stringify(invoicePayload("동일 사업자 잠금 테스트")),
  });
  for (const invoiceId of [slowDraft.body.invoice.id, otherCorpDraft.body.invoice.id]) {
    const ready = await httpRequest(baseUrl, `/api/tax/invoices/${invoiceId}/preflight`, { method: "POST", headers: authA, body: "{}" });
    assert(ready.status === 200 && ready.body.can_issue === true, `lock preflight failed: ${JSON.stringify(ready)}`);
  }
  const slowIssuePromise = httpRequest(baseUrl, `/api/tax/invoices/${slowDraft.body.invoice.id}/issue`, {
    method: "POST", headers: authA, body: JSON.stringify({ confirm_paid: true }),
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const submittingDuplicate = await httpRequest(baseUrl, `/api/tax/invoices/${slowDraft.body.invoice.id}/issue`, {
    method: "POST", headers: authA, body: JSON.stringify({ confirm_paid: true }),
  });
  assert(submittingDuplicate.status === 409 && submittingDuplicate.body.error === "invoice_not_draft", `submitting duplicate was not blocked: ${JSON.stringify(submittingDuplicate)}`);
  const corpLocked = await httpRequest(baseUrl, `/api/tax/invoices/${otherCorpDraft.body.invoice.id}/issue`, {
    method: "POST", headers: authA, body: JSON.stringify({ confirm_paid: true }),
  });
  assert(corpLocked.status === 409 && corpLocked.body.error === "corp_invoice_submission_in_progress", `corp lock failed: ${JSON.stringify(corpLocked)}`);
  const slowIssued = await slowIssuePromise;
  assert(slowIssued.status === 200 && slowIssued.body.invoice?.status === "issued", `slow issue failed: ${JSON.stringify(slowIssued)}`);
  const issuedDuplicate = await httpRequest(baseUrl, `/api/tax/invoices/${slowDraft.body.invoice.id}/issue`, {
    method: "POST", headers: authA, body: JSON.stringify({ confirm_paid: true }),
  });
  assert(issuedDuplicate.status === 409 && issuedDuplicate.body.error === "invoice_not_draft", `issued duplicate was not blocked: ${JSON.stringify(issuedDuplicate)}`);
  console.log("PASS 5: submitting/issued 이중 발행과 동일 corpNum 동시 발행 409 차단");

  await runBridgeProductionLockSmoke();
  console.log("PASS 6: isTest:false 요청 production_locked 차단");

  const mismatchPayload = invoicePayload("합계 불일치 테스트");
  mismatchPayload.totals.total_amount = 9999;
  const mismatch = await httpRequest(baseUrl, "/api/tax/invoices", {
    method: "POST", headers: authA, body: JSON.stringify(mismatchPayload),
  });
  assert(mismatch.status === 400 && mismatch.body.error === "invoice_validation_failed", `totals mismatch accepted: ${JSON.stringify(mismatch)}`);
  console.log("PASS 7: 합계 불일치 초안 400 차단");

  const crossUser = await httpRequest(baseUrl, `/api/tax/invoices/${draft.body.invoice.id}`, { headers: authB });
  assert([403, 404].includes(crossUser.status), `cross-user access accepted: ${JSON.stringify(crossUser)}`);
  console.log("PASS 8: 다른 사용자의 invoice 접근 차단");

  console.log("TAX_INVOICE_FLOW_SMOKE_OK");
} finally {
  cleanup();
}
