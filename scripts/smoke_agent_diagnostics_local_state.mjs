#!/usr/bin/env node

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-agent-diag-local-state-"));
const port = 21500 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const email = "agent-diag-local-state@example.test";
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
  users: [
    {
      id: "agent-diag-local-state-user-id",
      email,
      name: "Agent Diagnostics Local State",
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
    },
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
    body: JSON.stringify({ email, password, device_label: "Agent Diagnostics Smoke" }),
  });
  assert(login.response.ok, `login_failed:${JSON.stringify(login.body)}`);
  const headers = { authorization: `Bearer ${login.body.session_token}` };

  const heartbeat = await request("/api/agent/heartbeat", {
    method: "POST",
    headers,
    body: JSON.stringify({
      status: "connected",
      version: "v1.0.17",
      platform: "Darwin 25.5.0 arm64",
      device_label: "Agent Diagnostics Smoke",
      readiness: {
        web_login: true,
        naver_account: { status: "missing", has_id: false, has_password: false },
        ai_keys: {
          gemini: "missing",
          claude: "missing",
          openai: "missing",
          apify: "missing",
          selected_model: "gemini-2.5-flash",
          selected_model_ready: "missing",
        },
        diagnostics: {
          app_mode: "all",
          version: "v1.0.17",
          local_state: {
            available: true,
            app_data_dir: "/Users/private/Library/Application Support/AIMAX",
            repair_available: true,
            repair_strategy: "quarantine_only_no_delete",
            legacy_candidate_count: 2,
            stale_request_count: 1,
            lock_file_action: "diagnostic_only",
            request_files: [
              {
                name: "aimax-local-agent-request.json",
                path: "/Users/private/Library/Application Support/AIMAX/aimax-local-agent-request.json",
                exists: true,
                stale: true,
                repair_action: "quarantine_if_stale",
                age_seconds: 7200,
              },
            ],
          },
        },
      },
    }),
  });
  assert(heartbeat.response.ok, `heartbeat_failed:${JSON.stringify(heartbeat.body)}`);

  const status = await request("/api/agent/status?platform=macos", { headers });
  assert(status.response.ok, `status_failed:${JSON.stringify(status.body)}`);
  const localState = status.body.agent?.diagnostics?.local_state;
  assert(localState?.available === true, `local_state_missing:${JSON.stringify(status.body)}`);
  assert(localState.repair_available === true, `repair_available_missing:${JSON.stringify(localState)}`);
  assert(localState.legacy_candidate_count === 2, `legacy_count_wrong:${JSON.stringify(localState)}`);
  assert(localState.stale_request_count === 1, `stale_count_wrong:${JSON.stringify(localState)}`);
  assert(!JSON.stringify(localState).includes("/Users/private"), `path_leaked:${JSON.stringify(localState)}`);

  console.log("AGENT_DIAGNOSTICS_LOCAL_STATE_SMOKE_OK");
} finally {
  child.kill("SIGTERM");
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_error) {}
}
