import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-cafe24-auto-send-"));
const appPort = 19091;
let mailPort = 0;
const receivedMail = [];
const mailAttempts = [];
const plannedMailFailures = new Map([["mail-fail@example.com", 1]]);

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

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, timeoutMs = 8000) {
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

await listen(mailServer, 0);
mailPort = mailServer.address().port;

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

  const response = await fetch(`http://127.0.0.1:${appPort}/api/integrations/cafe24/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-aimax-cafe24-secret": "smoke-secret",
    },
    body: JSON.stringify({
      order: {
        email: "auto-buyer@example.com",
        name: "자동 구매자",
        product_name: "블로그마케터 예리씨",
        amount: "33,000",
        order_date: "2026-05-27",
      },
    }),
  });
  assert.equal(response.status, 201);
  const data = await response.json();
  assert.equal(data.order.status, "pending");
  assert.equal(data.order.product, "yeri");
  assert.equal(data.review_alert_queued, false);
  assert.equal(data.auto_process_queued, true);

  const order = await waitFor(() => {
    const orders = readJson(path.join(tmpRoot, "cafe24-orders.json"), { orders: [] }).orders || [];
    const found = orders.find((item) => item.id === data.order.id);
    return found?.status === "sent" ? found : null;
  });

  assert.equal(order.issue, "");
  assert.equal(order.product, "yeri");
  assert.ok(order.processed_at);
  assert.ok(order.sent_at);
  assert.equal(order.auto_process_error || "", "");

  assert.equal(receivedMail.length, 1);
  assert.equal(receivedMail[0].to, "auto-buyer@example.com");
  assert.match(receivedMail[0].text, /\/setup\?token=/);
  assert.match(receivedMail[0].text, /비밀번호를 설정/);
  assert.doesNotMatch(receivedMail[0].text, /임시 비밀번호/);

  const users = readJson(path.join(tmpRoot, "users.json"), { users: [] }).users || [];
  const user = users.find((item) => item.email === "auto-buyer@example.com");
  assert.ok(user);
  assert.equal(user.entitlements.product, "yeri");
  assert.ok(user.email_events?.some((event) => event.type === "cafe24_onboarding_guide_auto"));

  const setupTokens = readJson(path.join(tmpRoot, "setup-tokens.json"), { tokens: [] }).tokens || [];
  assert.equal(setupTokens.filter((token) => token.email === "auto-buyer@example.com" && !token.used_at).length, 1);

  const reviewResponse = await fetch(`http://127.0.0.1:${appPort}/api/integrations/cafe24/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-aimax-cafe24-secret": "smoke-secret",
    },
    body: JSON.stringify({
      order: {
        email: "corrected-buyer@example.com",
        name: "정정 구매자",
        product_name: "확인 필요한 상품명",
        amount: "33,000",
        order_date: "2026-05-27",
      },
    }),
  });
  assert.equal(reviewResponse.status, 201);
  const reviewData = await reviewResponse.json();
  assert.equal(reviewData.order.status, "needs_review");
  assert.ok(["unknown_product", "ambiguous_product"].includes(reviewData.order.issue));
  assert.equal(reviewData.auto_process_queued, false);

  const loginResponse = await fetch(`http://127.0.0.1:${appPort}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "admin" }),
  });
  assert.equal(loginResponse.status, 200);
  const cookie = loginResponse.headers.get("set-cookie");
  assert.ok(cookie);

  const updateResponse = await fetch(`http://127.0.0.1:${appPort}/api/admin/cafe24-orders/update`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify({
      order_id: reviewData.order.id,
      product: "yeri",
      status: "pending",
    }),
  });
  assert.equal(updateResponse.status, 200);
  const updateData = await updateResponse.json();
  assert.equal(updateData.auto_process_queued, true);

  const correctedOrder = await waitFor(() => {
    const orders = readJson(path.join(tmpRoot, "cafe24-orders.json"), { orders: [] }).orders || [];
    const found = orders.find((item) => item.id === reviewData.order.id);
    return found?.status === "sent" ? found : null;
  });
  assert.equal(correctedOrder.issue, "");
  assert.equal(correctedOrder.product, "yeri");
  assert.equal(receivedMail.length, 2);
  assert.equal(receivedMail[1].to, "corrected-buyer@example.com");
  assert.match(receivedMail[1].text, /\/setup\?token=/);

  const failResponse = await fetch(`http://127.0.0.1:${appPort}/api/integrations/cafe24/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-aimax-cafe24-secret": "smoke-secret",
    },
    body: JSON.stringify({
      order: {
        email: "mail-fail@example.com",
        name: "메일 실패 구매자",
        product_name: "블로그마케터 예리씨",
        amount: "33,000",
        order_date: "2026-05-27",
      },
    }),
  });
  assert.equal(failResponse.status, 201);
  const failData = await failResponse.json();
  assert.equal(failData.auto_process_queued, true);

  const failedOrder = await waitFor(() => {
    const orders = readJson(path.join(tmpRoot, "cafe24-orders.json"), { orders: [] }).orders || [];
    const found = orders.find((item) => item.id === failData.order.id);
    return found?.status === "failed" ? found : null;
  });
  assert.equal(failedOrder.auto_process_stage, "failed");
  assert.equal(failedOrder.auto_process_error_stage, "mail_sending");
  assert.equal(failedOrder.auto_process_error, "mail_send_failed");
  assert.equal(receivedMail.length, 2);
  assert.equal(mailAttempts.filter((item) => item.to === "mail-fail@example.com").length, 1);

  const retryResponse = await fetch(`http://127.0.0.1:${appPort}/api/admin/cafe24-orders/retry`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify({
      order_ids: [failedOrder.id],
      mode: "retry",
    }),
  });
  assert.equal(retryResponse.status, 200);
  const retryData = await retryResponse.json();
  assert.equal(retryData.count, 1);
  assert.equal(retryData.error_count, 0);
  assert.equal(receivedMail.length, 3);
  assert.equal(receivedMail[2].to, "mail-fail@example.com");

  const retryOrder = await waitFor(() => {
    const orders = readJson(path.join(tmpRoot, "cafe24-orders.json"), { orders: [] }).orders || [];
    const found = orders.find((item) => item.id === failedOrder.id);
    return found?.status === "sent" ? found : null;
  });
  assert.equal(retryOrder.auto_process_stage, "sent");
  assert.equal(retryOrder.auto_process_error || "", "");

  const resendResponse = await fetch(`http://127.0.0.1:${appPort}/api/admin/cafe24-orders/retry`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify({
      order_ids: [order.id],
      mode: "resend",
      resend_guide: true,
    }),
  });
  assert.equal(resendResponse.status, 200);
  const resendData = await resendResponse.json();
  assert.equal(resendData.count, 1);
  assert.equal(resendData.error_count, 0);
  assert.equal(receivedMail.length, 4);
  assert.equal(receivedMail[3].to, "auto-buyer@example.com");
  assert.match(receivedMail[3].text, /\/setup\?token=/);

  const setupTokensAfterResend = readJson(path.join(tmpRoot, "setup-tokens.json"), { tokens: [] }).tokens || [];
  assert.equal(setupTokensAfterResend.filter((token) => token.email === "auto-buyer@example.com" && !token.used_at).length, 1);

  console.log("smoke_cafe24_auto_send: PASS");
} finally {
  child.kill("SIGTERM");
  mailServer.close();
}
