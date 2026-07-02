#!/usr/bin/env node
// waiting_user 오류보고 이메일 알림 스모크.
// 로컬 HTTP 스텁을 AIMAX_MAIL_WEBHOOK_URL 로 지정해 실제 외부 발송 없이 스윕 동작을 검증한다.
// 스윕은 export/엔드포인트 대신 짧은 interval env(AIMAX_WAITING_USER_MAIL_INTERVAL_MS)로 트리거한다.

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function seedUsers(tmpDir, email) {
  writeJson(path.join(tmpDir, "users.json"), {
    version: 1,
    users: [{
      id: "waiting-user-mail-smoke-id",
      email,
      name: "Waiting User Mail Smoke",
      status: "active",
      must_change_password: false,
      password_hash: hashPassword("SmokePassword123!"),
      entitlements: { product: "bundle", products: ["bundle"], status: "active" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }],
  });
}

function seedIndex(tmpDir, rows) {
  const indexPath = path.join(tmpDir, "reports-index.jsonl");
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(indexPath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
}

function readIndexRows(tmpDir) {
  const indexPath = path.join(tmpDir, "reports-index.jsonl");
  if (!fs.existsSync(indexPath)) return [];
  return fs.readFileSync(indexPath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function readUsers(tmpDir) {
  const usersPath = path.join(tmpDir, "users.json");
  if (!fs.existsSync(usersPath)) return [];
  return JSON.parse(fs.readFileSync(usersPath, "utf8")).users || [];
}

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function reportRow(overrides = {}) {
  const stored = overrides.stored_at || isoDaysAgo(0);
  return {
    report_id: overrides.report_id || `rep-${crypto.randomUUID().slice(0, 8)}`,
    date: String(stored).slice(0, 10),
    stored_at: stored,
    status: "waiting_user",
    status_updated_at: stored,
    report_kind: "error",
    source: "app_error_report",
    account_email: overrides.account_email || "buyer@example.test",
    job_kind: "yeri_write",
    public_message: "확인이 필요한 오류가 접수되었습니다.",
    ...overrides,
  };
}

function startMailStub({ status = 200 } = {}) {
  const received = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk.toString(); });
    req.on("end", () => {
      try { received.push(JSON.parse(body)); } catch (_error) { received.push({ raw: body }); }
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(status >= 400 ? { error: "stub_error" } : { id: `stub-${received.length}` }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({
        received,
        url: `http://127.0.0.1:${port}/`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

function bootServer(tmpDir, port, extraEnv = {}) {
  const child = childProcess.spawn(process.execPath, ["oracle/aimax-reports-api/server.js"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      AIMAX_REPORT_HOST: "127.0.0.1",
      AIMAX_REPORT_PORT: String(port),
      AIMAX_REPORT_DATA_DIR: tmpDir,
      AIMAX_RESEARCH_DATA_DIR: path.join(tmpDir, "research"),
      AIMAX_DOWNLOAD_DIR: path.join(tmpDir, "downloads"),
      AIMAX_USER_SECRET_ENCRYPTION_KEY: `base64:${crypto.randomBytes(32).toString("base64")}`,
      APIFY_API_TOKEN: "",
      AIMAX_APIFY_API_TOKEN: "",
      GEMINI_API_KEY: "",
      AIMAX_GEMINI_API_KEY: "",
      AIMAX_WAITING_USER_MAIL_INTERVAL_MS: "1000",
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  return { child, logs: () => `stdout=${stdout}\nstderr=${stderr}` };
}

async function waitForServer(port, logs) {
  const started = Date.now();
  while (Date.now() - started < 8000) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/reports/health`);
      const body = await response.json();
      if (body.ok) return;
    } catch (_error) {
      await sleep(150);
    }
  }
  throw new Error(`server did not start\n${logs()}`);
}

async function waitFor(fn, label, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await fn();
    if (value) return value;
    await sleep(200);
  }
  throw new Error(`timeout waiting for ${label}`);
}

let portCursor = 23600 + Math.floor(Math.random() * 400);
function nextPort() {
  portCursor += 1;
  return portCursor;
}

// 1) waiting_user 오류보고 1건 → 스윕 → 스텁 1건 수신 + 행 마커 + email_events 기록
// 2) 스윕 재실행 → 추가 발송 0 (dedup)
async function scenarioSendAndDedup() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-wum-send-"));
  const email = "buyer@example.test";
  const reportId = "rep-send-1";
  seedUsers(tmpDir, email);
  seedIndex(tmpDir, [reportRow({ report_id: reportId, account_email: email })]);
  const stub = await startMailStub({ status: 200 });
  const port = nextPort();
  const { child, logs } = bootServer(tmpDir, port, { AIMAX_MAIL_WEBHOOK_URL: stub.url });
  try {
    await waitForServer(port, logs);
    await waitFor(() => readIndexRows(tmpDir).some((r) => r.report_id === reportId && r.user_notified_at), "user_notified_at");
    assert(stub.received.length === 1, `expected_1_mail_got_${stub.received.length}`);
    const mail = stub.received[0];
    assert(mail.to === email, `expected_recipient:${mail.to}`);
    assert(String(mail.subject || "").includes("확인이 필요합니다"), `expected_subject:${mail.subject}`);
    assert(String(mail.subject || "").includes("예리 블로그 글쓰기"), `expected_kind_label:${mail.subject}`);
    assert(!/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(String(mail.text || "")), "mail_text_must_have_no_emoji");
    const row = readIndexRows(tmpDir).find((r) => r.report_id === reportId);
    assert(row.user_notified_channel === "email", "expected_channel_email");
    const user = readUsers(tmpDir).find((u) => u.email === email);
    const events = (user && user.email_events) || [];
    assert(events.some((e) => e.type === "error_report_waiting_user"), "expected_email_event");
    console.log("PASS 1) waiting_user 오류보고 1건 발송 + 마커 + email_events");

    // dedup: 몇 번의 추가 스윕이 지나도 발송은 1건에 머문다.
    await sleep(2500);
    assert(stub.received.length === 1, `expected_no_resend_got_${stub.received.length}`);
    console.log("PASS 2) 스윕 재실행 시 재발송 없음 (dedup)");
  } finally {
    child.kill("SIGTERM");
    await stub.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_error) {}
  }
}

// 3) invalid email → skip 마커, 4) 피드백 리포트 → 발송 안 함, 5) 7일 초과 → 발송 안 함
async function scenarioSkips() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-wum-skip-"));
  seedUsers(tmpDir, "buyer@example.test");
  seedIndex(tmpDir, [
    reportRow({ report_id: "rep-invalid", account_email: "not-an-email" }),
    reportRow({ report_id: "rep-feedback", account_email: "fb@example.test", report_kind: "feedback", source: "staff_feedback" }),
    reportRow({ report_id: "rep-stale", account_email: "stale@example.test", stored_at: isoDaysAgo(30), status_updated_at: isoDaysAgo(30) }),
    reportRow({ report_id: "rep-eligible", account_email: "eligible@example.test" }),
  ]);
  const stub = await startMailStub({ status: 200 });
  const port = nextPort();
  const { child, logs } = bootServer(tmpDir, port, { AIMAX_MAIL_WEBHOOK_URL: stub.url });
  try {
    await waitForServer(port, logs);
    // 유효한 행이 처리될 때까지 대기 후 상태를 확정한다.
    await waitFor(() => readIndexRows(tmpDir).some((r) => r.report_id === "rep-invalid" && r.user_notify_skipped), "invalid_skip_marker");
    await waitFor(() => readIndexRows(tmpDir).some((r) => r.report_id === "rep-eligible" && r.user_notified_at), "eligible_sent");
    await sleep(1500);
    const rows = readIndexRows(tmpDir);
    const invalid = rows.find((r) => r.report_id === "rep-invalid");
    assert(invalid.user_notify_skipped === "invalid_email", "expected_invalid_email_skip");
    const feedback = rows.find((r) => r.report_id === "rep-feedback");
    assert(!feedback.user_notified_at && !feedback.user_notify_skipped, "feedback_must_not_be_touched");
    const stale = rows.find((r) => r.report_id === "rep-stale");
    assert(!stale.user_notified_at && !stale.user_notify_skipped, "stale_must_not_be_sent");
    const recipients = stub.received.map((m) => m.to);
    assert(recipients.length === 1 && recipients[0] === "eligible@example.test", `expected_only_eligible:${JSON.stringify(recipients)}`);
    console.log("PASS 3) invalid email skip 마커");
    console.log("PASS 4) 피드백 리포트 발송 안 함");
    console.log("PASS 5) 7일 초과 행 발송 안 함");
  } finally {
    child.kill("SIGTERM");
    await stub.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_error) {}
  }
}

// 6) 스텁 500 → attempts 증가, 3회 후 failed 마커
async function scenarioFailure() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-wum-fail-"));
  const reportId = "rep-fail";
  seedUsers(tmpDir, "buyer@example.test");
  seedIndex(tmpDir, [reportRow({ report_id: reportId, account_email: "fail@example.test" })]);
  const stub = await startMailStub({ status: 500 });
  const port = nextPort();
  const { child, logs } = bootServer(tmpDir, port, { AIMAX_MAIL_WEBHOOK_URL: stub.url });
  try {
    await waitForServer(port, logs);
    const failed = await waitFor(
      () => readIndexRows(tmpDir).find((r) => r.report_id === reportId && r.user_notify_failed_at),
      "user_notify_failed_at",
    );
    assert(failed.user_notify_attempts >= 3, `expected_3_attempts:${failed.user_notify_attempts}`);
    assert(!failed.user_notified_at, "failed_row_must_not_be_notified");
    console.log("PASS 6) 발송 실패 3회 후 failed 마커 + attempts 증가");
  } finally {
    child.kill("SIGTERM");
    await stub.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_error) {}
  }
}

// 7) 킬 스위치 env → 발송 0
async function scenarioKillSwitch() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-wum-kill-"));
  const reportId = "rep-kill";
  seedUsers(tmpDir, "buyer@example.test");
  seedIndex(tmpDir, [reportRow({ report_id: reportId, account_email: "kill@example.test" })]);
  const stub = await startMailStub({ status: 200 });
  const port = nextPort();
  const { child, logs } = bootServer(tmpDir, port, { AIMAX_MAIL_WEBHOOK_URL: stub.url, AIMAX_WAITING_USER_MAIL: "0" });
  try {
    await waitForServer(port, logs);
    await sleep(3000);
    assert(stub.received.length === 0, `kill_switch_must_block_all_got_${stub.received.length}`);
    const row = readIndexRows(tmpDir).find((r) => r.report_id === reportId);
    assert(!row.user_notified_at && !row.user_notify_skipped && !row.user_notify_attempts, "kill_switch_must_leave_row_untouched");
    console.log("PASS 7) 킬 스위치 env 활성 시 발송 0");
  } finally {
    child.kill("SIGTERM");
    await stub.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_error) {}
  }
}

try {
  await scenarioSendAndDedup();
  await scenarioSkips();
  await scenarioFailure();
  await scenarioKillSwitch();
  console.log("WAITING_USER_MAIL_SMOKE_OK");
} catch (error) {
  console.error("WAITING_USER_MAIL_SMOKE_FAILED");
  console.error(error);
  process.exitCode = 1;
}
