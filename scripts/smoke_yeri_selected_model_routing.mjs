#!/usr/bin/env node

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-yeri-selected-model-"));
const port = 21000 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const email = "yeri-selected-model-smoke@example.test";
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
    id: "yeri-selected-model-smoke-user-id",
    email,
    name: "Yeri Selected Model Smoke User",
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
    AIMAX_KEYCHAIN_ACCOUNT: "aimax-selected-model-smoke-no-secret",
    AIMAX_LOCAL_KEYRING_SERVICE: "aimax-selected-model-smoke-no-secret",
    AIMAX_LEGACY_KEYRING_SERVICE: "aimax-selected-model-smoke-no-secret",
    GEMINI_API_KEY: "",
    AIMAX_GEMINI_API_KEY: "",
    OPENAI_API_KEY: "",
    AIMAX_OPENAI_API_KEY: "",
    CLAUDE_API_KEY: "",
    AIMAX_CLAUDE_API_KEY: "",
    APIFY_API_TOKEN: "",
    AIMAX_APIFY_API_TOKEN: "",
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

async function waitForJobStatus(auth, jobId, expectedStatus) {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    const result = await request("/api/jobs", { headers: auth });
    const job = result.jobs.find((item) => item.id === jobId);
    if (job?.status === expectedStatus) return job;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`job_did_not_reach_${expectedStatus}`);
}

async function createServerGenerationJob(auth, aiModel) {
  return request("/api/jobs", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      kind: "yeri_write",
      server_generation: true,
      confirm_paid: true,
      payload: {
        keywords: [`${aiModel} 라우팅`],
        word_count: 300,
        image_count: 0,
        style_id: "info",
        ai_model: aiModel,
      },
    }),
  });
}

try {
  await waitForServer();
  const browserAuth = await login("Browser Smoke");
  const agentAuth = await login("Agent Smoke");

  const workers = await request("/api/workers", { headers: browserAuth });
  const yeriGeneration = workers.job_kinds.find((item) => item.kind === "yeri_write")?.server_generation || {};
  assert(yeriGeneration.enabled === true, "server_generation_not_enabled");
  assert(yeriGeneration.supported_providers?.includes("claude"), "claude_not_advertised");
  assert(yeriGeneration.supported_providers?.includes("openai"), "openai_not_advertised");

  const claude = await createServerGenerationJob(browserAuth, "claude");
  assert(claude.job.status === "generating", `claude_initial_status:${claude.job.status}`);
  const claudeFailed = await waitForJobStatus(browserAuth, claude.job.id, "failed");
  assert(claudeFailed.failed_reason === "yeri_claude_key_missing", `claude_routed_wrong:${claudeFailed.failed_reason}`);

  const openai = await createServerGenerationJob(browserAuth, "gpt-5.4-mini");
  assert(openai.job.status === "generating", `openai_initial_status:${openai.job.status}`);
  const openaiFailed = await waitForJobStatus(browserAuth, openai.job.id, "failed");
  assert(openaiFailed.failed_reason === "yeri_openai_key_missing", `openai_routed_wrong:${openaiFailed.failed_reason}`);

  const queued = await request("/api/jobs", {
    method: "POST",
    headers: browserAuth,
    body: JSON.stringify({
      kind: "yeri_write",
      payload: {
        keywords: ["로컬 큐 모델 전달"],
        word_count: 300,
        image_count: 0,
        style_id: "info",
        ai_model: "claude",
      },
    }),
  });
  assert(queued.job.status === "queued", `local_job_not_queued:${queued.job.status}`);

  const next = await request("/api/agent/next-job", { headers: agentAuth });
  assert(next.job?.id === queued.job.id, "queued_job_not_claimed");
  assert(next.job.payload?.ai_model === "claude", `agent_payload_model_lost:${JSON.stringify(next.job?.payload)}`);

  console.log("YERI_SELECTED_MODEL_ROUTING_SMOKE_OK");
} finally {
  child.kill("SIGTERM");
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_error) {}
}
