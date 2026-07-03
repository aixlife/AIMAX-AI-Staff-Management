#!/usr/bin/env node
// 진행-정체(progress_stage stall) 좀비보호 2차 스모크:
// 러너 하트비트는 살아있지만 워커가 행 걸려 진행 단계가 멈춘 잡을 실패 처리하는지 검증한다.
// - progress_stage 기록(변화 시에만 changed_at 전진, churn 없음)
// - progress + updated_at 둘 다 정체 시에만 실패 처리(한쪽만 정체면 유지)
// - progress 필드 없는 구버전 러너는 기존 불변식 그대로(러너 생존 시 안 죽임)
// - 시그니처 분류(runner_not_started)

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const email = "progress-stall-smoke@example.test";
const password = "SmokePassword123!";
// 스톨 임계 5분(env 최소값)으로 부팅하고 파일 타임스탬프를 6분 이상 과거로 백데이트해 검증한다.
const STALL_MINUTES = 5;
const BACKDATE_MS = 6 * 60 * 1000;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hashPassword(value, salt = crypto.randomBytes(16)) {
  const params = { N: 16384, r: 8, p: 1, keylen: 64 };
  const derived = crypto.scryptSync(String(value), salt, params.keylen, params);
  return `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function seedUsers(tmpDir) {
  writeJson(path.join(tmpDir, "users.json"), {
    version: 1,
    users: [{
      id: "progress-stall-smoke-user-id",
      email,
      name: "Progress Stall Smoke",
      status: "active",
      must_change_password: false,
      password_hash: hashPassword(password),
      entitlements: { product: "bundle", products: ["bundle"], status: "active" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }],
  });
}

function bootServer(tmpDir, port, extraEnv = {}) {
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
      AIMAX_JOB_PROGRESS_STALL_MINUTES: String(STALL_MINUTES),
      APIFY_API_TOKEN: "",
      AIMAX_APIFY_API_TOKEN: "",
      GEMINI_API_KEY: "",
      AIMAX_GEMINI_API_KEY: "",
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  return { child, logs: () => `stdout=${stdout}\nstderr=${stderr}` };
}

function makeClient(baseUrl) {
  return async function request(pathname, options = {}) {
    const { expectStatus, ...fetchOptions } = options;
    const response = await fetch(`${baseUrl}${pathname}`, {
      ...fetchOptions,
      headers: { "content-type": "application/json", ...(fetchOptions.headers || {}) },
    });
    let body = {};
    try { body = await response.json(); } catch (_error) {}
    if (expectStatus) {
      if (response.status !== expectStatus) {
        throw new Error(`${fetchOptions.method || "GET"} ${pathname} -> expected ${expectStatus}, got ${response.status} ${JSON.stringify(body)}`);
      }
      return body;
    }
    if (!response.ok) {
      throw new Error(`${fetchOptions.method || "GET"} ${pathname} -> ${response.status} ${JSON.stringify(body)}`);
    }
    return body;
  };
}

async function waitForServer(request, logs) {
  const started = Date.now();
  while (Date.now() - started < 8000) {
    try {
      const health = await request("/api/reports/health");
      if (health.ok) return;
    } catch (_error) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error(`server did not start\n${logs()}`);
}

async function login(request) {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, device_label: "Smoke Windows" }),
  });
  return { authorization: `Bearer ${result.session_token}` };
}

// 하트비트. progressStage 를 주면 top-level progress_stage 로 실어보낸다(v1.0.56+ 러너 흉내).
async function heartbeat(request, auth, progressStage) {
  const payload = {
    status: "connected",
    version: "v99.0.0-smoke",
    platform: "windows",
    device_label: "Smoke Windows",
    readiness: { workers: { yeri_write: "ready" } },
  };
  if (progressStage !== undefined) payload.progress_stage = progressStage;
  await request("/api/agent/heartbeat", { method: "POST", headers: auth, body: JSON.stringify(payload) });
}

// running + runner_started_at 설정된 잡을 만든다: create → claim(next-job) → update(running, worker started).
async function startRunningJob(request, auth, keyword) {
  const created = await request("/api/jobs", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      kind: "yeri_write",
      target_platform: "windows",
      target_device_label: "Smoke Windows",
      payload: { keywords: [keyword], ai_model: "mock-no-paid" },
    }),
  });
  const jobId = created.job.id;
  const claimed = await request("/api/agent/next-job?platform=windows&device_label=Smoke%20Windows", { headers: auth });
  assert(claimed.job && claimed.job.id === jobId, "claim_mismatch");
  await request("/api/agent/jobs/update", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ job_id: jobId, status: "running", log: "worker started" }),
  });
  return jobId;
}

function readJobs(tmpDir) {
  return JSON.parse(fs.readFileSync(path.join(tmpDir, "jobs.json"), "utf8"));
}

function mutateJob(tmpDir, jobId, mutator) {
  const data = readJobs(tmpDir);
  const job = data.jobs.find((j) => j.id === jobId);
  assert(job, `job_not_found_in_file:${jobId}`);
  mutator(job);
  fs.writeFileSync(path.join(tmpDir, "jobs.json"), JSON.stringify(data, null, 2), "utf8");
}

function findJob(tmpDir, jobId) {
  return readJobs(tmpDir).jobs.find((j) => j.id === jobId);
}

async function lifecycleScenario() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-progress-stall-"));
  const port = 24100 + Math.floor(Math.random() * 400);
  seedUsers(tmpDir);
  const { child, logs } = bootServer(tmpDir, port);
  const request = makeClient(`http://127.0.0.1:${port}`);
  try {
    await waitForServer(request, logs);
    const auth = await login(request);
    await heartbeat(request, auth); // 러너 등록(진행단계 없음)

    // 1) progress_stage "writing" 하트비트 → 잡에 progress_stage + changed_at 기록.
    const job1 = await startRunningJob(request, auth, "정체 1");
    await heartbeat(request, auth, "writing");
    let j1 = findJob(tmpDir, job1);
    assert(j1.progress_stage === "writing", `expected_progress_stage_writing:${JSON.stringify(j1.progress_stage)}`);
    assert(typeof j1.progress_stage_changed_at === "string" && j1.progress_stage_changed_at, "expected_changed_at_set");
    const changedAt1 = j1.progress_stage_changed_at;
    console.log("PASS 1) progress_stage 최초 기록 + changed_at 설정");

    // 2a) 같은 단계 재보고 → changed_at 불변(churn 없음).
    await new Promise((r) => setTimeout(r, 20));
    await heartbeat(request, auth, "writing");
    j1 = findJob(tmpDir, job1);
    assert(j1.progress_stage_changed_at === changedAt1, `expected_changed_at_unchanged:${j1.progress_stage_changed_at} vs ${changedAt1}`);
    // 2b) 다른 단계 → changed_at 전진.
    await new Promise((r) => setTimeout(r, 20));
    await heartbeat(request, auth, "publishing");
    j1 = findJob(tmpDir, job1);
    assert(j1.progress_stage === "publishing", "expected_stage_publishing");
    assert(j1.progress_stage_changed_at !== changedAt1
      && Date.parse(j1.progress_stage_changed_at) > Date.parse(changedAt1),
      `expected_changed_at_advanced:${j1.progress_stage_changed_at} vs ${changedAt1}`);
    console.log("PASS 2) 같은 단계 재보고는 changed_at 불변, 다른 단계는 전진");

    // 3) changed_at + updated_at 둘 다 6분 백데이트 → 같은 단계 하트비트 시 실패 처리.
    const past = new Date(Date.now() - BACKDATE_MS).toISOString();
    mutateJob(tmpDir, job1, (job) => { job.progress_stage_changed_at = past; job.updated_at = past; });
    await heartbeat(request, auth, "publishing"); // 같은 단계 → changed_at 갱신 안 됨 → 정체 유지
    j1 = findJob(tmpDir, job1);
    assert(j1.status === "failed", `expected_failed_on_stall:${j1.status}`);
    assert(j1.failed_reason === "local_worker_progress_stalled", `expected_failed_reason:${j1.failed_reason}`);
    assert(j1.failed_stage === "runner_progress_stalled", `expected_failed_stage:${j1.failed_stage}`);
    assert(j1.result && j1.result.progress_stage === "publishing" && j1.result.error === "local_worker_progress_stalled",
      `expected_result_shape:${JSON.stringify(j1.result)}`);
    const logMsg = (j1.logs || []).map((l) => l.message).join(" | ");
    assert(logMsg.includes("작업 진행(단계: publishing)") && logMsg.includes("멈춰 작업을 실패"),
      `expected_log_message:${logMsg}`);
    const guards = JSON.parse(fs.readFileSync(path.join(tmpDir, "job-guards.json"), "utf8"));
    const guardRow = guards.guards.find((g) => g.job_kind === "yeri_write" && g.signature === "runner_not_started");
    assert(guardRow, `expected_runner_not_started_guard:${JSON.stringify(guards.guards)}`);
    console.log("PASS 3) progress+updated 둘 다 정체 → 실패 처리 + 로그 + runner_not_started 가드");

    // 4) changed_at 만 6분 백데이트(updated_at 최신) → 실패 처리 안 함.
    const job2 = await startRunningJob(request, auth, "정체 4");
    await heartbeat(request, auth, "writing");
    mutateJob(tmpDir, job2, (job) => { job.progress_stage_changed_at = past; }); // updated_at 은 최신 유지
    await heartbeat(request, auth, "writing");
    const j2 = findJob(tmpDir, job2);
    assert(j2.status === "running", `expected_still_running_when_updated_fresh:${j2.status}`);
    console.log("PASS 4) progress 만 정체 + updated_at 최신 → 실패 처리 안 함");

    // 5) progress 필드 전무(구버전 러너) + updated_at 백데이트 + 러너 생존 → 실패 처리 안 함(기존 불변식).
    const job3 = await startRunningJob(request, auth, "정체 5");
    mutateJob(tmpDir, job3, (job) => { job.updated_at = past; }); // progress 필드 없음
    await heartbeat(request, auth); // 진행단계 없는 하트비트(구버전)
    const j3 = findJob(tmpDir, job3);
    assert(j3.status === "running", `expected_old_runner_untouched:${j3.status}`);
    assert(!j3.progress_stage && !j3.progress_stage_changed_at, "expected_no_progress_fields_added");
    console.log("PASS 5) progress 필드 없는 구버전 러너 → 기존 불변식(러너 생존 시 유지)");
  } finally {
    child.kill("SIGTERM");
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_error) {}
  }
}

// 6) 시그니처 분류 단위: 새 토큰이 runner_not_started 로 분류되는지.
async function classifierUnitScenario() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-progress-stall-cls-"));
  process.env.AIMAX_REPORT_DATA_DIR = tmpDir;
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const { __jobGuardTest } = require(path.join(repoRoot, "oracle/aimax-reports-api/server.js"));
  const cls = __jobGuardTest.classifyJobFailureSignature;
  assert(cls({ reason: "local_worker_progress_stalled" }) === "runner_not_started",
    "reason_local_worker_progress_stalled_must_be_runner_not_started");
  assert(cls({ stage: "runner_progress_stalled" }) === "runner_not_started",
    "stage_runner_progress_stalled_must_be_runner_not_started");
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log("PASS 6) 진행-정체 시그니처 분류 단위 검증(runner_not_started)");
}

try {
  await lifecycleScenario();
  await classifierUnitScenario();
  console.log("PROGRESS_STALL_SMOKE_OK");
} catch (error) {
  console.error("PROGRESS_STALL_SMOKE_FAILED");
  console.error(error);
  process.exitCode = 1;
}
