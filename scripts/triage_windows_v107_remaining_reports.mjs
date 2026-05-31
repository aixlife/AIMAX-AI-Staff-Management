#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.AIMAX_REPORT_DATA_DIR || "/home/ubuntu/aimax-reports/data";
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const INDEX_PATH = path.join(DATA_DIR, "reports-index.jsonl");
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const backupSuffix = `.bak-${stamp}-windows-v107-remaining-triage`;

const changes = {
  "AIMAX-RPT-20260516102016-b84c2df4": {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message: "브라우저 창이 닫히는 흐름은 Windows 실행기 v1.0.7에서 로컬 실행기/브라우저 진단과 안내를 보강했습니다. 최신 Windows 설치 파일로 업데이트한 뒤 AIMAX와 열린 네이버/Chrome 창을 모두 닫고 실행기를 다시 연결해주세요.",
    next_update_message: "재연결 후 키워드 1개와 임시저장으로 먼저 확인해주세요. 같은 문제가 반복되면 아래 '아직 안 돼요'를 눌러주세요.",
  },
  "AIMAX-RPT-20260516104218-3d4d36ac": {
    status: "waiting_user",
    status_label: "사용자 확인 필요",
    public_message: "AI 글 생성 실패 원인이 더 자세히 기록되도록 Windows 실행기 v1.0.7을 배포했습니다. 최신 Windows 설치 파일로 업데이트한 뒤 비용이 커지지 않게 키워드 1개와 임시저장으로 먼저 확인해주세요.",
    next_update_message: "다시 실패하면 아래 '아직 안 돼요'를 눌러주세요. 다음 오류 보고에는 provider/model/status/request id/토큰 사용량이 함께 들어와 운영팀이 원인을 더 정확히 확인할 수 있습니다.",
  },
  "AIMAX-RPT-20260518095126-d9a35540": {
    status: "working",
    status_label: "조치 중",
    public_message: "v1.0.7 진단으로 원인을 확인했습니다. GPT-5.4 mini 호출 설정값이 현재 모델에서 지원되지 않아 글 생성이 실패했습니다. 운영팀이 Windows 핫픽스를 준비 중입니다. 당장 작업이 필요하면 AI 모델을 Gemini 2.5 Pro/Flash 또는 Claude로 바꿔 키워드 1개와 임시저장으로 먼저 확인해주세요.",
    next_update_message: "핫픽스 빌드와 배포가 끝나면 이 화면에 최신 설치 안내를 남기겠습니다. 같은 OpenAI 모델로 여러 번 반복 실행하지 말아주세요.",
  },
};

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

const nextRows = rows.map((row) => {
  const change = changes[row.report_id];
  if (!change) return row;
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
  touched.push({ report_id: row.report_id, previous_status: row.status, next_status: next.status });
  return next;
});

writeRows(nextRows);

console.log(JSON.stringify({
  ok: true,
  updated_at: updatedAt,
  updated_count: touched.length,
  backups: backups.filter(Boolean),
  touched,
}, null, 2));
