#!/usr/bin/env node

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-staff-resume-ui-"));
const port = 21100 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const email = "staff-resume-smoke@aimax.ai.kr";
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
    id: "staff-resume-smoke-user",
    email,
    name: "Staff Resume Smoke",
    status: "active",
    account_segment: "makefamily_member",
    must_change_password: false,
    password_hash: hashPassword(password),
    entitlements: {
      product: "bundle",
      products: ["bundle", "blog_team", "songi", "yunmi", "sangsu", "jieun", "nakyung", "eunseo"],
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

async function assertEunseoVisible(page) {
  await page.waitForSelector('#staffGrid [data-staff-card="eunseo"]', { timeout: 5000 });
}

async function waitForResumeHidden(page) {
  await page.waitForFunction(() => document.querySelector("#staffResumePrompt")?.classList.contains("hidden"), null, { timeout: 3000 });
}

try {
  await waitForServer();
  const playwright = await import("playwright");
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 960 } });
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

    await page.click('button[data-tab="staff"]');
    await page.waitForSelector("#staffTab:not(.hidden)", { timeout: 8000 });
    await page.waitForSelector("#staffGrid [data-staff-card]", { timeout: 8000 });

    const chrome = await page.evaluate(() => ({
      executionTabs: document.querySelectorAll("[data-staff-execution-filter]").length,
      searchExists: Boolean(document.querySelector("#staffSearch")),
      statusFilters: document.querySelectorAll("[data-staff-filter]").length,
      cards: document.querySelectorAll("#staffGrid [data-staff-card]").length,
      oldInlineDetail: Boolean(document.querySelector(".staff-detail")),
      oldInlineAction: Boolean(document.querySelector("#staffDetailAction")),
    }));
    if (chrome.executionTabs !== 4 || !chrome.searchExists || chrome.statusFilters < 3 || chrome.cards < 1) {
      throw new Error(`staff chrome missing: ${JSON.stringify(chrome)}`);
    }
    if (chrome.oldInlineDetail || chrome.oldInlineAction) {
      throw new Error(`old inline staff detail remains: ${JSON.stringify(chrome)}`);
    }

    for (const filter of ["web", "pc", "mobile", "all"]) {
      await page.click(`[data-staff-execution-filter="${filter}"]`);
      await assertEunseoVisible(page);
    }

    await page.click('#staffGrid [data-staff-card="songi"]');
    await page.waitForSelector("#staffResumePrompt:not(.hidden)", { timeout: 5000 });
    const activeAction = await page.evaluate(() => {
      const button = document.querySelector("#staffResumeActionBtn");
      return {
        text: button?.textContent?.replace(/\s+/g, " ").trim() || "",
        disabled: Boolean(button?.disabled),
        background: button ? getComputedStyle(button).backgroundColor : "",
        title: button?.getAttribute("title") || "",
      };
    });
    if (!activeAction.text.includes("직원 업무지시") || activeAction.disabled || activeAction.background !== "rgb(15, 118, 110)") {
      throw new Error(`active staff work-order button mismatch: ${JSON.stringify(activeAction)}`);
    }
    await page.click("#staffResumeCloseBtn");
    await waitForResumeHidden(page);

    await page.click('#staffGrid [data-staff-card="yeri"]');
    await page.waitForSelector("#staffResumePrompt:not(.hidden)", { timeout: 3000 });
    const yeriCopy = await page.evaluate(() => ({
      headline: document.querySelector("#staffResumeDescription")?.textContent || "",
      identity: document.querySelector("#staffResumeIdentity")?.textContent || "",
      intro: document.querySelector("#staffResumeIntro")?.textContent || "",
      statusInHeader: Boolean(document.querySelector("#staffResumeStatus")),
    }));
    if (yeriCopy.statusInHeader || !yeriCopy.headline.includes("초안은 빠르게") || !yeriCopy.identity.includes("콘텐츠제작팀") || !yeriCopy.intro.includes("콘텐츠 라이터")) {
      throw new Error(`Yeri resume copy/header status mismatch: ${JSON.stringify(yeriCopy)}`);
    }
    await page.click("#staffResumeCloseBtn");
    await waitForResumeHidden(page);

    await page.click('#staffGrid [data-staff-card="eunseo"]');
    await page.waitForSelector("#staffResumePrompt:not(.hidden)", { timeout: 5000 });

    const resume = await page.evaluate(() => {
      const prompt = document.querySelector("#staffResumePrompt");
      const sheet = document.querySelector(".staff-resume-sheet");
      const actionButton = document.querySelector("#staffResumeActionBtn");
      const optionRows = [...document.querySelectorAll("#staffResumeExecutionOptions .execution-option")];
      const optionButtons = [...document.querySelectorAll("#staffResumeExecutionOptions button")];
      const optionPills = [...document.querySelectorAll("#staffResumeExecutionOptions .pill")];
      const optionLabels = [...document.querySelectorAll("#staffResumeExecutionOptions .execution-option-title strong")]
        .map((node) => node.textContent?.trim() || "");
      const sheetRect = sheet.getBoundingClientRect();
      return {
        name: document.querySelector("#staffResumeName")?.textContent?.trim(),
        role: document.querySelector("#staffResumeRole")?.textContent?.trim(),
        promptBackground: getComputedStyle(prompt).backgroundColor,
        promptBackdrop: getComputedStyle(prompt).backdropFilter || getComputedStyle(prompt).webkitBackdropFilter || "",
        sheetBackground: getComputedStyle(sheet).backgroundColor,
        sheetWidth: sheetRect.width,
        sheetHeight: sheetRect.height,
        sheetScrollWidth: sheet.scrollWidth,
        sheetScrollHeight: sheet.scrollHeight,
        sheetClientWidth: sheet.clientWidth,
        sheetClientHeight: sheet.clientHeight,
        sheetGridColumns: getComputedStyle(sheet).gridTemplateColumns,
        firstSectionGridColumn: getComputedStyle(document.querySelector(".staff-resume-section")).gridColumn,
        sectionRects: [...document.querySelectorAll(".staff-resume-section")].map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            title: node.querySelector(".staff-resume-section-title")?.textContent?.trim() || "",
            top: Math.round(rect.top - sheetRect.top),
            left: Math.round(rect.left - sheetRect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        }),
        optionCount: optionRows.length,
        optionButtonCount: optionButtons.length,
        optionPillCount: optionPills.length,
        optionLabels,
        actionText: actionButton?.textContent?.replace(/\s+/g, " ").trim() || "",
        actionDisabled: Boolean(actionButton?.disabled),
        actionBackground: actionButton ? getComputedStyle(actionButton).backgroundColor : "",
        identity: document.querySelector("#staffResumeIdentity")?.textContent || "",
        intro: document.querySelector("#staffResumeIntro")?.textContent || "",
        career: document.querySelector("#staffResumeCareer")?.textContent || "",
        reference: document.querySelector("#staffResumeReference")?.textContent || "",
        interview: document.querySelector("#staffResumeInterview")?.textContent || "",
        statusInHeader: Boolean(document.querySelector("#staffResumeStatus")),
      };
    });
    if (resume.name !== "은서" || resume.role !== "녹화 프롬프터") {
      throw new Error(`resume header mismatch: ${JSON.stringify(resume)}`);
    }
    if (!resume.promptBackground.includes("rgba(248, 250, 247") || !resume.promptBackdrop.includes("blur")) {
      throw new Error(`resume backdrop should stay light translucent: ${JSON.stringify(resume)}`);
    }
    if (resume.sheetBackground !== "rgb(255, 255, 255)") {
      throw new Error(`resume sheet should be white: ${JSON.stringify(resume)}`);
    }
    if (resume.statusInHeader) {
      throw new Error(`resume header status should be removed: ${JSON.stringify(resume)}`);
    }
    if (resume.sheetWidth / resume.sheetHeight < 1.35) {
      throw new Error(`desktop resume should be landscape A4-ish: ${JSON.stringify(resume)}`);
    }
    if (resume.sheetScrollHeight > resume.sheetClientHeight + 2 || resume.sheetScrollWidth > resume.sheetClientWidth + 2) {
      throw new Error(`desktop resume content should fit inside landscape sheet: ${JSON.stringify(resume)}`);
    }
    if (resume.optionCount !== 5 || resume.optionButtonCount !== 5 || resume.optionPillCount !== 0) {
      throw new Error(`Eunseo execution options mismatch: ${JSON.stringify(resume)}`);
    }
    if (!resume.actionText.includes("웹에서 바로 사용") || resume.actionDisabled || resume.actionBackground !== "rgb(15, 118, 110)") {
      throw new Error(`Eunseo work-order button mismatch: ${JSON.stringify(resume)}`);
    }
    for (const label of ["웹에서 바로 사용", "Mac 앱 다운로드", "Windows 앱", "Android APK", "Toss 미니앱"]) {
      if (!resume.optionLabels.includes(label)) {
        throw new Error(`missing Eunseo option ${label}: ${JSON.stringify(resume.optionLabels)}`);
      }
    }
    for (const text of ["AIMAX-2026-EUNSEO", "촬영지원팀", "10년차", "강원 평창"]) {
      if (!resume.identity.includes(text)) {
        throw new Error(`missing Eunseo identity text ${text}: ${resume.identity}`);
      }
    }
    for (const text of ["카메라 앞", "지역 방송국", "1인 크리에이터", "전 촬영 PD", "속도는 제가 맞추니까요"]) {
      const joined = `${resume.intro}\n${resume.career}\n${resume.reference}\n${resume.interview}`;
      if (!joined.includes(text)) {
        throw new Error(`missing Eunseo resume copy ${text}: ${joined}`);
      }
    }

    await page.click("#staffResumeCloseBtn");
    await waitForResumeHidden(page);
    await page.click('#staffGrid [data-staff-card="eunseo"]');
    await page.waitForSelector("#staffResumePrompt:not(.hidden)", { timeout: 3000 });
    await page.keyboard.press("Escape");
    await waitForResumeHidden(page);
    await page.click('#staffGrid [data-staff-card="eunseo"]');
    await page.waitForSelector("#staffResumePrompt:not(.hidden)", { timeout: 3000 });
    await page.mouse.click(20, 20);
    await waitForResumeHidden(page);

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await mobile.addInitScript(() => {
      window.localStorage.setItem("aimax_web_secret_notice_20260522", "1");
      window.localStorage.setItem("aimax_service_notice_20260530_yeri_hyunju_june1", "1");
    });
    await mobile.goto(`${baseUrl}/app`);
    await mobile.fill("#email", email);
    await mobile.fill("#password", password);
    await mobile.click("#loginForm button[type=submit]");
    await mobile.waitForSelector("#appView:not(.hidden)", { timeout: 8000 });
    await mobile.click('button[data-tab="staff"]');
    await mobile.waitForSelector('#staffGrid [data-staff-card="eunseo"]', { timeout: 8000 });
    await mobile.click('#staffGrid [data-staff-card="eunseo"]');
    await mobile.waitForSelector("#staffResumePrompt:not(.hidden)", { timeout: 3000 });
    const mobileSheet = await mobile.locator(".staff-resume-sheet").evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { width: rect.width, left: rect.left, radius: getComputedStyle(node).borderRadius };
    });
    if (mobileSheet.width < 380 || mobileSheet.left !== 0 || mobileSheet.radius !== "0px") {
      throw new Error(`mobile resume sheet should fill viewport: ${JSON.stringify(mobileSheet)}`);
    }
    await mobile.close();
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify({ ok: true, port, data_dir: tmpDir }));
  console.log("STAFF_RESUME_MODAL_UI_SMOKE_OK");
} finally {
  child.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 100));
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
