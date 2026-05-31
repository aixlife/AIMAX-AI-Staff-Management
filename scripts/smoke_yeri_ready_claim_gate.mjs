#!/usr/bin/env node

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-yeri-ready-claim-smoke-"));
const port = 21000 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const email = "yeri-ready-claim-smoke@example.test";
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
    id: "yeri-ready-claim-smoke-user-id",
    email,
    name: "Yeri Ready Claim Smoke User",
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
    AIMAX_YERI_READY_FOR_PUBLISH_CLAIM_ENABLED: "1",
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

async function login(deviceLabel) {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, device_label: deviceLabel }),
  });
  return { authorization: `Bearer ${result.session_token}` };
}

async function waitForReady(auth, jobId) {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    const result = await request("/api/jobs", { headers: auth });
    const job = result.jobs.find((item) => item.id === jobId);
    if (job?.status === "ready_for_publish") return job;
    if (job?.status === "failed") throw new Error(`job failed before claim:${JSON.stringify(job)}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("ready_for_publish_timeout");
}

try {
  await waitForServer();
  const browserAuth = await login("Browser Ready Claim Smoke");
  const agentAuth = await login("Agent Ready Claim Smoke");

  const created = await request("/api/jobs", {
    method: "POST",
    headers: browserAuth,
    body: JSON.stringify({
      kind: "yeri_write",
      server_generation: true,
      payload: {
        keywords: ["ready claim smoke"],
        image_count: 0,
        ai_model: "gemini-2.5-flash",
      },
    }),
  });
  await waitForReady(browserAuth, created.job.id);

  const next = await request("/api/agent/next-job", { headers: agentAuth });
  assert(next.job?.id === created.job.id, `ready job was not claimable:${JSON.stringify(next)}`);
  assert(next.job.status === "running", `claimed job status mismatch:${next.job.status}`);
  assert(next.job.artifact?.content_markdown?.includes("# ready claim smoke 실전 정리"), "claimed job artifact content missing");
  assert(next.job.artifact.text_model === "mock-no-paid", "claimed job artifact model mismatch");

  console.log("YERI_READY_CLAIM_GATE_SMOKE_OK");
} finally {
  child.kill("SIGTERM");
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_error) {}
}
