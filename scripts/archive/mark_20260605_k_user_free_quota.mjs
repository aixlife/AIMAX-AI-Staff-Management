#!/usr/bin/env node
// 2026-06-05 k***@gmail.com 1명의 보고 7건 처리.
// 6건: 무료 Gemini 키 429(사용량 한도) → waiting_user + 대기/유료키 안내.
// 1건: 네이버 로그인 확인 필요 → waiting_user + 재로그인 안내.
// 서버에서 실행(DATA_DIR 직접 갱신). report JSON support 블록 + index 행 + 백업.
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.AIMAX_REPORT_DATA_DIR || "/home/ubuntu/aimax-reports/data";
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const INDEX_PATH = path.join(DATA_DIR, "reports-index.jsonl");
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const backupSuffix = `.bak-${stamp}-k-user-free-quota`;

const QUOTA = {
  status: "waiting_user",
  status_label: "사용자 확인 필요",
  public_message:
    "확인 결과, 사용 중인 무료 Gemini API 키의 사용량 한도(429)에 도달한 것으로 보입니다. 분당 한도면 잠시 후, 일일 한도면 내일 다시 시도하거나, 본인 유료 API 키를 웹 설정의 AI/API 연결에 등록하면 해소됩니다. 여러 글을 한 번에 몰아서 보내면 한도에 더 빨리 도달하니 간격을 두고 실행해주세요.",
  next_update_message:
    "유료 키 등록 또는 시간을 두고 재시도한 뒤에도 같은 오류가 계속되면 이 접수 ID와 함께 알려주세요.",
};
const NAVER = {
  status: "waiting_user",
  status_label: "사용자 확인 필요",
  public_message:
    "네이버 로그인 세션 확인이 필요합니다. 실행기에서 네이버에 다시 로그인(2단계 인증/새 기기 등록 포함) 후 다시 시도해주세요.",
  next_update_message: "재로그인 후에도 같은 문제가 계속되면 이 접수 ID와 함께 알려주세요.",
};

const TARGETS = new Map([
  ["AIMAX-RPT-20260605021705-a8f9ce44", NAVER],
  ["AIMAX-RPT-20260605022342-eb057ab7", QUOTA],
  ["AIMAX-RPT-20260605022724-786ad94b", QUOTA],
  ["AIMAX-RPT-20260605023000-a491b496", QUOTA],
  ["AIMAX-RPT-20260605023349-4f633fa0", QUOTA],
  ["AIMAX-RPT-20260605023953-07006315", QUOTA],
  ["AIMAX-RPT-20260605052354-740fde3c", QUOTA],
]);

function readRows() {
  if (!fs.existsSync(INDEX_PATH)) throw new Error(`missing report index: ${INDEX_PATH}`);
  return fs.readFileSync(INDEX_PATH, "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
}
function writeRows(rows) {
  const tmp = `${INDEX_PATH}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`, "utf8");
  fs.renameSync(tmp, INDEX_PATH);
}
function reportPath(row) {
  const date = String(row.date || row.stored_at || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  return path.join(REPORTS_DIR, date, `${row.report_id}.json`);
}
function copyBackup(p) {
  if (!fs.existsSync(p)) return "";
  const b = `${p}${backupSuffix}`;
  fs.copyFileSync(p, b);
  return b;
}

const updatedAt = new Date().toISOString();
const rows = readRows();
const backups = [copyBackup(INDEX_PATH)];
const touched = [];

const nextRows = rows.map((row) => {
  const change = TARGETS.get(row.report_id);
  if (!change) return row;
  const filePath = reportPath(row);
  if (filePath && fs.existsSync(filePath)) {
    backups.push(copyBackup(filePath));
    const report = JSON.parse(fs.readFileSync(filePath, "utf8"));
    report.support = { ...(report.support || {}), ...change, updated_at: updatedAt };
    fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  touched.push({ report_id: row.report_id, previous_status: row.status, next_status: change.status });
  return { ...row, ...change, status_updated_at: updatedAt };
});

const missing = [...TARGETS.keys()].filter((id) => !touched.find((t) => t.report_id === id));
writeRows(nextRows);
console.log(JSON.stringify({ ok: true, updated_at: updatedAt, touched_count: touched.length, missing, backups: backups.filter(Boolean).length }, null, 2));
