#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.AIMAX_REPORT_DATA_DIR || "/home/ubuntu/aimax-reports/data";
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const INDEX_PATH = path.join(DATA_DIR, "reports-index.jsonl");
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const backupSuffix = `.bak-${stamp}-report-wave-20260520`;

const yeriChromeWorking = {
  status: "working",
  status_label: "조치 중",
  public_message: "최신 Windows 실행기에서도 예리 실행 시 Chrome 브라우저 시작 단계에서 세션이 열리지 않는 기록을 확인했습니다. 실행기 전체 문제가 아니라 예리 브라우저 시작/프로필 복구 쪽으로 Windows 핫픽스를 준비 중입니다.",
  next_update_message: "핫픽스 안내가 올라오기 전까지 같은 예리 작업을 여러 번 반복하지 말아주세요. Chrome/네이버 창을 모두 닫아두고, 배포가 끝나면 최신 설치 안내를 이 화면에 남기겠습니다.",
};

const downloadWorking = {
  status: "working",
  status_label: "조치 중",
  public_message: "Windows 설치 파일과 계정 다운로드 권한은 서버에서 정상으로 확인했습니다. 구버전 실행기의 업데이트 다운로드 실패 원인을 확인하고 대체 다운로드 안내를 준비 중입니다.",
  next_update_message: "우선 Chrome 또는 Edge에서 웹앱을 새로고침한 뒤 업데이트 탭을 다시 시도해주세요. 계속 실패하면 이 접수 ID와 함께 카카오채널로 알려주세요.",
};

const geminiQuotaWaiting = {
  status: "waiting_user",
  status_label: "사용자 확인 필요",
  public_message: "글 생성 실패 원인은 Gemini API 429 쿼터 초과로 확인됩니다. 현재 API 키에서 Gemini 2.5 Pro 무료/요금제 한도가 막혀 있어 앱 재설치로 해결되는 문제가 아닙니다.",
  next_update_message: "Google AI Studio 결제/쿼터를 확인하거나 다른 정상 API 키 또는 OpenAI/Claude 모델로 바꾼 뒤 키워드 1개와 임시저장으로 먼저 테스트해주세요.",
};

const changes = {
  "AIMAX-RPT-20260516150059-8879a9b5": yeriChromeWorking,
  "AIMAX-RPT-20260516161506-67741b89": yeriChromeWorking,
  "AIMAX-RPT-20260516164406-bc649df1": yeriChromeWorking,
  "AIMAX-RPT-20260516164517-8d41a79a": yeriChromeWorking,
  "AIMAX-RPT-20260518095126-d9a35540": yeriChromeWorking,
  "AIMAX-RPT-20260519151029-c51f8f7a": yeriChromeWorking,
  "AIMAX-RPT-20260516091042-e77599e1": downloadWorking,
  "AIMAX-RPT-20260519111502-f4464f9a": downloadWorking,
  "AIMAX-RPT-20260519075307-3c80ca70": geminiQuotaWaiting,
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
