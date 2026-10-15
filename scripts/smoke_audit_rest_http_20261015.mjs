#!/usr/bin/env node
// 2026-10-15 전수조사 잔여 — 실제 서버를 띄워 HTTP 로 확인한다(유료 호출 없음, 글 생성은 mock).
//  #8 부팅 때 57일 묵은 ready_for_publish 가 실패로 바뀌고 작업 목록에서 안내가 보인다
//  #5 키워드 3개 묶음은 첫 편이 끝난 뒤에 나머지가 생성된다
//  #5 가짜 Gemini 키 저장은 200 + 경고(verification.invalid) — 실제 구글 무료 조회 1회(네트워크 없으면 건너뜀 표시)
import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const email = "audit-rest-http@example.test";
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
      id: "audit-rest-user",
      email,
      name: "Audit Rest Smoke",
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
    body: JSON.stringify({ email, password, device_label: "Smoke Windows" }),
  });
  return { authorization: `Bearer ${result.session_token}` };
}


const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-audit-rest-http-"));
seedUsers(tmpDir);
const old = new Date(Date.now() - 57 * 24 * 3600 * 1000).toISOString();
writeJson(path.join(tmpDir, "jobs.json"), { version: 1, jobs: [{
  id: "stale-ready", user_id: "audit-rest-user", kind: "yeri_write", worker_code: "yeri", status: "ready_for_publish",
  target_platform: "macos", payload: { keywords: ["오래된 글"] }, logs: [], created_at: old, updated_at: old,
}] });
const port = 18700 + Math.floor(Math.random() * 200);
const { child, logs } = bootServer(tmpDir, port, {
  AIMAX_YERI_SERVER_GENERATION_MOCK: "1",
  AIMAX_YERI_SERVER_GENERATION_MOCK_DELAY_MS: "1200",
  AIMAX_YERI_READY_FOR_PUBLISH_CLAIM_ENABLED: "1",
});
const request = makeClient(`http://127.0.0.1:${port}`);
try {
  await waitForServer(request, logs);
  const auth = await login(request);

  // #8
  let list = await request("/api/jobs", { headers: auth });
  const stale = list.jobs.find((job) => job.id === "stale-ready");
  assert(stale && stale.status === "failed", `57일 묵은 작업이 실패로 바뀌어야 함: ${stale?.status}`);
  assert(stale.diagnostic?.code === "runner_not_available", `진단: ${JSON.stringify(stale.diagnostic)}`);
  console.log("#8 http ok —", stale.diagnostic.title);

  // #5 묶음
  const created = await request("/api/jobs", {
    method: "POST", headers: auth,
    body: JSON.stringify({ kind: "yeri_write", server_generation: true, target_platform: "windows", target_device_label: "Smoke Windows",
      payload: { keywords: ["첫째 글", "둘째 글", "셋째 글"], mode: "save", image_count: 0, word_count: 300 } }),
  });
  assert(created.split_count === 3, "3편으로 분리");
  await sleep(500);
  list = await request("/api/jobs", { headers: auth });
  const batch = () => list.jobs.filter((job) => created.jobs.some((item) => item.id === job.id));
  assert(batch().every((job) => job.status === "generating"), "처음엔 셋 다 생성 대기");
  let headReadyAt = 0;
  for (let i = 0; i < 40; i += 1) {
    await sleep(250);
    list = await request("/api/jobs", { headers: auth });
    const states = batch().map((job) => job.status);
    const head = batch().find((job) => job.id === created.jobs[0].id);
    if (!headReadyAt && head.status === "ready_for_publish") {
      headReadyAt = Date.now();
      const followers = batch().filter((job) => job.id !== head.id);
      assert(followers.every((job) => job.status === "generating"), `첫 편 완료 순간 나머지는 아직 대기: ${states}`);
    }
    if (states.every((s) => s === "ready_for_publish")) break;
  }
  assert(headReadyAt, "첫 편 완료");
  assert(batch().every((job) => job.status === "ready_for_publish"), "나머지도 이어서 완료");
  console.log("#5 batch http ok");

  // #5 키 저장 경고
  const saved = await request("/api/user/secrets/gemini", { method: "PUT", headers: auth, body: JSON.stringify({ value: "AIzaSyFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE0" }) });
  if (saved.verification?.reason === "network_unreachable") {
    console.log("#5 key check SKIPPED (network)");
  } else {
    assert(saved.ok && saved.verification?.invalid === true, `가짜 키 경고: ${JSON.stringify(saved.verification)}`);
    assert(saved.secret?.web_configured === true, "저장은 됨");
    console.log("#5 key check http ok —", saved.verification.message.slice(0, 40));
  }
  console.log("AUDIT_REST_HTTP_SMOKE_OK");
} finally {
  child.kill();
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
