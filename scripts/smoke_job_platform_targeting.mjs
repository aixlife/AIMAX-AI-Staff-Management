#!/usr/bin/env node

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-job-targeting-smoke-"));
const port = 19400 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const email = "job-targeting-smoke@example.test";
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

writeJson(path.join(tmpDir, "users.json"), {
  version: 1,
  users: [{
    id: "job-targeting-smoke-user-id",
    email,
    name: "Job Targeting Smoke User",
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

async function login(deviceLabel) {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, device_label: deviceLabel }),
  });
  return { authorization: `Bearer ${result.session_token}` };
}

try {
  await waitForServer();
  const browserAuth = await login("Win32");
  const windowsAuth = await login("Smoke Windows");
  const macAuth = await login("Smoke Mac");

  await request("/api/agent/heartbeat", {
    method: "POST",
    headers: windowsAuth,
    body: JSON.stringify({
      status: "connected",
      version: "v9.9.9-win",
      platform: "Windows 11 AMD64",
      device_label: "Smoke Windows",
      readiness: {},
    }),
  });
  await request("/api/agent/heartbeat", {
    method: "POST",
    headers: macAuth,
    body: JSON.stringify({
      status: "connected",
      version: "v9.9.9-mac",
      platform: "Darwin 25.5.0 arm64",
      device_label: "Smoke Mac",
      readiness: {},
    }),
  });

  const created = await request("/api/jobs", {
    method: "POST",
    headers: browserAuth,
    body: JSON.stringify({
      kind: "yeri_write",
      target_platform: "windows",
      target_device_label: "Smoke Windows",
      payload: { keywords: ["targeting smoke"], ai_model: "gemini-2.5-flash" },
    }),
  });
  if (created.job?.target_platform !== "windows" || created.job?.target_device_label !== "Smoke Windows") {
    throw new Error(`job target was not stored: ${JSON.stringify(created.job)}`);
  }

  const macLegacyPoll = await request("/api/agent/next-job", { headers: macAuth });
  if (macLegacyPoll.job) {
    throw new Error(`mac legacy poll received a Windows-targeted job: ${macLegacyPoll.job.id}`);
  }

  const macExplicitPoll = await request("/api/agent/next-job?platform=macos&device_label=Smoke%20Mac", { headers: macAuth });
  if (macExplicitPoll.job) {
    throw new Error(`mac explicit poll received a Windows-targeted job: ${macExplicitPoll.job.id}`);
  }

  const windowsLegacyPoll = await request("/api/agent/next-job", { headers: windowsAuth });
  if (windowsLegacyPoll.job?.id !== created.job.id) {
    throw new Error(`windows legacy poll did not receive target job: ${JSON.stringify(windowsLegacyPoll.job)}`);
  }

  console.log("JOB_PLATFORM_TARGETING_SMOKE_OK");
} finally {
  child.kill("SIGTERM");
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_error) {}
}
