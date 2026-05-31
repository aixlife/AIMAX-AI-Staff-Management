#!/usr/bin/env node

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-songi-discovery-smoke-"));
const researchDir = path.join(tmpDir, "research");
const port = 19180 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const email = "songi-discovery@example.test";
const password = "SmokePassword123!";
const keepAlive = process.argv.includes("--keep-alive");

function hashPassword(value, salt = crypto.randomBytes(16)) {
  const params = { N: 16384, r: 8, p: 1, keylen: 64 };
  const derived = crypto.scryptSync(String(value), salt, params.keylen, params);
  return `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_error) {
    return fallback;
  }
}

writeJson(path.join(tmpDir, "users.json"), {
  version: 1,
  users: [{
    id: "songi-discovery-user",
    email,
    name: "Songi Discovery User",
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
    YOUTUBE_API_KEY: "",
    AIMAX_YOUTUBE_API_KEY: "",
    APIFY_API_TOKEN: "",
    AIMAX_APIFY_API_TOKEN: "",
    GEMINI_API_KEY: "",
    AIMAX_GEMINI_API_KEY: "",
    AIMAX_SONGI_SERVER_YTDLP_DISCOVERY_ENABLED: "0",
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
    body: JSON.stringify({ name: "키워드 후보 테스트", industry: "교육", goal: "벤치마킹 후보 찾기" }),
  });
  const project = projectResponse.project;
  if (!project?.id) throw new Error("project was not created");

  const integrationsBefore = await request("/api/research/integrations", { headers: auth });
  if (integrationsBefore.integrations.youtube.configured) throw new Error("youtube should start missing");

  await request("/api/agent/heartbeat", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      status: "connected",
      version: "v1.0.2",
      platform: "Darwin smoke",
      device_label: "Songi Discovery Smoke",
      readiness: {
        web_login: true,
        media_tools: {
          yt_dlp: "ready",
          yt_dlp_version: "smoke",
        },
      },
    }),
  });
  const integrationsAfter = await request("/api/research/integrations", { headers: auth });
  if (!integrationsAfter.integrations.youtube.local_configured) throw new Error("local yt-dlp was not reported configured");

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
  if (!started.pending_runner || started.run.source_mode !== "local_ytdlp") {
    throw new Error(`unexpected discovery start: ${JSON.stringify(started)}`);
  }
  if (!started.command?.id || started.command.type !== "songi_youtube_discovery") {
    throw new Error(`discovery command was not created: ${JSON.stringify(started.command)}`);
  }

  const delivered = await request("/api/agent/next-command?platform=Darwin%20smoke", { headers: auth });
  if (delivered.command?.id !== started.command.id) {
    throw new Error(`discovery command was not delivered: ${JSON.stringify(delivered)}`);
  }

  await request("/api/agent/commands/update", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      command_id: started.command.id,
      status: "done",
      log: "YouTube 후보 1개를 찾았습니다.",
      result: {
        ok: true,
        run_id: started.run.id,
        project_id: project.id,
        keyword: "AI 직원",
        platform: "youtube",
        source_mode: "local_ytdlp",
        source_version: "smoke",
        candidates: [{
          video_id: "smoke12345",
          url: "https://www.youtube.com/watch?v=smoke12345",
          title: "AI 직원 벤치마킹 후보",
          creator: "AIMAX Smoke",
          description: "후보 카드와 가져오기 검증용 자료",
          thumbnail_url: "",
          published_at: new Date().toISOString(),
          metrics: {
            view_count: 12345,
            like_count: 321,
            comment_count: 45,
            views_per_hour: 514,
            engagement_rate: 0.0296,
            age_hours: 24,
            duration_seconds: 58,
          },
        }],
      },
    }),
  });

  const listedBeforeImport = await request(`/api/research/discovery?project_id=${encodeURIComponent(project.id)}`, { headers: auth });
  const smokeCandidate = listedBeforeImport.candidates.find((item) => item.run_id === started.run.id);
  if (!smokeCandidate || smokeCandidate.measurement_badge !== "로컬 공개 검색") {
    throw new Error(`local candidate was not materialized: ${JSON.stringify(listedBeforeImport)}`);
  }
  if (!smokeCandidate.metrics?.is_short_form || !smokeCandidate.url.includes("/shorts/")) {
    throw new Error(`local candidate was not normalized as shorts: ${JSON.stringify(smokeCandidate)}`);
  }

  const imported = await request(`/api/research/discovery/candidates/${encodeURIComponent(smokeCandidate.id)}/import`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({}),
  });
  if (imported.item.link_fetch_status !== "youtube_discovery") {
    throw new Error(`unexpected import status: ${imported.item.link_fetch_status}`);
  }
  if (imported.candidate.imported_item_id !== imported.item.id) {
    throw new Error("candidate did not keep imported item id");
  }

  const listed = await request(`/api/research/discovery?project_id=${encodeURIComponent(project.id)}`, { headers: auth });
  if (!listed.candidates.some((item) => item.id === smokeCandidate.id && item.imported_item_id === imported.item.id)) {
    throw new Error("imported candidate was not listed");
  }

  console.log("SONGI_DISCOVERY_SMOKE_OK");
  if (keepAlive) {
    console.log(JSON.stringify({ baseUrl, email, password, projectId: project.id }));
    await new Promise(() => {});
  }
} finally {
  if (!keepAlive) cleanup();
}
