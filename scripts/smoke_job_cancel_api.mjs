#!/usr/bin/env node

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-job-cancel-smoke-"));
const port = 21400 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const email = "job-cancel-smoke@example.test";
const password = "SmokePassword123!";

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

writeJson(path.join(tmpDir, "users.json"), {
  version: 1,
  users: [{
    id: "job-cancel-smoke-user-id",
    email,
    name: "Job Cancel Smoke",
    status: "active",
    must_change_password: false,
    password_hash: hashPassword(password),
    entitlements: {
      product: "bundle",
      products: ["bundle"],
      status: "active",
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }],
});

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
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";
child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  let body = {};
  try {
    body = await response.json();
  } catch (_error) {}
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${pathname} -> ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 8000) {
    try {
      const health = await request("/api/reports/health");
      if (health.ok) return;
    } catch (_error) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error(`server did not start\nstdout=${stdout}\nstderr=${stderr}`);
}

async function login() {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, device_label: "Smoke Browser" }),
  });
  return { authorization: `Bearer ${result.session_token}` };
}

async function createJob(auth, keyword) {
  const created = await request("/api/jobs", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      kind: "yeri_write",
      target_platform: "windows",
      target_device_label: "Smoke Windows",
      payload: { keywords: [keyword], ai_model: "mock-no-paid", image_count: 0 },
    }),
  });
  return created.job;
}

async function getJob(auth, jobId) {
  const listed = await request("/api/jobs", { headers: auth });
  return listed.jobs.find((job) => job.id === jobId);
}

try {
  await waitForServer();
  const auth = await login();

  const queued = await createJob(auth, "cancel queued");
  const queuedCancel = await request(`/api/jobs/${encodeURIComponent(queued.id)}/cancel`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ reason: "user_cancelled" }),
  });
  assert(queuedCancel.job.status === "cancelled", `queued_not_cancelled:${JSON.stringify(queuedCancel)}`);
  assert(!queuedCancel.command, `queued_cancel_should_not_create_command:${JSON.stringify(queuedCancel.command)}`);

  const running = await createJob(auth, "cancel running");
  const claimed = await request("/api/agent/next-job?platform=windows&device_label=Smoke%20Windows", { headers: auth });
  assert(claimed.job?.id === running.id, `running_claim_mismatch:${JSON.stringify(claimed)}`);
  const runningCancel = await request(`/api/jobs/${encodeURIComponent(running.id)}/cancel`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ reason: "user_cancelled" }),
  });
  assert(runningCancel.job.status === "cancelled", `running_not_cancelled:${JSON.stringify(runningCancel)}`);
  assert(runningCancel.command?.type === "stop_current_job", `stop_command_missing:${JSON.stringify(runningCancel.command)}`);
  assert(runningCancel.command.target_device_label === "Smoke Windows", `stop_command_device_missing:${JSON.stringify(runningCancel.command)}`);

  const wrongDevice = await request("/api/agent/next-command?platform=windows&device_label=Other%20Windows", { headers: auth });
  assert(!wrongDevice.command, `wrong_device_received_command:${JSON.stringify(wrongDevice)}`);
  const rightDevice = await request("/api/agent/next-command?platform=windows&device_label=Smoke%20Windows", { headers: auth });
  assert(rightDevice.command?.type === "stop_current_job", `right_device_no_stop_command:${JSON.stringify(rightDevice)}`);
  assert(rightDevice.command.payload?.job_id === running.id, `stop_command_job_id_mismatch:${JSON.stringify(rightDevice.command)}`);

  const lateDone = await request("/api/agent/jobs/update", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      job_id: running.id,
      status: "done",
      log: "late done should be ignored",
      result: { ok: true, success: 1, total: 1 },
    }),
  });
  assert(lateDone.ignored === true, `late_done_not_ignored:${JSON.stringify(lateDone)}`);
  const stillCancelled = await getJob(auth, running.id);
  assert(stillCancelled.status === "cancelled", `cancelled_job_resurrected:${JSON.stringify(stillCancelled)}`);

  console.log("JOB_CANCEL_API_SMOKE_OK");
} finally {
  child.kill("SIGTERM");
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_error) {}
}
