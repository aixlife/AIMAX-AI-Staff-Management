#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.AIMAX_REPORT_DATA_DIR || "/home/ubuntu/aimax-reports/data";
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const INDEX_PATH = path.join(DATA_DIR, "reports-index.jsonl");
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const backupSuffix = `.bak-${stamp}-windows-v109-yeri-chrome-start`;

const v109YeriChrome = {
  status: "waiting_user",
  status_label: "사용자 확인 필요",
  public_message: "Windows 통합 실행기 v1.0.9를 배포했습니다. 예리 작업에서 Chrome 세션이 열리지 않던 흐름을 보강했습니다. 업데이트 탭에서 최신 Windows 통합 설치 파일을 받아 설치해주세요.",
  next_update_message: "설치 전 Chrome/네이버 창을 모두 닫고, 설치 후 웹앱을 새로고침한 뒤 키워드 1개와 임시저장으로 먼저 확인해주세요. 같은 문제가 반복되면 아래 '아직 안 돼요'를 눌러주세요.",
};

const v109Download = {
  status: "waiting_user",
  status_label: "사용자 확인 필요",
  public_message: "Windows 통합 실행기 v1.0.9를 배포했고, Windows 다운로드는 통합 설치 파일만 받도록 정리했습니다. 웹앱을 새로고침한 뒤 업데이트 탭에서 다시 다운로드해주세요.",
  next_update_message: "다운로드가 계속 실패하면 Chrome 또는 Edge에서 다시 시도하고, 그래도 안 되면 이 접수 ID와 함께 카카오채널로 알려주세요.",
};

const v109ImageRetry = {
  status: "waiting_user",
  status_label: "사용자 확인 필요",
  public_message: "사용 중인 Windows 실행기가 구버전으로 확인되어 최신 통합 실행기 v1.0.9 기준으로 먼저 확인이 필요합니다. 업데이트 탭에서 최신 Windows 통합 설치 파일을 설치해주세요.",
  next_update_message: "설치 후 이미지 1장, 키워드 1개, 임시저장으로 먼저 확인해주세요. 이미지가 계속 0장으로 나오면 아래 '아직 안 돼요'를 눌러주세요.",
};

const changes = {
  "AIMAX-RPT-20260516150059-8879a9b5": v109YeriChrome,
  "AIMAX-RPT-20260516161506-67741b89": v109YeriChrome,
  "AIMAX-RPT-20260516164406-bc649df1": v109YeriChrome,
  "AIMAX-RPT-20260516164517-8d41a79a": v109YeriChrome,
  "AIMAX-RPT-20260518095126-d9a35540": v109YeriChrome,
  "AIMAX-RPT-20260519151029-c51f8f7a": v109YeriChrome,
  "AIMAX-RPT-20260519111502-f4464f9a": v109Download,
  "AIMAX-RPT-20260516091042-e77599e1": v109ImageRetry,
};

function readRows() {
  if (!fs.existsSync(INDEX_PATH)) {
    throw new Error(`missing report index: ${INDEX_PATH}`);
  }
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

function copyBackup(filePath) {
  if (!fs.existsSync(filePath)) return "";
  const backupPath = `${filePath}${backupSuffix}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

const updatedAt = new Date().toISOString();
const rows = readRows();
const backups = [copyBackup(INDEX_PATH)];
const touched = [];
const missing = new Set(Object.keys(changes));

const nextRows = rows.map((row) => {
  const change = changes[row.report_id];
  if (!change) return row;
  missing.delete(row.report_id);

  const next = {
    ...row,
    ...change,
    status_updated_at: updatedAt,
  };

  const filePath = reportPath(row);
  if (filePath && fs.existsSync(filePath)) {
    backups.push(copyBackup(filePath));
    const report = JSON.parse(fs.readFileSync(filePath, "utf8"));
    report.support = {
      ...(report.support || {}),
      ...change,
      updated_at: updatedAt,
    };
    fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  touched.push({
    report_id: row.report_id,
    previous_status: row.status,
    next_status: next.status,
  });
  return next;
});

writeRows(nextRows);

console.log(JSON.stringify({
  ok: true,
  updated_at: updatedAt,
  updated_count: touched.length,
  missing: Array.from(missing),
  backups: backups.filter(Boolean),
  touched,
}, null, 2));
