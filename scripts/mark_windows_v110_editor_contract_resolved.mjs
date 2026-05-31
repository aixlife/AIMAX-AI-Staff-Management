#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.AIMAX_REPORT_DATA_DIR || "/home/ubuntu/aimax-reports/data";
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const INDEX_PATH = path.join(DATA_DIR, "reports-index.jsonl");
const REPORT_ID = "AIMAX-RPT-20260520021900-587c9a8c";
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const backupSuffix = `.bak-${stamp}-windows-v110-editor-contract-resolved`;

const change = {
  status: "waiting_user",
  status_label: "사용자 확인 필요",
  public_message: "Windows 통합 실행기 v1.0.10 수정본을 배포했습니다. 이번 오류는 고객님 Gemini Flash API 키 문제가 아니라 v1.0.9 실행기 내부 파일 계약 불일치로, 글 생성 뒤 네이버 에디터 본문 입력 단계에서 멈춘 문제였습니다.",
  next_update_message: "업데이트 탭에서 최신 Windows 통합 실행기를 다시 설치한 뒤 웹앱을 새로고침하고, 로컬 실행기 버전이 v1.0.10으로 보이면 작업을 다시 실행해주세요.",
};

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
let touched = null;

const nextRows = rows.map((row) => {
  if (row.report_id !== REPORT_ID) return row;
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
  touched = {
    report_id: row.report_id,
    previous_status: row.status,
    next_status: next.status,
  };
  return next;
});

if (!touched) throw new Error(`report not found: ${REPORT_ID}`);
writeRows(nextRows);

console.log(JSON.stringify({
  ok: true,
  updated_at: updatedAt,
  backups: backups.filter(Boolean),
  touched,
}, null, 2));
