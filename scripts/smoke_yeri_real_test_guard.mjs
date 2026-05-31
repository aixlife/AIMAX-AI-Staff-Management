#!/usr/bin/env node

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-yeri-real-test-guard-smoke-"));
const port = 21000 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const allowedEmail = "yeri-real-test-allowed@example.test";
const blockedEmail = "yeri-real-test-blocked@example.test";
const password = "SmokePassword123!";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hashPassword(value, salt = crypto.randomBytes(16)) {
  const params = { N: 16384, r: 8, p: 1, keylen: 64 };
  const derived = crypto.scryptSync(String(value), salt, params.keylen, params);
  return `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

function user(id, email, name) {
  return {
    id,
    email,
    name,
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
  };
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

writeJson(path.join(tmpDir, "users.json"), {
  version: 1,
  users: [
    user("yeri-real-test-allowed-user-id", allowedEmail, "Yeri Real Test Allowed"),
    user("yeri-real-test-blocked-user-id", blockedEmail, "Yeri Real Test Blocked"),
  ],
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
    AIMAX_YERI_SERVER_GENERATION_ALLOWED_USERS: allowedEmail,
    AIMAX_YERI_SERVER_GENERATION_REAL_TEST_ONLY: "1",
    AIMAX_YERI_SERVER_GENERATION_REAL_TEST_MAX_WORD_COUNT: "500",
    AIMAX_YERI_SERVER_GENERATION_REAL_TEST_MAX_IMAGE_COUNT: "1",
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

async function login(email) {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, device_label: "Real Test Guard Smoke" }),
  });
  assert(result.response.ok, `login_failed:${email}:${JSON.stringify(result.body)}`);
  return { authorization: `Bearer ${result.body.session_token}` };
}

async function createYeriJob(headers, payload, options = {}) {
  const {
    confirmPaid = true,
    serverGeneration = true,
  } = options;
  const body = {
    kind: "yeri_write",
    payload,
  };
  if (serverGeneration) body.server_generation = true;
  if (confirmPaid !== undefined) body.confirm_paid = confirmPaid;
  return request("/api/jobs", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

try {
  await waitForServer();
  const allowedAuth = await login(allowedEmail);
  const blockedAuth = await login(blockedEmail);

  const blocked = await createYeriJob(blockedAuth, {
    keywords: ["blocked user should stay local"],
    ai_model: "gemini-2.5-flash",
    word_count: 300,
    image_count: 1,
  }, { serverGeneration: false });
  assert(blocked.response.status === 201, `blocked_create_status:${blocked.response.status}:${JSON.stringify(blocked.body)}`);
  assert(blocked.body.job?.status === "queued", `blocked_should_stay_local:${JSON.stringify(blocked.body)}`);

  const blockedServerGeneration = await createYeriJob(blockedAuth, {
    keywords: ["blocked user cannot request server generation"],
    ai_model: "gemini-2.5-flash",
    word_count: 300,
    image_count: 1,
  });
  assert(blockedServerGeneration.response.status === 403, `blocked_server_generation_status:${blockedServerGeneration.response.status}:${JSON.stringify(blockedServerGeneration.body)}`);
  assert(blockedServerGeneration.body.error === "yeri_server_generation_not_allowed", `blocked_server_generation_error:${JSON.stringify(blockedServerGeneration.body)}`);

  const allowedLocal = await createYeriJob(allowedAuth, {
    keywords: ["allowed user can still stay local unless requested"],
    ai_model: "gemini-2.5-flash",
    word_count: 300,
    image_count: 1,
  }, { serverGeneration: false });
  assert(allowedLocal.response.status === 201, `allowed_local_status:${allowedLocal.response.status}:${JSON.stringify(allowedLocal.body)}`);
  assert(allowedLocal.body.job?.status === "queued", `allowed_local_should_queue:${JSON.stringify(allowedLocal.body)}`);

  const missingConfirm = await createYeriJob(allowedAuth, {
    keywords: ["allowed user needs confirm paid"],
    ai_model: "gemini-2.5-flash",
    word_count: 300,
    image_count: 1,
  }, { confirmPaid: false });
  assert(missingConfirm.response.status === 402, `confirm_status:${missingConfirm.response.status}:${JSON.stringify(missingConfirm.body)}`);
  assert(missingConfirm.body.error === "yeri_paid_confirmation_required", `confirm_error:${JSON.stringify(missingConfirm.body)}`);

  const tooLong = await createYeriJob(allowedAuth, {
    keywords: ["too long should be blocked"],
    ai_model: "gemini-2.5-flash",
    word_count: 1000,
    image_count: 1,
  });
  assert(tooLong.response.status === 400, `word_limit_status:${tooLong.response.status}:${JSON.stringify(tooLong.body)}`);
  assert(tooLong.body.error === "yeri_real_test_limit_exceeded", `word_limit_error:${JSON.stringify(tooLong.body)}`);
  assert(tooLong.body.field === "word_count", `word_limit_field:${JSON.stringify(tooLong.body)}`);

  const tooManyImages = await createYeriJob(allowedAuth, {
    keywords: ["too many images should be blocked"],
    ai_model: "gemini-2.5-flash",
    word_count: 300,
    image_count: 2,
  });
  assert(tooManyImages.response.status === 400, `image_limit_status:${tooManyImages.response.status}:${JSON.stringify(tooManyImages.body)}`);
  assert(tooManyImages.body.error === "yeri_real_test_limit_exceeded", `image_limit_error:${JSON.stringify(tooManyImages.body)}`);
  assert(tooManyImages.body.field === "image_count", `image_limit_field:${JSON.stringify(tooManyImages.body)}`);

  console.log("YERI_REAL_TEST_GUARD_SMOKE_OK");
} finally {
  child.kill("SIGTERM");
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_error) {}
}
