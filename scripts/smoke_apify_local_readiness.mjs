import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForServer(baseUrl, timeoutMs = 8000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/version`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw lastError || new Error("server did not start");
}

async function api(baseUrl, token, pathValue, options = {}) {
  const response = await fetch(`${baseUrl}${pathValue}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-aimax-session-token": token,
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${pathValue} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "aimax-apify-readiness-"));
const port = await freePort();
const token = `smoke-${crypto.randomBytes(16).toString("hex")}`;
const userId = crypto.randomUUID();
const now = new Date().toISOString();
const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const fakeGeminiSecret = "smoke-phase2-gemini-key-1234567890";
const fakeApifySecret = "smoke-phase2-apify-token-1234567890";

await fs.mkdir(dataDir, { recursive: true });
await fs.writeFile(
  path.join(dataDir, "users.json"),
  JSON.stringify({
    version: 1,
    users: [{
      id: userId,
      email: "smoke@example.invalid",
      status: "active",
      must_change_password: false,
      entitlements: { status: "active", product: "bundle", products: ["bundle"] },
      created_at: now,
      updated_at: now,
    }],
  }),
);
await fs.writeFile(
  path.join(dataDir, "sessions.json"),
  JSON.stringify({
    version: 1,
    sessions: [{
      id: crypto.randomUUID(),
      user_id: userId,
      token_hash: hashToken(token),
      created_at: now,
      expires_at: expiresAt,
      last_seen_at: now,
      device_label: "apify-readiness-smoke",
    }],
  }),
);

const server = childProcess.spawn(process.execPath, ["oracle/aimax-reports-api/server.js"], {
  cwd: repoRoot,
  env: {
    ...process.env,
    AIMAX_REPORT_HOST: "127.0.0.1",
    AIMAX_REPORT_PORT: String(port),
    AIMAX_REPORT_DATA_DIR: dataDir,
    AIMAX_KEYCHAIN_ACCOUNT: "__aimax_smoke_missing__",
    AIMAX_KEYRING_SERVICE: "__aimax_smoke_missing__",
    AIMAX_LEGACY_KEYRING_SERVICE: "__aimax_smoke_missing__",
    AIMAX_USER_SECRET_ENCRYPTION_KEY: `base64:${crypto.randomBytes(32).toString("base64")}`,
    APIFY_API_TOKEN: "",
    GEMINI_API_KEY: "",
    AIMAX_SONGI_MEDIA_TOOL_CHECK_TIMEOUT_MS: "100",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let stderr = "";
server.stderr.setEncoding("utf8");
server.stderr.on("data", (chunk) => {
  stderr += chunk;
});

try {
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForServer(baseUrl);
  await api(baseUrl, token, "/api/agent/heartbeat", {
    method: "POST",
    body: JSON.stringify({
      status: "connected",
      version: "v-smoke",
      platform: "Windows 11 AMD64",
      device_label: "apify-readiness-smoke",
      readiness: {
        web_login: true,
        ai_keys: {
          gemini: "missing",
          claude: "missing",
          openai: "missing",
          apify: "ready",
          selected_model: "gemini-2.5-flash",
          selected_model_ready: "missing",
        },
      },
    }),
  });
  const status = await api(baseUrl, token, "/api/agent/status");
  const integrations = await api(baseUrl, token, "/api/research/integrations");
  assert(status.agent?.readiness?.ai_keys?.apify === "ready", "agent readiness did not preserve ai_keys.apify");
  assert(integrations.integrations?.apify?.server_configured === false, "server_configured should be false");
  assert(integrations.integrations?.apify?.configured === false, "configured should remain server execution readiness");
  assert(integrations.integrations?.apify?.local_configured === true, "local_configured should be true");
  assert(integrations.integrations?.apify?.execution_mode === "local_pending", "execution_mode should be local_pending");
  assert(integrations.integrations?.apify?.local_execution_available === false, "local execution should not be advertised yet");
  const project = await api(baseUrl, token, "/api/research/projects", {
    method: "POST",
    body: JSON.stringify({ name: "Apify readiness smoke" }),
  });
  const item = await api(baseUrl, token, "/api/research/items", {
    method: "POST",
    body: JSON.stringify({
      project_id: project.project.id,
      url: "https://www.instagram.com/reel/SMOKE_TEST/",
    }),
  });
  assert(item.item?.link_fetch_status === "apify_local_pending", "Instagram item should use apify_local_pending when only local Apify is ready");
  assert(String(item.item?.source_text || "").includes("웹 보안 저장소"), "Instagram item should direct users to web secret storage");

  await api(baseUrl, token, "/api/user/secrets/gemini", {
    method: "PUT",
    body: JSON.stringify({ value: fakeGeminiSecret }),
  });
  await api(baseUrl, token, "/api/user/secrets/apify", {
    method: "PUT",
    body: JSON.stringify({ value: fakeApifySecret }),
  });
  const webIntegrations = await api(baseUrl, token, "/api/research/integrations");
  assert(webIntegrations.integrations?.gemini?.execution_mode === "web_user", "Gemini should switch to web_user after web secret save");
  assert(webIntegrations.integrations?.apify?.execution_mode === "web_user", "Apify should switch to web_user after web secret save");
  const webItem = await api(baseUrl, token, "/api/research/items", {
    method: "POST",
    body: JSON.stringify({
      project_id: project.project.id,
      url: "https://www.instagram.com/reel/SMOKE_WEB_READY/",
    }),
  });
  assert(webItem.item?.link_fetch_status === "apify_needs_approval", "Instagram item should require explicit Apify approval when web Apify is ready");

  const report = await api(baseUrl, token, "/api/reports", {
    method: "POST",
    body: JSON.stringify({
      source: "aimax-webapp",
      user_input: {
        work_context: "송이 자료조사 자동 분석",
        visible_error: "Apify SNS 수집: 수집 실행이 실패했습니다.",
        user_note: `API key=${fakeGeminiSecret}`,
      },
      system: {
        research_item: {
          employee: "송이",
          workflow: "songi_research",
          task: "reference_collection_and_analysis",
          failed_stage: "apify_collection",
          error_code: "research_apify_run_failed",
          source_url: webItem.item.url,
          item_id: webItem.item.id,
          apify_status_url: "https://console.apify.com/actors/runs/run-smoke?token=secret-token-should-redact",
          api_key: fakeApifySecret,
        },
      },
    }),
  });
  const reportDate = String(report.stored_at || "").slice(0, 10);
  const reportPath = path.join(dataDir, "reports", reportDate, `${report.report_id}.json`);
  const storedReportText = await fs.readFile(reportPath, "utf8");
  const storedReport = JSON.parse(storedReportText);
  assert(storedReport.system?.research_item?.failed_stage === "apify_collection", "report should preserve Songi failed_stage");
  assert(storedReport.system?.research_item?.error_code === "research_apify_run_failed", "report should preserve Songi error_code");
  assert(!storedReportText.includes(fakeGeminiSecret), "report should redact fake Gemini secret");
  assert(!storedReportText.includes(fakeApifySecret), "report should redact fake Apify secret");
  assert(!storedReportText.includes("secret-token-should-redact"), "report should redact tokenized status URLs");

  const appHtml = await fetch(`${baseUrl}/app`).then((response) => response.text());
  assert(appHtml.includes("웹 보안 저장 필요"), "app should label local-only Apify as web security storage required");
  assert(appHtml.includes("failed_stage"), "app should include failed_stage in Songi report diagnostics");
  console.log("APIFY_LOCAL_READINESS_SMOKE_OK");
} finally {
  server.kill("SIGTERM");
  await new Promise((resolve) => server.once("exit", resolve));
  await fs.rm(dataDir, { recursive: true, force: true });
  if (stderr.trim()) {
    console.error(stderr.trim());
  }
}
