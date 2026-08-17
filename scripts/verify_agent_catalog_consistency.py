#!/usr/bin/env python3
"""카탈로그가 광고하는 실행기 버전과 실제로 서빙 중인 설치 파일이 같은지 확인한다.

2026-08-18 사고: v1.0.60·v1.0.61 은 태그·CI 빌드·카탈로그 LATEST 상향까지 끝났는데
설치 파일 업로드만 빠졌다. 그 결과 4주 동안 사용자는 "v1.0.61 로 업데이트하세요" 안내를
보고 내려받았지만 받은 파일은 v1.0.59 였고, 플릿 111대 중 v1.0.60/61 은 0대였다.
아무도 몰랐던 이유는 두 값을 대조하는 곳이 없었기 때문이다.

이 스크립트는 그 대조 하나만 한다.
  (a) `.env` 의 AIMAX_{MACOS,WINDOWS}_LATEST_AGENT_VERSION  — 광고하는 버전
  (b) 다운로드 디렉토리의 aimax-bundle-versions.json        — 실제 올린 번들 버전 도장
  (c) 도장에 적힌 sha256 이 지금 파일과 같은지               — 도장만 남고 파일이 바뀐 경우

서버에서 실행: python3 scripts/verify_agent_catalog_consistency.py
불일치면 종료코드 1. 감시 타이머에 물릴 수 있다.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

DEFAULT_ENV_FILE = Path("/home/ubuntu/aimax-reports-api/.env")
DEFAULT_DOWNLOAD_DIR = Path("/home/ubuntu/aimax-downloads")
STAMP_NAME = "aimax-bundle-versions.json"

PLATFORM_FILES = {
    "macos": "aimax-bundle-macos.dmg",
    "windows": "aimax-bundle-windows.exe",
}


def read_catalog_versions(env_file: Path) -> dict[str, str]:
    if not env_file.exists():
        return {}
    text = env_file.read_text(encoding="utf-8", errors="replace")
    found: dict[str, str] = {}
    for platform in PLATFORM_FILES:
        m = re.search(rf"^AIMAX_{platform.upper()}_LATEST_AGENT_VERSION=(.*)$", text, re.M)
        if m:
            found[platform] = m.group(1).strip().strip('"').strip("'")
    return found


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Verify agent catalog vs served bundles")
    parser.add_argument("--env-file", type=Path, default=DEFAULT_ENV_FILE)
    parser.add_argument("--download-dir", type=Path, default=DEFAULT_DOWNLOAD_DIR)
    parser.add_argument("--json", action="store_true", help="결과를 JSON 으로 출력")
    args = parser.parse_args(argv)

    problems: list[str] = []
    catalog = read_catalog_versions(args.env_file)
    if not catalog:
        problems.append(f"카탈로그 버전을 읽지 못했습니다: {args.env_file}")

    stamp_path = args.download_dir / STAMP_NAME
    stamp: dict = {}
    if stamp_path.exists():
        try:
            stamp = json.loads(stamp_path.read_text(encoding="utf-8"))
        except Exception as exc:
            problems.append(f"버전 도장을 읽지 못했습니다: {exc}")
    else:
        problems.append(
            f"버전 도장이 없습니다: {stamp_path} — 번들을 한 번도 정식 경로로 올리지 않았거나 "
            "구버전 배포 스크립트로 올렸습니다."
        )

    served_version = str(stamp.get("version") or "")
    for platform, filename in PLATFORM_FILES.items():
        advertised = catalog.get(platform, "")
        if advertised and served_version and advertised != served_version:
            problems.append(
                f"{platform}: 카탈로그는 {advertised} 를 광고하는데 실제 올린 번들은 {served_version} 입니다. "
                "사용자는 업데이트해도 광고된 버전에 도달할 수 없습니다."
            )
        file_path = args.download_dir / filename
        if not file_path.exists():
            problems.append(f"{platform}: 설치 파일이 없습니다: {file_path}")
            continue
        recorded = ((stamp.get("files") or {}).get(filename) or {}).get("sha256") or ""
        if recorded:
            actual = sha256_of(file_path)
            if actual != recorded:
                problems.append(
                    f"{platform}: 도장의 sha256 과 현재 파일이 다릅니다 "
                    f"(도장 {recorded[:12]}… / 실제 {actual[:12]}…). 도장 없이 파일만 교체됐습니다."
                )

    result = {
        "ok": not problems,
        "catalog": catalog,
        "served_version": served_version,
        "stamped_at": stamp.get("stamped_at", ""),
        "problems": problems,
    }
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"카탈로그 광고 버전 : {catalog or '-'}")
        print(f"실제 서빙 번들 버전 : {served_version or '-'} (도장 {stamp.get('stamped_at') or '-'})")
        if problems:
            print(f"\n불일치 {len(problems)}건:")
            for line in problems:
                print(f" - {line}")
        else:
            print("\n일치 — 광고 버전과 서빙 번들이 같습니다.")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
