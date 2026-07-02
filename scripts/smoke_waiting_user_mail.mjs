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

// entries: 문자열(email → id "user-<email>") 또는 { id, email } 객체의 배열/단일값.
// C-1 검증(account_user_id 로 users.json 조회 + 이메일 일치)을 통과시키려면
// 각 발송 대상 행의 account_user_id 에 대응하는 유저가 여기 시드되어야 한다.
function seedUsers(tmpDir, entries) {
  const list = (Array.isArray(entries) ? entries : [entries]).map((entry) => {
    const obj = typeof entry === "string" ? { id: `user-${entry}`, email: entry } : entry;
    return {
      id: obj.id,
      email: obj.email,
      name: "Waiting User Mail Smoke",
      status: "active",
      must_change_password: false,
      password_hash: hashPassword("SmokePassword123!"),
      entitlements: { product: "bundle", products: ["bundle"], status: "active" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });
  writeJson(path.join(tmpDir, "users.json"), { version: 1, users: list });
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
  const email = overrides.account_email || "buyer@example.test";
  return {
    report_id: overrides.report_id || `rep-${crypto.randomUUID().slice(0, 8)}`,
    date: String(stored).slice(0, 10),
    stored_at: stored,
    status: "waiting_user",
    status_updated_at: stored,
    report_kind: "error",
    source: "app_error_report",
    account_email: email,
    // C-1: 기본적으로 검증을 통과하도록 이메일에 대응하는 유저 id 를 붙인다. 검증 실패 케이스는 override.
    account_user_id: `user-${email}`,
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
  seedUsers(tmpDir, [email]);
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
  // rep-invalid: 검증은 통과하되(정본 이메일이 잘못된 형식) 최종 isValidEmail 에서 걸려 invalid_email 마커.
  seedUsers(tmpDir, ["eligible@example.test", "not-an-email"]);
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
  seedUsers(tmpDir, ["fail@example.test"]);
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
  seedUsers(tmpDir, ["kill@example.test"]);
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

// C-1: account_user_id 가 users.json 과 불일치(이메일 다름)하거나 유저가 없으면
// 발송 금지 + unverified_account 스킵 마커. (리포트 토큰 경로의 스푸핑 방어)
async function scenarioUnverifiedAccount() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-wum-unverified-"));
  // 실제 유저는 real@ 인데, 행은 attacker@ 로 스푸핑을 시도한다.
  seedUsers(tmpDir, [{ id: "user-real", email: "real@example.test" }]);
  seedIndex(tmpDir, [
    // (a) account_user_id 존재하지만 이메일 불일치 → unverified
    reportRow({ report_id: "rep-mismatch", account_email: "attacker@evil.test", account_user_id: "user-real" }),
    // (b) account_user_id 가 존재하지 않는 유저 → unverified
    reportRow({ report_id: "rep-absent", account_email: "ghost@example.test", account_user_id: "user-does-not-exist" }),
  ]);
  const stub = await startMailStub({ status: 200 });
  const port = nextPort();
  const { child, logs } = bootServer(tmpDir, port, { AIMAX_MAIL_WEBHOOK_URL: stub.url });
  try {
    await waitForServer(port, logs);
    await waitFor(() => readIndexRows(tmpDir).some((r) => r.report_id === "rep-mismatch" && r.user_notify_skipped), "mismatch_skip");
    await waitFor(() => readIndexRows(tmpDir).some((r) => r.report_id === "rep-absent" && r.user_notify_skipped), "absent_skip");
    await sleep(1500);
    const rows = readIndexRows(tmpDir);
    const mismatch = rows.find((r) => r.report_id === "rep-mismatch");
    const absent = rows.find((r) => r.report_id === "rep-absent");
    assert(mismatch.user_notify_skipped === "unverified_account", `expected_unverified_mismatch:${mismatch.user_notify_skipped}`);
    assert(absent.user_notify_skipped === "unverified_account", `expected_unverified_absent:${absent.user_notify_skipped}`);
    assert(!mismatch.user_notified_at && !absent.user_notified_at, "unverified_must_not_be_notified");
    assert(stub.received.length === 0, `unverified_must_not_send_got_${stub.received.length}`);
    console.log("PASS 8) 미검증 account(불일치/부재) → 발송 0 + unverified_account 마커 (C-1)");
  } finally {
    child.kill("SIGTERM");
    await stub.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_error) {}
  }
}

// C-2: report_id 가 비었거나 정규화 후 빈 문자열(가비지)인 행은 마커를 남길 수 없어 발송하지 않는다.
// 크래시 없이 건너뛰고, 정상 행은 그대로 발송된다.
async function scenarioGarbageReportId() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-wum-garbage-"));
  seedUsers(tmpDir, ["ok@example.test"]);
  seedIndex(tmpDir, [
    reportRow({ report_id: "", account_email: "empty@example.test" }),
    reportRow({ report_id: "!!!@@@###", account_email: "garbage@example.test" }),
    reportRow({ report_id: "rep-ok", account_email: "ok@example.test" }),
  ]);
  const stub = await startMailStub({ status: 200 });
  const port = nextPort();
  const { child, logs } = bootServer(tmpDir, port, { AIMAX_MAIL_WEBHOOK_URL: stub.url });
  try {
    await waitForServer(port, logs);
    // 정상 행이 발송되면(=크래시 없이 스윕이 돌았다) 가비지 행 판정을 확정한다.
    await waitFor(() => readIndexRows(tmpDir).some((r) => r.report_id === "rep-ok" && r.user_notified_at), "ok_sent");
    await sleep(1500);
    const recipients = stub.received.map((m) => m.to);
    assert(recipients.length === 1 && recipients[0] === "ok@example.test", `expected_only_ok:${JSON.stringify(recipients)}`);
    // 서버 생존 확인.
    const health = await (await fetch(`http://127.0.0.1:${port}/api/reports/health`)).json();
    assert(health.ok === true, "server_must_survive_garbage_rows");
    console.log("PASS 9) 빈/가비지 report_id → 발송 안 함, 크래시 없음 (C-2)");
  } finally {
    child.kill("SIGTERM");
    await stub.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_error) {}
  }
}

// C-1(redaction): handleReport 가 세션 계정을 포함한 리포트에 redactPayload 를 적용해
// row.account_email 이 마스킹("*")된 정상 세션 오류보고 + 유효한 account_user_id →
// 정본 유저 이메일로 발송(스텁이 받은 수신자가 시드된 정본 주소인지 확인).
async function scenarioMaskedEmailSends() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-wum-masked-"));
  const canonical = "canonical@example.test";
  const reportId = "rep-masked";
  seedUsers(tmpDir, [{ id: "user-masked", email: canonical }]);
  seedIndex(tmpDir, [
    reportRow({ report_id: reportId, account_email: "c***@e***.test", account_user_id: "user-masked" }),
  ]);
  const stub = await startMailStub({ status: 200 });
  const port = nextPort();
  const { child, logs } = bootServer(tmpDir, port, { AIMAX_MAIL_WEBHOOK_URL: stub.url });
  try {
    await waitForServer(port, logs);
    await waitFor(() => readIndexRows(tmpDir).some((r) => r.report_id === reportId && r.user_notified_at), "masked_sent");
    assert(stub.received.length === 1, `expected_1_mail_got_${stub.received.length}`);
    assert(stub.received[0].to === canonical, `expected_canonical_recipient:${stub.received[0].to}`);
    console.log("PASS 10) 마스킹된 account_email + 유효 user_id → 정본 이메일로 발송 (redaction)");
  } finally {
    child.kill("SIGTERM");
    await stub.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_error) {}
  }
}

// 스킵 마커 재평가: 이전 스윕에서 user_notify_skipped:"unverified_account" 로 얼어붙은 행이
// 이제 검증을 통과하면(마스킹 이메일 + 유효 user_id) 다음 스윕에서 발송되고 스킵 필드가 지워진다.
async function scenarioSkipReeval() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-wum-reeval-"));
  const canonical = "reeval@example.test";
  const reportId = "rep-reeval";
  seedUsers(tmpDir, [{ id: "user-reeval", email: canonical }]);
  seedIndex(tmpDir, [
    reportRow({
      report_id: reportId,
      account_email: "r***@e***.test",
      account_user_id: "user-reeval",
      user_notify_skipped: "unverified_account",
      user_notify_skipped_at: isoDaysAgo(1),
    }),
  ]);
  const stub = await startMailStub({ status: 200 });
  const port = nextPort();
  const { child, logs } = bootServer(tmpDir, port, { AIMAX_MAIL_WEBHOOK_URL: stub.url });
  try {
    await waitForServer(port, logs);
    const row = await waitFor(
      () => readIndexRows(tmpDir).find((r) => r.report_id === reportId && r.user_notified_at),
      "reeval_sent",
    );
    assert(stub.received.length === 1 && stub.received[0].to === canonical, `expected_canonical:${JSON.stringify(stub.received.map((m) => m.to))}`);
    assert(!row.user_notify_skipped, `skip_marker_must_be_cleared:${row.user_notify_skipped}`);
    assert(!row.user_notify_skipped_at, `skip_marker_at_must_be_cleared:${row.user_notify_skipped_at}`);
    console.log("PASS 11) 스킵된 행 재평가 통과 → 발송 + 스킵 마커 제거");
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
  await scenarioUnverifiedAccount();
  await scenarioGarbageReportId();
  await scenarioMaskedEmailSends();
  await scenarioSkipReeval();
  console.log("WAITING_USER_MAIL_SMOKE_OK");
} catch (error) {
  console.error("WAITING_USER_MAIL_SMOKE_FAILED");
  console.error(error);
  process.exitCode = 1;
}
