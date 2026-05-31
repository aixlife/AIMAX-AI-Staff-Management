#!/usr/bin/env node

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-yeri-server-generation-smoke-"));
const port = 20000 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const email = "yeri-server-generation-smoke@example.test";
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

writeJson(path.join(tmpDir, "users.json"), {
  version: 1,
  users: [{
    id: "yeri-server-generation-smoke-user-id",
    email,
    name: "Yeri Server Generation Smoke User",
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
    AIMAX_YERI_SERVER_GENERATION_MOCK: "1",
    AIMAX_YERI_SERVER_GENERATION_ENABLED: "",
    APIFY_API_TOKEN: "",
    AIMAX_APIFY_API_TOKEN: "",
    GEMINI_API_KEY: "",
    AIMAX_GEMINI_API_KEY: "",
    OPENAI_API_KEY: "",
    AIMAX_OPENAI_API_KEY: "",
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

async function login(deviceLabel) {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, device_label: deviceLabel }),
  });
  return { authorization: `Bearer ${result.session_token}` };
}

async function waitForJobReady(auth, jobId) {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    const result = await request("/api/jobs", { headers: auth });
    const job = result.jobs.find((item) => item.id === jobId);
    if (job?.status === "ready_for_publish") return job;
    if (job?.status === "failed") throw new Error(`mock generation failed: ${JSON.stringify(job)}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("job_did_not_reach_ready_for_publish");
}

try {
  await waitForServer();
  const browserAuth = await login("Browser Smoke");
  const agentAuth = await login("Agent Smoke");

  const created = await request("/api/jobs", {
    method: "POST",
    headers: browserAuth,
    body: JSON.stringify({
      kind: "yeri_write",
      server_generation: true,
      payload: {
        keywords: ["서버 mock 예리"],
        word_count: 900,
        image_count: 2,
        style_id: "info",
        ai_model: "gemini-2.5-flash",
      },
    }),
  });
  assert(created.job.status === "generating", `initial_status_not_generating:${created.job.status}`);

  const readyJob = await waitForJobReady(browserAuth, created.job.id);
  assert(readyJob.artifact?.ready === true, "public_artifact_meta_missing");
  assert(readyJob.artifact.text_model === "mock-no-paid", "mock_model_mismatch");
  assert(!Object.prototype.hasOwnProperty.call(readyJob.artifact, "content_markdown"), "public_artifact_leaked_content");

  const artifactPath = path.join(tmpDir, "artifacts", `${created.job.id}.json`);
  assert(fs.existsSync(artifactPath), "artifact_file_not_created");
  const stored = readJson(artifactPath);
  assert(stored.artifact.content_markdown.includes("# 서버 mock 예리 실전 정리"), "artifact_markdown_title_missing");
  assert((stored.artifact.content_markdown.match(/\[이미지\]/g) || []).length === 2, "artifact_image_count_mismatch");

  const next = await request("/api/agent/next-job", { headers: agentAuth });
  assert(!next.job, "ready_for_publish_must_not_be_claimable_before_local_support");

  console.log("YERI_SERVER_GENERATION_MOCK_SMOKE_OK");
} finally {
  child.kill("SIGTERM");
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_error) {}
}
