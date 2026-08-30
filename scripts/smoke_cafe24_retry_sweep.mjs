// 카페24 자동 처리 실패 건 자동 재시도 스윕 스모크 (2026-08-30)
// (a) failed 건이 스윕으로 재시도되어 성공하는지
// (b) 최대 횟수 소진 시 정지 + "수동 확인 필요" 알림 정확히 1회인지 (중간 실패 알림 억제 포함)
// (c) needs_review·sent 건이 재시도 대상이 아닌지
// (d) 메일 발송 이력(rememberUserEmailEvent)이 있으면 이중 발송 없이 정지하는지
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-cafe24-retry-sweep-"));
const appPort = 19112;
const receivedMail = [];
const mailAttempts = [];
const telegramMessages = [];
const plannedMailFailures = new Map([
  ["buyer-a@example.com", 1],
  ["buyer-b@example.com", 999],
]);

const mailServer = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    mailAttempts.push(body);
    const remainingFailures = plannedMailFailures.get(body.to) || 0;
    if (remainingFailures > 0) {
      plannedMailFailures.set(body.to, remainingFailures - 1);
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "mail_send_failed" }));
      return;
    }
    receivedMail.push(body);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, id: `mail-${receivedMail.length}` }));
  });
});

const telegramServer = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    telegramMessages.push(body);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, result: { message_id: telegramMessages.length } }));
  });
});

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server.address().port);
    });
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await predicate();
    if (result) return result;
    await wait(100);
  }
  throw new Error("timeout");
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function orders() {
  return readJson(path.join(tmpRoot, "cafe24-orders.json"), { orders: [] }).orders || [];
}

function mailsTo(email) {
  return mailAttempts.filter((item) => item.to === email);
}

const mailPort = await listen(mailServer);
const telegramPort = await listen(telegramServer);

// (d) 픽스처: 메일 발송 이력이 이미 있는 사용자 + failed 주문 사전 주입
const nowIso = new Date().toISOString();
const hourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
fs.writeFileSync(path.join(tmpRoot, "users.json"), JSON.stringify({
  version: 1,
  users: [{
    id: "user-guard-d",
    email: "buyer-d@example.com",
    name: "가드 사용자",
    status: "active",
    must_change_password: false,
    password_hash: "fixture",
    created_at: hourAgoIso,
    updated_at: nowIso,
    entitlements: { product: "yeri", status: "active" },
    email_events: [{
      type: "cafe24_onboarding_guide_auto",
      provider: "webhook",
      provider_message_id: "fixture-mail-1",
      to: "buyer-d@example.com",
      subject: "[AIMAX] 안내",
      sent_at: nowIso,
    }],
  }],
}, null, 2));
fs.writeFileSync(path.join(tmpRoot, "cafe24-orders.json"), JSON.stringify({
  version: 1,
  orders: [{
    id: "order-guard-d",
    external_id: "guard-d-ext",
    email: "buyer-d@example.com",
    name: "가드 사용자",
    product: "yeri",
    products: ["yeri"],
    product_name: "블로그마케터 예리씨",
    amount: 33000,
    status: "failed",
    issue: "",
    created_at: hourAgoIso,
    received_at: hourAgoIso,
    updated_at: nowIso,
    auto_process_started_at: hourAgoIso,
    auto_process_stage: "failed",
    auto_process_error_stage: "mail_sending",
    auto_process_error: "mail_send_failed",
    auto_process_error_at: nowIso,
  }],
}, null, 2));

const env = {
  ...process.env,
  AIMAX_REPORT_DATA_DIR: tmpRoot,
  AIMAX_REPORT_PORT: String(appPort),
  AIMAX_ADMIN_PASSWORD: "admin",
  AIMAX_CAFE24_WEBHOOK_SECRET: "smoke-secret",
  AIMAX_MAIL_WEBHOOK_URL: `http://127.0.0.1:${mailPort}/send`,
  AIMAX_MAIL_WEBHOOK_SECRET: "mail-secret",
  AIMAX_CAFE24_AUTO_SEND_ENABLED: "1",
  AIMAX_CAFE24_REVIEW_ALERTS_ENABLED: "0",
  AIMAX_TELEGRAM_ALERTS_ENABLED: "1",
  AIMAX_TELEGRAM_BOT_TOKEN: "smoke-token",
  AIMAX_TELEGRAM_CHAT_ID: "1",
  AIMAX_TELEGRAM_API_BASE: `http://127.0.0.1:${telegramPort}`,
  AIMAX_CAFE24_AUTO_PROCESS_LOCK_MS: "300",
  AIMAX_CAFE24_RETRY_SWEEP_MS: "700",
  AIMAX_CAFE24_RETRY_SWEEP_INITIAL_DELAY_MS: "300",
  AIMAX_CAFE24_RETRY_MAX_ATTEMPTS: "3",
  AIMAX_CAFE24_RETRY_SINCE: "2020-01-01T00:00:00Z",
  AIMAX_ONBOARDING_REMINDER: "0",
};

const child = childProcess.spawn(process.execPath, ["oracle/aimax-reports-api/server.js"], {
  cwd: process.cwd(),
  env,
  stdio: ["ignore", "pipe", "pipe"],
});

let childOutput = "";
child.stdout.on("data", (data) => { childOutput += data.toString(); });
child.stderr.on("data", (data) => { childOutput += data.toString(); });

try {
  await waitFor(() => childOutput.includes(`http://127.0.0.1:${appPort}`));
  assert.match(childOutput, /\[cafe24 retry\] armed/);

  async function postOrder(email, name) {
    const response = await fetch(`http://127.0.0.1:${appPort}/api/integrations/cafe24/orders`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-aimax-cafe24-secret": "smoke-secret" },
      body: JSON.stringify({
        order: { email, name, product_name: "블로그마케터 예리씨", amount: "33,000", order_date: "2026-08-30" },
      }),
    });
    assert.equal(response.status, 201);
    return (await response.json()).order;
  }

  // (a) 일시 실패 건: 최초 자동 처리 실패 → 스윕 재시도로 성공
  const orderA = await postOrder("buyer-a@example.com", "일시 실패 구매자");
  // (b) 영구 실패 건: 3회 소진까지
  const orderB = await postOrder("buyer-b@example.com", "영구 실패 구매자");
  // (c) needs_review 건: 스윕 미대상
  const reviewResponse = await fetch(`http://127.0.0.1:${appPort}/api/integrations/cafe24/orders`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-aimax-cafe24-secret": "smoke-secret" },
    body: JSON.stringify({
      order: { email: "buyer-c@example.com", name: "리뷰 구매자", product_name: "확인 필요한 상품명", amount: "33,000", order_date: "2026-08-30" },
    }),
  });
  assert.equal(reviewResponse.status, 201);
  const orderC = (await reviewResponse.json()).order;
  assert.equal(orderC.status, "needs_review");

  // 최초 실패 확인 (A, B)
  await waitFor(() => {
    const a = orders().find((item) => item.id === orderA.id);
    const b = orders().find((item) => item.id === orderB.id);
    return a?.status === "failed" && b?.status === "failed" ? true : null;
  });

  // (a) 스윕 재시도로 A 성공
  const sentA = await waitFor(() => {
    const found = orders().find((item) => item.id === orderA.id);
    return found?.status === "sent" ? found : null;
  });
  assert.equal(sentA.retry_count, 1);
  assert.ok(sentA.last_retry_at);
  assert.equal(sentA.auto_process_error || "", "");
  assert.equal(mailsTo("buyer-a@example.com").length, 2, "A: 최초 1회 + 재시도 1회");
  assert.equal(receivedMail.filter((item) => item.to === "buyer-a@example.com").length, 1, "A: 실제 수신 1통");
  assert.match(receivedMail.find((item) => item.to === "buyer-a@example.com").text, /\/setup\?token=/);
  const usersAfterA = readJson(path.join(tmpRoot, "users.json"), { users: [] }).users || [];
  const userA = usersAfterA.find((item) => item.email === "buyer-a@example.com");
  assert.ok(userA?.email_events?.some((event) => event.type === "cafe24_onboarding_guide_auto_retry"));

  // (b) B는 3회 소진 후 정지
  const stoppedB = await waitFor(() => {
    const found = orders().find((item) => item.id === orderB.id);
    return found?.auto_retry_stopped_reason === "exhausted" ? found : null;
  });
  assert.equal(stoppedB.status, "failed");
  assert.equal(stoppedB.retry_count, 3);
  assert.equal(mailsTo("buyer-b@example.com").length, 4, "B: 최초 1회 + 재시도 3회");

  // (d) 가드 픽스처: 이중 발송 없이 정지
  const stoppedD = await waitFor(() => {
    const found = orders().find((item) => item.id === "order-guard-d");
    return found?.auto_retry_stopped_reason === "guide_already_sent" ? found : null;
  });
  assert.equal(stoppedD.status, "failed");
  assert.equal(mailsTo("buyer-d@example.com").length, 0, "D: 메일 발송 0건 (이중 발송 가드)");
  assert.equal(stoppedD.retry_count || 0, 0, "D: 재시도 시도 자체가 없어야 함");

  // 소진 알림이 텔레그램에 실제 도달할 때까지 대기
  await waitFor(() => telegramMessages.some((item) => String(item.text || "").startsWith("[AIMAX 카페24 자동 재시도 소진]")) ? true : null);
  await waitFor(() => telegramMessages.some((item) => String(item.text || "").startsWith("[AIMAX 카페24 자동 재시도 중단]")) ? true : null);

  // 추가 스윕 2주기 이상 관찰: 더 이상 시도·알림이 없어야 함
  const mailCountBefore = mailAttempts.length;
  const telegramCountBefore = telegramMessages.length;
  await wait(2000);
  assert.equal(mailAttempts.length, mailCountBefore, "소진/정지 후 추가 메일 시도 없음");
  assert.equal(telegramMessages.length, telegramCountBefore, "소진/정지 후 추가 알림 없음");
  const finalB = orders().find((item) => item.id === orderB.id);
  assert.equal(finalB.retry_count, 3);

  // (c) needs_review·sent 건 미대상 재확인
  const finalC = orders().find((item) => item.id === orderC.id);
  assert.equal(finalC.status, "needs_review");
  assert.equal(finalC.retry_count === undefined, true, "C: 재시도 기록 없음");
  assert.equal(mailsTo("buyer-c@example.com").length, 0);
  const finalA = orders().find((item) => item.id === orderA.id);
  assert.equal(finalA.retry_count, 1, "A: sent 이후 추가 재시도 없음");

  // 알림 수량 검증: 최초 실패 2회(A,B) + 소진 1회(B) + 중단 1회(D), 중간 재시도 실패 알림 0
  const plainFailureAlerts = telegramMessages.filter((item) => String(item.text || "").startsWith("[AIMAX 카페24 자동 처리 실패]"));
  const exhaustedAlerts = telegramMessages.filter((item) => String(item.text || "").startsWith("[AIMAX 카페24 자동 재시도 소진]"));
  const blockedAlerts = telegramMessages.filter((item) => String(item.text || "").startsWith("[AIMAX 카페24 자동 재시도 중단]"));
  assert.equal(plainFailureAlerts.length, 2, "최초 실패 알림은 A·B 각 1회뿐 (중간 재시도 알림 억제)");
  assert.equal(exhaustedAlerts.length, 1, "소진 알림 정확히 1회");
  assert.equal(blockedAlerts.length, 1, "이중 발송 가드 알림 정확히 1회");
  assert.match(exhaustedAlerts[0].text, /수동 확인 필요/);
  assert.match(exhaustedAlerts[0].text, /buyer-b@example.com/);
  assert.match(blockedAlerts[0].text, /buyer-d@example.com/);

  console.log("smoke_cafe24_retry_sweep: PASS");
} catch (error) {
  console.error("smoke_cafe24_retry_sweep: FAIL");
  console.error(error);
  console.error("--- server output tail ---");
  console.error(childOutput.slice(-4000));
  process.exitCode = 1;
} finally {
  child.kill("SIGTERM");
  mailServer.close();
  telegramServer.close();
}
