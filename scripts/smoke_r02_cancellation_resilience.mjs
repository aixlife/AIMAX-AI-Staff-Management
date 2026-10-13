import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { createRequire } from "node:module";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-r02-cancellation-"));
process.env.AIMAX_REPORT_DATA_DIR = dataDir;
const mod = createRequire(import.meta.url)("../oracle/aimax-reports-api/server.js");
const { __r02Test, __yeriHybridTest, __storageTest } = mod;
const now = new Date().toISOString();
const userId = "r02-fixture-user";
const token = "r02-fixture-token";
const hash = crypto.createHash("sha256").update(token).digest("hex");

function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
async function request(method, url, body = null) {
  const req = Readable.from(body === null ? [] : [Buffer.from(JSON.stringify(body))]);
  req.method = method;
  req.url = url;
  req.headers = { host: "fixture.local", authorization: `Bearer ${token}`, ...(body === null ? {} : { "content-type": "application/json" }) };
  let status = 0;
  let raw = "";
  const res = { headersSent: false, writeHead(code) { status = code; this.headersSent = true; }, end(chunk = "") { raw += String(chunk); } };
  await __r02Test.dispatchApiRequest(req, res);
  return { status, body: raw ? JSON.parse(raw) : {} };
}
async function expect(method, url, body, expectedStatus) {
  const result = await request(method, url, body);
  assert.equal(result.status, expectedStatus, `${method} ${url}: ${JSON.stringify(result.body)}`);
  return result.body;
}

try {
  write(path.join(dataDir, "users.json"), { version: 1, users: [{ id: userId, email: "r02@example.test", name: "R02", status: "active", must_change_password: false, entitlements: { product: "bundle", products: ["bundle"], status: "active" }, created_at: now, updated_at: now }] });
  write(path.join(dataDir, "sessions.json"), { version: 1, sessions: [{ id: "r02", user_id: userId, token_hash: hash, created_at: now, last_seen_at: now, expires_at: new Date(Date.now() + 3600000).toISOString() }] });
  write(path.join(dataDir, "jobs.json"), { version: 1, jobs: [
    { id: "ready", user_id: userId, kind: "yeri_write", status: "ready_for_publish", payload: {}, logs: [], updated_at: now },
    { id: "command-lock", user_id: userId, kind: "yeri_write", status: "running", payload: {}, logs: [], updated_at: now },
    { id: "jobs-lock", user_id: userId, kind: "yeri_write", status: "running", payload: {}, logs: [], updated_at: now },
    { id: "stale-startup", user_id: userId, kind: "yeri_write", status: "generating", payload: {}, logs: [], created_at: new Date(Date.now() - 3600000).toISOString(), updated_at: new Date(Date.now() - 3600000).toISOString() },
  ] });

  const cancelled = await expect("POST", "/api/jobs/ready/cancel", { reason: "fixture" }, 200);
  assert.equal(cancelled.job.status, "cancelled");
  assert.equal(cancelled.command.type, "stop_current_job");
  const firstCommandId = cancelled.command.id;

  // next-command durably marks the command delivered before writing its HTTP
  // response.  Drop that response, then repeat cancellation: the one
  // unacknowledged stop command must be queued for one safe re-delivery.
  const firstDelivery = await expect("GET", "/api/agent/next-command", null, 200);
  assert.equal(firstDelivery.command.id, firstCommandId);
  assert.equal(firstDelivery.command.status, "delivered");
  __r02Test.mutateCommandsWithLock((commands) => {
    commands.commands.push({ id: "other-job-done", user_id: userId, type: "stop_current_job", status: "done", payload: { job_id: "other-job" }, finished_at: now, logs: [] });
  });
  const redelivered = await expect("POST", "/api/jobs/ready/cancel", { reason: "lost_delivery_response" }, 200);
  assert.equal(redelivered.already_terminal, true);
  assert.equal(redelivered.command.id, firstCommandId);
  assert.equal(redelivered.command.status, "queued");
  const secondDelivery = await expect("GET", "/api/agent/next-command", null, 200);
  assert.equal(secondDelivery.command.id, firstCommandId);
  assert.equal(__r02Test.loadCommands().commands.filter((command) => command.type === "stop_current_job" && command.payload?.job_id === "ready").length, 1);
  assert.equal(__r02Test.loadCommands().commands.find((command) => command.id === "other-job-done").status, "done");

  const stale = __r02Test.loadCommands();
  __r02Test.mutateCommandsWithLock((commands) => { commands.commands.push({ id: "unrelated", user_id: userId, type: "open_settings", status: "queued", payload: {} }); });
  assert.throws(() => __r02Test.saveCommands(stale), (error) => error.code === "json_write_conflict");
  assert.ok(__r02Test.loadCommands().commands.some((command) => command.id === firstCommandId));

  __r02Test.mutateCommandsWithLock((commands) => { commands.commands = commands.commands.filter((command) => command.id !== firstCommandId); });
  const repaired = await expect("POST", "/api/jobs/ready/cancel", { reason: "repair" }, 200);
  assert.equal(repaired.already_terminal, true);
  assert.equal(repaired.command.type, "stop_current_job");
  assert.notEqual(repaired.command.id, firstCommandId);
  const repairedJob = __yeriHybridTest.loadJobs().jobs.find((job) => job.id === "ready");
  assert.equal(repairedJob.cancel_stop_command_required, false);
  assert.equal(repairedJob.cancel_stop_command_id, repaired.command.id);

  fs.writeFileSync(path.join(dataDir, "agent-commands.lock"), "fixture-owner\n");
  const commandLocked = await expect("POST", "/api/jobs/command-lock/cancel", { reason: "locked" }, 503);
  assert.equal(commandLocked.error, "storage_unavailable");
  const pendingRepair = __yeriHybridTest.loadJobs().jobs.find((job) => job.id === "command-lock");
  assert.equal(pendingRepair.status, "cancelled");
  assert.equal(pendingRepair.cancel_stop_command_required, true);
  fs.unlinkSync(path.join(dataDir, "agent-commands.lock"));
  const commandRepaired = await expect("POST", "/api/jobs/command-lock/cancel", { reason: "repair" }, 200);
  assert.equal(commandRepaired.command.type, "stop_current_job");

  fs.writeFileSync(path.join(dataDir, "jobs.lock"), "fixture-owner\n");
  // The stale fixture makes startup recovery attempt a real jobs.json save;
  // a retained lock must leave the API responsive and visible in health.
  assert.doesNotThrow(() => __r02Test.runStartupJobRecovery());
  const health = __storageTest.jsonStorageHealth();
  assert.equal(health.jobs_lock.present, true);
  const healthResponse = await expect("GET", "/api/reports/health", null, 200);
  assert.equal(healthResponse.ok, false);
  assert.ok(healthResponse.storage.issues.some((issue) => issue.code === "jobs_lock_present"));
  const jobsLocked = await expect("POST", "/api/jobs/jobs-lock/cancel", { reason: "locked" }, 503);
  assert.equal(jobsLocked.code, "json_lock_busy");
  fs.unlinkSync(path.join(dataDir, "jobs.lock"));
  assert.doesNotThrow(() => __r02Test.runStartupJobRecovery());
  assert.equal(__yeriHybridTest.loadJobs().jobs.find((job) => job.id === "stale-startup").status, "failed");
  assert.equal((await expect("GET", "/api/reports/health", null, 200)).ok, true);

  // A synchronous storage read failure receives a common 503 and the same
  // dispatch function remains healthy once the file is restored.
  const jobsPath = path.join(dataDir, "jobs.json");
  const jobsBackup = fs.readFileSync(jobsPath, "utf8");
  fs.writeFileSync(jobsPath, "{ broken json", "utf8");
  const corrupted = await expect("GET", "/api/jobs", null, 503);
  assert.equal(corrupted.error, "storage_unavailable");
  assert.equal(corrupted.code, "json_read_failed");
  fs.writeFileSync(jobsPath, jobsBackup, "utf8");
  await expect("GET", "/api/jobs", null, 200);

  const imageJob = { kind: "yeri_write", payload: { image_count: 1 } };
  assert.equal(__yeriHybridTest.imageCompletionIssue(imageJob, { images: { image_skipped_no_key: true, mode_overridden_to_save: true } }), "");
  // 2026-10-13: 키 때문에 이미지만 빠지고 글은 저장된 경우는 실패가 아니다(완료 + 작업 기록 안내).
  assert.equal(__yeriHybridTest.imageCompletionIssue(imageJob, { images: { image_skipped_no_key: true } }), "");
  assert.notEqual(__yeriHybridTest.imageCompletionIssue(imageJob, { images: { mode_overridden_to_save: true } }), "");
  console.log("R02_CANCELLATION_RESILIENCE_SMOKE_OK");
} finally {
  fs.rmSync(dataDir, { recursive: true, force: true });
}
