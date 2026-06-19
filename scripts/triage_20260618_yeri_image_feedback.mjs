#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.AIMAX_REPORT_DATA_DIR || "/home/ubuntu/aimax-reports/data";
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const INDEX_PATH = path.join(DATA_DIR, "reports-index.jsonl");
const AUTOMATION_TICKETS_PATH = path.join(DATA_DIR, "automation-tickets.jsonl");
const DRY_RUN = process.env.DRY_RUN === "1" || process.argv.includes("--dry-run");
const REPORT_ID = "AIMAX-RPT-20260618073506-ef878983";

const UPDATE = {
  status: "waiting_user",
  status_label: "사용자 확인 필요",
  public_message:
    "확인 결과, 최근 예리 이미지 문제는 이미지 생성 3장 중 2장만 삽입되고 1장은 Gemini 이미지 모델의 유료/권한 제한(image_paid_required)으로 빠진 건입니다. 직전 작업들에는 Claude quota 초과와 Gemini 일시 오류도 함께 기록되어 있어 앱/실행기 단독 오류가 아니라 선택 모델/제공자 한도 상태가 섞인 케이스로 분류했습니다.",
  next_update_message:
    "설정 > AI/API 연결에서 이미지 생성 가능한 유료 Gemini/OpenAI 키와 선택 모델 권한을 확인한 뒤, 이미지 1장짜리 새 작업 1건만 테스트해주세요. 같은 문제가 계속되면 같은 화면에서 다시 알려주세요. 운영팀은 예리 이미지 실패를 별도 watchdog 대상으로 계속 추적합니다.",
};

function utcNow() {
  return new Date().toISOString();
}

function readRows() {
  if (!fs.existsSync(INDEX_PATH)) throw new Error(`missing report index: ${INDEX_PATH}`);
  return fs.readFileSync(INDEX_PATH, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function writeRows(rows) {
  const tmpPath = `${INDEX_PATH}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  fs.renameSync(tmpPath, INDEX_PATH);
}

function appendTicketStatusUpdate(ticketId, reportId, status, updatedAt) {
  if (!ticketId || DRY_RUN) return null;
  const row = {
    ticket_id: String(ticketId),
    source: "triage_20260618_yeri_image_feedback",
    status,
    report_id: reportId,
    updated_at: updatedAt,
  };
  fs.appendFileSync(AUTOMATION_TICKETS_PATH, `${JSON.stringify(row)}\n`, "utf8");
  return row;
}

function reportPath(row) {
  const date = String(row.date || row.stored_at || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  return path.join(REPORTS_DIR, date, `${row.report_id}.json`);
}

function backup(filePath, suffix, backups) {
  if (!filePath || !fs.existsSync(filePath) || DRY_RUN) return;
  const backupPath = `${filePath}${suffix}`;
  fs.copyFileSync(filePath, backupPath);
  backups.push(backupPath);
}

function countsByStatus(rows) {
  const counts = {};
  for (const row of rows) counts[row.status || ""] = (counts[row.status || ""] || 0) + 1;
  return counts;
}

function main() {
  const updatedAt = utcNow();
  const suffix = `.bak-${updatedAt.replace(/[-:TZ.]/g, "").slice(0, 14)}-yeri-image-feedback-triage`;
  const rows = readRows();
  const beforeCounts = countsByStatus(rows);
  const backups = [];
  let touched = null;

  backup(INDEX_PATH, suffix, backups);
  for (const row of rows) {
    if (row.report_id !== REPORT_ID) continue;
    const previousStatus = row.status || "";
    Object.assign(row, UPDATE, { status_updated_at: updatedAt });
    const filePath = reportPath(row);
    const ticketId = row.automation_ticket_id || "";
    backup(filePath, suffix, backups);
    if (!DRY_RUN && filePath && fs.existsSync(filePath)) {
      const report = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const reportTicketId = report.support?.automation_ticket_id || ticketId;
      report.support = {
        ...(report.support || {}),
        ...UPDATE,
        updated_at: updatedAt,
      };
      const tmpPath = `${filePath}.tmp-${process.pid}`;
      fs.writeFileSync(tmpPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      fs.renameSync(tmpPath, filePath);
      appendTicketStatusUpdate(reportTicketId, REPORT_ID, UPDATE.status, updatedAt);
    }
    touched = {
      report_id: REPORT_ID,
      previous_status: previousStatus,
      next_status: row.status,
    };
  }

  if (!touched) throw new Error(`target report not found: ${REPORT_ID}`);
  if (!DRY_RUN) writeRows(rows);
  console.log(JSON.stringify({
    ok: true,
    dry_run: DRY_RUN,
    updated_at: updatedAt,
    before_counts: beforeCounts,
    after_counts: countsByStatus(rows),
    touched,
    backups,
  }, null, 2));
}

main();
