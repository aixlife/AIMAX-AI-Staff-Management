#!/usr/bin/env python3
"""R3-S post-deploy report triage for AIMAX production reports."""

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

WINDOWS_CURRENT = "v1.0.28"
MAC_CURRENT = "v1.0.17"


def utc_now() -> str:
    return _dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


WINDOWS_INSTALL_MESSAGE = (
    f"R3-R 배포로 Windows 통합 실행기 {WINDOWS_CURRENT}가 운영에 반영되었습니다. "
    "설치 파일 잠김/구버전 인식/실행기 연결/로컬 설정 열기/작업 시작 감시 문제가 최신 빌드에서 보강됐고, "
    "Windows 실제 사용자 흐름과 임시저장 테스트가 통과했습니다."
)
WINDOWS_INSTALL_NEXT = (
    "웹앱을 새로고침한 뒤 업데이트 탭에서 AIMAX 통합 Windows 설치 파일을 새로 받아 설치해주세요. "
    "설치 전 AIMAX와 열린 Chrome/Whale/Naver 창을 모두 닫고, 설치 후 실행기를 다시 연결한 다음 로컬 보안 설정을 한 번만 저장해주세요. "
    "같은 단계에서 다시 막히면 이 화면에서 \"아직 안 돼요\"를 눌러주세요. 유료 글쓰기 작업은 반복 실행하지 마세요."
)

WINDOWS_CONTENT_MESSAGE = (
    f"R3-R 배포로 Windows 통합 실행기 {WINDOWS_CURRENT}가 운영에 반영되었습니다. "
    "AI 글 생성 실패/브라우저 시작/네이버 입력 단계의 진단과 복구 흐름이 보강됐습니다. "
    "단, Gemini quota/API 키 문제는 설치만으로 해결되지 않을 수 있습니다."
)
WINDOWS_CONTENT_NEXT = (
    "최신 Windows 설치 파일로 업데이트한 뒤 먼저 키워드 1개, 이미지 0~1장, 임시저장으로만 확인해주세요. "
    "provider quota 또는 API 키 오류가 다시 보이면 같은 유료 작업을 반복하지 말고 오류 보고를 보내주세요."
)

WINDOWS_IMAGE_MESSAGE = (
    f"R3-R 배포로 Windows 통합 실행기 {WINDOWS_CURRENT}가 운영에 반영되었습니다. "
    "네이버 Smart Editor 본문/이미지 삽입과 이미지 1장 임시저장 실제 테스트가 통과했습니다. "
    "Gemini 이미지 quota가 막힐 때는 설정된 이미지 fallback으로 1장 삽입까지 확인했습니다."
)
WINDOWS_IMAGE_NEXT = (
    "최신 Windows 설치 파일로 업데이트한 뒤 키워드 1개, 이미지 1장, 임시저장으로만 한 번 확인해주세요. "
    "글 생성 뒤 멈춘 경우 비용이 발생했을 수 있으니 같은 키워드 유료 재시도는 반복하지 말고, 실패하면 이 화면에서 \"아직 안 돼요\"를 눌러주세요."
)

MAC_MESSAGE = (
    f"R3-R 배포로 Mac 통합 실행기 {MAC_CURRENT}가 운영에 반영되었습니다. "
    "Mac 로컬 설정 열기/네이버 비밀번호 저장 중 로딩이 계속되던 흐름은 최신 Mac 실제 사용자 테스트에서 통과했습니다."
)
MAC_NEXT = (
    "웹앱을 새로고침한 뒤 업데이트 탭에서 AIMAX 통합 macOS 설치 파일을 새로 받아 설치해주세요. "
    "설치 후 실행기를 다시 연결하고 로컬 보안 설정을 한 번만 저장해주세요. 같은 로딩이 반복되면 \"아직 안 돼요\"로 알려주세요."
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

QUEUE_DONE_MESSAGE = "해당 작업 멈춤 문제는 서버 작업 큐 라우팅 수정, runner-start watchdog, R3-R 실제 사용자 흐름 통과로 운영 조치가 완료되었습니다."
QUEUE_DONE_NEXT = "새 작업에서 같은 현상이 반복될 때만 새 오류 보고를 보내주세요."

STATUS_LABEL = {
    "waiting_user": "사용자 확인 필요",
    "done": "완료",
}

EXPLICIT = {
    "AIMAX-RPT-20260522185718-6fe2df2a": ("done", QUEUE_DONE_MESSAGE, QUEUE_DONE_NEXT),
    "AIMAX-RPT-20260523092205-4a3c9f05": ("waiting_user", SMARTSCREEN_MESSAGE, SMARTSCREEN_NEXT),
    "AIMAX-RPT-20260516091042-e77599e1": ("waiting_user", WINDOWS_IMAGE_MESSAGE, WINDOWS_IMAGE_NEXT),
    "AIMAX-RPT-20260525230206-cd8e0825": ("waiting_user", WINDOWS_IMAGE_MESSAGE, WINDOWS_IMAGE_NEXT),
}

WINDOWS_INSTALL_IDS = {
    "AIMAX-RPT-20260514083437-5731089e",
    "AIMAX-RPT-20260514095338-480d0ce4",
    "AIMAX-RPT-20260516102016-b84c2df4",
    "AIMAX-RPT-20260516150059-8879a9b5",
    "AIMAX-RPT-20260516161506-67741b89",
    "AIMAX-RPT-20260516164406-bc649df1",
    "AIMAX-RPT-20260516164517-8d41a79a",
    "AIMAX-RPT-20260518071933-5e3b43e6",
    "AIMAX-RPT-20260518072833-17cb362a",
    "AIMAX-RPT-20260518095126-d9a35540",
    "AIMAX-RPT-20260519151029-c51f8f7a",
    "AIMAX-RPT-20260522015806-4bcdf1df",
    "AIMAX-RPT-20260523053651-fafcc06d",
    "AIMAX-RPT-20260523064721-fcf8d675",
    "AIMAX-RPT-20260523092409-978c89fc",
    "AIMAX-RPT-20260523122345-e02aee0b",
    "AIMAX-RPT-20260523125033-c73003fb",
    "AIMAX-RPT-20260523132024-d392cf5d",
    "AIMAX-RPT-20260525043813-ca0c41e0",
    "AIMAX-RPT-20260526065632-57438e24",
    "AIMAX-RPT-20260527050751-c3b0b802",
    "AIMAX-RPT-20260527103437-209bfd00",
}

WINDOWS_CONTENT_IDS = {
    "AIMAX-RPT-20260516104218-3d4d36ac",
    "AIMAX-RPT-20260518072529-c4524800",
    "AIMAX-RPT-20260518072852-330b6ff3",
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


def planned_change(row: dict) -> tuple[str, str, str] | None:
    report_id = row.get("report_id")
    if report_id in EXPLICIT:
        return EXPLICIT[report_id]
    if report_id in WINDOWS_INSTALL_IDS:
        return ("waiting_user", WINDOWS_INSTALL_MESSAGE, WINDOWS_INSTALL_NEXT)
    if report_id in WINDOWS_CONTENT_IDS:
        return ("waiting_user", WINDOWS_CONTENT_MESSAGE, WINDOWS_CONTENT_NEXT)
    if report_id in MAC_IDS:
        return ("waiting_user", MAC_MESSAGE, MAC_NEXT)
    if row.get("status") == "working":
        if str(row.get("os", "")).lower().startswith("mac"):
            return ("waiting_user", MAC_MESSAGE, MAC_NEXT)
        return ("waiting_user", WINDOWS_INSTALL_MESSAGE, WINDOWS_INSTALL_NEXT)
    return None


def main() -> int:
    if not INDEX_PATH.exists():
        raise SystemExit(f"missing index: {INDEX_PATH}")
    updated_at = utc_now()
    backup_suffix = f".bak-{updated_at.replace('-', '').replace(':', '').replace('T', '').replace('Z', '')}-r3s-post-deploy-triage"
    rows = read_rows()
    backups: list[str] = []
    touched: list[dict] = []
    backup(INDEX_PATH, backup_suffix, backups)

    for row in rows:
        change = planned_change(row)
        if not change:
            continue
        next_status, public_message, next_update_message = change
        previous_status = row.get("status") or ""
        row.update({
            "status": next_status,
            "status_updated_at": updated_at,
            "status_label": STATUS_LABEL.get(next_status, next_status),
            "public_message": public_message,
            "next_update_message": next_update_message,
        })
        detail_path = report_path(row)
        if detail_path and detail_path.exists() and not DRY_RUN:
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
        touched.append({
            "report_id": row.get("report_id"),
            "previous_status": previous_status,
            "next_status": next_status,
        })

    if not DRY_RUN:
        write_rows(rows)

    counts: dict[str, int] = {}
    for row in rows:
        status = row.get("status", "new")
        counts[status] = counts.get(status, 0) + 1
    print(json.dumps({
        "ok": True,
        "dry_run": DRY_RUN,
        "updated_at": updated_at,
        "updated_count": len(touched),
        "counts": counts,
        "touched": touched,
        "backups_count": len(backups),
        "backups_sample": backups[:8],
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
