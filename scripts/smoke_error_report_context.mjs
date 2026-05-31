#!/usr/bin/env node

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-error-report-context-"));
const port = 22000 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const email = "error-report-context@example.test";
const password = "SmokePassword123!";
const adminToken = "smoke-admin-token";

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
  users: [
    {
      id: "error-report-context-user-id",
      email,
      name: "Error Report Context",
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
    AIMAX_REPORT_TOKEN: "smoke-report-token",
    AIMAX_RESEARCH_DATA_DIR: path.join(tmpDir, "research"),
    AIMAX_DOWNLOAD_DIR: path.join(tmpDir, "downloads"),
    AIMAX_ADMIN_TOKEN: adminToken,
    AIMAX_ADMIN_PASSWORD: "",
    TELEGRAM_BOT_TOKEN: "",
    TELEGRAM_CHAT_ID: "",
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
    body: JSON.stringify({ email, password, device_label: "Error Report Context Smoke" }),
  });
  assert(login.response.ok, `login_failed:${JSON.stringify(login.body)}`);
  const headers = { authorization: `Bearer ${login.body.session_token}` };

  const reportPayload = {
    source: "smoke-webapp",
    user_input: {
      work_context: "예리 임시저장",
      visible_error: "content_generation failed with api_key=sk-secret12345678901234567890 for user@example.com",
      user_note: "signed url should be redacted",
    },
    web_context: {
      url: "https://api.example.invalid/app",
      detected_platform: "windows",
      user_agent: "SmokeBrowser/1.0",
    },
    system: {
      app: {
        name: "AIMAX Web App",
        version: "v1.0.30",
        mode: "web",
      },
      runtime: {
        system: "Windows",
        platform: "windows",
      },
      agent: {
        connected: true,
        version: "v1.0.30",
        platform: "Windows 11",
        readiness: {
          ai_keys: {
            gemini: "ready",
            selected_model: "gemini-2.5-flash",
          },
        },
        jobs_recent: [
          {
            id: "job-smoke-123",
            kind: "yeri_write",
            worker_code: "yeri",
            status: "failed",
            result: {
              ok: false,
              stage: "content_generation",
              failed_keyword: "테스트 키워드",
              error: "provider_error token=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
              signed_media_url: "https://example.invalid/private/file.png?X-Amz-Signature=secret",
            },
          },
        ],
      },
      research: {
        media_tools: {
          platform: "win32",
          arch: "x64",
          video_file_analysis_ready: false,
          video_download: {
            available: false,
            error: "research_tool_not_found",
          },
          frame_extract: {
            available: false,
            error: "research_tool_not_found",
          },
        },
      },
    },
  };

  const submitted = await request("/api/reports", {
    method: "POST",
    headers,
    body: JSON.stringify(reportPayload),
  });
  assert(submitted.response.status === 201, `report_submit_failed:${JSON.stringify(submitted.body)}`);
  assert(submitted.body.report_id, "report_id_missing");

  const indexPath = path.join(tmpDir, "reports-index.jsonl");
  const indexRows = fs.readFileSync(indexPath, "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line));
  const row = indexRows.find((item) => item.report_id === submitted.body.report_id);
  assert(row, "report_index_row_missing");
  assert(row.account_user_id === "error-report-context-user-id", `account_user_id_wrong:${JSON.stringify(row)}`);
  assert(row.account_email === "e***@example.test", `account_email_redaction_wrong:${JSON.stringify(row)}`);
  assert(row.job_id === "job-smoke-123", `job_id_missing:${JSON.stringify(row)}`);
  assert(row.job_kind === "yeri_write", `job_kind_missing:${JSON.stringify(row)}`);
  assert(row.job_worker === "yeri", `job_worker_missing:${JSON.stringify(row)}`);
  assert(row.job_status === "failed", `job_status_missing:${JSON.stringify(row)}`);
  assert(row.job_stage === "content_generation", `job_stage_missing:${JSON.stringify(row)}`);
  assert(row.job_failed_keyword === "테스트 키워드", `job_keyword_missing:${JSON.stringify(row)}`);
  assert(row.media_tools_ready === "missing", `media_tools_ready_missing:${JSON.stringify(row)}`);
  assert(row.media_tools_missing === "yt-dlp, ffmpeg", `media_tools_missing_wrong:${JSON.stringify(row)}`);
  assert(!JSON.stringify(row).includes("sk-secret"), `secret_leaked_in_index:${JSON.stringify(row)}`);

  const reportPath = path.join(tmpDir, "reports", row.date, `${row.report_id}.json`);
  const storedReport = readJson(reportPath);
  const storedText = JSON.stringify(storedReport);
  assert(!storedText.includes("sk-secret"), "api_key_leaked_in_report");
  assert(!storedText.includes("X-Amz-Signature=secret"), "signed_url_leaked_in_report");
  assert(storedText.includes("[REDACTED]") || storedText.includes("[REDACTED_TOKEN]"), "redaction_marker_missing");

  const admin = await request("/api/admin/reports", {
    headers: { "x-aimax-admin-token": adminToken },
  });
  assert(admin.response.ok, `admin_reports_failed:${JSON.stringify(admin.body)}`);
  const adminRow = (admin.body.reports || []).find((item) => item.report_id === row.report_id);
  assert(adminRow?.job_id === "job-smoke-123", `admin_job_id_missing:${JSON.stringify(adminRow)}`);
  assert(adminRow?.job_stage === "content_generation", `admin_job_stage_missing:${JSON.stringify(adminRow)}`);
  assert(adminRow?.media_tools_missing === "yt-dlp, ffmpeg", `admin_media_tools_missing:${JSON.stringify(adminRow)}`);

  console.log("ERROR_REPORT_CONTEXT_SMOKE_OK");
} finally {
  child.kill("SIGTERM");
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_error) {}
}
