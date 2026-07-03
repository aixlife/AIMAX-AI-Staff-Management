#!/usr/bin/env node
// 예리 키워드 분리 스모크: 콤마/줄바꿈 키워드를 넣으면 키워드마다 1편씩 잡이 분리 생성되는지,
// 예약 스태거·가드 차단·키워드 캡(10개)·단일 키워드 무회귀를 검증한다.
// 유료 생성 회피: server_generation 미요청 + 웹 AI 키 없음 → 잡은 queued 로만 생성된다(러너 경로).

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const email = "yeri-kwsplit-smoke@example.test";
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
      id: "yeri-kwsplit-smoke-user-id",
      email,
      name: "Yeri KW Split Smoke",
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

// 유료 생성 회피: seo_research_enabled=false (SEO 조사 네트워크 호출 차단),
// server_generation 미요청 + 웹 AI 키 없음 → yeriGenerationMode="" → queued 로만 생성.
function yeriPayload(extra = {}) {
  return {
    ai_model: "mock-no-paid",
    seo_research_enabled: false,
    word_count: 1500,
    image_count: 0,
    ...extra,
  };
}

async function createYeriJob(request, auth, payload, expectStatus) {
  return request("/api/jobs", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      kind: "yeri_write",
      target_platform: "windows",
      target_device_label: "Smoke Windows",
      payload,
    }),
    ...(expectStatus ? { expectStatus } : {}),
  });
}

function readJobsFile(tmpDir) {
  const raw = fs.readFileSync(path.join(tmpDir, "jobs.json"), "utf8");
  return JSON.parse(raw).jobs || [];
}

// 시나리오 1: 3개 키워드 → 3개 잡, 각 payload.keywords 길이 1·순서 일치, response.jobs 3개, response.job.id === jobs[0].id.
// 시나리오 2: 단일 키워드 → 정확히 1개 잡, 무회귀(job 존재, jobs/split_count 없음).
// 시나리오 3: 예약 모드 스태거 — date 2026-07-10, hour 22, interval 3, 3키워드 → 22 / (익일)1 / 4.
// 시나리오 5: 콤마 12개 문자열 → 10개 잡(yeriPayloadKeywords 캡).
async function creationScenario() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-yeri-kwsplit-"));
  const port = 24100 + Math.floor(Math.random() * 400);
  seedUsers(tmpDir);
  const { child, logs } = bootServer(tmpDir, port);
  const request = makeClient(`http://127.0.0.1:${port}`);
  try {
    await waitForServer(request, logs);
    const auth = await login(request);

    // 1) 3개 키워드 배열 → 3개 잡
    const kws = ["강남 피부관리", "리프팅 후기", "보톡스 가격"];
    const created = await createYeriJob(request, auth, yeriPayload({ keywords: kws }));
    assert(created.ok === true, "expected_ok_true");
    assert(created.split_count === 3, `expected_split_count_3:${JSON.stringify(created.split_count)}`);
    assert(Array.isArray(created.jobs) && created.jobs.length === 3, `expected_jobs_len_3:${JSON.stringify(created.jobs?.length)}`);
    assert(created.job && created.job.id === created.jobs[0].id, "expected_job_equals_first_split");
    const stored = readJobsFile(tmpDir);
    assert(stored.length === 3, `expected_3_jobs_persisted:${stored.length}`);
    for (let i = 0; i < 3; i += 1) {
      const jobRow = stored.find((row) => row.id === created.jobs[i].id);
      assert(jobRow, `stored_job_missing_${i}`);
      assert(Array.isArray(jobRow.payload.keywords) && jobRow.payload.keywords.length === 1,
        `expected_single_keyword_${i}:${JSON.stringify(jobRow.payload.keywords)}`);
      assert(jobRow.payload.keywords[0] === kws[i], `keyword_order_mismatch_${i}:${jobRow.payload.keywords[0]}`);
      assert(jobRow.status === "queued", `expected_queued_${i}:${jobRow.status}`);
      const splitLog = (jobRow.logs || []).some((entry) => String(entry.message || "").includes(`키워드 ${i + 1}/3`));
      assert(splitLog, `expected_split_log_${i}:${JSON.stringify(jobRow.logs)}`);
    }
    console.log("PASS 1) 3개 키워드 → 3개 잡 (각 payload.keywords 길이 1·순서 일치, response.job=jobs[0])");

    // 새 tmpDir 없이 이어서 진행하되 잡 파일을 비운다(시나리오 격리).
    fs.writeFileSync(path.join(tmpDir, "jobs.json"), JSON.stringify({ version: 1, jobs: [] }), "utf8");

    // 2) 단일 키워드 → 무회귀
    const single = await createYeriJob(request, auth, yeriPayload({ keywords: ["단일 키워드"] }));
    assert(single.ok === true && single.job, "expected_single_job");
    assert(single.jobs === undefined, `single_must_not_have_jobs:${JSON.stringify(single.jobs)}`);
    assert(single.split_count === undefined, `single_must_not_have_split_count:${JSON.stringify(single.split_count)}`);
    const afterSingle = readJobsFile(tmpDir);
    assert(afterSingle.length === 1, `expected_1_job_single:${afterSingle.length}`);
    assert(afterSingle[0].payload.keywords[0] === "단일 키워드", "single_keyword_mismatch");
    console.log("PASS 2) 단일 키워드 → 정확히 1개 잡 (jobs/split_count 없음, 무회귀)");

    fs.writeFileSync(path.join(tmpDir, "jobs.json"), JSON.stringify({ version: 1, jobs: [] }), "utf8");

    // 3) 예약 스태거
    const sched = await createYeriJob(request, auth, yeriPayload({
      keywords: ["예약 A", "예약 B", "예약 C"],
      mode: "schedule",
      schedule_date: "2026-07-10",
      schedule_hour: "22",
      schedule_interval: "3",
    }));
    assert(sched.split_count === 3, "expected_schedule_split_3");
    const schedRows = sched.jobs.map((pub) => readJobsFile(tmpDir).find((row) => row.id === pub.id));
    const expected = [
      { date: "2026-07-10", hour: "22" },
      { date: "2026-07-11", hour: "1" },
      { date: "2026-07-11", hour: "4" },
    ];
    for (let i = 0; i < 3; i += 1) {
      assert(schedRows[i].payload.schedule_date === expected[i].date,
        `schedule_date_${i}_mismatch:${schedRows[i].payload.schedule_date}`);
      assert(String(schedRows[i].payload.schedule_hour) === expected[i].hour,
        `schedule_hour_${i}_mismatch:${schedRows[i].payload.schedule_hour}`);
    }
    console.log("PASS 3) 예약 스태거 — 22 / (익일)1 / 4 (날짜 롤오버 정확)");

    fs.writeFileSync(path.join(tmpDir, "jobs.json"), JSON.stringify({ version: 1, jobs: [] }), "utf8");

    // 5) 콤마 12개 문자열 → 10개 잡(캡)
    const twelve = Array.from({ length: 12 }, (_v, i) => `키워드${i + 1}`).join(", ");
    const capped = await createYeriJob(request, auth, yeriPayload({ keywords: twelve }));
    assert(capped.split_count === 10, `expected_cap_10:${JSON.stringify(capped.split_count)}`);
    assert(capped.jobs.length === 10, `expected_jobs_10:${capped.jobs.length}`);
    const cappedRows = readJobsFile(tmpDir);
    assert(cappedRows.length === 10, `expected_10_persisted:${cappedRows.length}`);
    console.log("PASS 5) 콤마 12개 문자열 → 10개 잡 (yeriPayloadKeywords 캡)");
  } finally {
    child.kill("SIGTERM");
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_error) {}
  }
}

// 시나리오 4: yeri_write paused 가드 → 409 + 잡 0개 생성(가드는 분리 전에 검사).
async function pausedGuardScenario() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-yeri-kwsplit-guard-"));
  const port = 24600 + Math.floor(Math.random() * 300);
  seedUsers(tmpDir);
  // device_key 없는 레거시 paused 가드 → 전 기기 차단.
  writeJson(path.join(tmpDir, "job-guards.json"), {
    version: 1,
    guards: [{
      user_id: "yeri-kwsplit-smoke-user-id",
      job_kind: "yeri_write",
      signature: "naver_login_failed",
      consecutive_count: 3,
      paused: true,
      created_at: new Date().toISOString(),
      last_error_at: new Date().toISOString(),
    }],
  });
  const { child, logs } = bootServer(tmpDir, port);
  const request = makeClient(`http://127.0.0.1:${port}`);
  try {
    await waitForServer(request, logs);
    const auth = await login(request);
    const blocked = await createYeriJob(request, auth, yeriPayload({ keywords: ["A", "B", "C"] }), 409);
    assert(blocked.error === "guard_paused", `expected_guard_paused:${JSON.stringify(blocked)}`);
    // 잡 파일이 없거나 0개여야 한다(가드가 분리 루프 이전에 차단).
    const jobsPath = path.join(tmpDir, "jobs.json");
    const jobCount = fs.existsSync(jobsPath) ? (JSON.parse(fs.readFileSync(jobsPath, "utf8")).jobs || []).length : 0;
    assert(jobCount === 0, `expected_zero_jobs_on_guard:${jobCount}`);
    console.log("PASS 4) paused 가드 → 409 + 잡 0개 (분리 전에 차단)");
  } finally {
    child.kill("SIGTERM");
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_error) {}
  }
}

try {
  await creationScenario();
  await pausedGuardScenario();
  console.log("YERI_KEYWORD_SPLIT_SMOKE_OK");
} catch (error) {
  console.error("YERI_KEYWORD_SPLIT_SMOKE_FAILED");
  console.error(error);
  process.exitCode = 1;
}
