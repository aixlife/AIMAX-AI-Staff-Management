#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
from datetime import UTC, datetime, timedelta
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"failed to load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


guidance = load_module("aimax_report_auto_guidance", ROOT / "scripts" / "aimax_report_auto_guidance.py")


now = datetime.now(UTC)
stored_at = (now - timedelta(minutes=30)).isoformat(timespec="milliseconds").replace("+00:00", "Z")
report_id = "AIMAX-RPT-SMOKE-IMAGE-DONE"
ticket_id = "AIMAX-AUTO-SMOKE-IMAGE-DONE"
job_id = "smoke-image-job"

with tempfile.TemporaryDirectory(prefix="aimax-report-guidance-completion-") as tmp:
    data_dir = Path(tmp)
    report_dir = data_dir / "reports" / stored_at[:10]
    report_dir.mkdir(parents=True)
    index_row = {
        "report_id": report_id,
        "stored_at": stored_at,
        "date": stored_at[:10],
        "status": "new",
        "status_updated_at": stored_at,
        "visible_error": "그림생성이 안된채 업로드 됨",
        "job_id": job_id,
        "automation_ticket_id": ticket_id,
    }
    detail = {
        "server_received_at": stored_at,
        "support": {"automation_ticket_id": ticket_id},
    }
    jobs = {
        "jobs": [
            {
                "id": job_id,
                "status": "done",
                "result": {
                    "ok": True,
                    "images": {"attempted": 4, "generated": 4, "inserted": 4, "failure_count": 0},
                },
            }
        ]
    }
    (data_dir / "reports-index.jsonl").write_text(f"{json.dumps(index_row)}\n", encoding="utf-8")
    (data_dir / "automation-tickets.jsonl").write_text(
        f"{json.dumps({'ticket_id': ticket_id, 'status': 'open', 'report_id': report_id, 'updated_at': stored_at})}\n",
        encoding="utf-8",
    )
    (report_dir / f"{report_id}.json").write_text(f"{json.dumps(detail)}\n", encoding="utf-8")
    (data_dir / "jobs.json").write_text(f"{json.dumps(jobs)}\n", encoding="utf-8")

    result = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts" / "aimax_report_auto_guidance.py"),
            "--data-dir",
            str(data_dir),
            "--min-age-minutes",
            "0",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(result.stdout)
    assert payload["touched_count"] == 1, payload
    assert payload["touched"][0]["next_status"] == "done", payload
    rows = guidance.read_rows(data_dir / "reports-index.jsonl")
    assert rows[0]["status"] == "done", rows[0]
    assert guidance.latest_ticket_statuses(data_dir)[ticket_id] == "done"

print("REPORT_AUTO_GUIDANCE_COMPLETION_SYNC_SMOKE_OK")


draft_report_id = "AIMAX-RPT-SMOKE-IMAGE-PAID-DRAFT"
draft_ticket_id = "AIMAX-AUTO-SMOKE-IMAGE-PAID-DRAFT"
draft_job_id = "smoke-image-paid-draft-job"

with tempfile.TemporaryDirectory(prefix="aimax-report-guidance-image-paid-draft-") as tmp:
    data_dir = Path(tmp)
    report_dir = data_dir / "reports" / stored_at[:10]
    report_dir.mkdir(parents=True)
    index_row = {
        "report_id": draft_report_id,
        "stored_at": stored_at,
        "date": stored_at[:10],
        "status": "reviewing",
        "status_updated_at": stored_at,
        "work_context": "블로그",
        "visible_error": "단계: content_generation server_generation_provider_transient",
        "user_response": "still_failing",
        "auto_guidance_category": "provider_transient",
        "job_id": draft_job_id,
        "automation_ticket_id": draft_ticket_id,
    }
    detail = {
        "server_received_at": stored_at,
        "support": {"automation_ticket_id": draft_ticket_id},
    }
    image_failure = {
        "stage": "image_generation",
        "error_code": "image_paid_required",
        "provider": "gemini",
        "message": "Gemini 이미지 모델은 무료 티어에서 사용할 수 없어 이미지 없이 본문을 입력했습니다.",
    }
    jobs = {
        "jobs": [
            {
                "id": draft_job_id,
                "kind": "yeri_write",
                "status": "done",
                "user_id": "",
                "result": {
                    "ok": True,
                    "mode": "save",
                    "images": {
                        "attempted": 3,
                        "generated": 0,
                        "inserted": 0,
                        "failure_count": 3,
                        "failures": [image_failure, image_failure, image_failure],
                        "soft_failure_accepted": True,
                        "mode_overridden_to_save": True,
                    },
                    "posts": [{"status": "done", "mode": "save", "requested_mode": "schedule"}],
                },
            }
        ]
    }
    (data_dir / "reports-index.jsonl").write_text(f"{json.dumps(index_row, ensure_ascii=False)}\n", encoding="utf-8")
    (data_dir / "automation-tickets.jsonl").write_text(
        f"{json.dumps({'ticket_id': draft_ticket_id, 'status': 'open', 'report_id': draft_report_id, 'updated_at': stored_at})}\n",
        encoding="utf-8",
    )
    (report_dir / f"{draft_report_id}.json").write_text(f"{json.dumps(detail, ensure_ascii=False)}\n", encoding="utf-8")
    (data_dir / "jobs.json").write_text(f"{json.dumps(jobs, ensure_ascii=False)}\n", encoding="utf-8")

    result = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts" / "aimax_report_auto_guidance.py"),
            "--data-dir",
            str(data_dir),
            "--min-age-minutes",
            "0",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(result.stdout)
    assert payload["touched_count"] == 1, payload
    assert payload["touched"][0]["category"] == "image_paid_required_saved_as_draft", payload
    rows = guidance.read_rows(data_dir / "reports-index.jsonl")
    assert rows[0]["status"] == "waiting_user", rows[0]
    assert guidance.latest_ticket_statuses(data_dir)[draft_ticket_id] == "waiting_user"

print("REPORT_AUTO_GUIDANCE_IMAGE_PAID_DRAFT_SMOKE_OK")


yunmi_report_id = "AIMAX-RPT-SMOKE-YUNMI-FALLBACK-DONE"
yunmi_ticket_id = "AIMAX-AUTO-SMOKE-YUNMI-FALLBACK-DONE"
yunmi_failed_job_id = "smoke-yunmi-paid-job"
yunmi_fallback_job_id = "smoke-yunmi-fallback-job"
yunmi_user_id = "smoke-user"

with tempfile.TemporaryDirectory(prefix="aimax-report-guidance-yunmi-fallback-") as tmp:
    data_dir = Path(tmp)
    report_dir = data_dir / "reports" / stored_at[:10]
    report_dir.mkdir(parents=True)
    index_row = {
        "report_id": yunmi_report_id,
        "stored_at": stored_at,
        "date": stored_at[:10],
        "account_user_id": yunmi_user_id,
        "status": "new",
        "status_updated_at": stored_at,
        "work_context": "윤미 스크립트 AI 생성",
        "visible_error": "yunmi_ai_invalid_json",
        "job_id": yunmi_failed_job_id,
        "automation_ticket_id": yunmi_ticket_id,
    }
    detail = {
        "server_received_at": stored_at,
        "support": {"automation_ticket_id": yunmi_ticket_id},
        "system": {"jobs_recent": []},
    }
    jobs = {
        "jobs": [
            {
                "id": yunmi_failed_job_id,
                "user_id": yunmi_user_id,
                "kind": "yunmi_script",
                "status": "failed",
                "finished_at": stored_at,
                "result": {"ok": False, "mode": "ai_generated", "error": "yunmi_ai_invalid_json"},
            },
            {
                "id": yunmi_fallback_job_id,
                "user_id": yunmi_user_id,
                "kind": "yunmi_script",
                "status": "done",
                "finished_at": (now - timedelta(minutes=29)).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
                "payload": {"mode": "no_paid_alpha"},
                "result": {"ok": True, "mode": "no_paid_alpha"},
            },
        ]
    }
    (data_dir / "reports-index.jsonl").write_text(f"{json.dumps(index_row)}\n", encoding="utf-8")
    (data_dir / "automation-tickets.jsonl").write_text(
        f"{json.dumps({'ticket_id': yunmi_ticket_id, 'status': 'open', 'report_id': yunmi_report_id, 'updated_at': stored_at})}\n",
        encoding="utf-8",
    )
    (report_dir / f"{yunmi_report_id}.json").write_text(f"{json.dumps(detail)}\n", encoding="utf-8")
    (data_dir / "jobs.json").write_text(f"{json.dumps(jobs)}\n", encoding="utf-8")

    result = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts" / "aimax_report_auto_guidance.py"),
            "--data-dir",
            str(data_dir),
            "--min-age-minutes",
            "0",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(result.stdout)
    assert payload["touched_count"] == 1, payload
    assert payload["touched"][0]["category"] == "yunmi_fallback_completed_after_report", payload
    assert payload["touched"][0]["next_status"] == "done", payload
    rows = guidance.read_rows(data_dir / "reports-index.jsonl")
    assert rows[0]["status"] == "done", rows[0]
    assert guidance.latest_ticket_statuses(data_dir)[yunmi_ticket_id] == "done"

print("REPORT_AUTO_GUIDANCE_YUNMI_FALLBACK_SMOKE_OK")


still_failing_rows = [
    {
        "report_id": "AIMAX-RPT-SMOKE-WEB-LOGIN-STILL-FAILING",
        "stored_at": stored_at,
        "date": stored_at[:10],
        "status": "reviewing",
        "status_updated_at": stored_at,
        "work_context": "웹앱 연결",
        "visible_error": "로그인 실패 : 웹앱 이메일 또는 비밀번호가 맞지 않습니다.",
        "user_response": "still_failing",
        "auto_guidance_category": "web_login_failed",
    },
    {
        "report_id": "AIMAX-RPT-SMOKE-NAVER-STILL-FAILING",
        "stored_at": stored_at,
        "date": stored_at[:10],
        "status": "reviewing",
        "status_updated_at": stored_at,
        "work_context": "블로그 글쓰기",
        "visible_error": "네이버ID 정보 화면에서 멈춤 2단계 인증을 해도 안됨",
        "user_response": "still_failing",
        "auto_guidance_category": "naver_login_required",
    },
]

with tempfile.TemporaryDirectory(prefix="aimax-report-guidance-still-failing-") as tmp:
    data_dir = Path(tmp)
    report_dir = data_dir / "reports" / stored_at[:10]
    report_dir.mkdir(parents=True)
    (data_dir / "reports-index.jsonl").write_text(
        "".join(f"{json.dumps(row, ensure_ascii=False)}\n" for row in still_failing_rows),
        encoding="utf-8",
    )
    (data_dir / "automation-tickets.jsonl").write_text("", encoding="utf-8")
    (data_dir / "jobs.json").write_text(f"{json.dumps({'jobs': []})}\n", encoding="utf-8")
    for row in still_failing_rows:
        detail = {"server_received_at": stored_at, "support": {}}
        (report_dir / f"{row['report_id']}.json").write_text(f"{json.dumps(detail)}\n", encoding="utf-8")

    result = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts" / "aimax_report_auto_guidance.py"),
            "--data-dir",
            str(data_dir),
            "--min-age-minutes",
            "0",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(result.stdout)
    assert payload["touched_count"] == 2, payload
    categories = {item["category"] for item in payload["touched"]}
    assert categories == {"web_login_failed_still_failing", "naver_login_required_still_failing"}, payload
    rows = guidance.read_rows(data_dir / "reports-index.jsonl")
    assert {row["status"] for row in rows} == {"waiting_user"}, rows

print("REPORT_AUTO_GUIDANCE_STILL_FAILING_SMOKE_OK")


driver_block_report_id = "AIMAX-RPT-SMOKE-BROWSER-DRIVER-BLOCKED"
driver_block_ticket_id = "AIMAX-AUTO-SMOKE-BROWSER-DRIVER-BLOCKED"

with tempfile.TemporaryDirectory(prefix="aimax-report-guidance-driver-block-") as tmp:
    data_dir = Path(tmp)
    report_dir = data_dir / "reports" / stored_at[:10]
    report_dir.mkdir(parents=True)
    index_row = {
        "report_id": driver_block_report_id,
        "stored_at": stored_at,
        "date": stored_at[:10],
        "status": "reviewing",
        "status_updated_at": stored_at,
        "work_context": "블로그 글쓰기",
        "visible_error": (
            "AIMAX 관리자 조치 필요\n"
            "단계: 브라우저 시작\n"
            "기술 정보 보기\n"
            "단계: browser_start\n"
            "Windows 애플리케이션 제어 정책이 브라우저 드라이버 실행을 차단했습니다. "
            "config.yaml의 browser.driver_mode를 \"selenium\"으로 두고 chromedriver.exe를 지정해 주세요."
        ),
        "feedback_improve": "Windows 애플리케이션 제어 정책이 브라우저 드라이버 실행을 차단했습니다.",
        "job_stage": "browser_start",
        "user_response": "still_failing",
        "auto_guidance_category": "api_key_invalid",
        "automation_ticket_id": driver_block_ticket_id,
    }
    detail = {
        "server_received_at": stored_at,
        "support": {"automation_ticket_id": driver_block_ticket_id},
        "system": {
            "jobs_recent": [
                {
                    "id": "previous-api-failure",
                    "kind": "yeri_write",
                    "status": "failed",
                    "result": {"error": "server_generation_auth_failed"},
                    "logs": [{"message": "Claude API 키 인증 실패"}],
                }
            ]
        },
    }
    (data_dir / "reports-index.jsonl").write_text(f"{json.dumps(index_row, ensure_ascii=False)}\n", encoding="utf-8")
    (data_dir / "automation-tickets.jsonl").write_text(
        f"{json.dumps({'ticket_id': driver_block_ticket_id, 'status': 'open', 'report_id': driver_block_report_id, 'updated_at': stored_at})}\n",
        encoding="utf-8",
    )
    (data_dir / "jobs.json").write_text(f"{json.dumps({'jobs': []})}\n", encoding="utf-8")
    (report_dir / f"{driver_block_report_id}.json").write_text(f"{json.dumps(detail, ensure_ascii=False)}\n", encoding="utf-8")

    result = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts" / "aimax_report_auto_guidance.py"),
            "--data-dir",
            str(data_dir),
            "--min-age-minutes",
            "0",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(result.stdout)
    assert payload["touched_count"] == 1, payload
    assert payload["touched"][0]["category"] == "browser_driver_policy_blocked", payload
    rows = guidance.read_rows(data_dir / "reports-index.jsonl")
    assert rows[0]["status"] == "waiting_user", rows[0]
    assert guidance.latest_ticket_statuses(data_dir)[driver_block_ticket_id] == "waiting_user"

print("REPORT_AUTO_GUIDANCE_DRIVER_BLOCK_SMOKE_OK")
