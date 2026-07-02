#!/usr/bin/env node
// P1 가드레일 스모크: 연속 실패 가드, acknowledge 해제, 하트비트 자동 해제,
// 시그니처 전환 시 카운트 리셋, 구버전 러너 preflight 차단.

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const email = "p1-guardrails-smoke@example.test";
const password = "SmokePassword123!";

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
      id: "p1-guardrails-smoke-user-id",
      email,
      name: "P1 Guardrails Smoke",
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
  // expectStatus 를 주면 그 상태코드를 성공으로 간주하고 body 를 돌려준다.
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
    body: JSON.stringify({ email, password, device_label: "Smoke Browser" }),
  });
  return { authorization: `Bearer ${result.session_token}` };
}

async function heartbeat(request, auth, version, readiness = {}) {
  await request("/api/agent/heartbeat", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      status: "connected",
      version,
      platform: "windows",
      device_label: "Smoke Windows",
      readiness: { workers: { yeri_write: "ready" }, ...readiness },
    }),
  });
}

async function createJob(request, auth, keyword, expectStatus) {
  return request("/api/jobs", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      kind: "yeri_write",
      target_platform: "windows",
      target_device_label: "Smoke Windows",
      payload: { keywords: [keyword], ai_model: "mock-no-paid" },
    }),
    ...(expectStatus ? { expectStatus } : {}),
  });
}

async function claimJob(request, auth) {
  const claimed = await request("/api/agent/next-job?platform=windows&device_label=Smoke%20Windows", { headers: auth });
  assert(claimed.job, "expected_claimed_job");
  return claimed.job.id;
}

// 러너 흐름 그대로: claim → running(worker started) → failed(지정한 오류)
async function failJobAs(request, auth, keyword, failure) {
  const created = await createJob(request, auth, keyword);
  const jobId = created.job.id;
  assert((await claimJob(request, auth)) === jobId, "claim_mismatch");
  await request("/api/agent/jobs/update", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ job_id: jobId, status: "running", log: "worker started" }),
  });
  await request("/api/agent/jobs/update", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ job_id: jobId, status: "failed", log: failure.log, failed_stage: failure.stage, result: failure.result }),
  });
  return jobId;
}

const LOGIN_FAILURE = {
  stage: "naver_login",
  log: "로그인 실패: 아이디 또는 비밀번호를 확인해주세요.",
  result: { visible_error: "로그인 실패: 아이디 또는 비밀번호를 확인해주세요." },
};
const BILLING_FAILURE = {
  stage: "content_generation",
  log: "Gemini 결제/요금제 한도 초과 - 결제/크레딧 상태를 확인해주세요.",
  result: { visible_error: "Gemini 결제/요금제 한도 초과 - 결제/크레딧 상태를 확인해주세요." },
};
// 계정 단위(기기 무관) 시그니처 — 구조화 stage 로 분류된다.
const AIKEY_FAILURE = {
  stage: "server_generation_auth_failed",
  log: "AI 키 인증 실패",
  result: { visible_error: "AI 키 인증에 실패했습니다." },
};
// 기기 단위 시그니처 — 실행기 미시작(임계 5회).
const RUNNER_FAILURE = {
  stage: "runner_start_not_reported",
  log: "실행기가 작업을 시작하지 못했습니다.",
  result: { visible_error: "실행기가 시작되지 않았습니다." },
};

// M-4: 기기(platform/device_label) 별로 잡을 만들고 실패시키는 헬퍼.
async function createJobOn(request, auth, keyword, device, expectStatus) {
  return request("/api/jobs", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      kind: "yeri_write",
      target_platform: device.platform,
      target_device_label: device.label,
      payload: { keywords: [keyword], ai_model: "mock-no-paid" },
    }),
    ...(expectStatus ? { expectStatus } : {}),
  });
}

async function claimJobOn(request, auth, device) {
  const query = new URLSearchParams({ platform: device.platform, device_label: device.label }).toString();
  const claimed = await request(`/api/agent/next-job?${query}`, { headers: auth });
  assert(claimed.job, "expected_claimed_job");
  return claimed.job.id;
}

async function failJobOn(request, auth, keyword, device, failure) {
  const created = await createJobOn(request, auth, keyword, device);
  const jobId = created.job.id;
  assert((await claimJobOn(request, auth, device)) === jobId, "claim_mismatch");
  await request("/api/agent/jobs/update", { method: "POST", headers: auth, body: JSON.stringify({ job_id: jobId, status: "running", log: "worker started" }) });
  await request("/api/agent/jobs/update", { method: "POST", headers: auth, body: JSON.stringify({ job_id: jobId, status: "failed", log: failure.log, failed_stage: failure.stage, result: failure.result }) });
  return jobId;
}

async function heartbeatOn(request, auth, version, device, readiness = {}) {
  await request("/api/agent/heartbeat", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      status: "connected",
      version,
      platform: device.platform,
      device_label: device.label,
      readiness: { workers: { yeri_write: "ready" }, ...readiness },
    }),
  });
}

async function acknowledge(request, auth) {
  await request("/api/jobs/guard/acknowledge", { method: "POST", headers: auth, body: JSON.stringify({ job_kind: "yeri_write" }) });
}

const DEVICE_A = { platform: "windows", label: "Device A" };
const DEVICE_B = { platform: "windows", label: "Device B" };
const NO_TARGET = { platform: "", label: "" };

async function mainScenario() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-p1-guard-smoke-"));
  const port = 21400 + Math.floor(Math.random() * 400);
  seedUsers(tmpDir);
  const { child, logs } = bootServer(tmpDir, port);
  const request = makeClient(`http://127.0.0.1:${port}`);
  try {
    await waitForServer(request, logs);
    const auth = await login(request);
    // 러너 등록 (버전은 MIN 위로 — preflight 는 별도 시나리오에서 검증)
    await heartbeat(request, auth, "v99.0.0-smoke");

    // 1) 동일 시그니처(네이버 로그인) 3연속 실패 → 4번째 생성 409 guard_paused
    await failJobAs(request, auth, "가드 1회차", LOGIN_FAILURE);
    await failJobAs(request, auth, "가드 2회차", LOGIN_FAILURE);
    await createJob(request, auth, "가드 3회차 전 생성 허용 확인"); // 2회까지는 생성 허용
    // 방금 만든 잡을 3회차 실패로 사용
    const pendingId = (await request("/api/jobs", { headers: auth })).jobs.find((job) => job.status === "queued" || job.status === "assigned")?.id;
    assert(pendingId, "expected_pending_job_for_third_failure");
    assert((await claimJob(request, auth)) === pendingId, "third_claim_mismatch");
    await request("/api/agent/jobs/update", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ job_id: pendingId, status: "running", log: "worker started" }),
    });
    await request("/api/agent/jobs/update", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ job_id: pendingId, status: "failed", log: LOGIN_FAILURE.log, failed_stage: LOGIN_FAILURE.stage, result: LOGIN_FAILURE.result }),
    });
    const blocked = await createJob(request, auth, "차단 확인", 409);
    assert(blocked.error === "guard_paused", `expected_guard_paused:${JSON.stringify(blocked)}`);
    assert(blocked.guard_class === "naver_login_failed", `expected_naver_class:${JSON.stringify(blocked)}`);
    assert(String(blocked.message || "").includes("네이버"), "expected_korean_guidance");
    console.log("PASS 1) 3연속 동일 실패 후 생성 409 guard_paused");

    // 2) 가드 조회 API — 본인 가드 확인
    const guards = await request("/api/jobs/guards", { headers: auth });
    assert(guards.guards.length === 1 && guards.guards[0].paused === true, `expected_paused_guard:${JSON.stringify(guards)}`);
    console.log("PASS 2) GET /api/jobs/guards 활성 가드 반환");

    // 3) acknowledge → 생성 허용, 카운트 리셋
    await request("/api/jobs/guard/acknowledge", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ job_kind: "yeri_write" }),
    });
    const afterAck = await createJob(request, auth, "해제 후 생성");
    assert(afterAck.ok === true, "expected_create_after_ack");
    console.log("PASS 3) acknowledge 후 생성 허용");

    // 4) 시그니처 전환 시 카운트 리셋: 로그인 2회 → 결제 1회 → 생성 여전히 허용
    //    (acknowledge 로 count=0 이므로 로그인 2회는 임계 미달, 결제 전환 시 1로 리셋)
    const seeded = (await request("/api/jobs", { headers: auth })).jobs.find((job) => job.status === "queued" || job.status === "assigned")?.id;
    assert(seeded, "expected_seeded_job");
    assert((await claimJob(request, auth)) === seeded, "seeded_claim_mismatch");
    await request("/api/agent/jobs/update", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ job_id: seeded, status: "running", log: "worker started" }),
    });
    await request("/api/agent/jobs/update", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ job_id: seeded, status: "failed", log: LOGIN_FAILURE.log, failed_stage: LOGIN_FAILURE.stage, result: LOGIN_FAILURE.result }),
    });
    await failJobAs(request, auth, "로그인 실패 2회차", LOGIN_FAILURE);
    await failJobAs(request, auth, "결제 실패로 전환", BILLING_FAILURE);
    const afterSwitch = await createJob(request, auth, "전환 후 생성 허용");
    assert(afterSwitch.ok === true, "expected_create_after_signature_switch");
    const switched = await request("/api/jobs/guards", { headers: auth });
    // M-4: naver(기기 단위)와 billing(계정 단위)은 이제 별도 행이므로 billing 행을 찾아 검증한다.
    const billingGuard = switched.guards.find((g) => g.guard_class === "billing_quota");
    assert(billingGuard && billingGuard.consecutive_count === 1,
      `expected_billing_count_1:${JSON.stringify(switched)}`);
    console.log("PASS 4) 시그니처 전환 시 카운트 1로 리셋 (계정 단위 billing 행)");

    // 5) 하트비트 naver_account ready 전이 → naver_login_failed 가드 자동 해제
    //    M-4 로 naver(기기 단위) 카운트가 앞 시나리오에서 누적돼 있어, acknowledge 로 먼저 리셋한 뒤
    //    로그인 실패 3연속으로 pause 를 새로 만들어 검증한다.
    await request("/api/jobs/guard/acknowledge", { method: "POST", headers: auth, body: JSON.stringify({ job_kind: "yeri_write" }) });
    // 남은 queued 잡 정리를 위해 방금 생성한 잡을 로그인 실패 처리
    const q1 = (await request("/api/jobs", { headers: auth })).jobs.find((job) => job.status === "queued" || job.status === "assigned")?.id;
    assert((await claimJob(request, auth)) === q1, "q1_claim_mismatch");
    await request("/api/agent/jobs/update", { method: "POST", headers: auth, body: JSON.stringify({ job_id: q1, status: "running", log: "worker started" }) });
    await request("/api/agent/jobs/update", { method: "POST", headers: auth, body: JSON.stringify({ job_id: q1, status: "failed", log: LOGIN_FAILURE.log, failed_stage: LOGIN_FAILURE.stage, result: LOGIN_FAILURE.result }) });
    await failJobAs(request, auth, "재차단 2회차", LOGIN_FAILURE);
    await failJobAs(request, auth, "재차단 3회차", LOGIN_FAILURE);
    await createJob(request, auth, "재차단 확인", 409);
    await heartbeat(request, auth, "v99.0.0-smoke", { naver_account: { status: "ready" } });
    const afterReady = await createJob(request, auth, "레디니스 해제 후 생성");
    assert(afterReady.ok === true, "expected_create_after_readiness_release");
    console.log("PASS 5) 네이버 준비 전이 시 가드 자동 해제");

    // 6) 성공(done) 시 가드 삭제
    const doneId = afterReady.job.id;
    assert((await claimJob(request, auth)) === doneId, "done_claim_mismatch");
    await request("/api/agent/jobs/update", { method: "POST", headers: auth, body: JSON.stringify({ job_id: doneId, status: "running", log: "worker started" }) });
    await request("/api/agent/jobs/update", { method: "POST", headers: auth, body: JSON.stringify({ job_id: doneId, status: "done", log: "완료" }) });
    const cleared = await request("/api/jobs/guards", { headers: auth });
    assert(cleared.guards.length === 0, `expected_no_guards_after_done:${JSON.stringify(cleared)}`);
    console.log("PASS 6) done 전이 시 가드 삭제");
  } finally {
    child.kill("SIGTERM");
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_error) {}
  }
}

async function versionGateScenario() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-p1-vergate-smoke-"));
  const port = 21850 + Math.floor(Math.random() * 300);
  seedUsers(tmpDir);
  const { child, logs } = bootServer(tmpDir, port, {
    AIMAX_MIN_AGENT_VERSION: "v9.9.9",
    AIMAX_LATEST_AGENT_VERSION: "v9.9.9",
  });
  const request = makeClient(`http://127.0.0.1:${port}`);
  try {
    await waitForServer(request, logs);
    const auth = await login(request);
    // 에이전트 정보 없음 → 차단하지 않음 (기존 동작 보존)
    const noAgent = await createJob(request, auth, "에이전트 없음 생성 허용");
    assert(noAgent.ok === true, "expected_create_without_agent");
    // 구버전 하트비트 → 생성 409 runner_update_required
    await heartbeat(request, auth, "v1.0.0");
    const blocked = await createJob(request, auth, "구버전 차단", 409);
    assert(blocked.error === "runner_update_required", `expected_update_required:${JSON.stringify(blocked)}`);
    assert(String(blocked.message || "").includes("업데이트"), "expected_update_guidance");
    console.log("PASS 7) 에이전트 미등록은 허용, 구버전 러너는 409 runner_update_required");
  } finally {
    child.kill("SIGTERM");
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_error) {}
  }
}

// 레드팀 H-2 + M-1: 2단계 분류 — 구조화 필드 우선, 자유텍스트는 강한 문구만 폴백.
async function signatureUnitScenario() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-p1-sig-unit-"));
  process.env.AIMAX_REPORT_DATA_DIR = tmpDir;
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const { __jobGuardTest } = require(path.join(repoRoot, "oracle/aimax-reports-api/server.js"));
  const cls = __jobGuardTest.classifyJobFailureSignature;
  // H-2 회귀: 좀비 타임아웃(구조화 필드)은 실행기 계열 — transient 오분류 금지.
  assert(cls({ reason: "runner_stopped_heartbeating_or_timed_out" }) === "runner_not_started",
    "zombie_timeout_must_be_runner_not_started");
  assert(cls({ reason: "runner_start_not_reported" }) === "runner_not_started", "start_not_reported_class");
  assert(cls({ stage: "runner_stopped_heartbeating_or_timed_out" }) === "runner_not_started", "stage_runner_class");
  // 실제 흐름: 네이버 로그인 실패는 stage 로 도착(구조화 1단계).
  assert(cls({ stage: "naver_login", visible_error: "로그인 실패: 아이디 또는 비밀번호를 확인해주세요." }) === "naver_login_failed", "structured_login_class");
  // 강한 자유텍스트만 2단계 매칭.
  assert(cls({ visible_error: "Gemini 일시적 오류 - 잠시 후 다시 시도해주세요." }) === "transient", "transient_class");
  assert(cls({ visible_error: "Gemini 결제/요금제 한도 초과" }) === "billing_quota", "billing_class");
  assert(cls({ visible_error: "네이버 로그인 화면에서 인증이 필요합니다" }) === "naver_login_failed", "freetext_naver_class");
  // M-1 적대 케이스: 구조화 필드가 자유텍스트의 일반 단어를 이긴다.
  assert(cls({ diagnostic_code: "server_generation_auth_failed", visible_error: "발행 중 timeout 오류가 났어요" }) === "ai_key_invalid",
    "structured_auth_beats_freetext_timeout");
  // bare timeout 은 2단계에서 매칭 안 됨 → other.
  assert(cls({ visible_error: "발행 중 timeout 오류가 났어요" }) === "other", "bare_timeout_freetext_is_other");
  // bare 로그인(네이버 없음)은 2단계에서 제거됨 → other.
  assert(cls({ visible_error: "로그인해주세요" }) === "other", "bare_login_freetext_is_other");
  assert(cls({ visible_error: "잠시 후 다시 시도해주세요" }) === "transient", "freetext_transient_class");
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log("PASS 8) 시그니처 2단계 분류 단위 검증 (구조화 우선 + 강한 자유텍스트 폴백)");
}

// 레드팀 H-1: job-guards.json 손상 상태에서 acknowledge 가 503 으로 응답하고 서버가 살아있는지.
async function corruptGuardStoreScenario() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-p1-corrupt-smoke-"));
  const port = 22300 + Math.floor(Math.random() * 300);
  seedUsers(tmpDir);
  const { child, logs } = bootServer(tmpDir, port);
  const request = makeClient(`http://127.0.0.1:${port}`);
  try {
    await waitForServer(request, logs);
    const auth = await login(request);
    fs.writeFileSync(path.join(tmpDir, "job-guards.json"), "{corrupt!!", "utf8");
    const broken = await request("/api/jobs/guard/acknowledge", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ job_kind: "yeri_write" }),
      expectStatus: 503,
    });
    assert(broken.error === "guard_store_unavailable", `expected_store_unavailable:${JSON.stringify(broken)}`);
    const health = await request("/api/reports/health");
    assert(health.ok === true, "server_must_survive_corrupt_guard_store");
    // 손상 파일이 있어도 잡 생성은 fail-open 으로 계속 허용되어야 한다.
    const created = await createJob(request, auth, "손상 상태 생성 허용");
    assert(created.ok === true, "expected_create_with_corrupt_store");
    console.log("PASS 9) 가드 저장소 손상 시 503 + 서버 생존 + 생성 fail-open");
  } finally {
    child.kill("SIGTERM");
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_error) {}
  }
}

// M-2: naver readiness saved_at — 전이 없는 ready 재보고는 가드 유지(무력화 방지),
// saved_at 이 마지막 실패 이후일 때만 해제.
async function naverSavedAtScenario() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-p1-naver-savedat-"));
  const port = 22650 + Math.floor(Math.random() * 300);
  seedUsers(tmpDir);
  const { child, logs } = bootServer(tmpDir, port);
  const request = makeClient(`http://127.0.0.1:${port}`);
  try {
    await waitForServer(request, logs);
    const auth = await login(request);
    // 네이버 ready 로 먼저 등록해 previousNaverStatus 를 ready 로 만든다(이후 전이 배제).
    await heartbeat(request, auth, "v99.0.0-smoke", { naver_account: { status: "ready" } });
    await failJobAs(request, auth, "savedat 1회차", LOGIN_FAILURE);
    await failJobAs(request, auth, "savedat 2회차", LOGIN_FAILURE);
    await failJobAs(request, auth, "savedat 3회차", LOGIN_FAILURE);
    await createJob(request, auth, "savedat 차단 확인", 409);
    console.log("PASS 10) 네이버 ready 상태에서 3연속 로그인 실패 후 차단");

    // (1) ready→ready 재보고 + saved_at 없음 → 가드 유지 (무력화 회귀 방지, 가장 중요)
    await heartbeat(request, auth, "v99.0.0-smoke", { naver_account: { status: "ready" } });
    await createJob(request, auth, "saved_at 없음 유지 확인", 409);
    console.log("PASS 11) ready 재보고 + saved_at 없음 → 가드 유지");

    // (3) saved_at 이 last_error_at 이전 → 유지
    await heartbeat(request, auth, "v99.0.0-smoke", { naver_account: { status: "ready", saved_at: "2020-01-01T00:00:00.000Z" } });
    await createJob(request, auth, "saved_at 과거 유지 확인", 409);
    console.log("PASS 12) saved_at 이 마지막 실패 이전 → 가드 유지");

    // (2) saved_at 이 last_error_at 이후 → 해제
    const future = new Date(Date.now() + 60 * 1000).toISOString();
    await heartbeat(request, auth, "v99.0.0-smoke", { naver_account: { status: "ready", saved_at: future } });
    const afterResave = await createJob(request, auth, "saved_at 재저장 후 생성");
    assert(afterResave.ok === true, "expected_create_after_saved_at_resave");
    console.log("PASS 13) saved_at 이 마지막 실패 이후 → 가드 해제");
  } finally {
    child.kill("SIGTERM");
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_error) {}
  }
}

// M-4: 가드 기기 단위 분리 — 기기 격리, 계정 단위 전체 차단, 레거시 행, acknowledge/성공 해제.
async function deviceScopeScenario() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-p1-devscope-"));
  const port = 22960 + Math.floor(Math.random() * 300);
  seedUsers(tmpDir);
  const { child, logs } = bootServer(tmpDir, port);
  const request = makeClient(`http://127.0.0.1:${port}`);
  try {
    await waitForServer(request, logs);
    const auth = await login(request);

    // (1) 기기 A naver 3연속 → paused. 기기 B 타겟 생성은 허용.
    await failJobOn(request, auth, "A naver 1", DEVICE_A, LOGIN_FAILURE);
    await failJobOn(request, auth, "A naver 2", DEVICE_A, LOGIN_FAILURE);
    await failJobOn(request, auth, "A naver 3", DEVICE_A, LOGIN_FAILURE);
    await createJobOn(request, auth, "A 차단 확인", DEVICE_A, 409);
    const bAllowed = await createJobOn(request, auth, "B 생성 허용", DEVICE_B);
    assert(bAllowed.ok === true, "expected_device_b_create_allowed");
    console.log("PASS 14) 기기 A naver paused → 기기 B 생성 허용");

    // (2) 타겟 없는(아무 기기나) 잡은 어떤 paused 기기든 걸려 차단.
    const noTargetBlocked = await createJobOn(request, auth, "무타겟 차단", NO_TARGET, 409);
    assert(noTargetBlocked.error === "guard_paused", `expected_no_target_blocked:${JSON.stringify(noTargetBlocked)}`);
    console.log("PASS 15) 기기 A paused → 타겟 없는 잡 차단");

    // (3) ai_key_invalid 3연속(계정 단위) → 기기 무관 전부 차단.
    await acknowledge(request, auth); // 앞의 naver 가드 리셋
    await failJobOn(request, auth, "A key 1", DEVICE_A, AIKEY_FAILURE);
    await failJobOn(request, auth, "A key 2", DEVICE_A, AIKEY_FAILURE);
    await failJobOn(request, auth, "A key 3", DEVICE_A, AIKEY_FAILURE);
    const keyBlockA = await createJobOn(request, auth, "key A 차단", DEVICE_A, 409);
    const keyBlockB = await createJobOn(request, auth, "key B 차단", DEVICE_B, 409);
    assert(keyBlockA.guard_class === "ai_key_invalid" && keyBlockB.guard_class === "ai_key_invalid",
      `expected_account_scope_block:${JSON.stringify([keyBlockA, keyBlockB])}`);
    console.log("PASS 16) ai_key_invalid 3연속 → 기기 무관 전부 차단");

    // (6) 성공(done) 시 전체 해제 회귀 — 다른 기기의 잔여 가드까지 함께 지운다.
    await acknowledge(request, auth);
    const successJob = await createJobOn(request, auth, "성공 처리", DEVICE_A);
    const successId = successJob.job.id;
    assert((await claimJobOn(request, auth, DEVICE_A)) === successId, "success_claim_mismatch");
    await request("/api/agent/jobs/update", { method: "POST", headers: auth, body: JSON.stringify({ job_id: successId, status: "running", log: "worker started" }) });
    // PASS 14 에서 만들어둔 기기 B 큐 잡을 실패시켜 다른 기기에 잔여 가드를 만든다.
    const bLeftoverId = await claimJobOn(request, auth, DEVICE_B);
    await request("/api/agent/jobs/update", { method: "POST", headers: auth, body: JSON.stringify({ job_id: bLeftoverId, status: "running", log: "worker started" }) });
    await request("/api/agent/jobs/update", { method: "POST", headers: auth, body: JSON.stringify({ job_id: bLeftoverId, status: "failed", log: LOGIN_FAILURE.log, failed_stage: LOGIN_FAILURE.stage, result: LOGIN_FAILURE.result }) });
    const beforeDone = await request("/api/jobs/guards", { headers: auth });
    assert(beforeDone.guards.some((g) => g.paused === false && g.guard_class === "naver_login_failed"), `expected_residual_guard:${JSON.stringify(beforeDone)}`);
    // 기기 A 잡 done → user+kind 전체(모든 기기) 가드 해제.
    await request("/api/agent/jobs/update", { method: "POST", headers: auth, body: JSON.stringify({ job_id: successId, status: "done", log: "완료" }) });
    const clearedAll = await request("/api/jobs/guards", { headers: auth });
    assert(clearedAll.guards.length === 0, `expected_all_cleared_on_success:${JSON.stringify(clearedAll)}`);
    console.log("PASS 17) 성공(done) 시 user+kind 전체(모든 기기) 가드 해제");
  } finally {
    child.kill("SIGTERM");
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_error) {}
  }
}

// M-4 (5): 레거시 행(device_key 없음)은 전 기기 차단 + acknowledge 로 해제.
async function legacyGuardRowScenario() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-p1-legacy-"));
  const port = 23260 + Math.floor(Math.random() * 300);
  seedUsers(tmpDir);
  const { child, logs } = bootServer(tmpDir, port);
  const request = makeClient(`http://127.0.0.1:${port}`);
  try {
    await waitForServer(request, logs);
    const auth = await login(request);
    // device_key 필드가 없는 구버전 형식 가드 행을 직접 심는다.
    writeJson(path.join(tmpDir, "job-guards.json"), {
      version: 1,
      guards: [{
        user_id: "p1-guardrails-smoke-user-id",
        job_kind: "yeri_write",
        signature: "naver_login_failed",
        consecutive_count: 3,
        paused: true,
        created_at: new Date().toISOString(),
        last_error_at: new Date().toISOString(),
      }],
    });
    const blockA = await createJobOn(request, auth, "레거시 A 차단", DEVICE_A, 409);
    const blockB = await createJobOn(request, auth, "레거시 B 차단", DEVICE_B, 409);
    assert(blockA.error === "guard_paused" && blockB.error === "guard_paused",
      `expected_legacy_block_all:${JSON.stringify([blockA, blockB])}`);
    console.log("PASS 18) 레거시 행(device_key 없음) → 전 기기 차단");
    await acknowledge(request, auth);
    const afterAck = await createJobOn(request, auth, "레거시 해제 후 생성", DEVICE_A);
    assert(afterAck.ok === true, "expected_create_after_legacy_ack");
    console.log("PASS 19) 레거시 행 acknowledge 로 해제");
  } finally {
    child.kill("SIGTERM");
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_error) {}
  }
}

// M-4 (4): runner_not_started 는 기기 단위. 기기 B 재시작은 기기 A 가드를 안 풀고, 기기 A 재시작만 푼다.
async function runnerRestartScopeScenario() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-p1-runner-scope-"));
  const port = 23560 + Math.floor(Math.random() * 300);
  seedUsers(tmpDir);
  const { child, logs } = bootServer(tmpDir, port);
  const request = makeClient(`http://127.0.0.1:${port}`);
  try {
    await waitForServer(request, logs);
    const auth = await login(request);
    // 기기 A 에서 runner_not_started 5연속(임계 5) → paused. 기기 A 하트비트는 아직 안 보낸다
    // (첫 하트비트가 곧 '재시작' 트리거가 되게 하기 위해).
    for (let i = 1; i <= 5; i += 1) {
      await failJobOn(request, auth, `A runner ${i}`, DEVICE_A, RUNNER_FAILURE);
    }
    await createJobOn(request, auth, "A runner 차단", DEVICE_A, 409);
    console.log("PASS 20) 기기 A runner 5연속 → 차단");

    // 기기 B 첫 하트비트(=기기 B 재시작) → 기기 B 스코프만 해제. 기기 A 가드는 유지.
    await heartbeatOn(request, auth, "v99.0.0-smoke", DEVICE_B);
    await createJobOn(request, auth, "B 재시작 후 A 유지", DEVICE_A, 409);
    console.log("PASS 21) 기기 B 재시작 → 기기 A runner 가드 유지");

    // 기기 A 첫 하트비트(=기기 A 재시작) → 기기 A 스코프 해제.
    await heartbeatOn(request, auth, "v99.0.0-smoke", DEVICE_A);
    const afterRestart = await createJobOn(request, auth, "A 재시작 후 생성", DEVICE_A);
    assert(afterRestart.ok === true, "expected_create_after_device_a_restart");
    console.log("PASS 22) 기기 A 재시작 → 기기 A runner 가드 해제");
  } finally {
    child.kill("SIGTERM");
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_error) {}
  }
}

try {
  await mainScenario();
  await versionGateScenario();
  await signatureUnitScenario();
  await corruptGuardStoreScenario();
  await naverSavedAtScenario();
  await deviceScopeScenario();
  await legacyGuardRowScenario();
  await runnerRestartScopeScenario();
  console.log("P1_GUARDRAILS_SMOKE_OK");
} catch (error) {
  console.error("P1_GUARDRAILS_SMOKE_FAILED");
  console.error(error);
  process.exitCode = 1;
}
