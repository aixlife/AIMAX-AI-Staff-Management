#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.AIMAX_REPORT_DATA_DIR || "/home/ubuntu/aimax-reports/data";
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const INDEX_PATH = path.join(DATA_DIR, "reports-index.jsonl");
const AUTOMATION_TICKETS_PATH = path.join(DATA_DIR, "automation-tickets.jsonl");
const DRY_RUN = process.env.DRY_RUN === "1" || process.argv.includes("--dry-run");

const STATUS_LABELS = {
  waiting_user: "사용자 확인 필요",
  working: "작업 중",
  done: "완료",
};

const UPDATES = {
  "AIMAX-RPT-20260605162910-96577656": {
    status: "waiting_user",
    category: "api_key_missing",
    public_message: "확인 결과, 해당 작업은 글 생성 뒤 네이버 입력 단계에서 AI API 키가 로컬 실행기에서 제공되지 않아 실패했습니다. 앱이 멈춘 것이 아니라 웹 보안 저장소와 로컬 생성 경로의 키 전달 차이로 생긴 케이스입니다.",
    next_update_message: "설정 > AI/API 연결에서 사용하려는 제공자 키를 저장한 뒤 웹앱을 새로고침하고, 키워드 1개와 임시저장으로 새 작업 1건만 다시 시도해주세요. 이번 코드 패치는 같은 유형의 보고를 API 키 문제로 더 정확히 분류합니다.",
  },
  "AIMAX-RPT-20260609123649-e6225d90": {
    status: "waiting_user",
    category: "api_key_missing",
    public_message: "연결된 작업 로그를 확인한 결과, 진행 중으로 보였던 작업은 이후 AI API 키 미제공 오류로 실패했습니다. 작업 큐 자체보다 선택한 AI 모델/API 키 설정 확인이 필요한 상태입니다.",
    next_update_message: "설정 > AI/API 연결에서 Gemini/OpenAI/Claude 중 사용할 모델의 키를 저장하고, 웹앱을 새로고침한 뒤 키워드 1개와 임시저장으로만 먼저 확인해주세요.",
  },
  "AIMAX-RPT-20260609125934-30627195": {
    status: "waiting_user",
    category: "api_key_missing",
    public_message: "작업 도중 꺼진 것으로 보였지만, 실제 실패 원인은 네이버 입력 단계에서 AI API 키가 제공되지 않은 오류였습니다.",
    next_update_message: "설정 > AI/API 연결에서 사용할 AI 제공자 키를 저장한 뒤 새 작업 1건만 다시 시도해주세요. 같은 증상이 반복되면 이 접수 ID로 다시 알려주세요.",
  },
  "AIMAX-RPT-20260609125938-64447847": {
    status: "waiting_user",
    category: "api_key_missing",
    public_message: "같은 시간대 중복 보고와 동일하게, 실제 실패 원인은 네이버 입력 단계에서 AI API 키가 제공되지 않은 오류로 확인됐습니다.",
    next_update_message: "설정 > AI/API 연결에서 사용할 AI 제공자 키를 저장한 뒤 새 작업 1건만 다시 시도해주세요. 중복 제출은 하지 않아도 됩니다.",
  },
  "AIMAX-RPT-20260609125939-92557a00": {
    status: "waiting_user",
    category: "api_key_missing",
    public_message: "같은 시간대 중복 보고와 동일하게, 실제 실패 원인은 네이버 입력 단계에서 AI API 키가 제공되지 않은 오류로 확인됐습니다.",
    next_update_message: "설정 > AI/API 연결에서 사용할 AI 제공자 키를 저장한 뒤 새 작업 1건만 다시 시도해주세요. 중복 제출은 하지 않아도 됩니다.",
  },
  "AIMAX-RPT-20260611014232-30442ceb": {
    status: "done",
    category: "staff_feedback_reviewed",
    public_message: "예리 글 첫머리에 AIMAX 예리로만 시작되는 점과 업체명/대표명 반영 요청을 확인했습니다. 오류가 아니라 글쓰기 품질 개선 피드백으로 분류했습니다.",
    next_update_message: "향후 예리 입력 폼에 업체명/대표명 맥락을 더 명확히 넣는 개선 후보로 반영하겠습니다. 당장 필요한 글은 키워드나 요청사항에 업체명/대표명을 함께 적어주세요.",
  },
  "AIMAX-RPT-20260612083939-1edbf13b": {
    status: "waiting_user",
    category: "runner_update_required",
    public_message: "보고 당시 실행기 v1.0.48의 최근 작업에는 구버전/모델 설정 오류와 네이버 로그인 실패가 섞여 있었습니다. 최신 실행기와 AI/API 연결 상태 기준으로 재확인이 필요합니다.",
    next_update_message: "업데이트 탭에서 최신 실행기를 설치하고 웹앱을 새로고침한 뒤, AI/API 연결과 네이버 로그인을 확인하고 키워드 1개 임시저장으로만 다시 테스트해주세요.",
  },
  "AIMAX-RPT-20260619065043-1e81ebe1": {
    status: "waiting_user",
    category: "provider_transient_with_patch_ready",
    public_message: "Gemini 고급 모델 요청이 AI 제공자 일시 오류로 반복 실패한 것을 확인했습니다. 코드 패치로 Gemini 3.5/고급 모델이 일시 장애나 모델 접근 오류를 내면 기본 Gemini 2.5 Flash로 한 번 안전 폴백하도록 준비했습니다.",
    next_update_message: "운영 배포 전까지는 모델을 Gemini 2.5 Flash 또는 정상 동작 확인된 GPT/Claude로 바꿔 1건만 다시 시도해주세요. 패치는 배포 승인 후 반영됩니다.",
  },
};

function utcNow() {
  return new Date().toISOString();
}

function readRows() {
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

function appendTicketStatusUpdate(ticketId, reportId, status, updatedAt) {
  if (!ticketId || DRY_RUN) return null;
  const ticket = {
    ticket_id: ticketId,
    source: "triage_20260619_watchdog_reports",
    status,
    report_id: reportId,
    updated_at: updatedAt,
  };
  fs.appendFileSync(AUTOMATION_TICKETS_PATH, `${JSON.stringify(ticket)}\n`, "utf8");
  return ticket;
}

function main() {
  const updatedAt = utcNow();
  const suffix = `.bak-${updatedAt.replace(/[-:TZ.]/g, "").slice(0, 14)}-watchdog-triage`;
  const rows = readRows();
  const backups = [];
  const touched = [];

  backup(INDEX_PATH, suffix, backups);
  for (const row of rows) {
    const update = UPDATES[row.report_id];
    if (!update) continue;
    const previousStatus = row.status || "";
    const statusLabel = STATUS_LABELS[update.status] || update.status;
    Object.assign(row, {
      status: update.status,
      status_label: statusLabel,
      status_updated_at: updatedAt,
      public_message: update.public_message,
      next_update_message: update.next_update_message,
      auto_guidance_category: update.category,
    });
    const filePath = reportPath(row);
    let ticketId = row.automation_ticket_id || "";
    backup(filePath, suffix, backups);
    if (!DRY_RUN && filePath && fs.existsSync(filePath)) {
      const report = JSON.parse(fs.readFileSync(filePath, "utf8"));
      ticketId = report.support?.automation_ticket_id || ticketId;
      report.support = {
        ...(report.support || {}),
        status: update.status,
        status_label: statusLabel,
        public_message: update.public_message,
        next_update_message: update.next_update_message,
        updated_at: updatedAt,
        auto_guidance_category: update.category,
        auto_guidance_source: "triage_20260619_watchdog_reports",
      };
      const tmpPath = `${filePath}.tmp-${process.pid}`;
      fs.writeFileSync(tmpPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      fs.renameSync(tmpPath, filePath);
      appendTicketStatusUpdate(ticketId, row.report_id, update.status, updatedAt);
    }
    touched.push({
      report_id: row.report_id,
      category: update.category,
      previous_status: previousStatus,
      next_status: update.status,
    });
  }

  if (!DRY_RUN && touched.length) writeRows(rows);
  console.log(JSON.stringify({ ok: true, dry_run: DRY_RUN, updated_at: updatedAt, touched_count: touched.length, touched, backups }, null, 2));
}

main();
