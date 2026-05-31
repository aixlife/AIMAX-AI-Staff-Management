#!/usr/bin/env node

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-yeri-paid-guard-smoke-"));
const port = 20500 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const email = "yeri-paid-guard-smoke@example.test";
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
    id: "yeri-paid-guard-smoke-user-id",
    email,
    name: "Yeri Paid Guard Smoke User",
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
    AIMAX_YERI_SERVER_GENERATION_ENABLED: "1",
    AIMAX_YERI_SERVER_GENERATION_MOCK: "",
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
  return { response, body };
}

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 8000) {
    try {
      const { response, body } = await request("/api/reports/health");
      if (response.ok && body.ok) return;
    } catch (_error) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error(`server did not start\nstdout=${stdout}\nstderr=${stderr}`);
}

try {
  await waitForServer();
  const login = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, device_label: "Paid Guard Smoke" }),
  });
  assert(login.response.ok, `login_failed:${JSON.stringify(login.body)}`);
  const auth = { authorization: `Bearer ${login.body.session_token}` };

  const create = await request("/api/jobs", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      kind: "yeri_write",
      server_generation: true,
      payload: { keywords: ["paid guard smoke"], ai_model: "gemini-2.5-flash" },
    }),
  });
  assert(create.response.status === 402, `paid_guard_status_mismatch:${create.response.status}`);
  assert(create.body.error === "yeri_paid_confirmation_required", `paid_guard_error_mismatch:${JSON.stringify(create.body)}`);

  console.log("YERI_PAID_GENERATION_GUARD_SMOKE_OK");
} finally {
  child.kill("SIGTERM");
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_error) {}
}
