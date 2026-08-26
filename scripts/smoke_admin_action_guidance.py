#!/usr/bin/env python3
"""스모크: 실행기가 admin_action_required 로 판정한 실패를 사용자 조치 안내로 뒤집지 않는지 검증한다.

배경 (2026-08-26): AIMAX-RPT-20260826001314 — 네이버 에디터에 원고 1584자 중 809자만 들어가
실패한 건(잡 diagnostic.code=admin_action_required). 자동 안내는 화면 문구
"키워드: … 단계: … 저장/업로드 로직 중 코드 수정이 필요" 가 api_key_missing 의
`키.*저장.*필요` 패턴에 걸려 "API 키를 확인하세요"로 나갔고, 사용자는 '아직 안 돼요'를 눌렀다.

실행: python3 scripts/smoke_admin_action_guidance.py
"""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REPORT_TIME = "2026-08-26T00:13:14.231Z"
JOB_TIME = "2026-08-26T00:05:00.000Z"
RUNNER_ERROR = (
    "고양이 분리불안 완화, 묘한쿠션으로 정말 도움 될까? 제대로 알아보기 처리 실패: "
    "네이버 에디터 입력 글자 수가 생성 원고보다 크게 부족합니다. 생성 원고 1584자 / 에디터 감지 809자. "
    "생성 원고 백업 파일을 확인해 다시 붙여넣을 수 있습니다."
)
# 사용자가 화면에서 그대로 복사해 온 문구. 여기 '키워드/저장/필요' 가 흩어져 들어 있다.
SCREEN_TEXT = (
    "실패 원인을 정리했습니다.\nAIMAX 관리자 조치 필요\n"
    "키워드: 고양이 분리불안 완화, 묘한쿠션으로 정말 도움 될까? 제대로 알아보기 · "
    "단계: smart_editor_input_verification\n"
    "네이버 에디터 구조, 실행기 연결, 저장/업로드 로직 중 코드 수정이 필요한 오류입니다.\n"
    "사용자가 설정으로 해결할 수 없는 문제입니다. 오류 보고를 보내주세요."
)
DIAGNOSTIC = {
    "code": "admin_action_required",
    "title": "AIMAX 관리자 조치 필요",
    "message": "네이버 에디터 구조, 실행기 연결, 저장/업로드 로직 중 코드 수정이 필요한 오류입니다.",
}

passed = 0
failed = 0


def check(name, actual, expected):
    global passed, failed
    if actual == expected:
        passed += 1
        print(f"  PASS  {name}  (={actual})")
    else:
        failed += 1
        print(f"  FAIL  {name}  expected={expected} actual={actual}")


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


guidance = load_module("aimax_report_auto_guidance", ROOT / "scripts" / "aimax_report_auto_guidance.py")

row = {
    "report_id": "AIMAX-RPT-SMOKE-ADMIN",
    "stored_at": REPORT_TIME,
    "status": "new",
    "status_updated_at": REPORT_TIME,
    "report_kind": "error",
    "source": "aimax-webapp",
    "account_user_id": "smoke-user",
    "product": "bundle",
    "os": "Windows",
    "work_context": "예리 블로그 글쓰기",
    "visible_error": SCREEN_TEXT,
    "job_id": "smoke-editor-job",
    "job_kind": "yeri_write",
    "job_stage": "smart_editor_input_verification",
    "job_error": RUNNER_ERROR,
}
detail = {
    "server_received_at": REPORT_TIME,
    "server_job_snapshot": {
        "matched_by": "job_ids",
        "jobs": [
            {
                "id": "smoke-editor-job",
                "kind": "yeri_write",
                "status": "failed",
                "user_id": "smoke-user",
                "created_at": JOB_TIME,
                "updated_at": JOB_TIME,
                "finished_at": JOB_TIME,
                "failed_stage": "smart_editor_input_verification",
                "diagnostic": DIAGNOSTIC,
                "result": {"ok": False, "stage": "smart_editor_input_verification", "error": RUNNER_ERROR},
            }
        ],
    },
}

print("[1] 스윕 분류 — 에디터 입력 잘림은 AIMAX 조치 건")
res = guidance.classify(row, detail, {})
check("category", getattr(res, "category", None), "editor_input_incomplete")
check("사용자 조치(api_key_missing)로 새지 않음", getattr(res, "category", None) == "api_key_missing", False)
check("상태 = reviewing(운영팀 확인)", getattr(res, "status", None), "reviewing")

print("[2] 'AIMAX 조치' 분류는 재응답이 와도 사용자 조치로 강등되지 않는다")
still = guidance.still_failing_guidance(
    {**row, "status": "reviewing", "user_response": "still_failing", "auto_guidance_category": "editor_input_incomplete"}
)
check("강등 없음", still, None)

print("[3] 전용 규칙이 없는 admin_action_required 도 사용자 조치로 새지 않는다")
other_detail = json.loads(json.dumps(detail))
other_detail["server_job_snapshot"]["jobs"][0]["failed_stage"] = "unknown_stage"
other_detail["server_job_snapshot"]["jobs"][0]["result"] = {
    "ok": False, "stage": "unknown_stage", "error": "무언가 잘못됐습니다",
}
other_row = {**row, "job_stage": "unknown_stage", "job_error": "무언가 잘못됐습니다",
             "visible_error": "AIMAX 관리자 조치 필요\n저장/업로드 로직 중 코드 수정이 필요한 오류입니다."}
res3 = guidance.classify(other_row, other_detail, {})
check("category", getattr(res3, "category", None), "aimax_action_required")

print("[4] 회귀 — 진짜 API 키 누락 건은 그대로 api_key_missing")
key_row = {**row, "job_stage": "content_generation", "job_error": "",
           "visible_error": "AI/API 키 등록 필요. 작업에 필요한 AI API 키가 저장되어 있지 않습니다."}
res4 = guidance.classify(key_row, {"server_received_at": REPORT_TIME}, {})
check("category", getattr(res4, "category", None), "api_key_missing")

print("[5] 회귀 — 좁힌 정규식이 문장을 건너뛰며 매칭하지 않는다")
import re
pat = [p for k, p in guidance.STRUCTURED_JOB_RULES if k == "api_key_missing"][0]
check("키워드…저장…필요 오매칭 없음", bool(re.search(pat, SCREEN_TEXT.lower(), re.I)), False)

print("[6] 서버 접수 시점(handleReport) 분류도 같은 결과")
node_script = r"""
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-admin-smoke-"));
process.env.AIMAX_REPORT_DATA_DIR = tmp;
process.env.AIMAX_USER_SECRET_ENCRYPTION_KEY = `base64:${crypto.randomBytes(32).toString("base64")}`;
const server = require(process.argv[1]);
const { classifyReportAutoGuidance, automationTicketCategory } = server.__automationTest;
const input = JSON.parse(process.argv[2]);
const g = classifyReportAutoGuidance(input.report);
const legit = classifyReportAutoGuidance(input.key_report);
console.log(JSON.stringify({
  key: g ? g.key : null,
  status: g ? g.status : null,
  tier: g ? g.signal_tier : null,
  legit_key: legit ? legit.key : null,
  ticket: automationTicketCategory(
    { auto_guidance_category: "editor_input_incomplete" },
    { support: { auto_guidance_category: "editor_input_incomplete" } },
  ),
  mail_subject: server.__reportMailTest.buildWaitingUserReportMail({
    report_id: "AIMAX-RPT-SMOKE-ADMIN", status: "reviewing", job_kind: "yeri_write",
    stored_at: input.report.server_received_at,
    auto_guidance_category: "editor_input_incomplete",
    public_message: g ? g.public_message : "",
    next_update_message: g ? g.next_update_message : "",
  }).subject,
}));
"""
payload = {
    "report": {
        "source": "aimax-webapp",
        "report_kind": "error",
        "server_received_at": REPORT_TIME,
        "account": {"user_id": "smoke-user"},
        "user_input": {"work_context": "예리 블로그 글쓰기", "visible_error": SCREEN_TEXT, "user_note": ""},
        "system": {
            "agent": {
                "jobs_recent": [
                    {
                        "id": "smoke-editor-job",
                        "kind": "yeri_write",
                        "status": "failed",
                        "updated_at": JOB_TIME,
                        "diagnostic": DIAGNOSTIC,
                        "result": {"error": RUNNER_ERROR, "stage": "smart_editor_input_verification"},
                    }
                ]
            }
        },
    },
    "key_report": {
        "source": "aimax-webapp",
        "report_kind": "error",
        "server_received_at": REPORT_TIME,
        "account": {"user_id": "smoke-user-2"},
        "user_input": {
            "work_context": "예리 블로그 글쓰기",
            "visible_error": "AI/API 키 등록 필요. 작업에 필요한 AI API 키가 저장되어 있지 않습니다.",
            "user_note": "",
        },
    },
}
proc = subprocess.run(
    ["node", "-e", node_script, str(ROOT / "oracle/aimax-reports-api/server.js"), json.dumps(payload, ensure_ascii=False)],
    capture_output=True, text=True, cwd=ROOT,
)
if proc.returncode != 0:
    failed += 1
    print("  FAIL  node 분류 실행 실패")
    print(proc.stderr[-1500:])
else:
    out = json.loads(proc.stdout.strip().splitlines()[-1])
    check("server key", out["key"], "editor_input_incomplete")
    check("server status", out["status"], "reviewing")
    check("신호 등급", out["tier"], "job_structured")
    check("회귀: 진짜 키 누락은 api_key_missing", out["legit_key"], "api_key_missing")
    check("자동화 티켓 분류", out["ticket"], "naver_editor")
    check("메일 제목이 'AIMAX가 조치 중' 계열", "AIMAX에서 조치 중" in out["mail_subject"], True)

print(f"\n결과: PASS {passed} / FAIL {failed}")
sys.exit(1 if failed else 0)
