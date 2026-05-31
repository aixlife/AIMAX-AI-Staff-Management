#!/usr/bin/env node

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-yunmi-access-smoke-"));
const port = 20200 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const password = "SmokePassword123!";

const users = [
  { id: "allowed-demo-name", email: "allowed-demo-name@example.test", name: "AIMAX Demo", allowed: true },
  { id: "allowed-demo-email", email: "demo@aimax.ai.kr", name: "Demo Mail", allowed: true },
  { id: "allowed-makefamily-1", email: "makefamily-1@example.test", name: "메이크패밀리 1", allowed: true },
  { id: "allowed-makefamily-2", email: "makefamily-2@example.test", name: "메이크패밀리2", allowed: true },
  { id: "blocked-regular", email: "blocked-yunmi@example.test", name: "일반 사용자", allowed: false },
];

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
  users: users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    status: "active",
    must_change_password: false,
    password_hash: hashPassword(password),
    entitlements: {
      product: "bundle",
      products: ["bundle", "songi", "blog_team"],
      status: "active",
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })),
});

writeJson(path.join(tmpDir, "jobs.json"), {
  version: 1,
  jobs: [
    {
      id: "blocked-old-yunmi-job",
      user_id: "blocked-regular",
      kind: "yunmi_script",
      worker_code: "yunmi_script_writer",
      status: "done",
      payload: {},
      logs: [],
      result: { mode: "no_paid_alpha" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "allowed-old-yunmi-job",
      user_id: "allowed-makefamily-1",
      kind: "yunmi_script",
      worker_code: "yunmi_script_writer",
      status: "done",
      payload: {},
      logs: [],
      result: { mode: "no_paid_alpha" },
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
    AIMAX_USER_SECRET_ENCRYPTION_KEY: `base64:${crypto.randomBytes(32).toString("base64")}`,
    AIMAX_KEYCHAIN_ACCOUNT: "smoke-no-keychain-account",
    AIMAX_KEYRING_SERVICE: "smoke-no-keyring-service",
    AIMAX_LEGACY_KEYRING_SERVICE: "smoke-no-legacy-keyring",
    AIMAX_YUNMI_PUBLIC_ENABLED: "",
    AIMAX_YUNMI_ALLOWED_USERS: "",
    GEMINI_API_KEY: "",
    AIMAX_GEMINI_API_KEY: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";
child.stdout.on("data", (chunk) => {
  stdout += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

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
    const error = new Error(`${options.method || "GET"} ${pathname} -> ${response.status} ${JSON.stringify(body)}`);
    error.status = response.status;
    error.body = body;
    throw error;
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

async function login(user) {
  const data = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: user.email, password }),
  });
  return { authorization: `Bearer ${data.session_token}` };
}

async function assertYunmiVisible(user, auth) {
  const workers = await request("/api/workers", { headers: auth });
  const hasWorker = workers.workers.some((worker) => worker.staff_code === "yunmi" && worker.job_kind === "yunmi_script");
  const hasJobKind = workers.job_kinds.some((jobKind) => jobKind.kind === "yunmi_script");
  if (!hasWorker || !hasJobKind) throw new Error(`${user.name} should see Yunmi`);
}

async function assertYunmiHidden(user, auth) {
  const workers = await request("/api/workers", { headers: auth });
  const hasWorker = workers.workers.some((worker) => worker.staff_code === "yunmi");
  const hasJobKind = workers.job_kinds.some((jobKind) => jobKind.kind === "yunmi_script");
  if (hasWorker || hasJobKind) throw new Error(`${user.name} should not see Yunmi`);

  let blocked = false;
  try {
    await request("/api/jobs", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        kind: "yunmi_script",
        payload: { topic: "차단 확인", reference_text: "일반 사용자에게는 열리면 안 됩니다." },
      }),
    });
  } catch (error) {
    blocked = error.status === 403 && error.body?.error === "job_not_allowed";
  }
  if (!blocked) throw new Error("blocked user could create a Yunmi job");

  const jobs = await request("/api/jobs", { headers: auth });
  if (jobs.jobs.some((job) => job.kind === "yunmi_script" || job.id === "blocked-old-yunmi-job")) {
    throw new Error("blocked user can still see Yunmi jobs");
  }
}

try {
  await waitForServer();
  for (const user of users) {
    const auth = await login(user);
    if (user.allowed) {
      await assertYunmiVisible(user, auth);
    } else {
      await assertYunmiHidden(user, auth);
    }
  }

  const demoAuth = await login(users[0]);
  const created = await request("/api/jobs", {
    method: "POST",
    headers: demoAuth,
    body: JSON.stringify({
      kind: "yunmi_script",
      payload: {
        topic: "내부 공개 확인",
        reference_text: "AIMAX Demo 사용자에게는 윤미가 열려야 합니다.",
      },
    }),
  });
  if (created.job?.kind !== "yunmi_script" || created.job?.status !== "done") {
    throw new Error("allowed user could not create a Yunmi job");
  }

  const makefamilyAuth = await login(users[2]);
  const jobs = await request("/api/jobs", { headers: makefamilyAuth });
  if (!jobs.jobs.some((job) => job.id === "allowed-old-yunmi-job")) {
    throw new Error("allowed user cannot see existing Yunmi jobs");
  }

  console.log("YUNMI_ACCESS_GATE_SMOKE_OK");
} finally {
  child.kill("SIGTERM");
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
