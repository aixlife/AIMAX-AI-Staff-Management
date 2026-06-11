#!/usr/bin/env node

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-eunseo-webapp-"));
const port = 21600 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const email = "eunseo-smoke@aimax.ai.kr";
const password = "SmokePassword123!";

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
    id: "eunseo-smoke-user",
    email,
    name: "Eunseo Smoke",
    status: "active",
    account_segment: "makefamily_member",
    must_change_password: false,
    password_hash: hashPassword(password),
    entitlements: {
      product: "eunseo",
      products: ["eunseo"],
      status: "active",
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }],
});
fs.mkdirSync(path.join(tmpDir, "downloads"), { recursive: true });
fs.writeFileSync(path.join(tmpDir, "downloads", "EunseoPrompter-mac-0.1.0.zip"), "EUNSEO ZIP SMOKE\n", "utf8");

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
    AIMAX_TELEGRAM_ALERTS_ENABLED: "0",
    AIMAX_TELEGRAM_BOT_TOKEN: "",
    AIMAX_TELEGRAM_CHAT_ID: "",
    GEMINI_API_KEY: "",
    AIMAX_GEMINI_API_KEY: "",
    AIMAX_APIFY_API_TOKEN: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.on("data", (chunk) => { output += chunk.toString(); });
child.stderr.on("data", (chunk) => { output += chunk.toString(); });

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 8000) {
    try {
      const response = await fetch(`${baseUrl}/api/reports/health`);
      const body = await response.json();
      if (body.ok) return;
    } catch (_error) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error(`server did not start: ${output}`);
}

async function assertTextResponse(url, expectedContentType, expectedText) {
  const response = await fetch(url);
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes(expectedContentType) || !text.includes(expectedText)) {
    throw new Error(`bad response ${url}: status=${response.status} contentType=${contentType} text=${text.slice(0, 120)}`);
  }
  return text;
}

try {
  await waitForServer();
  const direct = await fetch(`${baseUrl}/eunseo`, { redirect: "manual" });
  if (direct.status !== 302 || !(direct.headers.get("location") || "").includes("/app#staff")) {
    throw new Error(`Eunseo direct access should redirect to app: status=${direct.status} location=${direct.headers.get("location") || ""}`);
  }
  const directManifest = await fetch(`${baseUrl}/eunseo/manifest.webmanifest`);
  if (directManifest.status !== 403) {
    throw new Error(`Eunseo manifest should require launch access: status=${directManifest.status}`);
  }
  const publicZip = await fetch(`${baseUrl}/downloads/EunseoPrompter-mac-0.1.0.zip`);
  if (publicZip.status !== 404) {
    throw new Error(`Eunseo Mac zip should not be public: status=${publicZip.status}`);
  }

  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const loginBody = await loginResponse.json();
  if (!loginResponse.ok || !loginBody.session_token) {
    throw new Error(`login failed: ${loginResponse.status} ${JSON.stringify(loginBody)}`);
  }
  const launchResponse = await fetch(`${baseUrl}/api/eunseo/launch`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${loginBody.session_token}`,
    },
    body: "{}",
  });
  const launchBody = await launchResponse.json();
  if (!launchResponse.ok || !String(launchBody.url || "").startsWith("/eunseo?ticket=")) {
    throw new Error(`launch failed: ${launchResponse.status} ${JSON.stringify(launchBody)}`);
  }
  const downloadTicketResponse = await fetch(`${baseUrl}/api/downloads/tickets`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${loginBody.session_token}`,
    },
    body: JSON.stringify({ platform: "macos", product: "eunseo" }),
  });
  const downloadTicketBody = await downloadTicketResponse.json();
  if (!downloadTicketResponse.ok || !String(downloadTicketBody.url || "").startsWith("/api/downloads/agent?ticket=")) {
    throw new Error(`download ticket failed: ${downloadTicketResponse.status} ${JSON.stringify(downloadTicketBody)}`);
  }
  const gatedZip = await fetch(`${baseUrl}${downloadTicketBody.url}`);
  const gatedZipText = await gatedZip.text();
  if (!gatedZip.ok || !gatedZipText.includes("EUNSEO ZIP SMOKE")) {
    throw new Error(`gated zip failed: ${gatedZip.status} ${gatedZipText.slice(0, 80)}`);
  }
  await assertTextResponse(`${baseUrl}${launchBody.url}`, "text/html", "은서 녹화 프롬프터");

  const workersResponse = await fetch(`${baseUrl}/api/workers`);
  const workersBody = await workersResponse.json();
  const eunseo = workersBody.workers?.find((worker) => worker.staff_code === "eunseo");
  const webOption = eunseo?.execution_options?.find((option) => option.kind === "web_app");
  const macOption = eunseo?.execution_options?.find((option) => option.kind === "mac_download");
  if (!webOption || webOption.status !== "available" || webOption.url !== "/eunseo") {
    throw new Error(`Eunseo web option not available: ${JSON.stringify(webOption)}`);
  }
  if (!macOption || macOption.status !== "available" || macOption.url !== "/api/downloads/agent?platform=macos&product=eunseo") {
    throw new Error(`Eunseo mac option should use gated download API: ${JSON.stringify(macOption)}`);
  }

  const playwright = await import("playwright");
  const browser = await playwright.chromium.launch({
    headless: true,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await page.goto(`${baseUrl}${launchBody.url}`);
    await page.waitForSelector("#scriptText", { timeout: 5000 });
    const initial = await page.evaluate(() => ({
      title: document.title,
      hasVideo: Boolean(document.querySelector("#camera")),
      playLabel: document.querySelector("#playBtn")?.textContent?.trim(),
      script: document.querySelector("#scriptText")?.textContent || "",
      manifestHref: document.querySelector('link[rel="manifest"]')?.getAttribute("href") || "",
      cameraState: document.querySelector("#cameraState")?.textContent || "",
    }));
    if (initial.title !== "은서 녹화 프롬프터" || !initial.hasVideo || initial.playLabel !== "재생" || !initial.script.includes("은서 프롬프터") || initial.manifestHref !== "/eunseo/manifest.webmanifest") {
      throw new Error(`initial webapp mismatch: ${JSON.stringify(initial)}`);
    }

    await page.click("#editBtn");
    await page.fill("#scriptInput", "첫 문장입니다.\n두 번째 문장입니다.\n카메라 옆을 보고 읽습니다.");
    await page.click("#closeEditorBtn");
    await page.waitForFunction(() => document.querySelector("#scriptText")?.textContent?.includes("두 번째 문장입니다."));
    await page.locator("#fontRange").evaluate((node) => {
      node.value = "42";
      node.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.locator("#opacityRange").evaluate((node) => {
      node.value = "62";
      node.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const adjusted = await page.evaluate(() => ({
      script: document.querySelector("#scriptText")?.textContent || "",
      fontSize: getComputedStyle(document.querySelector("#scriptText")).fontSize,
      frameBackground: getComputedStyle(document.querySelector(".prompter-frame")).backgroundColor,
      stored: JSON.parse(localStorage.getItem("aimax_eunseo_web_prompter_v1") || "{}"),
    }));
    if (!adjusted.script.includes("카메라 옆") || adjusted.fontSize !== "42px" || adjusted.stored.fontSize !== 42 || adjusted.stored.opacity !== 62) {
      throw new Error(`adjusted webapp mismatch: ${JSON.stringify(adjusted)}`);
    }
    await page.click("#playBtn");
    await page.waitForFunction(() => document.querySelector("#playBtn")?.textContent?.trim() === "정지");
    await page.click("#playBtn");
    await page.waitForFunction(() => document.querySelector("#playBtn")?.textContent?.trim() === "재생");
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify({ ok: true, port, data_dir: tmpDir }));
  console.log("EUNSEO_WEBAPP_SMOKE_OK");
} finally {
  child.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 100));
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
