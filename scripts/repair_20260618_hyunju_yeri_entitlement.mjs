#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.AIMAX_REPORT_DATA_DIR || "/home/ubuntu/aimax-reports/data";
const USERS_PATH = path.join(DATA_DIR, "users.json");
const INDEX_PATH = path.join(DATA_DIR, "reports-index.jsonl");
const TICKETS_PATH = path.join(DATA_DIR, "automation-tickets.jsonl");
const REPORT_ID = "AIMAX-RPT-20260617090512-bece755b";
const TICKET_ID = "AIMAX-AUTO-20260617090512-991e7bd5";
const EMAIL = "kkj70584@gmail.com";
const DRY_RUN = process.env.DRY_RUN === "1" || process.argv.includes("--dry-run");

function nowIso() {
  return new Date().toISOString();
}

function backup(filePath, suffix, backups) {
  if (!fs.existsSync(filePath) || DRY_RUN) return;
  const backupPath = `${filePath}${suffix}`;
  fs.copyFileSync(filePath, backupPath);
  backups.push(backupPath);
}

function writeJson(filePath, data) {
  const tmpPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  fs.renameSync(tmpPath, filePath);
}

function readRows(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function writeRows(filePath, rows) {
  const tmpPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  fs.renameSync(tmpPath, filePath);
}

function orderedProducts(products) {
  const order = ["yeri", "hyunju", "songi", "yunmi", "jieun", "nakyung", "hyojin", "sangsu", "eunseo", "blog_team", "bundle"];
  return order.filter((item) => products.has(item));
}

function reportPath(row) {
  const date = String(row.date || row.stored_at || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  return path.join(DATA_DIR, "reports", date, `${row.report_id}.json`);
}

function main() {
  const updatedAt = nowIso();
  const suffix = `.bak-${updatedAt.replace(/[-:TZ.]/g, "").slice(0, 14)}-hyunju-yeri-entitlement-repair`;
  const backups = [];

  const users = JSON.parse(fs.readFileSync(USERS_PATH, "utf8"));
  const user = users.users.find((item) => item.email === EMAIL);
  if (!user) throw new Error(`user not found: ${EMAIL}`);
  const beforeEntitlements = JSON.parse(JSON.stringify(user.entitlements || {}));
  const products = new Set(Array.isArray(user.entitlements?.products) ? user.entitlements.products : []);
  products.add("yeri");
  products.add("hyunju");
  user.entitlements = {
    ...(user.entitlements || {}),
    product: user.entitlements?.product || "hyunju",
    products: orderedProducts(products),
    status: "active",
    updated_at: updatedAt,
    repair_source: "20260618_hyunju_yeri_entitlement_repair",
    expires_at: user.entitlements?.expires_at || null,
  };
  user.updated_at = updatedAt;
  backup(USERS_PATH, suffix, backups);
  if (!DRY_RUN) writeJson(USERS_PATH, users);

  const rows = readRows(INDEX_PATH);
  let reportUpdated = false;
  const statusUpdate = {
    status: "done",
    status_label: "완료",
    status_updated_at: updatedAt,
    public_message:
      "계정 권한을 확인해 예리와 현주가 함께 보이도록 복구했습니다. 원인은 기존 예리 권한이 있는 계정에 현주를 추가하는 과정에서 권한 목록이 덮어쓰기 된 케이스였습니다.",
    next_update_message:
      "웹앱을 새로고침한 뒤 예리와 현주가 모두 보이는지 확인해주세요. 이후 신규 권한 부여는 기존 상품을 보존하도록 서버도 수정했습니다.",
  };
  backup(INDEX_PATH, suffix, backups);
  for (const row of rows) {
    if (row.report_id !== REPORT_ID) continue;
    Object.assign(row, statusUpdate);
    const fp = reportPath(row);
    backup(fp, suffix, backups);
    if (!DRY_RUN && fp && fs.existsSync(fp)) {
      const report = JSON.parse(fs.readFileSync(fp, "utf8"));
      report.support = {
        ...(report.support || {}),
        status: statusUpdate.status,
        status_label: statusUpdate.status_label,
        public_message: statusUpdate.public_message,
        next_update_message: statusUpdate.next_update_message,
        updated_at: updatedAt,
        automation_ticket_id: TICKET_ID,
      };
      writeJson(fp, report);
    }
    reportUpdated = true;
  }
  if (!DRY_RUN) writeRows(INDEX_PATH, rows);

  const ticketClose = {
    ticket_id: TICKET_ID,
    source: "admin_report",
    status: "closed",
    priority: "normal",
    category: "general_error",
    report_id: REPORT_ID,
    report_kind: "error",
    created_at: updatedAt,
    updated_at: updatedAt,
    account_email: "k***@gmail.com",
    product: "hyunju",
    app_version: "",
    os: "Windows",
    visible_error: "예리 권한이 현주 권한 부여 후 사라짐",
    work_context: "권한 병합 복구 완료",
    suggested_next_action: "완료 처리됨. 재발 시 권한 부여 병합 로직 확인",
    admin_url: "https://api.aimax.ai.kr/admin#reports",
  };
  backup(TICKETS_PATH, suffix, backups);
  if (!DRY_RUN) fs.appendFileSync(TICKETS_PATH, `${JSON.stringify(ticketClose)}\n`, "utf8");

  console.log(JSON.stringify({
    ok: true,
    dry_run: DRY_RUN,
    updated_at: updatedAt,
    user_email: EMAIL.replace(/^(.).+(@.+)$/, "$1***$2"),
    before_entitlements: beforeEntitlements,
    after_entitlements: user.entitlements,
    report_updated: reportUpdated,
    ticket_closed: true,
    backups,
  }, null, 2));
}

main();
