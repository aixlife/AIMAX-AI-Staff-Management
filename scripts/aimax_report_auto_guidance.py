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
    "image_paid_required_saved_as_draft": Guidance(
        category="image_paid_required_saved_as_draft",
        status="waiting_user",
        status_label="사용자 확인 필요",
        public_message=(
            "최근 예리 작업은 본문 생성 뒤 네이버 임시저장까지 완료됐지만, 요청한 이미지가 현재 Gemini 이미지 모델 권한/요금제에서 생성되지 않아 "
            "공개 발행 또는 예약 발행 대신 안전하게 임시저장으로 전환되었습니다."
        ),
        next_update_message=(
            "네이버 블로그 임시저장함에서 글이 저장됐는지 먼저 확인해주세요. 이미지까지 자동 첨부하려면 설정 > AI/API 연결에서 이미지 생성 가능한 키/모델을 "
            "확인한 뒤 이미지 1장으로 새 작업 1건만 테스트해주세요. 급하면 이미지 0장으로 발행을 진행할 수 있습니다."
        ),
    ),
    "image_generation_failed": Guidance(
        category="image_generation_failed",
        status="waiting_user",
        status_label="사용자 확인 필요",
        public_message=(
            "본문은 생성됐지만 이미지 생성 또는 네이버 이미지 첨부가 완료되지 않아 작업이 중단되었습니다. "
            "생성된 원고는 로컬 실행기의 generated 폴더에 보존됩니다."
        ),
        next_update_message=(
            "이미지 0장 또는 1장으로 새 작업 1건만 다시 시도해주세요. 같은 문제가 반복되면 이미지 모델/API 권한을 확인하고, "
            "generated 폴더의 원고와 이미지 파일을 수동으로 붙여넣을 수 있습니다."
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
    # 2026-07-21: 기본값(gemini-2.5-flash)이 제공자 쪽에서 내려간 상황에서는 "기본 모델로
    # 전환" 안내가 같은 실패로 되돌아온다. 사용자 확인이 아니라 운영팀 조치 건으로 잡는다.
    "model_not_found": Guidance(
        category="model_not_found",
        status="reviewing",
        status_label="확인 중",
        public_message="선택한 AI 모델을 제공자가 더 이상 지원하지 않아 작업이 중단되었습니다. 사용자 설정 문제가 아니라 AIMAX가 모델 목록을 갱신해야 하는 건으로 접수되었습니다.",
        next_update_message="AIMAX에서 사용 가능한 모델로 교체하는 중입니다. 교체가 끝나면 이 화면에 안내가 업데이트되며, 그 뒤 새 작업 1건만 다시 시도해주세요. 같은 증상은 여러 번 보내지 않아도 됩니다.",
    ),
    "organization_verification_required": Guidance(
        category="organization_verification_required",
        status="waiting_user",
        status_label="사용자 확인 필요",
        public_message="OpenAI 이미지 모델 사용에 필요한 조직 인증 또는 모델 권한이 완료되지 않아 이미지 생성이 중단되었습니다.",
        next_update_message="OpenAI 개발자 콘솔에서 조직 인증과 이미지 모델 사용 권한을 확인한 뒤, 이미지 1장짜리 새 작업 1건만 다시 시도해주세요. 급하면 이미지 0장으로 먼저 글쓰기만 진행할 수 있습니다.",
    ),
    "provider_transient": Guidance(
        category="provider_transient",
        status="waiting_user",
        status_label="사용자 확인 필요",
        public_message="AI 제공자 서버가 일시적으로 응답하지 않아 실패한 건입니다. 코드나 실행기 고장보다는 외부 제공자 일시 장애 가능성이 큽니다.",
        next_update_message="같은 작업을 여러 번 반복하지 말고 10~30분 뒤 새 작업 1건만 다시 시도해주세요. 반복되면 이 접수 ID로 다시 알려주세요.",
    ),
    "ai_response_invalid": Guidance(
        category="ai_response_invalid",
        status="waiting_user",
        status_label="사용자 확인 필요",
        public_message=(
            "AI가 생성한 응답을 글 형식으로 해석하지 못해 글 생성 단계에서 중단되었습니다. "
            "실행기나 API 키 문제가 아니라 선택한 AI 모델의 응답 형식 문제로, 같은 모델에서 반복될 수 있습니다."
        ),
        next_update_message=(
            "설정 > AI/API 연결에서 모델을 AIMAX 기본 모델 또는 다른 모델로 바꾸거나, 잠시 뒤 새 작업 1건만 다시 시도해주세요. "
            "같은 모델에서 반복되면 이 접수 ID로 알려주세요."
        ),
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
    "bundle_integrity_mismatch": Guidance(
        category="bundle_integrity_mismatch",
        status="waiting_user",
        status_label="사용자 확인 필요",
        public_message=(
            "Windows AIMAX 실행기 설치 파일 일부가 설치 후 달라졌거나 손상되어 시작 전 안전 검사를 통과하지 못했습니다. "
            "작업 데이터나 AI 키 문제가 아니라 로컬 실행기 파일 상태 확인이 필요한 케이스입니다."
        ),
        next_update_message=(
            "AIMAX와 열린 브라우저를 모두 닫고, 웹앱 업데이트 탭에서 공식 Windows 통합 설치 파일을 다시 받아 설치해주세요. "
            "Windows 보안 또는 백신 보호 기록에서 AIMAX 파일 격리/차단 내역이 있으면 복원 또는 허용한 뒤 실행기 연결을 다시 눌러주세요."
        ),
    ),
    "browser_driver_policy_blocked": Guidance(
        category="browser_driver_policy_blocked",
        status="waiting_user",
        status_label="사용자 확인 필요",
        public_message="Windows 보안 또는 회사 보안 정책이 브라우저 드라이버 실행을 차단해 네이버 글쓰기 브라우저를 시작하지 못했습니다.",
        next_update_message="Windows 보안 > 보호 기록 또는 사용 중인 보안 프로그램에서 chromedriver/undetected_chromedriver/AIMAX 차단 내역을 허용 또는 복원한 뒤, AIMAX와 Chrome을 모두 닫고 새 작업 1건만 다시 시도해주세요.",
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


# 자유 텍스트 분류 입력. 두 가지를 의도적으로 제외한다:
# (1) jobs_recent JSON 전체 덤프 — 잡의 정형 코드는 classify_structured_job 이 1순위로
#     처리하고, 과거 잡 문구가 섞이면 무관한 키워드로 오분류된다(041852 사례).
# (2) 보고의 이전 안내 문구(public_message/next_update_message) — 이건 지난 분류의 '출력'이라
#     재분류 입력에 넣으면 옛 오분류가 스스로를 강화하는 피드백 루프가 된다. 예: 잘못 붙은
#     mac_gatekeeper 메시지의 "최신 macOS 설치 파일을 다시 설치" 가 runner_update 로 재오분류
#     (628 지은 채용 보고 사례). 분류는 사용자 신호(work_context/visible_error 등)로만.
def combined_text(row: dict[str, Any], detail: dict[str, Any] | None) -> str:
    parts = [
        row.get("work_context"),
        row.get("visible_error"),
        row.get("feedback_improve"),
        row.get("job_stage"),
        row.get("job_failed_keyword"),
    ]
    if detail:
        parts += [
            detail.get("user_input", {}).get("work_context"),
            detail.get("user_input", {}).get("visible_error"),
            detail.get("user_input", {}).get("user_note"),
        ]
    return " ".join(str(item or "") for item in parts).lower()


def report_recent_jobs(detail: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not isinstance(detail, dict):
        return []
    system = detail.get("system") if isinstance(detail.get("system"), dict) else {}
    agent = system.get("agent") if isinstance(system.get("agent"), dict) else {}
    agent_context = detail.get("agent_context") if isinstance(detail.get("agent_context"), dict) else {}
    for candidate in (agent.get("jobs_recent"), system.get("jobs_recent"), agent_context.get("jobs_recent"), detail.get("jobs_recent")):
        if isinstance(candidate, list):
            return [job for job in candidate if isinstance(job, dict)]
    return []


# 연결 잡의 정형 신호(머신 코드 + 서버/러너 고정 문구) 1순위 룰. server.js 의
# REPORT_STRUCTURED_JOB_GUIDANCE_RULES 와 의미를 맞춘다. 여기 매칭되면 자유 텍스트 룰은 건너뛴다.
STRUCTURED_JOB_RULES: list[tuple[str, str]] = [
    ("ai_response_invalid", r"invalid_json|server_generation_invalid_response|empty_content|응답을 글 형식으로 해석하지 못했"),
    ("bundle_integrity_mismatch", r"bundle_integrity|startup bundle integrity"),
    ("browser_driver_policy_blocked", r"browser_start|chromedriver|undetected_chromedriver|application control policy|애플리케이션 제어 정책|winerror 4551"),
    ("api_key_missing", r"key_missing|no api key|api 키가 없습니다|키가 없습니다"),
    ("api_key_invalid", r"server_generation_auth_failed|api_key_invalid|invalid api key|invalid x-api-key|api 키 인증"),
    ("quota_exceeded", r"server_generation_quota_exceeded|quota_exceeded|insufficient_quota|billing|payment|balance|out of credit|결제|크레딧"),
    ("rate_limited", r"server_generation_rate_limited|rate.?limit|resource_exhausted|429"),
    ("model_not_found", r"server_generation_model_not_found|model_not_found|unsupported model"),
    ("organization_verification_required", r"organization_verification_required|verify your organization|must be verified"),
    ("image_paid_required", r"image_paid_required|image_paid_reauired"),
    ("image_generation_failed", r"image_generation_failed|image_upload_failed|image_uploaded_but_not_inserted|이미지 생성 실패|이미지 생성용 로컬 api 키가 없어"),
    ("naver_login_required", r"naver_login|captcha|nid 로그인|로그인 실패: 아이디 또는 비밀번호|2단계 인증|인증 화면|로그인 페이지에 머무"),
    ("runner_update_required", r"update_required|runner_start_timeout|runner_start_not_reported|runner_stopped_heartbeating|local_worker_not_started_after_claim|local_ui_queue_not_processed_after_claim|local_worker_progress_stalled"),
    ("provider_transient", r"server_generation_provider_transient|provider_transient|server_generation_timeout|server_generation_interrupted|overloaded|unavailable|temporar"),
]


# jobs_recent 는 롤링 윈도우라 보고와 무관한 며칠~몇 주 전 잡이 섞인다. 낡은 잡의 정형
# 코드로 최신 보고를 분류하면 오귀속된다(7/3 "실행기 연결 안 됨" 보고에 6/16 api-key 잡).
# → 보고 접수 시각 기준 72h 창 안의 잡만 정형 신호로 신뢰한다. server.js 와 동일 정책.
STRUCTURED_JOB_RECENCY = timedelta(hours=72)
STRUCTURED_JOB_FUTURE_SKEW = timedelta(hours=1)


def report_received_time(row: dict[str, Any], detail: dict[str, Any] | None) -> datetime | None:
    for value in (
        row.get("stored_at"),
        (detail or {}).get("server_received_at"),
        row.get("status_updated_at"),
    ):
        parsed = parse_time(str(value or ""))
        if parsed:
            return parsed
    return None


def job_time(job: dict[str, Any]) -> datetime | None:
    for value in (job.get("finished_at"), job.get("updated_at"), job.get("created_at")):
        parsed = parse_time(str(value or ""))
        if parsed:
            return parsed
    return None


def recent_jobs_for_report(jobs: list[dict[str, Any]], report_time: datetime | None) -> list[dict[str, Any]]:
    # 보고 시각을 못 구하면 낡은-잡 오귀속 위험이 커 보수적으로 빈 리스트(자유텍스트 폴백).
    if not jobs or report_time is None:
        return []
    lower = report_time - STRUCTURED_JOB_RECENCY
    upper = report_time + STRUCTURED_JOB_FUTURE_SKEW
    out = []
    for job in jobs:
        t = job_time(job)
        if t and lower <= t <= upper:
            out.append(job)
    return out


def structured_job_signal(row: dict[str, Any], detail: dict[str, Any] | None, jobs_by_id: dict[str, dict[str, Any]]) -> str:
    # 후보 잡: (1) 서버 스냅샷(job_ids 매칭만 — account_recent 추정 조인은 오귀속 위험으로 제외)
    # (2) 클라이언트 jobs_recent (가능하면 jobs.json 의 최신 행으로 치환)
    jobs: list[dict[str, Any]] = []
    snapshot = (detail or {}).get("server_job_snapshot") or {}
    if snapshot.get("matched_by") == "job_ids" and isinstance(snapshot.get("jobs"), list):
        jobs = [job for job in snapshot["jobs"] if isinstance(job, dict)]
    if not jobs:
        for job in report_recent_jobs(detail):
            fresh = jobs_by_id.get(str(job.get("id") or job.get("job_id") or ""))
            jobs.append(fresh if fresh else job)
    if not jobs:
        row_job = jobs_by_id.get(str(row.get("job_id") or ""))
        if row_job and job_user_matches_report(row_job, row):
            jobs = [row_job]
    jobs = recent_jobs_for_report(jobs, report_received_time(row, detail))
    if not jobs:
        return ""
    primary = next((job for job in jobs if str(job.get("status") or "") in {"failed", "cancelled"}), jobs[0])
    result = primary.get("result") if isinstance(primary.get("result"), dict) else {}
    logs = primary.get("logs") if isinstance(primary.get("logs"), list) else []
    last_error_log = next((log for log in reversed(logs) if isinstance(log, dict) and log.get("level") == "error"), None)
    last_log = primary.get("last_log") if isinstance(primary.get("last_log"), dict) else {}
    diagnostic = primary.get("diagnostic") if isinstance(primary.get("diagnostic"), dict) else {}
    parts = [
        result.get("detail_code"),
        result.get("error"),
        primary.get("failed_stage") or result.get("stage"),
        primary.get("failed_reason"),
        result.get("visible_error"),
        diagnostic.get("code"),
        (last_error_log or {}).get("message") or (last_log.get("message") if last_log.get("level") == "error" else ""),
    ]
    return " ".join(str(item or "") for item in parts if item).lower()


def classify_structured_job(row: dict[str, Any], detail: dict[str, Any] | None, jobs_by_id: dict[str, dict[str, Any]]) -> Guidance | None:
    signal = structured_job_signal(row, detail, jobs_by_id)
    if not signal:
        return None
    for key, pattern in STRUCTURED_JOB_RULES:
        if re.search(pattern, signal, re.I):
            return GUIDANCE[key]
    return None


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


def image_paid_required_saved_as_draft(job: dict[str, Any]) -> bool:
    result = job.get("result") or {}
    if str(job.get("kind") or "") != "yeri_write":
        return False
    if str(job.get("status") or "") != "done" or result.get("ok") is not True:
        return False
    images = result.get("images") or {}
    attempted = int(images.get("attempted") or 0)
    inserted = int(images.get("inserted") or 0)
    failures = images.get("failures") if isinstance(images.get("failures"), list) else []
    if attempted <= 0 or inserted > 0:
        return False
    if not (
        images.get("mode_overridden_to_save") is True
        or str(result.get("mode") or "") == "save"
        or any(str((post or {}).get("mode") or "") == "save" for post in result.get("posts") or [])
    ):
        return False
    return any(str(item.get("error_code") or item.get("error") or "") == "image_paid_required" for item in failures if isinstance(item, dict))


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
    yunmi_text = combined_text(row, detail) + " " + json.dumps(report_recent_jobs(detail), ensure_ascii=False).lower()
    if "yunmi_ai_invalid_json" not in yunmi_text:
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
        if image_paid_required_saved_as_draft(job):
            return GUIDANCE["image_paid_required_saved_as_draft"]
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
    if is_browser_driver_policy_blocked(text):
        return GUIDANCE["browser_driver_policy_blocked"]
    if category == "web_login_failed" or re.search(r"로그인 실패.*웹앱|웹앱 이메일|비밀번호가 맞지", text, re.I):
        return GUIDANCE["web_login_failed_still_failing"]
    if category == "naver_login_required" or re.search(r"네이버.*로그인|2단계 인증|새 기기|내프로필|보안설정|이력관리", text, re.I):
        return GUIDANCE["naver_login_required_still_failing"]
    return None


def is_browser_driver_policy_blocked(text: str) -> bool:
    return bool(
        re.search(r"browser_start|브라우저 시작|chromedriver|undetected_chromedriver|애플리케이션 제어 정책|application control policy|winerror 4551", text, re.I)
        and re.search(r"차단|blocked|정책|policy|chromedriver|driver", text, re.I)
    )


def is_bundle_integrity_mismatch(text: str) -> bool:
    return bool(
        re.search(r"bundle.*integrity|integrity.*mismatch|startup bundle integrity|무결성", text, re.I)
        and re.search(r"mismatch|failed|손상|불일치|검사", text, re.I)
    )


# mac_gatekeeper 에서 bare "macos" 제외(모든 맥 보고 오분류 — 6/28 지은 보고 사례),
# runner_update_required 를 naver_login 앞으로(업데이트 안내문 속 "네이버 자동 로그인이
# 빨라지고" 릴리스 노트 문구 오분류 — 7/7 맥 고착 보고 사례).
MAC_GATEKEEPER_PATTERN = r"개인정보 보호 및 보안|그래도 열기|open anyway|다시실행 하면 아무 반응|확인되지 않은 개발자|손상되었기 때문에 열 수 없"


def classify(row: dict[str, Any], detail: dict[str, Any] | None, jobs_by_id: dict[str, dict[str, Any]] | None = None) -> Guidance | None:
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

    structured = classify_structured_job(row, detail, jobs_by_id or {})
    if structured:
        return structured

    if str(row.get("status") or "") == "working" and "v1.0.52" in text:
        return GUIDANCE["v1052_update_verify"]

    row_first_rules: list[tuple[str, str]] = [
        ("bundle_integrity_mismatch", r"bundle.*integrity|integrity.*mismatch|startup bundle integrity|무결성"),
        ("browser_driver_policy_blocked", r"browser_start|브라우저 시작|chromedriver|undetected_chromedriver|애플리케이션 제어 정책|application control policy|winerror 4551"),
        ("runner_update_required", r"update_required|필수 업데이트|최신.*설치|구버전|실행기.*업데이트"),
        ("web_login_failed", r"로그인 실패.*웹앱|웹앱 이메일|비밀번호가 맞지"),
        ("naver_login_required", r"네이버.*로그인|2단계 인증|새 기기|내프로필|보안설정|이력관리"),
        ("mac_gatekeeper", MAC_GATEKEEPER_PATTERN),
        ("image_paid_required", r"image_paid_reauired|image_paid_required|이미지.*유료|이미지.*사용불가|이미지 모델"),
        ("image_generation_failed", r"image_generation_failed|이미지 생성 실패|이미지.*0장|요청 \d+장 중 0장|image_upload_failed|image_uploaded_but_not_inserted"),
        ("organization_verification_required", r"organization_verification_required|organization verification|verify your organization|must be verified|조직 인증"),
        ("model_not_found", r"model_not_found|unsupported model|모델.*잘못|모델.*사용할 수 없|ai모델 사용불가"),
    ]
    for key, pattern in row_first_rules:
        if key == "bundle_integrity_mismatch" and is_bundle_integrity_mismatch(row_text):
            return GUIDANCE[key]
        if key != "bundle_integrity_mismatch" and re.search(pattern, row_text, re.I):
            return GUIDANCE[key]

    rules: list[tuple[str, str]] = [
        ("bundle_integrity_mismatch", r"bundle.*integrity|integrity.*mismatch|startup bundle integrity|무결성"),
        ("browser_driver_policy_blocked", r"browser_start|브라우저 시작|chromedriver|undetected_chromedriver|애플리케이션 제어 정책|application control policy|winerror 4551"),
        ("image_paid_required", r"image_paid_reauired|image_paid_required|이미지.*유료|이미지.*사용불가|이미지 모델"),
        ("image_generation_failed", r"image_generation_failed|이미지 생성 실패|이미지.*0장|요청 \d+장 중 0장|image_upload_failed|image_uploaded_but_not_inserted"),
        ("api_key_missing", r"api[_ -]?key.*missing|key_missing|no api key|no api key was provided|키가.*없|키.*저장.*필요|api.*저장.*안"),
        ("api_key_invalid", r"api_key_invalid|invalid api key|api key not valid|인증 실패|키 인증 실패|unauthorized"),
        ("quota_exceeded", r"quota_exceeded|insufficient_quota|billing|payment|credit|balance|크레딧|결제|요금제 한도|한도 초과"),
        ("rate_limited", r"rate_limited|rate limit|resource_exhausted|429|무료 사용량|분당|일일 한도"),
        ("organization_verification_required", r"organization_verification_required|organization verification|verify your organization|must be verified|조직 인증"),
        ("model_not_found", r"model_not_found|unsupported model|모델.*잘못|모델.*사용할 수 없|ai모델 사용불가"),
        ("provider_transient", r"provider_transient|temporar|unavailable|overloaded|일시적 오류|잠시 후"),
        ("web_login_failed", r"로그인 실패.*웹앱|웹앱 이메일|비밀번호가 맞지"),
        ("runner_update_required", r"update_required|필수 업데이트|최신.*설치|구버전|실행기.*업데이트"),
        ("naver_login_required", r"네이버.*로그인|2단계 인증|새 기기|내프로필|보안설정|이력관리"),
        ("mac_gatekeeper", MAC_GATEKEEPER_PATTERN),
    ]
    for key, pattern in rules:
        if key == "bundle_integrity_mismatch" and is_bundle_integrity_mismatch(text):
            return GUIDANCE[key]
        if key != "bundle_integrity_mismatch" and re.search(pattern, text, re.I):
            return GUIDANCE[key]

    return None


AUTO_GUIDANCE_SOURCES = {"handleReport", "aimax_report_auto_guidance"}


def report_auto_managed(row: dict[str, Any], detail: dict[str, Any] | None) -> bool:
    # 이 보고의 현재 안내가 자동 분류(handleReport / 스윕)로 설정된 것인지.
    # index 행에 category 가 있거나, detail.support.auto_guidance_source 가 자동 소스면 True.
    if str(row.get("auto_guidance_category") or ""):
        return True
    source = str(((detail or {}).get("support") or {}).get("auto_guidance_source") or "")
    return source in AUTO_GUIDANCE_SOURCES


def should_touch(row: dict[str, Any], guidance: Guidance, min_age: timedelta, detail: dict[str, Any] | None = None) -> bool:
    if str(row.get("status") or "") == "done":
        return False
    if str(row.get("auto_guidance_category") or "") == guidance.category:
        return False
    # waiting_user 인데 자동 안내 흔적이 전혀 없으면 운영자 수동설정으로 보고 건드리지 않는다.
    # 단 handleReport 로 자동 분류됐지만 index 에 category 가 안 남은 과거 보고(041852·628)는
    # detail.support.auto_guidance_source 로 자동설정을 식별해 재분류를 허용한다.
    if str(row.get("status") or "") == "waiting_user" and not report_auto_managed(row, detail):
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
        if status not in {"new", "reviewing", "working", "waiting_user"}:
            continue
        path = report_path(data_dir, row)
        detail = None
        if path and path.exists():
            try:
                detail = json.loads(path.read_text(encoding="utf-8", errors="replace"))
            except json.JSONDecodeError:
                detail = None
        guidance = completion_guidance(row, detail, jobs_by_id) or still_failing_guidance(row) or classify(row, detail, jobs_by_id)
        if not guidance or not should_touch(row, guidance, min_age, detail):
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
