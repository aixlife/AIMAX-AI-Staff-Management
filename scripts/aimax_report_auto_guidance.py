#!/usr/bin/env python3
"""Apply user-facing guidance to AIMAX reports.

This is intentionally conservative: it only auto-updates reports where the
visible error clearly maps to a known customer action or an already-shipped
update path. The message is shown in the user's 오류 보고 tab when they return.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any


DEFAULT_DATA_DIR = Path("/home/ubuntu/aimax-reports/data")


@dataclass(frozen=True)
class Guidance:
    category: str
    status: str
    status_label: str
    public_message: str
    next_update_message: str


GUIDANCE: dict[str, Guidance] = {
    "job_completed_after_report": Guidance(
        category="job_completed_after_report",
        status="done",
        status_label="완료",
        public_message="오류 보고 뒤 같은 작업이 정상 완료된 것을 확인했습니다.",
        next_update_message="같은 문제가 다시 생기면 이 접수 ID와 함께 알려주세요.",
    ),
    "yunmi_fallback_completed_after_report": Guidance(
        category="yunmi_fallback_completed_after_report",
        status="done",
        status_label="완료",
        public_message="윤미 유료 AI 응답 해석 오류 뒤 무과금 대체 생성으로 스크립트 생성이 완료된 것을 확인했습니다.",
        next_update_message="결과물이 비어 있거나 같은 오류가 반복되면 이 접수 ID와 함께 다시 알려주세요.",
    ),
    "image_paid_required": Guidance(
        category="image_paid_required",
        status="waiting_user",
        status_label="사용자 확인 필요",
        public_message=(
            "이미지 생성 단계에서 선택된 이미지 모델을 현재 API 키/요금제에서 사용할 수 없어 실패했습니다. "
            "글쓰기 기능 전체가 고장난 것은 아니며, 이미지 생성 권한 또는 유료 이미지 모델 사용 가능 여부 확인이 필요한 상태입니다."
        ),
        next_update_message=(
            "설정 > AI/API 연결에서 이미지 생성 가능한 Gemini 또는 OpenAI 키와 선택 모델 권한을 확인한 뒤, "
            "이미지 1장짜리 새 작업 1건만 다시 시도해주세요. 급하면 이미지 0장으로 먼저 글쓰기만 진행할 수 있습니다."
        ),
    ),
    "api_key_missing": Guidance(
        category="api_key_missing",
        status="waiting_user",
        status_label="사용자 확인 필요",
        public_message="AI/API 키가 저장되어 있지 않거나 실행기/웹앱에서 사용할 수 없는 상태입니다.",
        next_update_message="설정 > AI/API 연결에서 사용하는 제공자 키를 저장한 뒤 웹앱을 새로고침하고 새 작업 1건만 다시 시도해주세요.",
    ),
    "api_key_invalid": Guidance(
        category="api_key_invalid",
        status="waiting_user",
        status_label="사용자 확인 필요",
        public_message="저장된 AI/API 키가 제공자 서버에서 인증 실패로 거부되었습니다. 키가 잘못 복사되었거나 폐기된 상태일 수 있습니다.",
        next_update_message="제공자 콘솔에서 새 API 키를 발급해 설정 > AI/API 연결에 다시 저장한 뒤 새 작업 1건만 다시 시도해주세요.",
    ),
    "quota_exceeded": Guidance(
        category="quota_exceeded",
        status="waiting_user",
        status_label="사용자 확인 필요",
        public_message="AI 제공자의 결제/크레딧/요금제 한도 때문에 작업이 중단되었습니다. AIMAX 실행기 오류가 아니라 API 계정 상태 확인이 필요한 케이스입니다.",
        next_update_message="사용 중인 AI 제공자 콘솔에서 결제, 크레딧, 사용량 한도를 확인한 뒤 키를 다시 저장하거나 다른 사용 가능한 모델로 바꿔 1건만 테스트해주세요.",
    ),
    "rate_limited": Guidance(
        category="rate_limited",
        status="waiting_user",
        status_label="사용자 확인 필요",
        public_message="AI 무료 사용량 또는 분당 호출 한도에 걸린 상태입니다. 같은 작업을 반복 제출하면 대기 시간이 더 길어질 수 있습니다.",
        next_update_message="분당 한도면 10~30분 뒤, 일일 무료 한도면 다음 날 다시 시도해주세요. 급하면 본인 유료 API 키를 등록하거나 이미지 수/글 수를 줄여 1건만 테스트해주세요.",
    ),
    "model_not_found": Guidance(
        category="model_not_found",
        status="waiting_user",
        status_label="사용자 확인 필요",
        public_message="선택한 AI 모델을 현재 계정에서 사용할 수 없거나 모델명이 맞지 않아 작업이 중단되었습니다.",
        next_update_message="설정 > AI/API 연결에서 AIMAX 기본 모델 또는 현재 계정에서 사용 가능한 모델로 바꾼 뒤 새 작업 1건만 다시 시도해주세요.",
    ),
    "provider_transient": Guidance(
        category="provider_transient",
        status="waiting_user",
        status_label="사용자 확인 필요",
        public_message="AI 제공자 서버가 일시적으로 응답하지 않아 실패한 건입니다. 코드나 실행기 고장보다는 외부 제공자 일시 장애 가능성이 큽니다.",
        next_update_message="같은 작업을 여러 번 반복하지 말고 10~30분 뒤 새 작업 1건만 다시 시도해주세요. 반복되면 이 접수 ID로 다시 알려주세요.",
    ),
    "web_login_failed": Guidance(
        category="web_login_failed",
        status="waiting_user",
        status_label="사용자 확인 필요",
        public_message="웹앱 로그인 이메일 또는 비밀번호가 맞지 않아 연결이 실패했습니다.",
        next_update_message="이메일 대소문자/공백을 확인하고 비밀번호를 다시 입력해주세요. 계속 실패하면 비밀번호 재설정 또는 운영팀 확인이 필요합니다.",
    ),
    "web_login_failed_still_failing": Guidance(
        category="web_login_failed_still_failing",
        status="waiting_user",
        status_label="사용자 확인 필요",
        public_message="웹앱 계정은 활성 상태지만 입력한 비밀번호가 서버 검증과 계속 맞지 않는 상태로 확인됩니다.",
        next_update_message="비밀번호 재설정이 필요할 수 있습니다. 운영팀이 재설정 안내를 보낸 뒤 새 비밀번호로 로그인하고, 실행기 연결을 다시 눌러주세요.",
    ),
    "naver_login_required": Guidance(
        category="naver_login_required",
        status="waiting_user",
        status_label="사용자 확인 필요",
        public_message="네이버 로그인 또는 2단계 인증/보안 확인 화면에서 다음 단계로 넘어가지 못한 상태입니다. 네이버 계정 보안 확인이 먼저 필요합니다.",
        next_update_message="실행기에서 열린 브라우저에서 네이버 로그인, 2단계 인증, 새 기기 등록을 완료한 뒤 AIMAX 웹앱을 새로고침하고 새 작업 1건만 다시 시도해주세요.",
    ),
    "naver_login_required_still_failing": Guidance(
        category="naver_login_required_still_failing",
        status="waiting_user",
        status_label="사용자 확인 필요",
        public_message="로컬 실행기가 작업을 시작했지만 네이버 로그인/보안 확인 단계에서 제한 시간 안에 완료되지 않아 멈춘 것으로 확인됩니다.",
        next_update_message="AIMAX가 연 브라우저에서 네이버 로그인, 2단계 인증, 새 기기 등록을 끝낸 뒤 브라우저와 AIMAX를 모두 닫고 다시 연결해주세요. 같은 화면에 계속 멈추면 해당 네이버 보안 화면 캡처를 운영팀에 보내주세요.",
    ),
    "mac_gatekeeper": Guidance(
        category="mac_gatekeeper",
        status="waiting_user",
        status_label="사용자 확인 필요",
        public_message="macOS 보안 허용 후 AIMAX 실행기가 바로 보이지 않는 상태입니다. 앱이 차단되었거나 백그라운드 실행/권한 허용이 끝나지 않았을 수 있습니다.",
        next_update_message="AIMAX를 완전히 종료한 뒤 최신 macOS 설치 파일을 다시 설치하고, 시스템 설정 > 개인정보 보호 및 보안에서 허용 후 앱을 한 번 더 실행해주세요. 그래도 무반응이면 접수 ID와 함께 알려주세요.",
    ),
    "runner_update_required": Guidance(
        category="runner_update_required",
        status="waiting_user",
        status_label="사용자 확인 필요",
        public_message="로컬 실행기 버전 또는 연결 상태가 현재 웹 작업과 맞지 않아 업데이트/재연결이 필요한 상태입니다.",
        next_update_message="웹앱 업데이트 탭에서 최신 설치 파일을 받은 뒤 AIMAX와 열린 브라우저를 모두 닫고 설치하세요. 설치 후 실행기 연결을 다시 누르고 새 작업 1건만 테스트해주세요.",
    ),
    "v1052_update_verify": Guidance(
        category="v1052_update_verify",
        status="waiting_user",
        status_label="사용자 확인 필요",
        public_message="해당 오류는 Windows 실행기 v1.0.52 수정 묶음에 포함되어 배포되었습니다. 네이버 발행 버튼/이미지 배치/작업 진행 상태를 보강했습니다.",
        next_update_message="업데이트 탭에서 v1.0.52 설치 파일을 다시 설치하고 실행기를 재연결한 뒤, 키워드 1개와 임시저장 또는 이미지 1장 작업으로만 먼저 확인해주세요.",
    ),
    "staff_feedback_reviewing": Guidance(
        category="staff_feedback_reviewing",
        status="reviewing",
        status_label="확인 중",
        public_message="남겨주신 직원 피드백을 운영팀이 확인 중입니다. 기능 오류인지, 설정/사용량/계정 상태 문제인지 함께 분류합니다.",
        next_update_message="추가 조치가 확인되면 이 화면에 안내가 업데이트됩니다. 같은 증상은 여러 번 보내지 않아도 됩니다.",
    ),
}


def now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def parse_time(value: str) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.astimezone(UTC) if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def read_rows(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if not line.strip():
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def write_rows(path: Path, rows: list[dict[str, Any]]) -> None:
    tmp_path = path.with_name(f"{path.name}.tmp-{os.getpid()}")
    tmp_path.write_text("".join(f"{json.dumps(row, ensure_ascii=False)}\n" for row in rows), encoding="utf-8")
    tmp_path.replace(path)


def write_json(path: Path, data: dict[str, Any]) -> None:
    tmp_path = path.with_name(f"{path.name}.tmp-{os.getpid()}")
    tmp_path.write_text(f"{json.dumps(data, ensure_ascii=False, indent=2)}\n", encoding="utf-8")
    tmp_path.replace(path)


def append_ticket_status_update(data_dir: Path, ticket_id: str, report_id: str, status: str, updated_at: str, dry_run: bool) -> None:
    if not ticket_id or dry_run:
        return
    row = {
        "ticket_id": str(ticket_id),
        "source": "aimax_report_auto_guidance",
        "status": status,
        "report_id": str(report_id or ""),
        "updated_at": updated_at,
    }
    with (data_dir / "automation-tickets.jsonl").open("a", encoding="utf-8") as handle:
        handle.write(f"{json.dumps(row, ensure_ascii=False)}\n")


def ticket_status_for_report_status(status: str) -> str:
    if status == "done":
        return "done"
    if status == "waiting_user":
        return "waiting_user"
    if status == "working":
        return "working"
    return "open"


def latest_ticket_statuses(data_dir: Path) -> dict[str, str]:
    latest: dict[str, str] = {}
    for row in read_rows(data_dir / "automation-tickets.jsonl"):
        ticket_id = str(row.get("ticket_id") or "")
        if ticket_id:
            latest[ticket_id] = str(row.get("status") or "open")
    return latest


def backup(path: Path, suffix: str, backups: list[str], dry_run: bool) -> None:
    if dry_run or not path.exists():
        return
    backup_path = Path(f"{path}{suffix}")
    backup_path.write_bytes(path.read_bytes())
    backups.append(str(backup_path))


def report_path(data_dir: Path, row: dict[str, Any]) -> Path | None:
    date = str(row.get("date") or row.get("stored_at") or "")[:10]
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
        return None
    return data_dir / "reports" / date / f"{row.get('report_id')}.json"


def load_jobs_by_id(data_dir: Path) -> dict[str, dict[str, Any]]:
    jobs_path = data_dir / "jobs.json"
    if not jobs_path.exists():
        return {}
    try:
        payload = json.loads(jobs_path.read_text(encoding="utf-8", errors="replace"))
    except json.JSONDecodeError:
        return {}
    jobs = payload.get("jobs") if isinstance(payload, dict) else None
    if not isinstance(jobs, list):
        return {}
    return {str(job.get("id") or ""): job for job in jobs if isinstance(job, dict) and job.get("id")}


def combined_text(row: dict[str, Any], detail: dict[str, Any] | None) -> str:
    parts = [
        row.get("work_context"),
        row.get("visible_error"),
        row.get("feedback_improve"),
        row.get("job_stage"),
        row.get("job_failed_keyword"),
        row.get("public_message"),
        row.get("next_update_message"),
    ]
    if detail:
        parts += [
            detail.get("user_input", {}).get("work_context"),
            detail.get("user_input", {}).get("visible_error"),
            detail.get("user_input", {}).get("user_note"),
            json.dumps(detail.get("system", {}).get("jobs_recent", []), ensure_ascii=False),
        ]
    return " ".join(str(item or "") for item in parts).lower()


def report_issue_text(row: dict[str, Any]) -> str:
    return " ".join(
        str(row.get(key) or "")
        for key in ("work_context", "visible_error", "feedback_improve", "job_stage", "job_failed_keyword")
    ).lower()


def images_completed(job: dict[str, Any]) -> bool:
    images = (job.get("result") or {}).get("images") or {}
    attempted = int(images.get("attempted") or 0)
    inserted = int(images.get("inserted") or 0)
    generated = int(images.get("generated") or 0)
    failures = int(images.get("failure_count") or 0)
    return attempted > 0 and generated >= attempted and inserted >= attempted and failures == 0


def job_user_matches_report(job: dict[str, Any], row: dict[str, Any]) -> bool:
    report_user_id = str(row.get("account_user_id") or "")
    if not report_user_id:
        return True
    return str(job.get("user_id") or "") == report_user_id


def successful_yunmi_fallback_job(job: dict[str, Any], row: dict[str, Any], report_time: datetime, max_age: timedelta) -> bool:
    if str(job.get("kind") or "") != "yunmi_script" or str(job.get("status") or "") != "done":
        return False
    if not job_user_matches_report(job, row):
        return False
    result = job.get("result") or {}
    payload = job.get("payload") or {}
    if result.get("ok") is not True:
        return False
    if str(result.get("mode") or payload.get("mode") or "") != "no_paid_alpha":
        return False
    finished = parse_time(str(job.get("finished_at") or job.get("updated_at") or ""))
    return bool(finished and report_time <= finished <= report_time + max_age)


def successful_yunmi_fallback_after_report(
    row: dict[str, Any],
    detail: dict[str, Any] | None,
    jobs_by_id: dict[str, dict[str, Any]],
) -> bool:
    if "yunmi_ai_invalid_json" not in combined_text(row, detail):
        return False
    report_time = parse_time(str(row.get("stored_at") or row.get("server_received_at") or ""))
    if not report_time:
        return False
    max_age = timedelta(minutes=15)
    for job in (detail or {}).get("system", {}).get("jobs_recent") or []:
        if not isinstance(job, dict):
            continue
        if successful_yunmi_fallback_job(job, row, report_time, max_age):
            return True
    for job in jobs_by_id.values():
        if successful_yunmi_fallback_job(job, row, report_time, max_age):
            return True
    return False


def completion_guidance(row: dict[str, Any], detail: dict[str, Any] | None, jobs_by_id: dict[str, dict[str, Any]]) -> Guidance | None:
    if str(row.get("status") or "") in {"done"}:
        return None
    if successful_yunmi_fallback_after_report(row, detail, jobs_by_id):
        return GUIDANCE["yunmi_fallback_completed_after_report"]
    job_id = str(row.get("job_id") or "")
    job = jobs_by_id.get(job_id) if job_id else None
    if job and str(job.get("status") or "") == "done" and (job.get("result") or {}).get("ok") is True:
        if re.search(r"그림|이미지|image", report_issue_text(row), re.I) and images_completed(job):
            return GUIDANCE["job_completed_after_report"]
    return None


def still_failing_guidance(row: dict[str, Any]) -> Guidance | None:
    if str(row.get("status") or "") != "reviewing":
        return None
    if str(row.get("user_response") or "") != "still_failing":
        return None
    category = str(row.get("auto_guidance_category") or "")
    text = report_issue_text(row)
    if category == "web_login_failed" or re.search(r"로그인 실패.*웹앱|웹앱 이메일|비밀번호가 맞지", text, re.I):
        return GUIDANCE["web_login_failed_still_failing"]
    if category == "naver_login_required" or re.search(r"네이버.*로그인|2단계 인증|새 기기|내프로필|보안설정|이력관리", text, re.I):
        return GUIDANCE["naver_login_required_still_failing"]
    return None


def classify(row: dict[str, Any], detail: dict[str, Any] | None) -> Guidance | None:
    row_text = " ".join(
        str(row.get(key) or "")
        for key in ("work_context", "visible_error", "feedback_improve", "job_stage", "job_failed_keyword")
    ).lower()
    text = combined_text(row, detail)
    kind = str(row.get("report_kind") or "").lower()
    source = str(row.get("source") or "").lower()
    if kind == "feedback" or source == "staff_feedback":
        if str(row.get("status") or "") == "new":
            return GUIDANCE["staff_feedback_reviewing"]
        return None

    if str(row.get("status") or "") == "working" and "v1.0.52" in text:
        return GUIDANCE["v1052_update_verify"]

    row_first_rules: list[tuple[str, str]] = [
        ("web_login_failed", r"로그인 실패.*웹앱|웹앱 이메일|비밀번호가 맞지"),
        ("naver_login_required", r"네이버.*로그인|2단계 인증|새 기기|내프로필|보안설정|이력관리"),
        ("mac_gatekeeper", r"macos|개인정보 보호 및 보안|그래도 열기|open anyway|다시실행 하면 아무 반응"),
        ("image_paid_required", r"image_paid_reauired|image_paid_required|이미지.*유료|이미지.*사용불가|이미지 모델"),
        ("model_not_found", r"model_not_found|unsupported model|모델.*잘못|모델.*사용할 수 없|ai모델 사용불가"),
        ("runner_update_required", r"update_required|필수 업데이트|최신.*설치|구버전|실행기.*업데이트"),
    ]
    for key, pattern in row_first_rules:
        if re.search(pattern, row_text, re.I):
            return GUIDANCE[key]

    rules: list[tuple[str, str]] = [
        ("image_paid_required", r"image_paid_reauired|image_paid_required|이미지.*유료|이미지.*사용불가|이미지 모델"),
        ("api_key_missing", r"api[_ -]?key.*missing|key_missing|no api key|no api key was provided|키가.*없|키.*저장.*필요|api.*저장.*안"),
        ("api_key_invalid", r"api_key_invalid|invalid api key|api key not valid|인증 실패|키 인증 실패|unauthorized"),
        ("quota_exceeded", r"quota_exceeded|insufficient_quota|billing|payment|credit|balance|크레딧|결제|요금제 한도|한도 초과"),
        ("rate_limited", r"rate_limited|rate limit|resource_exhausted|429|무료 사용량|분당|일일 한도"),
        ("model_not_found", r"model_not_found|unsupported model|모델.*잘못|모델.*사용할 수 없|ai모델 사용불가"),
        ("provider_transient", r"provider_transient|temporar|unavailable|overloaded|일시적 오류|잠시 후"),
        ("web_login_failed", r"로그인 실패.*웹앱|웹앱 이메일|비밀번호가 맞지"),
        ("naver_login_required", r"네이버.*로그인|2단계 인증|새 기기|내프로필|보안설정|이력관리"),
        ("mac_gatekeeper", r"macos|개인정보 보호 및 보안|그래도 열기|open anyway|다시실행 하면 아무 반응"),
        ("runner_update_required", r"update_required|필수 업데이트|최신.*설치|구버전|실행기.*업데이트"),
    ]
    for key, pattern in rules:
        if re.search(pattern, text, re.I):
            return GUIDANCE[key]

    return None


def should_touch(row: dict[str, Any], guidance: Guidance, min_age: timedelta) -> bool:
    if str(row.get("status") or "") in {"done", "waiting_user"}:
        return False
    if str(row.get("auto_guidance_category") or "") == guidance.category:
        return False
    updated_at = parse_time(str(row.get("status_updated_at") or row.get("stored_at") or ""))
    if updated_at and datetime.now(UTC) - updated_at < min_age:
        return False
    return True


def apply_guidance_to_report(report: dict[str, Any], guidance: Guidance, updated_at: str) -> None:
    support = dict(report.get("support") or {})
    support.update(
        {
            "status": guidance.status,
            "status_label": guidance.status_label,
            "public_message": guidance.public_message,
            "next_update_message": guidance.next_update_message,
            "updated_at": updated_at,
            "auto_guidance_category": guidance.category,
            "auto_guidance_source": "aimax_report_auto_guidance",
        }
    )
    report["support"] = support


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Apply user-facing report guidance")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--min-age-minutes", type=int, default=15)
    parser.add_argument("--lookback-days", type=int, default=14)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    data_dir = args.data_dir
    index_path = data_dir / "reports-index.jsonl"
    rows = read_rows(index_path)
    now = datetime.now(UTC)
    min_age = timedelta(minutes=max(0, args.min_age_minutes))
    lookback = timedelta(days=max(1, args.lookback_days))
    updated_at = now_iso()
    suffix = f".bak-{updated_at.replace('-', '').replace(':', '').replace('.', '').replace('Z', '')[:14]}-auto-guidance"
    backups: list[str] = []
    touched: list[dict[str, Any]] = []
    synced_tickets: list[dict[str, Any]] = []
    latest_tickets = latest_ticket_statuses(data_dir)
    jobs_by_id = load_jobs_by_id(data_dir)

    backup(index_path, suffix, backups, args.dry_run)
    for row in rows:
        stored_at = parse_time(str(row.get("stored_at") or ""))
        if stored_at and now - stored_at > lookback:
            continue
        status = str(row.get("status") or "")
        ticket_id = str(row.get("automation_ticket_id") or "")
        if status in {"done", "waiting_user", "working"} and ticket_id:
            expected_ticket_status = ticket_status_for_report_status(status)
            current_ticket_status = latest_tickets.get(ticket_id, "")
            if current_ticket_status in {"open", "new", "working"} and current_ticket_status != expected_ticket_status:
                append_ticket_status_update(
                    data_dir,
                    ticket_id,
                    str(row.get("report_id") or ""),
                    status,
                    updated_at,
                    args.dry_run,
                )
                latest_tickets[ticket_id] = expected_ticket_status
                synced_tickets.append(
                    {
                        "ticket_id": ticket_id,
                        "report_id": row.get("report_id"),
                        "previous_status": current_ticket_status,
                        "next_status": expected_ticket_status,
                    }
                )
        if status not in {"new", "reviewing", "working"}:
            continue
        path = report_path(data_dir, row)
        detail = None
        if path and path.exists():
            try:
                detail = json.loads(path.read_text(encoding="utf-8", errors="replace"))
            except json.JSONDecodeError:
                detail = None
        guidance = completion_guidance(row, detail, jobs_by_id) or still_failing_guidance(row) or classify(row, detail)
        if not guidance or not should_touch(row, guidance, min_age):
            continue

        previous = status
        row.update(
            {
                "status": guidance.status,
                "status_updated_at": updated_at,
                "status_label": guidance.status_label,
                "public_message": guidance.public_message,
                "next_update_message": guidance.next_update_message,
                "auto_guidance_category": guidance.category,
            }
        )
        if detail is not None and path:
            backup(path, suffix, backups, args.dry_run)
            apply_guidance_to_report(detail, guidance, updated_at)
            if not args.dry_run:
                write_json(path, detail)
        append_ticket_status_update(
            data_dir,
            str(row.get("automation_ticket_id") or (detail or {}).get("support", {}).get("automation_ticket_id") or ""),
            str(row.get("report_id") or ""),
            guidance.status,
            updated_at,
            args.dry_run,
        )
        touched.append(
            {
                "report_id": row.get("report_id"),
                "category": guidance.category,
                "previous_status": previous,
                "next_status": guidance.status,
            }
        )

    if touched and not args.dry_run:
        write_rows(index_path, rows)
    print(
        json.dumps(
            {
                "ok": True,
                "dry_run": args.dry_run,
                "updated_at": updated_at,
                "touched_count": len(touched),
                "touched": touched,
                "synced_ticket_count": len(synced_tickets),
                "synced_tickets": synced_tickets,
                "backups": backups,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
