#!/usr/bin/env node

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-local-secret-import-smoke-"));
const port = 19300 + Math.floor(Math.random() * 600);
const baseUrl = `http://127.0.0.1:${port}`;
const email = "local-import-smoke@example.test";
const password = "SmokePassword123!";
const geminiSecret = "smoke-local-gemini-key-1234567890";
const apifySecret = "smoke-local-apify-token-1234567890";

function hashPassword(value, salt = crypto.randomBytes(16)) {
  const params = { N: 16384, r: 8, p: 1, keylen: 64 };
  const derived = crypto.scryptSync(String(value), salt, params.keylen, params);
  return `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

writeJson(path.join(tmpDir, "users.json"), {
  version: 1,
  users: [{
    id: "local-import-smoke-user-id",
    email,
    name: "Local Import Smoke User",
    status: "active",
    must_change_password: false,
    password_hash: hashPassword(password),
    entitlements: {
      product: "bundle",
      products: ["bundle", "songi"],
      status: "active",
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }],
});

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
    AIMAX_KEYCHAIN_ACCOUNT: "smoke-no-keychain-account",
    AIMAX_KEYRING_SERVICE: "smoke-no-keyring-service",
    AIMAX_LEGACY_KEYRING_SERVICE: "smoke-no-legacy-keyring",
    APIFY_API_TOKEN: "",
    AIMAX_APIFY_API_TOKEN: "",
    GEMINI_API_KEY: "",
    AIMAX_GEMINI_API_KEY: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";
child.stdout.on("data", (chunk) => {
  stdout += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  let body = {};
  try {
    body = await response.json();
  } catch (_error) {}
  if (!response.ok) {
    const error = new Error(`${options.method || "GET"} ${pathname} -> ${response.status} ${JSON.stringify(body)}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 8000) {
    try {
      const health = await request("/api/reports/health");
      if (health.ok) return;
    } catch (_error) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error(`server did not start\nstdout=${stdout}\nstderr=${stderr}`);
}

try {
  await waitForServer();
  const login = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const auth = { authorization: `Bearer ${login.session_token}` };

  await request("/api/agent/heartbeat", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      status: "connected",
      version: "v9.9.9-win",
      platform: "Windows 11 AMD64",
      device_label: "Smoke Windows",
      readiness: {},
    }),
  });
  await request("/api/agent/heartbeat", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      status: "connected",
      version: "v9.9.9-mac",
      platform: "Darwin 25.5.0 arm64",
      device_label: "Smoke Mac",
      readiness: {},
    }),
  });
  const macStatus = await request("/api/agent/status?platform=macos", { headers: auth });
  const winStatus = await request("/api/agent/status?platform=windows", { headers: auth });
  if (macStatus.agent.version !== "v9.9.9-mac" || winStatus.agent.version !== "v9.9.9-win") {
    throw new Error(`platform agent status mixed: mac=${macStatus.agent.version} win=${winStatus.agent.version}`);
  }

  let unsupportedRejected = false;
  try {
    await request("/api/agent/commands", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ type: "export_everything" }),
    });
  } catch (error) {
    unsupportedRejected = error.status === 400 && error.body?.error === "unsupported_command";
  }
  if (!unsupportedRejected) {
    throw new Error("unsupported agent command was not rejected");
  }

  const created = await request("/api/agent/commands", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      type: "import_local_provider_secrets",
      payload: { providers: ["gemini", "apify", "naver", "gemini"] },
    }),
  });
  if (created.command.type !== "import_local_provider_secrets" || created.command.result !== null) {
    throw new Error("local secret import command was not created with the expected public shape");
  }

  const targeted = await request("/api/agent/commands", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      type: "open_settings",
      platform: "macos",
    }),
  });
  const noPlatformNext = await request("/api/agent/next-command", { headers: auth });
  if (noPlatformNext.command?.id === targeted.command.id) {
    throw new Error("platform-targeted command was delivered to an untagged agent poll");
  }
  const command = noPlatformNext.command || {};
  if (command.id !== created.command.id) throw new Error("next-command did not deliver the un-targeted import command first");
  const macNext = await request("/api/agent/next-command?platform=macos", { headers: auth });
  if (macNext.command?.id !== targeted.command.id) {
    throw new Error("platform-targeted command was not delivered to matching macOS agent poll");
  }
  await request("/api/agent/commands/update", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      command_id: targeted.command.id,
      status: "done",
      log: "open_settings target smoke done",
    }),
  });

  if (JSON.stringify(command.payload.providers) !== JSON.stringify(["gemini", "apify"])) {
    throw new Error(`providers were not normalized: ${JSON.stringify(command.payload.providers)}`);
  }

  await request("/api/user/secrets/gemini", {
    method: "PUT",
    headers: auth,
    body: JSON.stringify({ value: geminiSecret }),
  });
  await request("/api/user/secrets/apify", {
    method: "PUT",
    headers: auth,
    body: JSON.stringify({ value: apifySecret }),
  });
  await request("/api/agent/commands/update", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      command_id: command.id,
      status: "done",
      log: "AI/API 키 가져오기 완료: 2개 저장, 0개 없음, 0개 실패",
      result: {
        type: "local_provider_secret_import",
        providers: {
          gemini: { status: "imported" },
          apify: { status: "imported" },
        },
        imported_count: 2,
        missing_count: 0,
        failed_count: 0,
        requested_count: 2,
      },
    }),
  });

  const completed = await request(`/api/agent/commands/${encodeURIComponent(command.id)}`, { headers: auth });
  if (completed.command.status !== "done" || completed.command.result?.imported_count !== 2) {
    throw new Error("completed import command did not expose sanitized result counts");
  }
  const commandJson = JSON.stringify(completed.command);
  if (commandJson.includes(geminiSecret) || commandJson.includes(apifySecret)) {
    throw new Error("raw provider secret leaked into command response");
  }

  const secrets = await request("/api/user/secrets", { headers: auth });
  if (!secrets.secrets.providers.gemini.web_configured || !secrets.secrets.providers.apify.web_configured) {
    throw new Error("imported provider secrets were not visible as web_configured");
  }

  const appResponse = await fetch(`${baseUrl}/app`);
  const appHtml = await appResponse.text();
  for (const marker of [
    "importLocalSecretsBtn",
    "webSecretNoticeImportBtn",
    "import_local_provider_secrets",
    "네이버 비밀번호와 브라우저 세션은 옮기지 않습니다",
  ]) {
    if (!appHtml.includes(marker)) {
      throw new Error(`app HTML missing local import marker: ${marker}`);
    }
  }

  const commandsFile = fs.existsSync(path.join(tmpDir, "agent-commands.json"))
    ? fs.readFileSync(path.join(tmpDir, "agent-commands.json"), "utf8")
    : "";
  const secretsFile = fs.existsSync(path.join(tmpDir, "user-secrets.json"))
    ? fs.readFileSync(path.join(tmpDir, "user-secrets.json"), "utf8")
    : "";
  const persisted = `${commandsFile}\n${secretsFile}`;
  if (persisted.includes(geminiSecret) || persisted.includes(apifySecret)) {
    throw new Error("raw provider secret leaked into persisted command/secret files");
  }
  if (`${stdout}\n${stderr}`.includes(geminiSecret) || `${stdout}\n${stderr}`.includes(apifySecret)) {
    throw new Error("raw provider secret leaked into server output");
  }

  console.log("LOCAL_SECRET_IMPORT_SMOKE_OK");
} finally {
  child.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 100));
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
