#!/usr/bin/env node

import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.AIMAX_WEB_APP_URL || "https://api.aimax.ai.kr/app";
const screenshotPath = process.env.AIMAX_USER_FLOW_SCREENSHOT || "/private/tmp/aimax_r3m_user_flow_overview.png";

function getSavedToken() {
  const script = "from web_agent.client import load_session_token; print(load_session_token() or '')";
  const output = childProcess.execFileSync("venv/bin/python", ["-c", script], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return output.trim();
}

function text(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

const token = getSavedToken();
if (!token) {
  console.error("missing saved AIMAX web session token");
  process.exit(2);
}

const { chromium } = await import("playwright");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
});
await context.addInitScript((sessionToken) => {
  localStorage.setItem("aimax_session_token", sessionToken);
}, token);

const page = await context.newPage();
try {
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector("#appView:not(.hidden)", { timeout: 20000 });
  const reportPrompt = await page.evaluate(() => {
    const prompt = document.querySelector("#reportAttentionPrompt");
    if (!prompt || prompt.classList.contains("hidden")) return null;
    return {
      reportId: prompt.dataset.reportId || "",
      title: document.querySelector("#reportAttentionTitle")?.textContent || "",
      body: document.querySelector("#reportAttentionBody")?.textContent || "",
      next: document.querySelector("#reportAttentionNext")?.textContent || "",
    };
  });
  if (reportPrompt) {
    await page.click("#reportAttentionLaterBtn");
    await page.waitForFunction(() => {
      const prompt = document.querySelector("#reportAttentionPrompt");
      return !prompt || prompt.classList.contains("hidden");
    }, { timeout: 5000 });
  }
  const webSecretNotice = await page.evaluate(() => {
    const prompt = document.querySelector("#webSecretNoticePrompt");
    if (!prompt || prompt.classList.contains("hidden")) return null;
    return {
      title: document.querySelector("#webSecretNoticeTitle")?.textContent || "",
      body: document.querySelector("#webSecretNoticeBody")?.textContent || "",
    };
  });
  if (webSecretNotice) {
    await page.click("#webSecretNoticeLaterBtn");
    await page.waitForFunction(() => {
      const prompt = document.querySelector("#webSecretNoticePrompt");
      return !prompt || prompt.classList.contains("hidden");
    }, { timeout: 5000 });
  }
  await page.click('button[data-tab="overview"]');
  await page.waitForTimeout(1200);

  const overview = await page.evaluate(() => ({
    loginHidden: document.querySelector("#loginView")?.classList.contains("hidden"),
    title: document.querySelector("#pageTitle")?.textContent || "",
    userEmail: document.querySelector("#userEmail")?.textContent || "",
    accountEmail: document.querySelector("#accountEmail")?.textContent || "",
    agentStatus: document.querySelector("#agentStatus")?.textContent || "",
    agentVersion: document.querySelector("#agentVersion")?.textContent || "",
    agentLastSeen: document.querySelector("#agentLastSeen")?.textContent || "",
    globalUpdateHidden: document.querySelector("#globalUpdateNotice")?.classList.contains("hidden"),
    updateNoticeHidden: document.querySelector("#updateNotice")?.classList.contains("hidden"),
    detectedPlatform: document.querySelector("#detectedPlatform")?.textContent || "",
  }));

  await page.click('button[data-tab="settings"]');
  await page.waitForTimeout(800);
  const settings = await page.evaluate(() => ({
    title: document.querySelector("#pageTitle")?.textContent || "",
    settingsOverall: document.querySelector("#settingsOverall")?.textContent || "",
    settingsAgentStatus: document.querySelector("#settingsAgentStatus")?.textContent || "",
    settingsAgentVersion: document.querySelector("#settingsAgentVersion")?.textContent || "",
  }));

  await page.click('button[data-tab="updates"]');
  await page.waitForTimeout(800);
  const updates = await page.evaluate(() => ({
    title: document.querySelector("#pageTitle")?.textContent || "",
    updatesOverall: document.querySelector("#updatesOverall")?.textContent || "",
    currentVersion: document.querySelector("#updateCurrentVersion")?.textContent || "",
    latestVersion: document.querySelector("#updateLatestVersion")?.textContent || "",
    minVersion: document.querySelector("#updateMinVersion")?.textContent || "",
    platform: document.querySelector("#updatePlatform")?.textContent || "",
    downloadLabel: document.querySelector("#updateDownloadLabel")?.textContent || "",
  }));

  const environment = await page.evaluate(() => {
    if (typeof reportEnvironmentPayload !== "function") return null;
    const payload = reportEnvironmentPayload();
    const diagnostics = payload?.system?.agent?.diagnostics || {};
    return {
      agentVersion: payload?.system?.agent?.version || "",
      diagnosticsKeys: Object.keys(diagnostics).sort(),
      hasLocalState: Boolean(diagnostics.local_state),
    };
  });

  await page.click('button[data-tab="overview"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const summary = {
    ok: true,
    url: baseUrl,
    screenshot: screenshotPath,
    reportPrompt,
    webSecretNotice,
    overview: Object.fromEntries(Object.entries(overview).map(([key, value]) => [key, typeof value === "string" ? text(value) : value])),
    settings: Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, text(value)])),
    updates: Object.fromEntries(Object.entries(updates).map(([key, value]) => [key, text(value)])),
    environment,
  };

  if (!overview.loginHidden) throw new Error(`app did not enter logged-in view: ${JSON.stringify(summary)}`);
  if (!text(overview.agentVersion).includes("v1.0.17")) throw new Error(`web UI did not show v1.0.17 runner: ${JSON.stringify(summary)}`);
  if (!text(updates.currentVersion).includes("v1.0.17")) throw new Error(`updates tab did not show v1.0.17 current version: ${JSON.stringify(summary)}`);

  console.log(JSON.stringify(summary, null, 2));
} finally {
  await browser.close();
  if (!fs.existsSync(screenshotPath)) {
    try {
      fs.writeFileSync(screenshotPath, "");
    } catch (_error) {}
  }
}
