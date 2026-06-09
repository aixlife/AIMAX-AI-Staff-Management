#!/usr/bin/env node
// v1.0.50 실브라우저 점검: 예리 AI 모델 드롭다운 기본값/라벨(무료 2.5-flash 복귀) + 직원 피드백 제출 end-to-end.
// 배포된 server.js + app.html 의 로컬 인스턴스를 실제 chromium 으로 사용자처럼 구동한다.

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-v1050-ui-"));
const port = 20800 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const email = "demo@aimax.ai.kr";
const password = "SmokePassword123!";
const evidenceDir = path.join(repoRoot, "docs", "testing", "evidence", "v1050-model-feedback-ui-20260610");

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
    id: "v1050-ui-smoke-user",
    email,
    name: "AIMAX Demo",
    status: "active",
    must_change_password: false,
    password_hash: hashPassword(password),
    entitlements: {
      product: "bundle",
      products: ["bundle", "yeri", "hyunju", "yunmi", "sangsu", "songi", "blog_team"],
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
child.stdout.on("data", (c) => { output += c.toString(); });
child.stderr.on("data", (c) => { output += c.toString(); });

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 8000) {
    try {
      const r = await fetch(`${baseUrl}/api/reports/health`);
      if ((await r.json()).ok) return;
    } catch (_e) { await new Promise((res) => setTimeout(res, 150)); }
  }
  throw new Error(`server did not start: ${output}`);
}

const consoleErrors = [];
const checks = {};
function assert(name, cond, detail) {
  checks[name] = cond ? "PASS" : `FAIL${detail ? ": " + detail : ""}`;
  if (!cond) throw new Error(`${name} FAIL${detail ? ": " + detail : ""}`);
}

try {
  await waitForServer();
  const playwright = await import("playwright");
  const browser = await playwright.chromium.launch({ headless: true });
  fs.mkdirSync(evidenceDir, { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 960 } });
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    page.on("pageerror", (e) => consoleErrors.push(String(e)));
    await page.addInitScript(() => {
      window.localStorage.setItem("aimax_web_secret_notice_20260522", "1");
      window.localStorage.setItem("aimax_service_notice_20260530_yeri_hyunju_june1", "1");
    });

    // 실제 로그인
    await page.goto(`${baseUrl}/app`);
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.click("#loginForm button[type=submit]");
    await page.waitForSelector("#appView:not(.hidden)", { timeout: 8000 });

    // 업무지시 탭 → 예리
    await page.click("button[data-tab='jobs']");
    await page.waitForSelector("#jobsTab:not(.hidden)", { timeout: 8000 });
    await page.click("#jobEmployeeSwitch [data-job-kind='yeri_write']");
    await page.waitForSelector("#yeriJobForm:not(.hidden)", { timeout: 8000 });
    await page.waitForFunction(() => (document.querySelector("#yeriAiModel")?.options?.length || 0) > 0, null, { timeout: 8000 });

    // === 핵심: 예리 AI 모델 드롭다운 (무료 2.5-flash 기본값 복귀 + 라벨/순서) ===
    const model = await page.evaluate(() => {
      const sel = document.querySelector("#yeriAiModel");
      const opts = Array.from(sel.options).map((o) => ({ value: o.value, text: o.textContent.trim(), selected: o.selected }));
      return { selectedValue: sel.value, firstValue: opts[0]?.value, opts };
    });
    const opt25 = model.opts.find((o) => o.value === "gemini-2.5-flash");
    const opt35 = model.opts.find((o) => o.value === "gemini-3.5-flash");
    assert("yeri_default_is_2.5-flash", model.selectedValue === "gemini-2.5-flash", `selected=${model.selectedValue}`);
    assert("yeri_first_option_2.5-flash", model.firstValue === "gemini-2.5-flash", `first=${model.firstValue}`);
    assert("opt_2.5-flash_label_free", !!opt25 && /무료 티어 가능/.test(opt25.text), opt25 ? opt25.text : "missing");
    assert("opt_3.5-flash_label_paid", !!opt35 && /(고품질|유료)/.test(opt35.text), opt35 ? opt35.text : "missing");
    assert("opt_3.5-flash_not_default_label", !!opt35 && !/무료 티어 가능/.test(opt35.text), opt35 ? opt35.text : "missing");

    // 키 없으면 예리 폼은 입력 비활성/차단 사유 노출 (v1.0.50 사일런트 실패 방지) — 정보성 캡처
    const yeriBlocker = await page.evaluate(() => {
      const b = document.querySelector("#yeriJobBlocker");
      const kw = document.querySelector("#yeriKeywords");
      return {
        blockerShown: b ? !b.classList.contains("hidden") : false,
        blockerText: b ? (b.textContent || "").trim() : "",
        keywordDisabled: kw ? kw.disabled : null,
      };
    });
    checks["yeri_prereq_surfaced(info)"] = yeriBlocker.blockerShown
      ? `blocker: ${yeriBlocker.blockerText.slice(0, 70)}`
      : `keywordDisabled=${yeriBlocker.keywordDisabled}`;
    await page.screenshot({ path: path.join(evidenceDir, "yeri-model-dropdown.png"), fullPage: false });

    // 설정 탭의 글로벌 AI 모델 기본값도 2.5-flash 인지
    await page.click("button[data-tab='settings']");
    await page.waitForSelector("#settingsTab:not(.hidden)", { timeout: 8000 });
    await page.waitForFunction(() => (document.querySelector("#settingsAiModel")?.options?.length || 0) > 0, null, { timeout: 8000 });
    const settingsModel = await page.evaluate(() => document.querySelector("#settingsAiModel")?.value);
    assert("settings_default_is_2.5-flash", settingsModel === "gemini-2.5-flash", `settings=${settingsModel}`);

    // === 직원 피드백 제출 end-to-end (v1.0.50 신규 탭) ===
    await page.click("button[data-tab='feedback']");
    await page.waitForSelector("#feedbackTab:not(.hidden)", { timeout: 8000 });
    await page.waitForSelector("#feedbackForm", { timeout: 8000 });
    await page.selectOption("#feedbackEmployee", { index: 1 });
    await page.selectOption("#feedbackRating", { index: 1 });
    await page.fill("#feedbackGood", "결과 화면이 한눈에 들어와서 좋았습니다.");
    await page.fill("#feedbackImprove", "다음 직원에게 넘기는 버튼이 더 눈에 띄면 좋겠습니다.");
    await page.click("#feedbackForm button[type=submit]");
    await page.waitForSelector("#feedbackResult:not(.hidden)", { timeout: 8000 });
    const feedbackReceipt = await page.textContent("#feedbackResult");
    assert("feedback_submit_receipt", !!feedbackReceipt && feedbackReceipt.trim().length > 0, "empty receipt");
    await page.screenshot({ path: path.join(evidenceDir, "feedback-submitted.png"), fullPage: false });

    // 콘솔 JS 에러 없어야 함
    assert("no_console_errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify({ ok: true, checks, console_errors: consoleErrors, evidence_dir: evidenceDir }, null, 2));
  console.log("V1050_MODEL_FEEDBACK_UI_OK");
} finally {
  child.kill("SIGTERM");
  await new Promise((res) => setTimeout(res, 100));
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
