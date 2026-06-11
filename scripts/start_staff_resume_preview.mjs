#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.AIMAX_PREVIEW_DATA_DIR || path.join(os.tmpdir(), "aimax-staff-resume-preview");
const port = Number(process.env.AIMAX_PREVIEW_PORT || 3027);
const email = process.env.AIMAX_PREVIEW_EMAIL || "preview@aimax.ai.kr";
const password = process.env.AIMAX_PREVIEW_PASSWORD || "Preview123!";

function hashPassword(value, salt = crypto.randomBytes(16)) {
  const params = { N: 16384, r: 8, p: 1, keylen: 64 };
  const derived = crypto.scryptSync(String(value), salt, params.keylen, params);
  return `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

writeJson(path.join(dataDir, "users.json"), {
  version: 1,
  users: [{
    id: "staff-resume-preview-user",
    email,
    name: "AIMAX Preview",
    status: "active",
    must_change_password: false,
    password_hash: hashPassword(password),
    entitlements: {
      product: "bundle",
      products: ["bundle", "blog_team", "songi", "yunmi", "sangsu", "jieun", "nakyung", "eunseo"],
      status: "active",
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }],
});

process.env.AIMAX_REPORT_HOST = process.env.AIMAX_REPORT_HOST || "127.0.0.1";
process.env.AIMAX_REPORT_PORT = String(port);
process.env.AIMAX_REPORT_DATA_DIR = dataDir;
process.env.AIMAX_RESEARCH_DATA_DIR = path.join(dataDir, "research");
process.env.AIMAX_DOWNLOAD_DIR = path.join(dataDir, "downloads");
process.env.AIMAX_USER_SECRET_ENCRYPTION_KEY = process.env.AIMAX_USER_SECRET_ENCRYPTION_KEY
  || `base64:${crypto.randomBytes(32).toString("base64")}`;
process.env.AIMAX_TELEGRAM_ALERTS_ENABLED = "0";
process.env.AIMAX_TELEGRAM_BOT_TOKEN = "";
process.env.AIMAX_TELEGRAM_CHAT_ID = "";
process.env.GEMINI_API_KEY = "";
process.env.AIMAX_GEMINI_API_KEY = "";
process.env.AIMAX_APIFY_API_TOKEN = "";

const { __storageTest } = require(path.join(repoRoot, "oracle", "aimax-reports-api", "server.js"));
const server = __storageTest.startServer();

server.on("listening", () => {
  console.log(`AIMAX staff preview: http://127.0.0.1:${port}/app`);
  console.log(`Login: ${email} / ${password}`);
});

server.on("error", (error) => {
  console.error(`AIMAX staff preview failed: ${error.code || error.message}`);
  process.exitCode = 1;
});
