import fs from "node:fs";
import path from "node:path";

const envPath = process.env.AIMAX_ENV_PATH || "/home/ubuntu/aimax-reports-api/.env";
const dataDirDefault = "/home/ubuntu/aimax-reports/data";

function loadEnv(filePath) {
  const env = {};
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

async function postJson(url, payload, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) {
    const error = new Error(body.error || `http_${response.status}`);
    error.body = body;
    error.status = response.status;
    throw error;
  }
  return { body, response };
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function waitFor(predicate, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await predicate();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("timeout");
}

const env = loadEnv(envPath);
const port = env.AIMAX_REPORT_PORT || "18988";
const baseUrl = `http://127.0.0.1:${port}`;
const publicBaseUrl = (env.AIMAX_PUBLIC_BASE_URL || "https://api.aimax.ai.kr").replace(/\/+$/, "");
const cafe24Secret = env.AIMAX_CAFE24_WEBHOOK_SECRET;
const adminPassword = env.AIMAX_ADMIN_PASSWORD || env.AIMAX_ADMIN_TOKEN;
const dataDir = env.AIMAX_REPORT_DATA_DIR || dataDirDefault;
const runId = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const email = `e2e-cafe24-${runId}@aimax.ai.kr`;

if (!cafe24Secret) throw new Error("missing_cafe24_secret");
if (!adminPassword) throw new Error("missing_admin_password");

const webhook = await postJson(
  `${baseUrl}/api/integrations/cafe24/orders`,
  {
    source: "codex_live_e2e",
    order: {
      id: `codex-live-e2e-${runId}`,
      email,
      name: "Codex E2E",
      product_name: "블로그마케터 예리씨",
      amount: "33000",
      order_date: new Date().toISOString(),
    },
  },
  { "x-aimax-cafe24-secret": cafe24Secret },
);

const orderId = webhook.body.order?.id;
if (!orderId) throw new Error("order_id_missing");

const sentOrder = await waitFor(() => {
  const orders = readJson(path.join(dataDir, "cafe24-orders.json"), { orders: [] }).orders || [];
  const order = orders.find((item) => item.id === orderId);
  return order?.status === "sent" ? order : null;
});

const users = readJson(path.join(dataDir, "users.json"), { users: [] }).users || [];
const user = users.find((item) => item.email === email);
if (!user) throw new Error("user_missing_after_order");
const mailEvent = [...(user.email_events || [])].reverse().find((event) => String(event.type || "").startsWith("cafe24_onboarding_guide"));
if (!mailEvent?.provider_message_id && mailEvent?.provider !== "apps_script") {
  throw new Error("mail_event_missing_provider_message_id");
}

const login = await postJson(`${baseUrl}/api/admin/login`, { password: adminPassword });
const cookie = login.response.headers.get("set-cookie");
if (!cookie) throw new Error("admin_cookie_missing");

const setupLink = await postJson(
  `${baseUrl}/api/admin/users/setup-links`,
  {
    emails: [email],
    source: "codex_live_cafe24_customer_flow_e2e",
  },
  { cookie },
);

const setup = setupLink.body.users?.[0];
if (!setup?.setup_url) throw new Error("setup_url_missing");

console.log(JSON.stringify({
  run_id: runId,
  public_base_url: publicBaseUrl,
  email,
  order_id: orderId,
  external_id: sentOrder.external_id || "",
  user_id: user.id,
  product: user.entitlements?.product || "",
  product_label: setup.product_label || "",
  order_status: sentOrder.status,
  order_sent_at: sentOrder.sent_at,
  auto_process_stage: sentOrder.auto_process_stage || "",
  mail_provider: mailEvent?.provider || "",
  mail_provider_message_id: mailEvent?.provider_message_id || "",
  setup_url: setup.setup_url,
  setup_expires_at: setup.expires_at,
}, null, 2));
