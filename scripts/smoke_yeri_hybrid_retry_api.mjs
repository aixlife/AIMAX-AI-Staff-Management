#!/usr/bin/env node

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-yeri-retry-api-smoke-"));
const port = 19900 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const email = "yeri-retry-smoke@example.test";
const password = "SmokePassword123!";

function hashPassword(value, salt = crypto.randomBytes(16)) {
  const params = { N: 16384, r: 8, p: 1, keylen: 64 };
  const derived = crypto.scryptSync(String(value), salt, params.keylen, params);
  return `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

writeJson(path.join(tmpDir, "users.json"), {
  version: 1,
  users: [{
    id: "yeri-retry-smoke-user-id",
    email,
    name: "Yeri Retry Smoke User",
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
    body: JSON.stringify({ email, password, device_label: "Yeri Retry Smoke" }),
  });
  return { authorization: `Bearer ${result.session_token}` };
}

function attachArtifactToJob(jobId) {
  const jobsPath = path.join(tmpDir, "jobs.json");
  const jobs = readJson(jobsPath);
  const job = jobs.jobs.find((item) => item.id === jobId);
  if (!job) throw new Error("job_not_found_for_artifact_attach");
  job.artifact_id = jobId;
  job.artifact_generated_at = "2026-05-25T00:00:00.000Z";
  job.artifact_text_model = "mock-no-paid";
  job.artifact_char_count = 12;
  writeJson(jobsPath, jobs);
  writeJson(path.join(tmpDir, "artifacts", `${jobId}.json`), {
    version: 1,
    kind: "yeri_write",
    job_id: jobId,
    artifact: {
      title: "재시도 테스트",
      content_markdown: "본문",
      generated_at: "2026-05-25T00:00:00.000Z",
      text_model: "mock-no-paid",
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    },
    saved_at: "2026-05-25T00:00:00.000Z",
  });
}

try {
  await waitForServer();
  const auth = await login();

  const created = await request("/api/jobs", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      kind: "yeri_write",
      payload: { keywords: ["retry smoke"], ai_model: "mock-no-paid" },
    }),
  });
  attachArtifactToJob(created.job.id);

  await request("/api/agent/jobs/update", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      job_id: created.job.id,
      status: "failed",
      log: "smart editor open failed",
      result: { ok: false, stage: "smart_editor_open", error: "selector timeout" },
    }),
  });

  const retried = await request(`/api/jobs/${encodeURIComponent(created.job.id)}/retry`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({}),
  });
  if (!retried.reused_artifact || retried.job.status !== "ready_for_publish") {
    throw new Error(`artifact retry contract failed: ${JSON.stringify(retried)}`);
  }

  const next = await request("/api/agent/next-job", { headers: auth });
  if (next.job) {
    throw new Error(`ready_for_publish should not be claimable before local support lands: ${next.job.id}`);
  }

  const createdNoArtifact = await request("/api/jobs", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      kind: "yeri_write",
      payload: { keywords: ["retry smoke no artifact"], ai_model: "mock-no-paid" },
    }),
  });
  await request("/api/agent/jobs/update", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      job_id: createdNoArtifact.job.id,
      status: "failed",
      result: { ok: false, stage: "content_generation", error: "mock generation failed" },
    }),
  });
  const retriedNoArtifact = await request(`/api/jobs/${encodeURIComponent(createdNoArtifact.job.id)}/retry`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({}),
  });
  if (retriedNoArtifact.reused_artifact || retriedNoArtifact.job.status !== "queued") {
    throw new Error(`content generation retry contract failed: ${JSON.stringify(retriedNoArtifact)}`);
  }

  console.log("YERI_HYBRID_RETRY_API_SMOKE_OK");
} finally {
  child.kill("SIGTERM");
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_error) {}
}
