#!/usr/bin/env node

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-user-secrets-smoke-"));
const port = 19080 + Math.floor(Math.random() * 600);
const baseUrl = `http://127.0.0.1:${port}`;
const email = "smoke-user@example.test";
const password = "SmokePassword123!";
const geminiSecret = "smoke-gemini-key-1234567890";
const apifySecret = "smoke-apify-token-1234567890";

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
    id: "smoke-user-id",
    email,
    name: "Smoke User",
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
    AIMAX_RESEARCH_DATA_DIR: path.join(tmpDir, "research"),
    AIMAX_DOWNLOAD_DIR: path.join(tmpDir, "downloads"),
    AIMAX_USER_SECRET_ENCRYPTION_KEY: `base64:${crypto.randomBytes(32).toString("base64")}`,
    AIMAX_KEYCHAIN_ACCOUNT: "smoke-no-keychain-account",
    AIMAX_KEYRING_SERVICE: "smoke-no-keyring-service",
    AIMAX_LEGACY_KEYRING_SERVICE: "smoke-no-legacy-keyring",
    APIFY_API_TOKEN: "",
    AIMAX_APIFY_API_TOKEN: "",
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

try {
  await waitForServer();
  const login = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const auth = { authorization: `Bearer ${login.session_token}` };

  const before = await request("/api/research/integrations", { headers: auth });
  if (before.integrations.apify.configured || before.integrations.gemini.configured) {
    throw new Error("expected clean smoke user to start without web provider secrets");
  }

  await request("/api/user/secrets/gemini", {
    method: "PUT",
    headers: auth,
    body: JSON.stringify({ value: geminiSecret }),
  });
  await request("/api/user/secrets/apify", {
    method: "PUT",
    headers: auth,
    body: JSON.stringify({ value: apifySecret }),
  });

  const secrets = await request("/api/user/secrets", { headers: auth });
  if (!secrets.secrets.providers.gemini.web_configured || !secrets.secrets.providers.apify.web_configured) {
    throw new Error("saved web provider secrets were not reported as configured");
  }

  const after = await request("/api/research/integrations", { headers: auth });
  if (!after.integrations.apify.configured || after.integrations.apify.execution_mode !== "web_user") {
    throw new Error("Apify integration did not switch to web_user mode");
  }
  if (!after.integrations.gemini.configured || after.integrations.gemini.execution_mode !== "web_user") {
    throw new Error("Gemini integration did not switch to web_user mode");
  }

  const project = await request("/api/research/projects", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ name: "Smoke project" }),
  });
  const item = await request("/api/research/items", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      project_id: project.project.id,
      url: "https://www.instagram.com/reel/smoke-test/",
    }),
  });
  if (item.item.link_fetch_status !== "apify_needs_approval") {
    throw new Error(`expected apify_needs_approval, got ${item.item.link_fetch_status}`);
  }

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 920 } });
    await page.goto(`${baseUrl}/app`);
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.click("#loginForm button[type=submit]");
    await page.waitForSelector("#appView:not(.hidden)", { timeout: 8000 });
    await page.waitForTimeout(300);
    if (await page.locator("#serviceNoticePrompt:not(.hidden)").count()) {
      await page.click("#serviceNoticeCloseBtn");
      await page.waitForSelector("#serviceNoticePrompt", { state: "hidden", timeout: 8000 });
    }
    await page.waitForTimeout(300);
    if (await page.locator("#webSecretNoticePrompt:not(.hidden)").count()) {
      const noticeText = await page.textContent("#webSecretNoticePrompt");
      if (!noticeText.includes("AIMAX 설정 방식이 더 쉬워졌습니다") || !noticeText.includes("설정 > AI/API 연결")) {
        throw new Error("web secret notice prompt did not render expected guidance");
      }
      await page.click("#webSecretNoticeSettingsBtn");
      await page.waitForSelector("#webSecretNoticePrompt", { state: "hidden", timeout: 8000 });
    } else {
      await page.click("[data-tab='settings']");
    }
    await page.waitForSelector("[data-tab='settings']", { timeout: 8000 });
    await page.waitForSelector("#userSecretsOverall", { timeout: 8000 });
    await page.waitForFunction(() => {
      const gemini = document.querySelector("#secretGeminiStatus")?.textContent || "";
      const apify = document.querySelector("#secretApifyStatus")?.textContent || "";
      return !gemini.includes("확인 중") && !apify.includes("확인 중");
    }, null, { timeout: 8000 });
    const settingsText = await page.textContent("#settingsTab");
    if (!settingsText.includes("AI/API 연결")) {
      throw new Error("settings tab did not render AI/API connection panel");
    }
    const geminiStatus = await page.textContent("#secretGeminiStatus");
    const apifyStatus = await page.textContent("#secretApifyStatus");
    if (!/웹 저장됨|서버 연결됨/.test(geminiStatus || "") || !/웹 저장됨|서버 연결됨/.test(apifyStatus || "")) {
      throw new Error(`unexpected UI secret statuses: gemini=${geminiStatus} apify=${apifyStatus}`);
    }
  } finally {
    await browser.close();
  }

  await request("/api/user/secrets/apify", { method: "DELETE", headers: auth });
  const afterDelete = await request("/api/research/integrations", { headers: auth });
  if (afterDelete.integrations.apify.configured) {
    throw new Error("Apify integration stayed configured after web secret delete");
  }

  const stored = fs.readFileSync(path.join(tmpDir, "user-secrets.json"), "utf8");
  if (stored.includes(geminiSecret) || stored.includes(apifySecret)) {
    throw new Error("raw provider secret leaked into user-secrets.json");
  }

  console.log("USER_SECRETS_SMOKE_OK");
} finally {
  child.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 100));
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
