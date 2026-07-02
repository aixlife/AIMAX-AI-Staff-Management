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
    assert(switched.guards[0].guard_class === "billing_quota" && switched.guards[0].consecutive_count === 1,
      `expected_billing_count_1:${JSON.stringify(switched)}`);
    console.log("PASS 4) 시그니처 전환 시 카운트 1로 리셋");

    // 5) 하트비트 naver_account ready 전이 → naver_login_failed 가드 자동 해제
    //    (다시 로그인 실패 3연속으로 pause 만든 뒤 검증. 직전 결제 1회 상태에서 로그인 실패가 오면 1로 리셋되므로 3회 필요)
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

try {
  await mainScenario();
  await versionGateScenario();
  await signatureUnitScenario();
  await corruptGuardStoreScenario();
  console.log("P1_GUARDRAILS_SMOKE_OK");
} catch (error) {
  console.error("P1_GUARDRAILS_SMOKE_FAILED");
  console.error(error);
  process.exitCode = 1;
}
