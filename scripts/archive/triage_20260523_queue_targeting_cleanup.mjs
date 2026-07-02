#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.AIMAX_REPORT_DATA_DIR || "/home/ubuntu/aimax-reports/data";
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const INDEX_PATH = path.join(DATA_DIR, "reports-index.jsonl");
const JOBS_PATH = path.join(DATA_DIR, "jobs.json");
const DRY_RUN = ["1", "true", "yes"].includes(String(process.env.DRY_RUN || "").toLowerCase());
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const backupSuffix = `.bak-${stamp}-queue-targeting-cleanup`;

const reportChanges = {
  "AIMAX-RPT-20260522185718-6fe2df2a": {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message: "예리 작업이 진행 중으로 멈춘 뒤 실패한 문제는 같은 계정의 Mac/Windows 실행기가 작업을 잘못 가져갈 수 있었던 서버 작업 큐 라우팅 문제로 확인했습니다. 2026-05-23 16:46 KST 운영 서버에 핫픽스를 반영했고, 새 작업부터는 현재 연결된 실행기 대상으로만 전달됩니다.",
    next_update_message: "웹앱을 새로고침한 뒤 Windows 실행기가 연결되어 있는지 확인하고, 키워드 1개와 임시저장으로 다시 시도해주세요. 같은 문제가 반복되면 이 화면에서 '아직 안 돼요'를 눌러주세요.",
  },
  "AIMAX-RPT-20260523053651-fafcc06d": {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message: "로컬 설정 열기 요청은 실행기에 전달됐지만 완료 응답이 늦은 상태로 확인했습니다. v1.0.17 설정 창 흐름은 배포되어 있으며, 설정 창이 작업 표시줄 뒤에 숨어 있거나 Windows가 프로토콜 실행 확인창을 막았을 가능성이 큽니다.",
    next_update_message: "AIMAX와 브라우저를 모두 닫은 뒤 웹앱을 새로고침하고 실행기를 다시 연결해주세요. 설정 열기를 다시 누른 뒤 작업 표시줄의 AIMAX 창을 확인하고, 계속 열리지 않으면 이 화면에서 '아직 안 돼요'를 눌러주세요.",
  },
  "AIMAX-RPT-20260523064721-fcf8d675": {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message: "보고 당시 웹앱이 Windows v1.0.16 실행기와 연결되어 있어 v1.0.17 설치 후 새 실행기가 아직 붙지 않은 상태로 보입니다. 최근 실패는 네이버 보안문자/추가 인증 단계에서 중단된 기록이며, 이전 이미지 0장 첨부 문제는 최신 실행기와 모델/API 설정 기준으로 재확인이 필요합니다.",
    next_update_message: "AIMAX를 완전히 종료한 뒤 v1.0.17 설치 파일을 다시 실행하고, 웹앱 새로고침 후 로컬 실행기 버전이 v1.0.17인지 확인해주세요. 네이버 브라우저에서 수동 인증을 완료한 뒤 키워드 1개, 이미지 1장, 임시저장으로만 먼저 확인해주세요.",
  },
};

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  const tmpPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  fs.renameSync(tmpPath, filePath);
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

function reportPath(row) {
  const date = String(row.date || row.stored_at || row.server_received_at || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  return path.join(REPORTS_DIR, date, `${row.report_id}.json`);
}

function copyBackup(filePath, backups) {
  if (!fs.existsSync(filePath) || DRY_RUN) return "";
  const backupPath = `${filePath}${backupSuffix}`;
  fs.copyFileSync(filePath, backupPath);
  backups.push(backupPath);
  return backupPath;
}

function minutesSince(value) {
  const parsed = Date.parse(value || "");
  if (!Number.isFinite(parsed)) return Number.POSITIVE_INFINITY;
  return Math.round((Date.now() - parsed) / 60000);
}

function staleRunningJobs(jobs) {
  return jobs
    .filter((job) => job.status === "running")
    .filter((job) => {
      const ageMinutes = minutesSince(job.updated_at || job.assigned_at || job.created_at);
      const createdAt = Date.parse(job.created_at || "");
      const hasLaterJob = jobs.some((other) => (
        other.user_id === job.user_id
        && other.id !== job.id
        && Date.parse(other.created_at || "") > createdAt
      ));
      return ageMinutes >= 180 || (ageMinutes >= 30 && hasLaterJob);
    });
}

const updatedAt = new Date().toISOString();
const backups = [];
const rows = readRows();
const jobsData = readJson(JOBS_PATH, { version: 1, jobs: [] });
const jobs = Array.isArray(jobsData.jobs) ? jobsData.jobs : [];

copyBackup(INDEX_PATH, backups);
copyBackup(JOBS_PATH, backups);

const missingReports = new Set(Object.keys(reportChanges));
const touchedReports = [];
const nextRows = rows.map((row) => {
  const change = reportChanges[row.report_id];
  if (!change) return row;
  missingReports.delete(row.report_id);
  touchedReports.push({
    report_id: row.report_id,
    previous_status: row.status || "",
    next_status: change.status,
  });
  if (!DRY_RUN) {
    const filePath = reportPath(row);
    if (filePath && fs.existsSync(filePath)) {
      copyBackup(filePath, backups);
      const report = readJson(filePath, {});
      report.support = {
        ...(report.support || {}),
        ...change,
        updated_at: updatedAt,
      };
      writeJson(filePath, report);
    }
  }
  return {
    ...row,
    ...change,
    status_updated_at: updatedAt,
  };
});

const staleJobs = staleRunningJobs(jobs);
const cancelledJobs = staleJobs.map((job) => ({
  id: job.id,
  user_id: job.user_id,
  kind: job.kind,
  age_minutes: minutesSince(job.updated_at || job.assigned_at || job.created_at),
}));

if (!DRY_RUN) {
  for (const job of staleJobs) {
    job.status = "cancelled";
    job.updated_at = updatedAt;
    job.finished_at = updatedAt;
    delete job.claim_expires_at;
    job.logs = job.logs || [];
    job.logs.push({
      at: updatedAt,
      level: "warning",
      message: "운영 정리로 오래된 실행 중 표시를 취소했습니다. 필요한 경우 새 작업을 다시 실행해주세요.",
    });
    job.result = {
      ...(job.result || {}),
      ok: false,
      stage: job.result?.stage || "operator_cleanup",
      error: job.result?.error || "오래된 실행 중 상태가 운영 정리로 취소되었습니다.",
    };
  }
  writeRows(nextRows);
  writeJson(JOBS_PATH, jobsData);
}

console.log(JSON.stringify({
  ok: true,
  dry_run: DRY_RUN,
  updated_at: updatedAt,
  reports: {
    touched_count: touchedReports.length,
    missing: Array.from(missingReports),
    touched: touchedReports,
  },
  jobs: {
    cancelled_count: cancelledJobs.length,
    cancelled: cancelledJobs,
  },
  backups,
}, null, 2));
