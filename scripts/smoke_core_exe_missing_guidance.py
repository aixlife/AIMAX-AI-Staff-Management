#!/usr/bin/env python3
"""스모크: 런처가 "본체 실행 파일을 찾지 못했습니다" 창을 띄운 보고를 재설치 안내
(runner_update_required)가 아니라 core_exe_missing(백신 격리 점검)으로 분류하는지 검증한다.

배경 (2026-08-23): AIMAX-RPT-20260823131857 — 사용자가 실행창이 안 떠서 재설치를 했고,
그 뒤 런처가 이 창을 띄웠다. 연결 잡은 runner_stopped 로만 올라와 자동 안내가
"최신 설치 파일로 다시 설치하세요"를 보냈고, 사용자는 still_failing 을 눌렀다.
이미 한 일을 다시 시키는 안내라 사용자는 5일째 실행기를 못 쓰는 상태로 남았다.

실행: python3 scripts/smoke_core_exe_missing_guidance.py
"""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# 8/23 보고 원문(사용자 표기 그대로 — "본체 실행파일", 띄어쓰기 없음).
USER_TEXT = (
    "이전에는 잘 하고 있었는데 오늘 실행창이 안떠서 현주 예리를 실행못해서 "
    "새로 설치를 했는데 본체 실행파일을 찾지 못했다고 뜸\n어떻게 해야 할까요?"
)
WORK_CONTEXT = "AIMAX 파일 설치후 실행했는데 오류창이 뜸"
REPORT_TIME = "2026-08-23T13:18:57.394Z"
JOB_TIME = "2026-08-23T12:50:00.000Z"

passed = 0
failed = 0


def check(name: str, actual, expected) -> None:
    global passed, failed
    if actual == expected:
        passed += 1
        print(f"  PASS  {name}  (={actual})")
    else:
        failed += 1
        print(f"  FAIL  {name}  expected={expected} actual={actual}")


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"failed to load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


guidance = load_module("aimax_report_auto_guidance", ROOT / "scripts" / "aimax_report_auto_guidance.py")


def row(**overrides) -> dict:
    base = {
        "report_id": "AIMAX-RPT-SMOKE-CORE-EXE",
        "stored_at": REPORT_TIME,
        "status": "new",
        "status_updated_at": REPORT_TIME,
        "report_kind": "error",
        "source": "aimax-webapp",
        "account_user_id": "smoke-user",
        "product": "bundle",
        "os": "Windows",
        "work_context": WORK_CONTEXT,
        "visible_error": USER_TEXT,
        "job_id": "smoke-job-runner-stopped",
        "job_kind": "hyunju_find",
        "job_stage": "runner_stopped",
    }
    base.update(overrides)
    return base


detail = {
    "server_received_at": REPORT_TIME,
    "server_job_snapshot": {
        "matched_by": "job_ids",
        "jobs": [
            {
                "id": "smoke-job-runner-stopped",
                "kind": "hyunju_find",
                "status": "failed",
                "user_id": "smoke-user",
                "created_at": JOB_TIME,
                "updated_at": JOB_TIME,
                "finished_at": JOB_TIME,
                "failed_stage": "runner_stopped",
                "result": {"ok": False, "stage": "runner_stopped", "error": "runner_stopped_heartbeating_or_timed_out"},
            }
        ],
    },
}

print("[1] 스윕 분류 — 정형 잡 신호(runner_stopped)보다 런처 고정 문구가 우선")
result = guidance.classify(row(), detail, {})
check("category", getattr(result, "category", None), "core_exe_missing")
check("status", getattr(result, "status", None), "waiting_user")
check("재설치 안내로 새지 않음", getattr(result, "category", None) == "runner_update_required", False)
check("백신 점검 안내 포함", "백신" in getattr(result, "next_update_message", ""), True)
check("설치 폴더 확인 안내 포함", "%LOCALAPPDATA%" in getattr(result, "next_update_message", ""), True)
check("어려운 말 안 씀(격리·런처·진단파일)", any(w in getattr(result, "next_update_message", "") for w in ("격리", "런처", "jsonl")), False)

print("[2] '안내대로 했는데 아직 안 돼요' 재응답도 같은 분류로 교정")
still = guidance.still_failing_guidance(
    row(status="reviewing", user_response="still_failing", auto_guidance_category="runner_update_required")
)
check("category", getattr(still, "category", None), "core_exe_missing")

print("[3] 회귀 — 런처 문구 없는 runner_stopped 보고는 그대로 runner_update_required")
plain = guidance.classify(
    row(work_context="현주 서이추 작업", visible_error="작업이 중간에 멈췄습니다"), detail, {}
)
check("category", getattr(plain, "category", None), "runner_update_required")

print("[4] 회귀 — 다른 '실행 파일을 찾지 못했습니다' 문구로 새지 않음")
ytdlp = guidance.classify(
    row(work_context="송이 유튜브 조사", visible_error="yt-dlp 실행 파일을 찾지 못했습니다.", job_stage="", job_id=""),
    {"server_received_at": REPORT_TIME},
    {},
)
check("core_exe_missing 아님", getattr(ytdlp, "category", None) == "core_exe_missing", False)

print("[5] 서버 접수 시점(handleReport) 분류 + 안내 메일 체크리스트")
node_script = r"""
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aimax-core-exe-smoke-"));
process.env.AIMAX_REPORT_DATA_DIR = tmp;
process.env.AIMAX_USER_SECRET_ENCRYPTION_KEY = `base64:${crypto.randomBytes(32).toString("base64")}`;
const server = require(process.argv[1]);
const { classifyReportAutoGuidance, automationTicketCategory } = server.__automationTest;
const input = JSON.parse(process.argv[2]);
const guidance = classifyReportAutoGuidance(input.report);
const row5 = {
  report_id: "AIMAX-RPT-SMOKE-CORE-EXE",
  status: "waiting_user",
  product: "bundle",
  os: "Windows",
  job_kind: "hyunju_find",
  stored_at: input.report.server_received_at,
  auto_guidance_category: "core_exe_missing",
  work_context: input.report.user_input.work_context,
  visible_error: input.report.user_input.visible_error,
  // 카탈로그에 실린 실제 안내문을 그대로 쓴다 — 하드코딩하면 문구를 바꿔도 검사에 안 걸린다.
  public_message: guidance ? guidance.public_message : "",
};
const plain = classifyReportAutoGuidance(input.plain_report);
console.log(JSON.stringify({
  key: guidance ? guidance.key : null,
  status: guidance ? guidance.status : null,
  signal_tier: guidance ? guidance.signal_tier : null,
  plain_key: plain ? plain.key : null,
  ticket_category: automationTicketCategory(
    { auto_guidance_category: "core_exe_missing" },
    { support: { auto_guidance_category: "core_exe_missing" } },
  ),
  checklist: server.__reportMailTest.reportActionChecklist(row5),
  mail_text: server.__reportMailTest.buildWaitingUserReportMail(row5).text,
}));
"""
payload = {
    "report": {
        "source": "aimax-webapp",
        "report_kind": "error",
        "server_received_at": REPORT_TIME,
        "account": {"user_id": "smoke-user"},
        "user_input": {"work_context": WORK_CONTEXT, "visible_error": USER_TEXT, "user_note": ""},
        "system": {
            "agent": {
                "jobs_recent": [
                    {
                        "id": "smoke-job-runner-stopped",
                        "kind": "hyunju_find",
                        "status": "failed",
                        "updated_at": JOB_TIME,
                        "result": {"error": "runner_stopped_heartbeating_or_timed_out"},
                    }
                ]
            }
        },
    },
    "plain_report": {
        "source": "aimax-webapp",
        "report_kind": "error",
        "server_received_at": REPORT_TIME,
        "account": {"user_id": "smoke-user"},
        "user_input": {"work_context": "현주 서이추 작업", "visible_error": "작업이 중간에 멈췄습니다", "user_note": ""},
        "system": {
            "agent": {
                "jobs_recent": [
                    {
                        "id": "smoke-job-runner-stopped",
                        "kind": "hyunju_find",
                        "status": "failed",
                        "updated_at": JOB_TIME,
                        "result": {"error": "runner_stopped_heartbeating_or_timed_out"},
                    }
                ]
            }
        },
    },
}
proc = subprocess.run(
    ["node", "-e", node_script, str(ROOT / "oracle/aimax-reports-api/server.js"), json.dumps(payload, ensure_ascii=False)],
    capture_output=True,
    text=True,
    cwd=ROOT,
)
if proc.returncode != 0:
    failed += 1
    print("  FAIL  node 분류 실행 실패")
    print(proc.stderr[-1500:])
else:
    out = json.loads(proc.stdout.strip().splitlines()[-1])
    check("server key", out["key"], "core_exe_missing")
    check("server status", out["status"], "waiting_user")
    check("신호 등급 표기", out["signal_tier"], "launcher_message")
    check("회귀: 런처 문구 없으면 runner_update_required", out["plain_key"], "runner_update_required")
    check("자동화 티켓 분류", out["ticket_category"], "local_runner")
    checklist = " ".join(out["checklist"])
    check("체크리스트: 재설치 반복 지시 없음", "최신 설치 파일을 다운로드" in checklist, False)
    check("체크리스트: 설치 폴더 확인 지시", "%LOCALAPPDATA%" in checklist, True)
    check("체크리스트: 백신 복원 지시", "백신" in checklist, True)
    check("체크리스트: 어려운 말 안 씀", any(w in checklist for w in ("격리", "런처", "jsonl")), False)
    check("안내 메일도 재설치 루프를 반복하지 않음", "최신 설치 파일을 다운로드" in out["mail_text"], False)
    check("안내 메일에 백신 복원 안내 포함", "백신" in out["mail_text"], True)
    check("안내 메일에 어려운 말 없음", any(w in out["mail_text"] for w in ("격리", "런처", "jsonl")), False)

print(f"\n결과: PASS {passed} / FAIL {failed}")
sys.exit(1 if failed else 0)
