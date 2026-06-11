#!/usr/bin/env node

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-feedback-ui-"));
const port = 20800 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const email = "feedback-smoke@aimax.ai.kr";
const password = "SmokePassword123!";
const adminPassword = "admin-feedback-smoke";

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
    id: "staff-feedback-smoke-user",
    email,
    name: "Feedback Smoke",
    status: "active",
    must_change_password: false,
    password_hash: hashPassword(password),
    entitlements: {
      product: "bundle",
      products: ["bundle", "songi", "yunmi", "sangsu", "blog_team"],
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
    AIMAX_ADMIN_PASSWORD: adminPassword,
    AIMAX_TELEGRAM_ALERTS_ENABLED: "0",
    AIMAX_TELEGRAM_BOT_TOKEN: "",
    AIMAX_TELEGRAM_CHAT_ID: "",
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

try {
  await waitForServer();
  const playwright = await import("playwright");
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    await page.addInitScript(() => {
      window.localStorage.setItem("aimax_web_secret_notice_20260522", "1");
      window.localStorage.setItem("aimax_service_notice_20260530_yeri_hyunju_june1", "1");
      window.localStorage.removeItem("aimax_sidebar_collapsed");
    });
    await page.goto(`${baseUrl}/app`);
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.click("#loginForm button[type=submit]");
    await page.waitForSelector("#appView:not(.hidden)", { timeout: 8000 });

    const beforeColumns = await page.locator("#appView").evaluate((node) => getComputedStyle(node).gridTemplateColumns);
    await page.click("#sideToggleBtn");
    await page.waitForFunction(() => document.querySelector("#appView")?.classList.contains("side-collapsed"), null, { timeout: 3000 });
    await page.waitForFunction((previous) => {
      const shell = document.querySelector("#appView");
      return shell && getComputedStyle(shell).gridTemplateColumns !== previous;
    }, beforeColumns, { timeout: 3000 });
    const afterColumns = await page.locator("#appView").evaluate((node) => getComputedStyle(node).gridTemplateColumns);
    const persisted = await page.evaluate(() => window.localStorage.getItem("aimax_sidebar_collapsed"));
    if (beforeColumns === afterColumns || persisted !== "1") {
      throw new Error(`sidebar collapse state did not persist: before=${beforeColumns} after=${afterColumns} persisted=${persisted}`);
    }

    await page.click("[data-tab='jobs']");
    await page.click("#jobEmployeeSwitch [data-job-kind='songi_research']");
    await page.click("[data-tab='feedback']");
    await page.waitForSelector("#feedbackTab:not(.hidden)", { timeout: 3000 });
    const selectedEmployee = await page.locator("#feedbackEmployee").inputValue();
    if (selectedEmployee !== "songi") {
      throw new Error(`feedback default employee mismatch: ${selectedEmployee}`);
    }
    await page.selectOption("#feedbackRating", "4");
    await page.fill("#feedbackGood", "결과를 바로 복사할 수 있어서 좋았습니다.");
    await page.fill("#feedbackImprove", "송이 결과에서 윤미에게 넘기기 버튼이 더 눈에 띄면 좋겠습니다.");
    await page.check("#feedbackContactNeeded");
    await page.click("#feedbackForm button[type=submit]");
    await page.waitForFunction(() => (document.querySelector("#feedbackResult")?.textContent || "").includes("피드백이 접수되었습니다"), null, { timeout: 8000 });

    const admin = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    await admin.goto(`${baseUrl}/admin#reports`);
    await admin.fill("#adminPassword", adminPassword);
    await admin.click("#loginForm button[type=submit]");
    await admin.waitForSelector("#adminView:not(.hidden)", { timeout: 8000 });
    await admin.click("[data-admin-tab='reports']");
    await admin.waitForSelector("#reportsTab:not(.hidden)", { timeout: 3000 });
    await admin.click("[data-report-filter='feedback']");
    await admin.waitForFunction(() => (document.querySelector("#reportsBody")?.textContent || "").includes("송이 피드백"), null, { timeout: 8000 });
    const adminText = await admin.locator("#reportsTab").textContent();
    if (!adminText.includes("피드백 1건") || !adminText.includes("만족도 4점") || !adminText.includes("확인 요청")) {
      throw new Error("admin feedback filter summary missing");
    }
    await admin.click("[data-report-filter='error']");
    const errorText = await admin.locator("#reportsBody").textContent();
    if (!errorText.includes("접수된 오류 보고가 없습니다.")) {
      throw new Error("admin error filter should not show feedback report");
    }
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify({ ok: true, port, data_dir: tmpDir }));
  console.log("STAFF_FEEDBACK_SIDEBAR_UI_SMOKE_OK");
} finally {
  child.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 100));
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
