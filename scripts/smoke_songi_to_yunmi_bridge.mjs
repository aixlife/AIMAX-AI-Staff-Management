import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-songi-yunmi-"));
const port = 19188 + Math.floor(Math.random() * 1000);
const token = "songi-yunmi-smoke-token";
const userId = "demo-user";
const projectId = "project-cut";
const itemId = "item-cut";
const now = new Date().toISOString();

function writeJson(name, value) {
  fs.writeFileSync(path.join(dataDir, name), JSON.stringify(value, null, 2), "utf8");
}

writeJson("users.json", {
  version: 1,
  users: [{
    id: userId,
    email: "demo@aimax.ai.kr",
    name: "AIMAX Demo",
    status: "active",
    must_change_password: false,
    entitlements: {
      status: "active",
      product: "bundle",
      products: ["bundle"],
    },
    created_at: now,
    updated_at: now,
  }],
});
writeJson("sessions.json", {
  version: 1,
  sessions: [{
    id: "session-smoke",
    user_id: userId,
    token_hash: crypto.createHash("sha256").update(token).digest("hex"),
    created_at: now,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    last_seen_at: now,
  }],
});
writeJson("jobs.json", { version: 1, jobs: [] });
writeJson("research.json", {
  version: 1,
  projects: [{
    id: projectId,
    user_id: userId,
    name: "테스트",
    goal: "벤치마킹 기반 콘텐츠 기획: 새로운 느낌",
    industry: "AI",
    content_category: "AI",
    content_topic: "새로운 느낌",
    created_at: now,
    updated_at: now,
  }],
  items: [{
    id: itemId,
    user_id: userId,
    project_id: projectId,
    title: "comment \"cut\" for access",
    url: "https://www.instagram.com/reels/DX7nLsxNqXS/",
    platform: "Instagram",
    category: "AI",
    content_category: "AI",
    content_topic: "새로운 느낌",
    summary: "댓글에 cut을 달면 접근 권한을 주는 CTA로 댓글 참여를 유도한 사례입니다.",
    source_text: "캡션/본문:\ncomment \"cut\" for access\n\n조회 8,708 · 좋아요 563 · 댓글 1,615",
    hooks: ["댓글에 특정 단어를 쓰게 만드는 단순 CTA"],
    flow: [
      { timestamp: "0:00-0:02", description: "문제 상황을 짧게 보여준다." },
      { timestamp: "0:02-0:05", description: "해결 도구 접근을 댓글 키워드로 연결한다." },
    ],
    benchmarking: ["정보 접근을 댓글 행동과 연결한다."],
    copywriting_points: ["comment \"cut\" for access처럼 짧고 명확한 행동 문장을 쓴다."],
    performance_reasons: {
      comments: "댓글 키워드가 접근 조건이라 댓글 수가 크게 늘어납니다.",
    },
    hook_note: "첫 문장에서 얻을 수 있는 결과를 바로 제시합니다.",
    copy_note: "댓글 키워드는 짧고 기억하기 쉬운 단어로 둡니다.",
    structure_note: "문제 제기 -> 접근 권한 제안 -> 댓글 CTA.",
    script_brief: "주제: AI 활용한 직원만들기\nCTA: 댓글에 '직원' 남겨주세요.",
    link_fetch_status: "apify_scraped",
    ai_analysis: { status: "completed" },
    created_at: now,
    updated_at: now,
  }],
});

const child = spawn(process.execPath, ["oracle/aimax-reports-api/server.js"], {
  cwd: repoRoot,
  env: {
    ...process.env,
    AIMAX_REPORT_HOST: "127.0.0.1",
    AIMAX_REPORT_PORT: String(port),
    AIMAX_REPORT_DATA_DIR: dataDir,
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

async function waitForServer() {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/version?platform=macos&current=v1.0.0`);
      if (response.ok) return;
    } catch (_error) {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`server did not start: ${output}`);
}

try {
  await waitForServer();
  const response = await fetch(`http://127.0.0.1:${port}/api/research/items/${encodeURIComponent(itemId)}/yunmi-script`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-aimax-session-token": token,
    },
    body: JSON.stringify({}),
  });
  const body = await response.json();
  if (!response.ok || !body.ok) {
    throw new Error(`bridge failed ${response.status}: ${JSON.stringify(body)}`);
  }
  if (body.job?.kind !== "yunmi_script" || body.job?.status !== "done") {
    throw new Error(`unexpected job: ${JSON.stringify(body.job)}`);
  }
  const jobs = JSON.parse(fs.readFileSync(path.join(dataDir, "jobs.json"), "utf8")).jobs || [];
  const job = jobs.find((entry) => entry.id === body.job.id);
  if (!job) throw new Error("created job not persisted");
  const referenceText = String(job.payload?.reference_text || "");
  if (!referenceText.includes("comment \"cut\" for access")) {
    throw new Error("songi source was not passed to yunmi reference_text");
  }
  if (job.payload?.mode !== "no_paid_alpha") {
    throw new Error(`expected no_paid_alpha, got ${job.payload?.mode}`);
  }
  if (job.payload?.topic !== "AI 활용한 직원만들기") {
    throw new Error(`expected script brief topic, got ${job.payload?.topic}`);
  }
  if (job.result?.cost?.total_won !== 0) {
    throw new Error("expected no-paid yunmi result");
  }
  console.log(JSON.stringify({
    ok: true,
    job_id: body.job.id,
    status: body.job.status,
    stage: body.job.result?.stage,
    paid_total_won: body.job.result?.cost?.total_won,
  }));
} finally {
  child.kill("SIGTERM");
  fs.rmSync(dataDir, { recursive: true, force: true });
}
