#!/usr/bin/env node

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-songi-server-discovery-smoke-"));
const researchDir = path.join(tmpDir, "research");
const port = 19680 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const email = "songi-server-discovery@example.test";
const password = "SmokePassword123!";
const fakeYtDlpScriptPath = path.join(tmpDir, "fake-yt-dlp.mjs");
const fakeYtDlpPath = process.platform === "win32"
  ? path.join(tmpDir, "fake-yt-dlp.cmd")
  : fakeYtDlpScriptPath;

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
    id: "songi-server-discovery-user",
    email,
    name: "Songi Server Discovery User",
    status: "active",
    must_change_password: false,
    password_hash: hashPassword(password),
    entitlements: {
      product: "bundle",
      products: ["bundle", "songi"],
      status: "active",
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }],
});

fs.writeFileSync(fakeYtDlpScriptPath, `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args.includes("--version")) {
  console.log("smoke-yt-dlp-2026.05.29");
  process.exit(0);
}
if (args.includes("--print")) {
  const url = args[args.length - 1] || "https://www.youtube.com/watch?v=serverSmoke001";
  console.log(["20260528", "42", "7", "1234", "58", url].join("\\x1f"));
  process.exit(0);
}
const query = args.find((arg) => arg.startsWith("ytsearch")) || "";
const keyword = query.split(":").slice(1).join(":") || "AI 직원";
const rows = [
  {
    id: "serverSmoke001",
    webpage_url: "https://www.youtube.com/watch?v=serverSmoke001",
    title: keyword + " 서버 공개 검색 후보",
    channel: "AIMAX Smoke",
    description: "서버 yt-dlp fallback 후보 카드 검증용 자료",
    upload_date: "20260528",
    view_count: 12345,
    duration: 58,
  },
];
for (const row of rows) console.log(JSON.stringify(row));
`, "utf8");
fs.chmodSync(fakeYtDlpScriptPath, 0o755);
if (process.platform === "win32") {
  fs.writeFileSync(fakeYtDlpPath, `@echo off\r\n"${process.execPath}" "${fakeYtDlpScriptPath}" %*\r\n`, "utf8");
} else {
  fs.chmodSync(fakeYtDlpPath, 0o755);
}

const child = childProcess.spawn(process.execPath, ["oracle/aimax-reports-api/server.js"], {
  cwd: repoRoot,
  env: {
    ...process.env,
    AIMAX_REPORT_HOST: "127.0.0.1",
    AIMAX_REPORT_PORT: String(port),
    AIMAX_REPORT_DATA_DIR: tmpDir,
    AIMAX_RESEARCH_DATA_DIR: researchDir,
    AIMAX_USER_SECRET_ENCRYPTION_KEY: `base64:${crypto.randomBytes(32).toString("base64")}`,
    AIMAX_KEYCHAIN_ACCOUNT: "smoke-no-keychain-account",
    AIMAX_KEYRING_SERVICE: "smoke-no-keyring-service",
    AIMAX_LEGACY_KEYRING_SERVICE: "smoke-no-legacy-keyring",
    AIMAX_SONGI_YTDLP_PATH: fakeYtDlpPath,
    AIMAX_SONGI_SERVER_YTDLP_DISCOVERY_ENABLED: "1",
    YOUTUBE_API_KEY: "",
    AIMAX_YOUTUBE_API_KEY: "",
    APIFY_API_TOKEN: "",
    AIMAX_APIFY_API_TOKEN: "",
    GEMINI_API_KEY: "",
    AIMAX_GEMINI_API_KEY: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let stderr = "";
child.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

function cleanup() {
  child.kill("SIGTERM");
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
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
    const error = new Error(body.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function waitForServer() {
  for (let i = 0; i < 80; i += 1) {
    try {
      await request("/api/reports/health");
      return;
    } catch (_error) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`server did not start: ${stderr}`);
}

try {
  await waitForServer();
  const login = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const auth = { authorization: `Bearer ${login.session_token}` };

  const projectResponse = await request("/api/research/projects", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ name: "서버 fallback 테스트", industry: "교육", goal: "구버전 실행기 없이 후보 찾기" }),
  });
  const project = projectResponse.project;
  if (!project?.id) throw new Error("project was not created");

  const integrations = await request("/api/research/integrations", { headers: auth });
  const youtube = integrations.integrations?.youtube || {};
  if (!youtube.configured || !youtube.server_configured || youtube.execution_mode !== "server_ytdlp") {
    throw new Error(`server yt-dlp was not selected: ${JSON.stringify(youtube)}`);
  }

  const started = await request("/api/research/discovery/search", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      project_id: project.id,
      keyword: "AI 직원",
      max_results: 5,
      date_range_days: 30,
    }),
  });
  if (started.pending_runner || started.command) {
    throw new Error(`server fallback should not create a runner command: ${JSON.stringify(started)}`);
  }
  if (started.run?.source_mode !== "server_ytdlp" || started.run?.status !== "completed") {
    throw new Error(`server fallback did not finish immediately: ${JSON.stringify(started.run)}`);
  }
  const candidate = started.candidates?.[0];
  if (!candidate || candidate.measurement_badge !== "유튜브 공개 검색") {
    throw new Error(`server candidate was not materialized: ${JSON.stringify(started)}`);
  }
  if (!candidate.metrics?.is_short_form || !candidate.url.includes("/shorts/")) {
    throw new Error(`server candidate was not normalized as shorts: ${JSON.stringify(candidate)}`);
  }

  const imported = await request(`/api/research/discovery/candidates/${encodeURIComponent(candidate.id)}/import`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({}),
  });
  if (imported.item.link_fetch_status !== "youtube_discovery") {
    throw new Error(`unexpected import status: ${imported.item.link_fetch_status}`);
  }

  console.log("SONGI_DISCOVERY_SERVER_FALLBACK_SMOKE_OK");
} finally {
  cleanup();
}
