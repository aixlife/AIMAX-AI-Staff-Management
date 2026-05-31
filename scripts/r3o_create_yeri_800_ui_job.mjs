#!/usr/bin/env node

import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.AIMAX_WEB_APP_URL || "https://api.aimax.ai.kr/app";
const screenshotDir = process.env.AIMAX_R3O_SCREENSHOT_DIR || "/private/tmp";
const beforePath = path.join(screenshotDir, "aimax_r3o_yeri_800_before_submit.png");
const afterPath = path.join(screenshotDir, "aimax_r3o_yeri_800_after_submit.png");

function getSavedToken() {
  const script = "from web_agent.client import load_session_token; print(load_session_token() or '')";
  const output = childProcess.execFileSync("venv/bin/python", ["-c", script], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return output.trim();
}

async function api(pathname, options = {}) {
  const response = await fetch(`https://api.aimax.ai.kr${pathname}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) {
    throw new Error(`${options.method || "GET"} ${pathname} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

function openJobs(jobs) {
  return jobs.filter((job) => ["queued", "generating", "ready_for_publish", "running"].includes(String(job.status || "")));
}

function newestJob(beforeIds, jobs) {
  return jobs
    .filter((job) => !beforeIds.has(job.id))
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0] || null;
}

const token = getSavedToken();
if (!token) {
  console.error("missing saved AIMAX web session token");
  process.exit(2);
}

fs.mkdirSync(screenshotDir, { recursive: true });

const beforeJobs = (await api("/api/jobs")).jobs || [];
const beforeOpen = openJobs(beforeJobs);
if (beforeOpen.length) {
  throw new Error(`open_jobs_exist_before_submit:${JSON.stringify(beforeOpen.map((job) => ({ id: job.id, kind: job.kind, status: job.status })))}`);
}
const beforeIds = new Set(beforeJobs.map((job) => job.id));

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
  const reportPromptVisible = await page.locator("#reportAttentionPrompt:not(.hidden)").count();
  if (reportPromptVisible) {
    await page.click("#reportAttentionLaterBtn");
    await page.waitForFunction(() => {
      const prompt = document.querySelector("#reportAttentionPrompt");
      return !prompt || prompt.classList.contains("hidden");
    }, { timeout: 5000 });
  }

  await page.click('button[data-tab="jobs"]');
  await page.waitForTimeout(1000);
  await page.fill("#yeriKeywords", "AIMAX 800자 실제 테스트");
  await page.selectOption("#yeriMode", "save");
  await page.selectOption("#yeriAiModel", "gemini-2.5-flash");
  await page.selectOption("#yeriWordCount", "800");
  await page.selectOption("#yeriImageCount", "1");
  await page.fill("#yeriCategory", "테스트");
  await page.screenshot({ path: beforePath, fullPage: true });

  const uiState = await page.evaluate(() => ({
    email: document.querySelector("#userEmail")?.textContent?.trim() || "",
    agentStatus: document.querySelector("#agentStatus")?.textContent?.trim() || "",
    agentVersion: document.querySelector("#agentVersion")?.textContent?.trim() || "",
    blockerHidden: document.querySelector("#yeriJobBlocker")?.classList.contains("hidden"),
    blockerText: document.querySelector("#yeriJobBlocker")?.textContent?.trim() || "",
    submitDisabled: document.querySelector("#yeriSubmitBtn")?.disabled,
    wordCount: document.querySelector("#yeriWordCount")?.value || "",
    imageCount: document.querySelector("#yeriImageCount")?.value || "",
    mode: document.querySelector("#yeriMode")?.value || "",
    model: document.querySelector("#yeriAiModel")?.value || "",
    costText: document.querySelector("#yeriCostEstimate")?.textContent?.trim() || "",
  }));
  if (uiState.submitDisabled) throw new Error(`yeri_submit_disabled:${JSON.stringify(uiState)}`);
  if (uiState.mode !== "save" || uiState.wordCount !== "800" || uiState.imageCount !== "1" || uiState.model !== "gemini-2.5-flash") {
    throw new Error(`unexpected_ui_state:${JSON.stringify(uiState)}`);
  }

  await page.click("#yeriSubmitBtn");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: afterPath, fullPage: true });
  const afterJobs = (await api("/api/jobs")).jobs || [];
  const job = newestJob(beforeIds, afterJobs);
  if (!job) throw new Error("created_job_not_found");
  if (job.kind !== "yeri_write") throw new Error(`created_job_kind_mismatch:${JSON.stringify(job)}`);

  console.log(JSON.stringify({
    ok: true,
    job: {
      id: job.id,
      kind: job.kind,
      status: job.status,
      created_at: job.created_at,
      updated_at: job.updated_at,
      payload: {
        mode: job.payload?.mode,
        ai_model: job.payload?.ai_model,
        word_count: job.payload?.word_count,
        image_count: job.payload?.image_count,
      },
    },
    uiState,
    screenshots: { before: beforePath, after: afterPath },
  }, null, 2));
} finally {
  await browser.close();
}
