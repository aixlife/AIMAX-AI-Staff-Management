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
REPRESENTATIVE = "윤동규"
CONTACT_URL = "http://pf.kakao.com/_LVxlXxj/chat"
CONTACT_EMAIL = "makefamily@makefamily.kr"

BUSINESS_INFO = {
    "제품명": APP_VERSION_LABEL,
    "판매 사업자": SELLER,
    "브랜드 관계": "AIMAX는 AIXLIFE와 주식회사 메이크패밀리가 공동으로 사용하는 브랜드입니다.",
    "대표자": REPRESENTATIVE,
    "사업자등록번호": "537-87-01496",
    "법인등록번호": "110111-7278553",
    "통신판매업 신고번호": "제 2020-서울금천-0389 호",
    "사업장 주소": "서울특별시 금천구 벚꽃로 298, 1410호 (가산동, 대륭포스트타워6차)",
    "문의 채널": CONTACT_URL,
    "이메일": CONTACT_EMAIL,
    "개인정보 보호책임자": REPRESENTATIVE,
    "라이선스": f"{LICENSE_UNIT} / {LICENSE_TERM}",
    "저작권": f"Copyright (c) 2026 {SELLER}. All rights reserved.",
}

RECOMMENDED_LIMITS = {
    "daily_neighbor_requests": 50,
    "daily_comments": 30,
    "daily_auto_posts": 2,
}

TERMS_TEXT = f"""AIMAX 이용약관

제1조 목적
이 약관은 {SELLER}(이하 "회사")가 제공하는 AIMAX 소프트웨어(이하 "프로그램")의 이용 조건, 권리와 의무, 책임 사항을 정합니다.

제2조 사용권
1. 프로그램은 {LICENSE_UNIT} 기준의 {LICENSE_TERM}으로 제공됩니다.
2. 사용자는 본인이 관리하는 1대의 PC에서 프로그램을 사용할 수 있습니다.
3. 회사의 사전 동의 없이 프로그램, 실행 파일, 설정 파일, 자동화 로직, 라이선스 기록을 제3자에게 판매, 대여, 공유, 양도, 재배포할 수 없습니다.

제3조 이용 조건
1. 사용자는 네이버 등 외부 플랫폼의 약관, 운영정책, 자동화 정책, 광고·표시 관련 법령을 직접 확인하고 준수해야 합니다.
2. 프로그램은 사용자의 입력값, 계정 상태, PC 환경, 네트워크 상태, 외부 플랫폼 화면 변경에 따라 결과가 달라질 수 있습니다.
3. 사용자는 프로그램을 불법 스팸, 허위·과장 광고, 권리 침해, 개인정보 무단 수집, 외부 플랫폼 정책 위반 목적으로 사용할 수 없습니다.

제4조 계정 및 보안
1. 네이버 계정, 비밀번호, API Key 등 인증 정보의 관리 책임은 사용자에게 있습니다.
2. 프로그램은 민감 정보를 가능한 범위에서 OS 키체인에 저장하며, 사용자는 PC 접근 권한과 보안 상태를 직접 관리해야 합니다.
3. 계정 공유, 원격 접속, 다중 PC 복제 사용으로 발생하는 문제는 사용자 책임입니다.

제5조 업데이트와 변경
1. 회사는 안정성, 정책 대응, 기능 개선, 브랜드 적용을 위해 프로그램과 약관을 변경할 수 있습니다.
2. 약관 버전이 변경되면 프로그램은 재동의를 요청할 수 있습니다.
3. 외부 플랫폼의 화면 구조나 정책 변경으로 일부 기능이 제한되거나 중단될 수 있습니다.

제6조 지식재산권
프로그램, UI, 자동화 흐름, 문서, 브랜드 표시, 코드와 구성 요소에 관한 권리는 회사 또는 정당한 권리자에게 있습니다. 사용자는 허용된 사용권 범위를 넘어 이를 복제, 분석, 변조, 재배포할 수 없습니다.

제7조 계약 해지 및 사용 제한
사용자가 약관, 관계 법령, 외부 플랫폼 정책을 중대하게 위반하거나 프로그램을 악용하는 경우 회사는 지원, 업데이트, 사용 안내 제공을 제한할 수 있습니다.

제8조 문의
프로그램 문의는 카카오 채널({CONTACT_URL}) 또는 이메일({CONTACT_EMAIL})로 접수합니다.
"""

DISCLAIMER_TEXT = """AIMAX 면책 조항

1. AIMAX는 네이버 블로그 운영을 보조하는 자동화 도구이며, 네이버 또는 외부 플랫폼이 공식 제공·인증·보증하는 제품이 아닙니다.
2. 외부 플랫폼은 자동화 활동, 반복 활동, 과도한 신청·댓글·공감·발행, 유사 문구 반복, 비정상 로그인 패턴 등에 대해 계정 제재, 활동 제한, 검색 노출 제한, 저품질 판정, 기능 제한을 적용할 수 있습니다.
3. 프로그램의 권장 한도는 위험을 줄이기 위한 보수적 기준일 뿐, 계정 안전이나 노출 성과를 보장하지 않습니다.
4. 사용자가 권장 한도를 초과하거나 빠른 속도 모드, 반복 문구, 다계정 운영, 정책 위반성 콘텐츠를 사용할 경우 제재 가능성이 높아질 수 있습니다.
5. 프로그램 사용 결과로 발생하는 계정 제한, 게시물 삭제, 노출 저하, 매출 손실, 데이터 손실, 제3자 분쟁, 법적 책임은 사용자에게 있습니다.
6. 회사는 고의 또는 중대한 과실이 없는 한 외부 플랫폼 정책 변경, 네트워크 장애, PC 환경 문제, 사용자의 설정 오류, 계정 보안 문제로 인한 손해를 책임지지 않습니다.
7. 사용자는 프로그램 실행 전 작업 내용, 발행 문구, 댓글, 신청 메시지, 광고성 표시 여부를 직접 검토해야 합니다.
8. 본 조항은 사용자의 법령상 권리를 제한하기 위한 것이 아니며, 관련 법령상 허용되는 범위에서 적용됩니다.
"""

PRIVACY_TEXT = f"""AIMAX 개인정보 처리방침

1. 처리 주체
개인정보 처리 주체는 {SELLER}이며, 개인정보 보호책임자는 {REPRESENTATIVE}입니다.

2. 처리하는 정보
프로그램은 사용자가 입력한 네이버 ID, 비밀번호, AI API Key, 블로그 프로필, 작업 설정값, 로컬 라이선스 ID, 동의 시각, 약관 버전, PC 식별 해시, 권장 한도 초과 확인 로그를 처리할 수 있습니다.

3. 저장 방식
네이버 비밀번호와 API Key 등 민감 정보는 가능한 범위에서 OS 키체인에 저장합니다. 동의 기록과 로컬 라이선스 기록은 사용자 PC의 앱 데이터 폴더에 저장됩니다.

4. 이용 목적
정보는 프로그램 실행, 로그인 보조, AI 글·댓글 생성, 로컬 라이선스 기록, 약관 동의 확인, 권장 한도 초과 이력 확인, 고객 지원을 위해 사용됩니다.

5. 외부 전송
프로그램은 사용자가 AI 생성 기능을 실행할 때 입력한 키워드, 프로필, 글 생성 요청 내용 등을 사용자가 설정한 AI 서비스 제공자에게 전송할 수 있습니다. 네이버 자동화 기능 실행 시 사용자의 PC에서 네이버 서비스로 필요한 요청이 발생합니다.

6. 보유 기간
로컬 설정과 동의 기록은 사용자가 삭제하거나 프로그램을 초기화할 때까지 사용자 PC에 보관됩니다. 고객 문의 과정에서 별도로 제공한 정보는 문의 처리 목적 달성 후 관계 법령에 따라 보관 또는 파기합니다.

7. 제3자 제공
회사는 사용자의 개인정보를 법령에 근거한 경우 또는 사용자의 별도 동의가 있는 경우를 제외하고 제3자에게 제공하지 않습니다.

8. 사용자 권리
사용자는 앱 데이터 폴더의 로컬 기록을 삭제하거나 고객센터를 통해 문의할 수 있습니다. 단, 로컬 기록 삭제 시 약관 재동의와 라이선스 재생성이 필요할 수 있습니다.

9. 문의
개인정보 관련 문의는 카카오 채널({CONTACT_URL}) 또는 이메일({CONTACT_EMAIL})로 접수합니다.
"""


def consent_path() -> Path:
    return APP_DATA_DIR / "aimax_consent.json"


def limit_override_log_path() -> Path:
    return APP_DATA_DIR / "aimax_limit_overrides.jsonl"


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def _load_json(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def load_consent_record() -> dict[str, Any]:
    return _load_json(consent_path())


def load_compliance_record() -> dict[str, Any]:
    return load_consent_record()


def save_consent_record(record: dict[str, Any]) -> None:
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    with consent_path().open("w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)


def has_current_consent() -> bool:
    record = load_consent_record()
    agreements = record.get("agreements") or {}
    return (
        record.get("terms_version") == TERMS_VERSION
        and agreements.get("terms") is True
        and agreements.get("disclaimer") is True
        and agreements.get("privacy") is True
    )


def generate_license_id() -> str:
    groups = ["".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(4)) for _ in range(3)]
    return "AIMAX-LOCAL-" + "-".join(groups)


def pc_identifier_hash() -> str:
    raw = "|".join(
        [
            socket.gethostname(),
            platform.platform(),
            platform.machine(),
            str(uuid.getnode()),
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def accept_current_terms() -> dict[str, Any]:
    previous = load_consent_record()
    created_at = previous.get("license_created_at") or now_iso()
    license_id = previous.get("license_id") or generate_license_id()
    record = {
        "license_id": license_id,
        "license_created_at": created_at,
        "consented_at": now_iso(),
        "terms_version": TERMS_VERSION,
        "app_version": APP_VERSION,
        "app_name": APP_NAME,
        "license_unit": LICENSE_UNIT,
        "license_term": LICENSE_TERM,
        "pc_identifier_hash": pc_identifier_hash(),
        "agreements": {
            "terms": True,
            "disclaimer": True,
            "privacy": True,
        },
        "seller": SELLER,
        "representative": REPRESENTATIVE,
        "contact": CONTACT_URL,
    }
    save_consent_record(record)
    return record


def save_consent(app_mode: str = "all") -> dict[str, Any]:
    return accept_current_terms()


def business_info_text() -> str:
    return "\n".join(f"{key}: {value}" for key, value in BUSINESS_INFO.items())


def license_info_text(record: dict[str, Any] | None = None) -> str:
    record = record or load_consent_record()
    if not record:
        return "로컬 라이선스 기록이 없습니다. 앱을 다시 실행하면 약관 동의 후 자동 생성됩니다."
    return "\n".join(
        [
            f"로컬 라이선스 ID: {record.get('license_id', '-')}",
            f"사용권: {record.get('license_unit', LICENSE_UNIT)} / {record.get('license_term', LICENSE_TERM)}",
            f"약관 버전: {record.get('terms_version', '-')}",
            f"동의 시각: {record.get('consented_at', '-')}",
            f"앱 버전: {record.get('app_name', APP_NAME)} {record.get('app_version', APP_VERSION)}",
            f"PC 식별 해시: {record.get('pc_identifier_hash', '-')}",
        ]
    )


def log_limit_override(item_name: str, configured_value: int, recommended_value: int, app_mode: str = "all") -> dict[str, Any]:
    record = load_consent_record()
    payload = {
        "changed_at": now_iso(),
        "item_name": item_name,
        "configured_value": configured_value,
        "recommended_value": recommended_value,
        "license_id": record.get("license_id", ""),
        "app_mode": app_mode or "all",
    }
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    with limit_override_log_path().open("a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")
    return payload
