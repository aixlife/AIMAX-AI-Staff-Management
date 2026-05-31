#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.AIMAX_REPORT_DATA_DIR || "/home/ubuntu/aimax-reports/data";
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const INDEX_PATH = path.join(DATA_DIR, "reports-index.jsonl");
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const backupSuffix = `.bak-${stamp}-phase5-v105-status`;

const STATUS = {
  status: "waiting_user",
  status_label: "사용자 확인 필요",
};

const defaultNext = "업데이트 후에도 같은 문제가 계속되면 이 화면에서 '아직 안 돼요'를 눌러주세요. 운영팀이 이어서 확인하겠습니다.";
const updateMessage = "Windows 실행기 안정화 업데이트(v1.0.5)를 배포했습니다. 웹앱의 업데이트 안내에서 최신 Windows 설치 파일을 받아 설치한 뒤 실행기 연결과 작업을 다시 시도해주세요.";

const changes = {
  "AIMAX-RPT-20260514083437-5731089e": {
    public_message: updateMessage,
    next_update_message: defaultNext,
  },
  "AIMAX-RPT-20260514095338-480d0ce4": {
    public_message: updateMessage,
    next_update_message: defaultNext,
  },
  "AIMAX-RPT-20260514100940-3d7cf508": {
    public_message: "현주 서로이웃 신청 멘트는 웹앱 설정 탭의 웹 작업 설정에서 저장하면 됩니다. Windows 실행기 안정화 업데이트(v1.0.5)도 배포했으니 최신 설치 파일로 업데이트한 뒤 멘트 1개 이상을 저장하고 다시 시도해주세요.",
    next_update_message: "멘트 저장과 v1.0.5 업데이트 후에도 계속 막히면 이 화면에서 '아직 안 돼요'를 눌러주세요.",
  },
  "AIMAX-RPT-20260516091042-e77599e1": {
    public_message: "이미지 첨부 실패를 성공처럼 보이지 않도록 Windows 실행기 v1.0.5에서 실패 표시와 안내를 보강했습니다. 최신 Windows 설치 파일로 업데이트한 뒤 이미지가 필요한 글을 다시 실행해주세요.",
    next_update_message: defaultNext,
  },
  "AIMAX-RPT-20260516102016-b84c2df4": {
    public_message: "브라우저 창 복구와 로그인 흐름을 Windows 실행기 v1.0.5에서 보강했습니다. 최신 Windows 설치 파일로 업데이트한 뒤 글쓰기 작업을 다시 시도해주세요.",
    next_update_message: defaultNext,
  },
  "AIMAX-RPT-20260516104218-3d4d36ac": {
    public_message: "글쓰기 초기화와 브라우저 복구 흐름을 Windows 실행기 v1.0.5에서 안정화했습니다. 최신 Windows 설치 파일로 업데이트한 뒤 같은 키워드로 다시 시도해주세요.",
    next_update_message: "업데이트 후에도 여러 키워드가 계속 글 생성 실패로 끝나면 이 화면에서 '아직 안 돼요'를 눌러주세요. 운영팀이 AI 응답/한도 문제까지 이어서 확인하겠습니다.",
  },
  "AIMAX-RPT-20260516150059-8879a9b5": {
    public_message: "대기 중에서 멈추는 문제를 확인해 Windows 실행기 v1.0.5 배포와 함께 실행기 연결/작업 수신 흐름을 보강했습니다. 최신 설치 파일로 업데이트한 뒤 다시 실행해주세요.",
    next_update_message: defaultNext,
  },
  "AIMAX-RPT-20260516161506-67741b89": {
    public_message: "네이버 로그인 후 브라우저 창이 닫히는 흐름을 Windows 실행기 v1.0.5에서 복구하도록 보강했습니다. 최신 설치 파일로 업데이트한 뒤 다시 시도해주세요.",
    next_update_message: defaultNext,
  },
  "AIMAX-RPT-20260516164406-bc649df1": {
    public_message: "확인된 실행기 패키징 오류를 수정한 Windows 실행기 v1.0.5를 배포했습니다. 최신 설치 파일로 업데이트하면 `content.ai_text` 가져오기 오류가 해결됩니다.",
    next_update_message: defaultNext,
  },
  "AIMAX-RPT-20260516164517-8d41a79a": {
    public_message: "확인된 실행기 패키징 오류를 수정한 Windows 실행기 v1.0.5를 배포했습니다. 최신 설치 파일로 업데이트하면 `content.ai_text` 가져오기 오류가 해결됩니다.",
    next_update_message: defaultNext,
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

if (!fs.existsSync(INDEX_PATH)) {
  throw new Error(`missing report index: ${INDEX_PATH}`);
}

const updatedAt = new Date().toISOString();
const backups = [copyBackup(INDEX_PATH)];
const rows = readRows();
const touched = [];

const nextRows = rows.map((row) => {
  const change = changes[row.report_id];
  if (!change) return row;
  const next = {
    ...row,
    ...STATUS,
    ...change,
    status_updated_at: updatedAt,
  };
  const filePath = reportPath(row);
  if (filePath && fs.existsSync(filePath)) {
    backups.push(copyBackup(filePath));
    const report = JSON.parse(fs.readFileSync(filePath, "utf8"));
    report.support = {
      ...(report.support || {}),
      ...STATUS,
      ...change,
      updated_at: updatedAt,
    };
    fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  touched.push({
    report_id: row.report_id,
    previous_status: row.status,
    next_status: next.status,
    public_message: next.public_message,
  });
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
