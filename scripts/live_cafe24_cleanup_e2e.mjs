import fs from "node:fs";

const envPath = process.env.AIMAX_ENV_PATH || "/home/ubuntu/aimax-reports-api/.env";
const inputPath = process.argv[2] || "/tmp/aimax-cafe24-e2e.json";

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
    throw error;
  }
  return { body, response };
}

const env = loadEnv(envPath);
const prepared = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const port = env.AIMAX_REPORT_PORT || "18988";
const baseUrl = `http://127.0.0.1:${port}`;
const adminPassword = env.AIMAX_ADMIN_PASSWORD || env.AIMAX_ADMIN_TOKEN;

if (!adminPassword) throw new Error("missing_admin_password");
if (!prepared.email || !prepared.order_id) throw new Error("missing_cleanup_target");

const login = await postJson(`${baseUrl}/api/admin/login`, { password: adminPassword });
const cookie = login.response.headers.get("set-cookie");
if (!cookie) throw new Error("admin_cookie_missing");

const updateOrder = await postJson(
  `${baseUrl}/api/admin/cafe24-orders/update`,
  {
    order_id: prepared.order_id,
    status: "ignored",
    product: prepared.product || "yeri",
    admin_note: "Codex live Cafe24 onboarding E2E cleanup",
  },
  { cookie },
);

let deleteUser = null;
try {
  deleteUser = await postJson(
    `${baseUrl}/api/admin/users/delete`,
    {
      email: prepared.email,
    },
    { cookie },
  );
} catch (error) {
  if (error.body?.error !== "user_not_found") throw error;
}

console.log(JSON.stringify({
  ok: true,
  email: prepared.email,
  order_id: prepared.order_id,
  order_status: updateOrder.body.order?.status || "",
  user_deleted: Boolean(deleteUser?.body?.deleted_email),
  revoked_sessions: deleteUser?.body?.revoked_sessions || 0,
  revoked_setup_tokens: deleteUser?.body?.revoked_setup_tokens || 0,
}, null, 2));
