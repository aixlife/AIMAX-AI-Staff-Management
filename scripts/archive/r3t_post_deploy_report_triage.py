#!/usr/bin/env python3
"""R3-T post-deploy report triage for AIMAX production reports."""

from __future__ import annotations

import datetime as _dt
import json
import os
import shutil
from pathlib import Path


DATA_DIR = Path(os.environ.get("AIMAX_REPORT_DATA_DIR", "/home/ubuntu/aimax-reports/data"))
REPORTS_DIR = DATA_DIR / "reports"
INDEX_PATH = DATA_DIR / "reports-index.jsonl"
DRY_RUN = os.environ.get("DRY_RUN", "").lower() in {"1", "true", "yes"}

WINDOWS_CURRENT = "v1.0.30"
MAC_CURRENT = "v1.0.17"

STATUS_LABEL = {
    "waiting_user": "사용자 확인 필요",
    "done": "완료",
    "reviewing": "검토 중",
}


def utc_now() -> str:
    return _dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


WINDOWS_INSTALL_MESSAGE = (
    f"R3-T 배포로 Windows 통합 실행기 {WINDOWS_CURRENT}가 운영에 반영되었습니다. "
    "설치창이 보이지 않거나 설치 후 실행기가 안 보이던 경로를 보강했고, "
    "Windows 실제 환경에서 설치 진행 화면, aimax:// 등록, 실행기 연결, 설정 열기, production 연결 상태가 통과했습니다."
)
WINDOWS_INSTALL_NEXT = (
    "웹앱을 새로고침한 뒤 업데이트 탭에서 AIMAX 통합 Windows 설치 파일을 새로 받아 설치해주세요. "
    "설치 전 AIMAX와 열린 Chrome/Whale/Naver 창을 모두 닫고, 설치 후 실행기를 다시 연결해주세요. "
    "같은 단계에서 다시 막히면 이 화면에서 \"아직 안 돼요\"를 눌러주세요. 유료 글쓰기 작업은 반복 실행하지 마세요."
)

WINDOWS_CONTENT_MESSAGE = (
    f"R3-T 배포로 Windows 통합 실행기 {WINDOWS_CURRENT}가 운영에 반영되었습니다. "
    "실행기 시작/연결/설정창 가시성과 작업 시작 감시가 최신 빌드에서 보강됐습니다. "
    "단, Gemini quota/API 키 문제는 설치만으로 해결되지 않을 수 있습니다."
)
WINDOWS_CONTENT_NEXT = (
    "최신 Windows 설치 파일로 업데이트한 뒤 먼저 키워드 1개, 이미지 0~1장, 임시저장으로만 확인해주세요. "
    "provider quota 또는 API 키 오류가 다시 보이면 같은 유료 작업을 반복하지 말고 오류 보고를 보내주세요."
)

WINDOWS_IMAGE_MESSAGE = (
    f"R3-T 배포로 Windows 통합 실행기 {WINDOWS_CURRENT}가 운영에 반영되었습니다. "
    "네이버 Smart Editor 본문/이미지 삽입과 이미지 1장 임시저장 실제 테스트가 이전 게이트에서 통과했고, "
    "이번 배포에서는 설치/실행기 연결 가시성까지 보강했습니다."
)
WINDOWS_IMAGE_NEXT = (
    "최신 Windows 설치 파일로 업데이트한 뒤 키워드 1개, 이미지 1장, 임시저장으로만 한 번 확인해주세요. "
    "글 생성 뒤 멈춘 경우 비용이 발생했을 수 있으니 같은 키워드 유료 재시도는 반복하지 말고, 실패하면 이 화면에서 \"아직 안 돼요\"를 눌러주세요."
)

SMARTSCREEN_MESSAGE = (
    f"현재 최신 Windows 통합 설치 파일은 {WINDOWS_CURRENT}입니다. "
    "Microsoft Defender SmartScreen이 새 설치 파일을 인식하지 못해 차단할 수 있지만, "
    "이것은 파일 손상 오류가 아니라 Windows 신뢰도/서명 안내입니다."
)
SMARTSCREEN_NEXT = (
    "업데이트 탭에서 최신 Windows 설치 파일을 받은 뒤 SmartScreen 창이 나오면 \"추가 정보\"를 누르고 \"실행\"을 선택해주세요. "
    "회사 보안 정책상 실행 버튼이 보이지 않으면 카카오채널에 이 접수 ID를 알려주세요."
)

WINDOWS_OPEN_SETTINGS_MESSAGE = (
    f"Windows 실행기 {WINDOWS_CURRENT}에서 로컬 설정 열기와 실행기 연결 가시성을 다시 검증했습니다. "
    "설정창이 뒤에 숨어 있거나 완료 응답이 늦는 경우가 있어도 작업 표시줄의 AIMAX 창을 확인할 수 있도록 안내가 보강되었습니다."
)
WINDOWS_OPEN_SETTINGS_NEXT = (
    "웹앱을 새로고침하고 최신 Windows 설치 파일로 업데이트한 뒤, 설정 탭의 \"로컬 설정 열기\"를 다시 눌러주세요. "
    "창이 바로 앞에 안 보이면 작업 표시줄의 AIMAX 창을 확인하고, 저장 후에도 같은 오류가 반복되면 \"아직 안 돼요\"를 눌러주세요."
)

LOCAL_SETTINGS_CANCELLED_MESSAGE = (
    "오류 보고 내용상 로컬 보안 설정 저장이 사용자 취소로 종료된 케이스로 확인했습니다. "
    f"실행기 {WINDOWS_CURRENT} 연결 자체는 감지되어 앱 장애라기보다 설정 저장을 다시 완료해야 하는 상태입니다."
)
LOCAL_SETTINGS_CANCELLED_NEXT = (
    "설정 탭에서 \"로컬 설정 열기\"를 다시 누른 뒤 필요한 값을 확인하고 저장까지 완료해주세요. "
    "의도적으로 취소한 것이 아니라 저장 버튼을 눌렀는데도 취소로 보이면 \"아직 안 돼요\"를 눌러주세요."
)

QUEUE_DONE_MESSAGE = "해당 작업 멈춤 문제는 서버 작업 큐 라우팅 수정, runner-start watchdog, 실제 사용자 흐름 통과로 운영 조치가 완료되었습니다."
QUEUE_DONE_NEXT = "새 작업에서 같은 현상이 반복될 때만 새 오류 보고를 보내주세요."

EXPLICIT: dict[str, tuple[str, str, str]] = {
    "AIMAX-RPT-20260522185718-6fe2df2a": ("done", QUEUE_DONE_MESSAGE, QUEUE_DONE_NEXT),
    "AIMAX-RPT-20260523092205-4a3c9f05": ("waiting_user", SMARTSCREEN_MESSAGE, SMARTSCREEN_NEXT),
    "AIMAX-RPT-20260527154717-2f9f8f86": ("waiting_user", WINDOWS_INSTALL_MESSAGE, WINDOWS_INSTALL_NEXT),
    "AIMAX-RPT-20260528002749-3f6dd074": ("waiting_user", WINDOWS_OPEN_SETTINGS_MESSAGE, WINDOWS_OPEN_SETTINGS_NEXT),
    "AIMAX-RPT-20260528003005-3e18f9d1": ("waiting_user", WINDOWS_OPEN_SETTINGS_MESSAGE, WINDOWS_OPEN_SETTINGS_NEXT),
    "AIMAX-RPT-20260528005841-aa3afc1d": ("waiting_user", LOCAL_SETTINGS_CANCELLED_MESSAGE, LOCAL_SETTINGS_CANCELLED_NEXT),
    "AIMAX-RPT-20260516091042-e77599e1": ("waiting_user", WINDOWS_IMAGE_MESSAGE, WINDOWS_IMAGE_NEXT),
    "AIMAX-RPT-20260525230206-cd8e0825": ("waiting_user", WINDOWS_IMAGE_MESSAGE, WINDOWS_IMAGE_NEXT),
}

WINDOWS_CONTENT_IDS = {
    "AIMAX-RPT-20260516104218-3d4d36ac",
    "AIMAX-RPT-20260518072529-c4524800",
    "AIMAX-RPT-20260518072852-330b6ff3",
}

WINDOWS_IMAGE_IDS = {
    "AIMAX-RPT-20260516091042-e77599e1",
    "AIMAX-RPT-20260525230206-cd8e0825",
}

MAC_IDS = {
    "AIMAX-RPT-20260525125020-96b6fc9a",
    "AIMAX-RPT-20260526021022-b5f73bd8",
    "AIMAX-RPT-20260526024302-720fb840",
    "AIMAX-RPT-20260526043826-00f312ea",
}


def read_rows() -> list[dict]:
    return [json.loads(line) for line in INDEX_PATH.read_text().splitlines() if line.strip()]


def write_rows(rows: list[dict]) -> None:
    tmp = INDEX_PATH.with_suffix(INDEX_PATH.suffix + f".tmp-{os.getpid()}")
    tmp.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n")
    tmp.replace(INDEX_PATH)


def report_path(row: dict) -> Path | None:
    date = str(row.get("date") or row.get("stored_at") or "")[:10]
    if len(date) != 10:
        return None
    return REPORTS_DIR / date / f"{row.get('report_id')}.json"


def backup(path: Path | None, suffix: str, backups: list[str]) -> None:
    if not path or not path.exists() or DRY_RUN:
        return
    dst = Path(str(path) + suffix)
    shutil.copy2(path, dst)
    backups.append(str(dst))


def mac_message() -> tuple[str, str, str]:
    return (
        "waiting_user",
        f"Mac 통합 실행기 {MAC_CURRENT}가 운영에 반영되어 있습니다. Mac 로컬 설정 열기/네이버 비밀번호 저장 중 로딩이 계속되던 흐름은 최신 Mac 실제 사용자 테스트에서 통과했습니다.",
        "웹앱을 새로고침한 뒤 업데이트 탭에서 AIMAX 통합 macOS 설치 파일을 새로 받아 설치해주세요. 설치 후 실행기를 다시 연결하고 로컬 보안 설정을 한 번만 저장해주세요. 같은 로딩이 반복되면 \"아직 안 돼요\"로 알려주세요.",
    )


def planned_change(row: dict) -> tuple[str, str, str] | None:
    report_id = row.get("report_id")
    status = row.get("status") or "new"
    public_message = str(row.get("public_message") or "")
    next_update_message = str(row.get("next_update_message") or "")
    os_name = str(row.get("os") or "").lower()

    if report_id in EXPLICIT:
        return EXPLICIT[report_id]
    if report_id in MAC_IDS:
        return mac_message()
    if report_id in WINDOWS_IMAGE_IDS:
        return ("waiting_user", WINDOWS_IMAGE_MESSAGE, WINDOWS_IMAGE_NEXT)
    if report_id in WINDOWS_CONTENT_IDS:
        return ("waiting_user", WINDOWS_CONTENT_MESSAGE, WINDOWS_CONTENT_NEXT)
    if "v1.0.28" in public_message or "v1.0.28" in next_update_message:
        if os_name.startswith("mac"):
            return mac_message()
        return ("waiting_user", WINDOWS_INSTALL_MESSAGE, WINDOWS_INSTALL_NEXT)
    if status in {"new", "working", "reviewing"} and os_name.startswith("windows"):
        return ("waiting_user", WINDOWS_INSTALL_MESSAGE, WINDOWS_INSTALL_NEXT)
    return None


def update_detail(row: dict, next_status: str, public_message: str, next_update_message: str, updated_at: str, backups: list[str], backup_suffix: str) -> None:
    detail_path = report_path(row)
    if not detail_path or not detail_path.exists() or DRY_RUN:
        return
    backup(detail_path, backup_suffix, backups)
    report = json.loads(detail_path.read_text())
    support = dict(report.get("support") or {})
    support.update({
        "status": next_status,
        "status_label": STATUS_LABEL.get(next_status, next_status),
        "public_message": public_message,
        "next_update_message": next_update_message,
        "updated_at": updated_at,
    })
    report["support"] = support
    tmp = detail_path.with_suffix(detail_path.suffix + f".tmp-{os.getpid()}")
    tmp.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    tmp.replace(detail_path)


def main() -> int:
    if not INDEX_PATH.exists():
        raise SystemExit(f"missing index: {INDEX_PATH}")
    updated_at = utc_now()
    backup_suffix = f".bak-{updated_at.replace('-', '').replace(':', '').replace('T', '').replace('Z', '')}-r3t-post-deploy-triage"
    rows = read_rows()
    backups: list[str] = []
    touched: list[dict] = []
    backup(INDEX_PATH, backup_suffix, backups)

    for row in rows:
        change = planned_change(row)
        if not change:
            continue
        next_status, public_message, next_update_message = change
        previous = {
            "status": row.get("status") or "new",
            "public_message": str(row.get("public_message") or "")[:80],
        }
        if (
            previous["status"] == next_status
            and row.get("public_message") == public_message
            and row.get("next_update_message") == next_update_message
        ):
            continue
        row.update({
            "status": next_status,
            "status_updated_at": updated_at,
            "status_label": STATUS_LABEL.get(next_status, next_status),
            "public_message": public_message,
            "next_update_message": next_update_message,
        })
        update_detail(row, next_status, public_message, next_update_message, updated_at, backups, backup_suffix)
        touched.append({
            "report_id": row.get("report_id"),
            "previous_status": previous["status"],
            "next_status": next_status,
            "message_prefix": public_message[:70],
        })

    if not DRY_RUN:
        write_rows(rows)

    counts: dict[str, int] = {}
    for row in rows:
        status = row.get("status") or "new"
        counts[status] = counts.get(status, 0) + 1

    print(json.dumps({
        "ok": True,
        "dry_run": DRY_RUN,
        "updated_at": updated_at,
        "updated_count": len(touched),
        "counts": counts,
        "touched": touched,
        "backups_count": len(backups),
        "backups_sample": backups[:10],
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
