#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.AIMAX_REPORT_DATA_DIR || "/home/ubuntu/aimax-reports/data";
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const INDEX_PATH = path.join(DATA_DIR, "reports-index.jsonl");
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const backupSuffix = `.bak-${stamp}-web-secret-and-v115`;

const songiWebSecretWaiting = {
  status: "waiting_user",
  status_label: "사용자 확인 필요",
  public_message: "송이 Apify 키 인식 문제는 로컬 실행기 저장 토큰과 웹 송이 실행 경로가 분리되어 생긴 문제로 확인했습니다. 2026-05-22 19:17 KST 배포에서 설정 탭에 AI/API 연결을 추가했고, Apify/Gemini 키를 사용자별 웹 보안 저장소에 암호화 저장해 송이가 실행기 없이 인식하도록 수정했습니다.",
  next_update_message: "웹앱을 새로고침한 뒤 설정 > AI/API 연결에서 Apify API Token과 Gemini API Key를 저장하고 송이 작업에서 Instagram/TikTok 링크를 다시 추가해주세요. 외부 API 비용이 드는 수집/분석은 확인 창 이후에만 실행됩니다.",
};

const windowsV115Waiting = {
  status: "waiting_user",
  status_label: "사용자 확인 필요",
  public_message: "Windows 실행기 다운로드와 로컬 설정 열기 대기 문제는 v1.0.15 핫픽스로 배포되어 있습니다. 다운로드가 즉시 시작되도록 바꾸고, 로컬 설정 창 열기 상태 안내를 보강했습니다.",
  next_update_message: "웹앱을 새로고침한 뒤 업데이트 탭에서 Windows v1.0.15 설치 파일을 받아 설치하고 다시 연결해주세요. 설치 후에도 로컬 설정 창이 열리지 않으면 이 접수 ID와 함께 다시 알려주세요.",
};

const oldWindowsImageWaiting = {
  status: "waiting_user",
  status_label: "사용자 확인 필요",
  public_message: "이 보고는 Windows v1.0.2 구버전 실행기에서 이미지 생성/첨부가 0장으로 끝난 기록입니다. 이후 Windows 필수 업데이트와 에디터/이미지 처리 핫픽스가 배포되어 최신 실행기 기준 재확인이 필요합니다.",
  next_update_message: "웹앱을 새로고침한 뒤 업데이트 탭에서 Windows v1.0.15를 설치하고, 키워드 1개와 이미지 1장으로 임시저장 테스트를 먼저 진행해주세요. 같은 문제가 계속되면 이 접수 ID로 다시 알려주세요.",
};

const changes = {
  "AIMAX-RPT-20260521063153-e9f89e1f": songiWebSecretWaiting,
  "AIMAX-RPT-20260522050646-d9ab7f2b": songiWebSecretWaiting,
  "AIMAX-RPT-20260522015806-4bcdf1df": windowsV115Waiting,
  "AIMAX-RPT-20260519111502-f4464f9a": windowsV115Waiting,
  "AIMAX-RPT-20260516091042-e77599e1": oldWindowsImageWaiting,
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
  const date = String(row.date || row.stored_at || row.received_at || "").slice(0, 10);
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
