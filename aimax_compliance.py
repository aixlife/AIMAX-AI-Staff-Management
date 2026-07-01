"""AIMAX compliance, consent, and local license helpers."""
from __future__ import annotations

import hashlib
import json
import platform
import secrets
import socket
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from paths import APP_DATA_DIR

APP_NAME = "AIMAX"
APP_DISPLAY_NAME = APP_NAME
APP_VERSION = "v1.0.56"
APP_VERSION_LABEL = f"{APP_NAME} {APP_VERSION}"
TERMS_VERSION = "2026-04-29"

LICENSE_UNIT = "1PC 1라이선스"
LICENSE_TERM = "영구 사용권"

SELLER = "주식회사 메이크패밀리"
SELLER_REPRESENTATIVE = "손정규"
SELLER_BUSINESS_NUMBER = "266-86-03788"
SELLER_ORDER_SALES_NUMBER = "제2025-충남천안-2018호"
SELLER_ADDRESS = "충청남도 천안시 동남구 대흥로 255 7층 2호"
SELLER_EMAIL = "contact@makefamilycorp.com"

# Plain terms are intentionally local/static. They are shown before first use and
# stored with a consent hash so support can distinguish stale consents.
TERMS_TEXT = f"""
{APP_NAME} 이용약관

제1조 목적
본 약관은 {SELLER}(이하 "회사")가 제공하는 {APP_NAME} 로컬 실행기 및 관련 웹 서비스의 이용 조건과 책임을 정합니다.

제2조 라이선스
1. 본 소프트웨어는 {LICENSE_UNIT} 기준으로 제공됩니다.
2. 라이선스는 {LICENSE_TERM}으로 제공되며, 사용자는 본인의 PC에서만 사용할 수 있습니다.
3. 회사의 사전 동의 없이 라이선스, 실행 파일, 인증 정보를 제3자에게 양도, 대여, 공유할 수 없습니다.

제3조 서비스 특성
1. 본 소프트웨어는 사용자의 PC에서 브라우저 자동화, 콘텐츠 생성 보조, 로컬 설정 저장 등을 수행합니다.
2. 네이버, OpenAI, Google 등 외부 서비스의 정책, 화면 변경, API 제한, 요금제 변경에 따라 일부 기능이 제한될 수 있습니다.
3. 자동화 결과물의 검수, 게시 여부, 법적 책임은 최종 사용자인 고객에게 있습니다.

제4조 금지행위
사용자는 다음 행위를 해서는 안 됩니다.
1. 타인의 계정 또는 API 키 무단 사용
2. 불법, 허위, 명예훼손, 저작권 침해 콘텐츠 생성 또는 게시
3. 소프트웨어 리버스 엔지니어링, 무단 복제, 재배포
4. 외부 서비스의 이용약관 또는 관련 법령을 위반하는 자동화 행위

제5조 책임 제한
1. 회사는 소프트웨어의 안정적 제공을 위해 노력하되, 외부 서비스 장애, 네트워크 장애, 사용자 PC 환경 문제로 인한 손해에 대해 책임을 지지 않습니다.
2. 회사는 사용자가 생성하거나 게시한 콘텐츠의 적법성, 정확성, 상업적 성과를 보증하지 않습니다.
3. 사용자는 실행 전 결과물을 확인하고 필요한 경우 수정해야 합니다.

제6조 지원 및 업데이트
1. 회사는 오류 수정, 보안 개선, 외부 서비스 변경 대응을 위해 업데이트를 제공할 수 있습니다.
2. 구버전 사용 시 일부 기능이 제한될 수 있습니다.

제7조 문의
상호: {SELLER}
대표자: {SELLER_REPRESENTATIVE}
사업자등록번호: {SELLER_BUSINESS_NUMBER}
통신판매업신고번호: {SELLER_ORDER_SALES_NUMBER}
주소: {SELLER_ADDRESS}
이메일: {SELLER_EMAIL}
""".strip()

PRIVACY_TEXT = f"""
{APP_NAME} 개인정보 처리방침

1. 처리하는 정보
회사는 서비스 제공 및 오류 지원을 위해 다음 정보를 처리할 수 있습니다.
- 사용자 계정 이메일 및 권한 정보
- PC 식별을 위한 로컬 디바이스 ID
- 앱 버전, 운영체제, 실행 로그, 오류 보고 내용
- 사용자가 직접 저장한 네이버 계정, API 키 등 로컬 설정 정보

2. 로컬 저장 정보
네이버 계정, API 키 등 민감 설정은 사용자의 PC 로컬 저장소에 저장됩니다. 회사는 사용자의 명시적 전송 또는 오류 보고 절차 없이는 해당 값을 서버에 수집하지 않습니다.

3. 서버 전송 정보
작업 요청, 작업 상태, 오류 보고, 라이선스 확인을 위해 필요한 최소 정보가 서버로 전송될 수 있습니다. 오류 보고 시 traceback, debug 파일 목록, 앱/OS 버전, 작업 단계 정보가 포함될 수 있습니다.

4. 이용 목적
- 라이선스 확인 및 중복 사용 방지
- 작업 상태 동기화
- 오류 분석 및 고객 지원
- 보안 및 부정 사용 방지

5. 보관 기간
계정 및 라이선스 정보는 서비스 이용 기간 동안 보관합니다. 오류 로그와 작업 기록은 지원 및 품질 개선 목적상 필요한 기간 동안 보관 후 삭제 또는 익명화할 수 있습니다.

6. 제3자 제공
회사는 법령에 따른 경우를 제외하고 개인정보를 제3자에게 제공하지 않습니다.

7. 사용자 권리
사용자는 개인정보 열람, 정정, 삭제, 처리 정지를 요청할 수 있습니다. 문의는 {SELLER_EMAIL}로 접수합니다.

8. 문의
상호: {SELLER}
대표자: {SELLER_REPRESENTATIVE}
사업자등록번호: {SELLER_BUSINESS_NUMBER}
주소: {SELLER_ADDRESS}
이메일: {SELLER_EMAIL}
""".strip()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def terms_hash() -> str:
    payload = f"{TERMS_VERSION}\n{TERMS_TEXT}\n---\n{PRIVACY_TEXT}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def consent_path() -> Path:
    return APP_DATA_DIR / "consent.json"


def device_id_path() -> Path:
    return APP_DATA_DIR / "device_id"


def ensure_app_data_dir() -> None:
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)


def get_device_id() -> str:
    ensure_app_data_dir()
    path = device_id_path()
    try:
        existing = path.read_text(encoding="utf-8").strip()
        if existing:
            return existing
    except FileNotFoundError:
        pass
    except Exception:
        pass
    raw = f"{uuid.getnode()}:{socket.gethostname()}:{platform.platform()}:{secrets.token_hex(8)}"
    device_id = hashlib.sha256(raw.encode("utf-8", errors="ignore")).hexdigest()[:24]
    try:
        path.write_text(device_id, encoding="utf-8")
    except Exception:
        pass
    return device_id


def load_consent() -> dict[str, Any]:
    try:
        with consent_path().open("r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return {}


def has_valid_consent() -> bool:
    data = load_consent()
    return bool(
        data.get("accepted")
        and data.get("terms_version") == TERMS_VERSION
        and data.get("terms_hash") == terms_hash()
    )


def save_consent(user_email: str = "") -> dict[str, Any]:
    ensure_app_data_dir()
    record = {
        "accepted": True,
        "accepted_at": _now_iso(),
        "terms_version": TERMS_VERSION,
        "terms_hash": terms_hash(),
        "app_name": APP_NAME,
        "app_version": APP_VERSION,
        "device_id": get_device_id(),
        "user_email": user_email or "",
        "os": platform.platform(),
    }
    with consent_path().open("w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)
    return record


def license_payload(user_email: str = "") -> dict[str, Any]:
    return {
        "app_name": APP_NAME,
        "app_version": APP_VERSION,
        "device_id": get_device_id(),
        "user_email": user_email or "",
        "os": platform.platform(),
        "hostname": socket.gethostname(),
        "terms_version": TERMS_VERSION,
        "terms_hash": terms_hash(),
    }


def consent_summary() -> str:
    data = load_consent()
    if not data:
        return "동의 기록 없음"
    return "\n".join(
        [
            f"동의 여부: {'예' if data.get('accepted') else '아니오'}",
            f"동의 시각: {data.get('accepted_at', '-')}",
            f"약관 버전: {data.get('terms_version', '-')}",
            f"앱 버전: {data.get('app_name', APP_NAME)} {data.get('app_version', APP_VERSION)}",
            f"디바이스: {data.get('device_id', '-')}",
        ]
    )
