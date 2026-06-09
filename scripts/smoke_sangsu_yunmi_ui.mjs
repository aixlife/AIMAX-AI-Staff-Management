#!/usr/bin/env node

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-sangsu-yunmi-ui-"));
const port = 20300 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const email = "demo@aimax.ai.kr";
const password = "SmokePassword123!";
const evidenceDir = path.join(repoRoot, "docs", "testing", "evidence", "sangsu-yunmi-ui-20260604");

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
    id: "sangsu-yunmi-ui-smoke-user",
    email,
    name: "AIMAX Demo",
    status: "active",
    must_change_password: false,
    password_hash: hashPassword(password),
    entitlements: {
      product: "bundle",
      products: ["bundle", "yunmi", "sangsu", "songi", "blog_team"],
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
    AIMAX_YUNMI_AI_MOCK: "1",
    GEMINI_API_KEY: "",
    AIMAX_GEMINI_API_KEY: "",
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
  fs.mkdirSync(evidenceDir, { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 960 } });
    await page.addInitScript(() => {
      window.localStorage.setItem("aimax_web_secret_notice_20260522", "1");
      window.localStorage.setItem("aimax_service_notice_20260530_yeri_hyunju_june1", "1");
    });
    await page.goto(`${baseUrl}/app`);
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.click("#loginForm button[type=submit]");
    await page.waitForSelector("#appView:not(.hidden)", { timeout: 8000 });
    await page.click("button[data-tab='jobs']");
    await page.waitForSelector("#jobsTab:not(.hidden)", { timeout: 8000 });

    await page.click("#jobEmployeeSwitch [data-job-kind='sangsu_quote']");
    await page.waitForSelector("#sangsuJobForm:not(.hidden)", { timeout: 8000 });
    const sangsuLayout = await page.locator("#sangsuJobForm .job-workspace").evaluate((node) => getComputedStyle(node).gridTemplateColumns);
    if (!sangsuLayout || sangsuLayout.split(" ").length < 2) {
      throw new Error("Sangsu two-column job workspace missing");
    }
    await page.fill("#sangsuClientName", "테스트 고객사");
    await page.fill("#sangsuClientEmail", "client@example.com");
    await page.fill("#sangsuProjectName", "윤미/상수 UI 개선 견적");
    await page.waitForFunction(() => (document.querySelector("#sangsuPreview")?.textContent || "").includes("client@example.com"), null, { timeout: 8000 });
    await page.screenshot({ path: path.join(evidenceDir, "sangsu-email.png"), fullPage: false });

    await page.click("#jobEmployeeSwitch [data-job-kind='yunmi_script']");
    await page.waitForSelector("#yunmiJobForm:not(.hidden)", { timeout: 8000 });
    const removedYunmiFields = await page.locator("#yunmiGenerationMode,#yunmiPlatform,#yunmiFormat,#yunmiDuration,#yunmiAudience,#yunmiTone,#yunmiCta").count();
    if (removedYunmiFields !== 0) {
      throw new Error("Yunmi simplified input still exposes removed option fields");
    }
    await page.fill("#yunmiTopic", "학부모 설명회 오프닝");
    await page.fill("#yunmiObjective", "긴장감을 낮추고 오늘 들을 내용을 기대하게 만들기");
    await page.fill("#yunmiReferenceText", "처음 10초에 분위기를 풀고, 오늘 얻어갈 수 있는 결과를 먼저 말한다. 설명회가 막막한 이유는 정보가 부족해서가 아니라 무엇을 먼저 봐야 하는지 모르기 때문이다.");
    await page.click("#yunmiSubmitBtn");
    await page.waitForSelector("#yunmiJobResult:not(.hidden)", { timeout: 8000 });
    await page.waitForFunction(() => document.querySelector("#yunmiJobPlaceholder")?.classList.contains("hidden"), null, { timeout: 8000 });
    const resultText = await page.textContent("#yunmiJobResult");
    if (!resultText.includes("숏폼 스크립트 1안") || !resultText.includes("숏폼 스크립트 2안") || !resultText.includes("숏폼 스크립트 3안") || !resultText.includes("최종 추천")) {
      throw new Error("Yunmi structured result missing");
    }
    if (!resultText.includes("A 타깃") || !resultText.includes("B 타깃") || !resultText.includes("C 타깃")) {
      throw new Error("Yunmi target-based variants missing");
    }
    if (!resultText.includes("근거 보기")) {
      throw new Error("Yunmi condensed details disclosure missing");
    }
    if (/오늘은|알아보겠습니다/.test(resultText)) {
      throw new Error("Yunmi result contains banned intro");
    }
    if (!resultText.includes("그냥 넘기는 순간은") || !resultText.includes("지금 막막한 게 정상입니다")) {
      throw new Error("Yunmi revised spoken flow missing");
    }
    await page.screenshot({ path: path.join(evidenceDir, "yunmi-result.png"), fullPage: false });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.click("#jobEmployeeSwitch [data-job-kind='sangsu_quote']");
    await page.waitForSelector("#sangsuJobForm:not(.hidden)", { timeout: 8000 });
    const mobileSangsuLayout = await page.locator("#sangsuJobForm .job-workspace").evaluate((node) => getComputedStyle(node).gridTemplateColumns);
    if (!mobileSangsuLayout || mobileSangsuLayout.split(" ").length !== 1) {
      throw new Error("Sangsu mobile job workspace did not collapse to one column");
    }
    await page.screenshot({ path: path.join(evidenceDir, "sangsu-mobile.png"), fullPage: false });
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify({ ok: true, evidence_dir: evidenceDir }));
  console.log("SANGSU_YUNMI_UI_SMOKE_OK");
} finally {
  child.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 100));
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
