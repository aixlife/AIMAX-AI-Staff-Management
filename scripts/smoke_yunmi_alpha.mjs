#!/usr/bin/env node

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-yunmi-alpha-smoke-"));
const port = 19700 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const email = "demo@aimax.ai.kr";
const password = "SmokePassword123!";
const fakeGeminiSecret = "smoke-yunmi-gemini-key-1234567890";
const yunmiRequestId = "yunmi-smoke-request-20260523";

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
    id: "yunmi-smoke-user-id",
    email,
    name: "AIMAX Demo",
    status: "active",
    must_change_password: false,
    password_hash: hashPassword(password),
    entitlements: {
      product: "bundle",
      products: ["bundle", "songi", "blog_team"],
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
    const error = new Error(`${options.method || "GET"} ${pathname} -> ${response.status} ${JSON.stringify(body)}`);
    error.status = response.status;
    error.body = body;
    throw error;
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

  const workers = await request("/api/workers", { headers: auth });
  const yunmi = workers.workers.find((worker) => worker.staff_code === "yunmi");
  if (!yunmi || yunmi.job_kind !== "yunmi_script" || yunmi.execution !== "web_module") {
    throw new Error("Yunmi worker is not exposed as a web_module job");
  }
  const jobKind = workers.job_kinds.find((item) => item.kind === "yunmi_script");
  if (!jobKind || jobKind.required_product !== "bundle") {
    throw new Error("Yunmi job kind is missing bundle entitlement");
  }

  let emptyFailed = false;
  try {
    await request("/api/jobs", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ kind: "yunmi_script", payload: {} }),
    });
  } catch (error) {
    emptyFailed = error.status === 400 && error.body?.error === "yunmi_source_required";
  }
  if (!emptyFailed) {
    throw new Error("empty Yunmi job did not fail with yunmi_source_required");
  }

  let urlOnlyFailed = false;
  try {
    await request("/api/jobs", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        kind: "yunmi_script",
        payload: {
          reference_url: "https://www.instagram.com/reel/example/",
        },
      }),
    });
  } catch (error) {
    urlOnlyFailed = error.status === 400 && error.body?.error === "yunmi_source_required";
  }
  if (!urlOnlyFailed) {
    throw new Error("URL-only Yunmi job did not fail with yunmi_source_required");
  }

  const created = await request("/api/jobs", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      kind: "yunmi_script",
      payload: {
        topic: "30대 피부관리 루틴",
        target_audience: "첫 상담을 고민하는 30대 고객",
        objective: "상담 전에 준비할 기준을 알려주기",
        reference_text: "피부관리는 순서가 중요합니다. 많은 고객이 제품부터 바꾸지만 먼저 생활 루틴과 자극 습관을 봐야 합니다.",
        cta: "저장하고 상담 전 체크리스트로 써보세요.",
      },
    }),
  });
  if (created.job.status !== "done") throw new Error("Yunmi alpha job did not finish synchronously");
  const result = created.job.result || {};
  if (result.mode !== "no_paid_alpha" || result.cost?.total_won !== 0) {
    throw new Error("Yunmi alpha job should be no-paid");
  }
  if (!Array.isArray(result.variants) || result.variants.length < 2) {
    throw new Error("Yunmi alpha job did not return script options");
  }
  if (!String(result.copy_text || "").includes("## 숏폼 스크립트 1안") || !String(result.copy_text || "").includes("## 최종 추천")) {
    throw new Error("Yunmi structured copy_text missing");
  }

  const withUrl = await request("/api/jobs", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      kind: "yunmi_script",
      payload: {
        topic: "제 2의 뇌 만들기",
        objective: "AI 비서를 만들어 준다는 내용을 구조적으로 설명하기",
        target_audience: "AI 자동화에 관심 있는 사람들",
        reference_url: "https://www.instagram.com/reel/example/",
      },
    }),
  });
  const urlDialogue = String(withUrl.job.result?.variants?.[0]?.rows?.[1]?.dialogue || "");
  if (/https?:\/\//i.test(urlDialogue)) {
    throw new Error("Yunmi URL leaked into script dialogue");
  }

  let unconfirmedFailed = false;
  try {
    await request("/api/jobs", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        kind: "yunmi_script",
        payload: {
          mode: "ai_beta",
          topic: "AI 생성 확인 없는 요청",
          reference_text: "확인 없이 AI 생성 경로가 열리면 안 됩니다.",
        },
      }),
    });
  } catch (error) {
    unconfirmedFailed = error.status === 402 && error.body?.error === "yunmi_paid_confirmation_required";
  }
  if (!unconfirmedFailed) {
    throw new Error("Yunmi AI generation request without confirm_paid was not blocked");
  }

  let missingKeyFailed = false;
  try {
    await request("/api/jobs", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        kind: "yunmi_script",
        payload: {
          mode: "ai_beta",
          confirm_paid: true,
          request_id: "yunmi-smoke-missing-key",
          ai_model: "gemini-2.5-pro",
          topic: "AI 생성 키 없는 요청",
          reference_text: "확인은 했지만 provider key가 없으면 막혀야 합니다.",
        },
      }),
    });
  } catch (error) {
    missingKeyFailed = error.status === 409 && error.body?.error === "yunmi_ai_key_missing";
  }
  if (!missingKeyFailed) {
    throw new Error("Yunmi AI generation request without provider key was not blocked");
  }

  await request("/api/user/secrets/gemini", {
    method: "PUT",
    headers: auth,
    body: JSON.stringify({ value: fakeGeminiSecret }),
  });
  const paidReady = await request("/api/jobs", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      kind: "yunmi_script",
      payload: {
        mode: "ai_beta",
        confirm_paid: true,
        request_id: yunmiRequestId,
        ai_model: "gemini-2.5-pro",
        topic: "윤미 AI 생성 요청",
        target_audience: "라이브 강의를 준비하는 강사",
        objective: "오프닝 30초를 더 명확하게 만들기",
        reference_text: "첫 문장에서 오늘 얻어갈 결과를 말하고, 사례를 하나만 보여준다.",
      },
    }),
  });
  if (paidReady.job.status !== "done") throw new Error("Yunmi AI mock job did not finish");
  if (paidReady.job.result?.mode !== "paid_ready_mock") throw new Error("Yunmi AI mock result mode missing");
  if (paidReady.job.result?.paid_call?.executed !== false) throw new Error("Yunmi AI mock smoke must not execute a paid call");
  if (paidReady.job.result?.paid_call?.request_id !== yunmiRequestId) throw new Error("Yunmi request id missing from result");
  if (!paidReady.job.result?.cost?.estimated_total_won || paidReady.job.result?.cost?.total_won !== 0) {
    throw new Error("Yunmi AI mock cost guard is wrong");
  }
  const duplicate = await request("/api/jobs", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      kind: "yunmi_script",
      payload: {
        mode: "ai_beta",
        confirm_paid: true,
        request_id: yunmiRequestId,
        ai_model: "gemini-2.5-pro",
        topic: "윤미 AI 생성 요청",
        reference_text: "같은 request id는 같은 job을 돌려줘야 합니다.",
      },
    }),
  });
  if (!duplicate.existing || duplicate.job.id !== paidReady.job.id) {
    throw new Error("Yunmi request id idempotency did not return the existing job");
  }

  const jobs = await request("/api/jobs", { headers: auth });
  if (!jobs.jobs.some((job) => job.id === created.job.id && job.kind === "yunmi_script")) {
    throw new Error("Yunmi job was not persisted in jobs list");
  }

  const appResponse = await fetch(`${baseUrl}/app`);
  const appHtml = await appResponse.text();
  if (!appHtml.includes("yunmiJobForm") || !appHtml.includes("윤미 스크립트작가")) {
    throw new Error("Yunmi form markers missing from app HTML");
  }
  if (!appHtml.includes("yunmiGenerationMode") || !appHtml.includes("data-yunmi-report-error")) {
    throw new Error("Yunmi AI generation UI markers missing from app HTML");
  }
  const persistedJobs = fs.readFileSync(path.join(tmpDir, "jobs.json"), "utf8");
  if (persistedJobs.includes(fakeGeminiSecret)) {
    throw new Error("raw Gemini key leaked into Yunmi jobs persistence");
  }

  let playwright = null;
  try {
    playwright = await import("playwright");
  } catch (_error) {
    console.log("YUNMI_UI_BROWSER_SMOKE_SKIPPED_NO_PLAYWRIGHT");
  }
  if (playwright?.chromium) {
    const browser = await playwright.chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 920 } });
      await page.addInitScript(() => {
        window.localStorage.setItem("aimax_web_secret_notice_20260522", "1");
        window.localStorage.setItem("aimax_service_notice_20260530_yeri_hyunju_june1", "1");
      });
      await page.goto(`${baseUrl}/app`);
      await page.fill("#email", email);
      await page.fill("#password", password);
      await page.click("#loginForm button[type=submit]");
      await page.waitForSelector("#appView:not(.hidden)", { timeout: 8000 });
      await page.click("[data-tab='jobs']");
      await page.waitForSelector("[data-job-kind='yunmi_script']", { timeout: 8000 });
      await page.click("[data-job-kind='yunmi_script']");
      await page.waitForSelector("#yunmiJobForm:not(.hidden)", { timeout: 8000 });
      await page.fill("#yunmiTopic", "학부모 설명회 오프닝");
      await page.fill("#yunmiAudience", "처음 참석한 학부모");
      await page.fill("#yunmiObjective", "긴장감을 낮추고 오늘 들을 내용을 기대하게 만들기");
      await page.fill("#yunmiReferenceText", "처음 10초에 분위기를 풀고, 오늘 얻어갈 수 있는 결과를 먼저 말한다.");
      await page.click("#yunmiSubmitBtn");
      await page.waitForSelector("#yunmiJobResult:not(.hidden)", { timeout: 8000 });
      const resultText = await page.textContent("#yunmiJobResult");
      if (!resultText.includes("숏폼 스크립트 1안") || !resultText.includes("숏폼 스크립트 2안") || !resultText.includes("최종 추천")) {
        throw new Error("Yunmi UI result did not render structured script options");
      }
      const jobsTableText = await page.textContent("#jobsTable");
      if (jobsTableText.includes("실패 원인을 정리했습니다") || jobsTableText.includes("중 오류")) {
        throw new Error("Yunmi completed job was rendered as a failure in the jobs table");
      }
      if (!jobsTableText.includes("숏폼 스크립트 1안/2안")) {
        throw new Error("Yunmi completed job log did not use the new structured script wording");
      }
      await page.selectOption("#yunmiGenerationMode", "ai_beta");
      await page.waitForFunction(() => (document.querySelector("#yunmiCostEstimate")?.textContent || "").includes("예상 원가"), null, { timeout: 8000 });
      page.once("dialog", async (dialog) => {
        const message = dialog.message();
        if (!message.includes("저장된 Gemini API 키로 실제 유료 AI 호출") || !message.includes("자동 유료 재시도는 하지 않고")) {
          throw new Error("Yunmi AI generation confirm did not include paid safety copy");
        }
        await dialog.accept();
      });
      await page.fill("#yunmiTopic", "AI 생성 UI 스모크");
      await page.fill("#yunmiReferenceText", "UI에서 비용 확인 후 테스트 mock 플래그만 실행한다.");
      await page.click("#yunmiSubmitBtn");
      await page.waitForFunction(() => (document.querySelector("#yunmiJobResult")?.textContent || "").includes("AI mock"), null, { timeout: 8000 });
      const paidText = await page.textContent("#yunmiJobResult");
      if (!paidText.includes("유료 호출 없음") || !paidText.includes("요청 ID")) {
        throw new Error("Yunmi AI mock UI result did not expose request id/no-paid status");
      }
    } finally {
      await browser.close();
    }
  }

  console.log("YUNMI_ALPHA_SMOKE_OK");
  console.log("YUNMI_AI_MOCK_SMOKE_OK");
} finally {
  child.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 100));
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
