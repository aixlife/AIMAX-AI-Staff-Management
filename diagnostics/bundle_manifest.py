"""빌드 산출물(onedir) 무결성 매니페스트 생성/검증 — 업데이트 부분 교체 감지.

업데이트가 부분적으로만 적용되면(예: app 은 새 버전인데 content/ 모듈은 구버전, 또는
이전 세대 파일이 삭제되지 않고 잔존) 임포트 불일치가 잡 실행 중에 터져 사용자가 원인을
알 수 없다. 빌드 시 파일별 {경로, sha256, size} 매니페스트를 onedir 루트에 만들어 두고,
앱 시작 시(부트스트랩 초기) 대조해 혼합 상태로 실행되기 전에 감지한다.

설계 원칙:
- 순수 stdlib(hashlib/json/os)만 사용 — frozen 부트스트랩 초기(외부 패키지 로드 전)에도 안전.
- 플랫폼 분기 없음(맥/윈도우 동일 동작). 매니페스트 파일이 없으면 구버전/맥 호환으로 통과.
- 실행 중 생기거나 변하는 파일(로그/락/언인스톨러 등)은 생성·검증 모두에서 제외.
- 검증 최적화: size 불일치는 해시 없이 확정, 불일치 상한 도달 시 조기 중단(어차피 재설치).
"""
from __future__ import annotations

import fnmatch
import hashlib
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

MANIFEST_NAME = "aimax_manifest.json"
MANIFEST_FORMAT = 1

# 실행 중 생기거나 변하는 파일 — 매니페스트 생성/검증 양쪽에서 제외한다.
# (매니페스트 자신, 로그, 락, Inno Setup 언인스톨러, OS 메타파일)
EXCLUDE_PATTERNS = (
    MANIFEST_NAME,
    "*.log",
    "*.lock",
    "unins*",
    ".DS_Store",
    "Thumbs.db",
)

# "여분 파일"(매니페스트에 없는 잔재) 감지 대상 확장자. 이전 세대 런타임/패키지 잔재가
# 혼합 상태 실행을 만드는 코드 파일만 본다(사용자가 둔 문서/이미지 등은 오탐 방지 위해 무시).
EXTRA_FILE_SUFFIXES = (".py", ".pyc", ".pyo", ".pyd", ".dll", ".so", ".dylib")

_HASH_CHUNK_SIZE = 1024 * 1024


def _is_excluded(rel_posix: str) -> bool:
    name = rel_posix.rsplit("/", 1)[-1]
    for pattern in EXCLUDE_PATTERNS:
        if fnmatch.fnmatch(name, pattern) or fnmatch.fnmatch(rel_posix, pattern):
            return True
    return False


def _sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(_HASH_CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _sha256_with_retry(path: Path) -> str:
    """시작 직후 백신 스캔 등으로 일시적 공유 위반이 날 수 있어 1회 재시도한다."""
    try:
        return _sha256_of(path)
    except OSError:
        time.sleep(0.2)
        return _sha256_of(path)


def generate_manifest(root_dir, version: str) -> dict:
    """root_dir 이하 전체 파일(제외 목록 제외)의 {경로: {sha256, size}} 매니페스트를 만든다."""
    root = Path(root_dir).resolve()
    files: dict[str, dict] = {}
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames.sort()
        for filename in sorted(filenames):
            full = Path(dirpath) / filename
            if full.is_symlink():
                # 심볼릭 링크(맥 .app 등)는 대상 파일 쪽에서 해시되므로 중복 등재하지 않는다.
                continue
            rel = full.relative_to(root).as_posix()
            if _is_excluded(rel):
                continue
            files[rel] = {"sha256": _sha256_of(full), "size": full.stat().st_size}
    # 여분 파일(잔재) 스캔 범위는 빌드 시점의 페이로드 관리 디렉터리로 고정한다.
    # (윈도우 onedir 은 _internal, 맥 .app 은 해당 없음 → 빈 목록. 데이터 주도라 플랫폼 분기 없음)
    extra_scan_dirs = [d for d in ("_internal",) if (root / d).is_dir()]
    return {
        "manifest_format": MANIFEST_FORMAT,
        "app_version": str(version),
        "generated_at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "extra_scan_dirs": extra_scan_dirs,
        "file_count": len(files),
        "files": files,
    }


def write_manifest(root_dir, version: str) -> Path:
    """매니페스트를 생성해 root_dir/aimax_manifest.json 에 기록하고 경로를 반환한다."""
    root = Path(root_dir).resolve()
    manifest = generate_manifest(root, version)
    path = root / MANIFEST_NAME
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    return path


def _safe_relative(root: Path, rel: str) -> Path | None:
    """매니페스트 경로가 root 밖을 가리키지 않는지 방어한다(비정상 매니페스트 대비)."""
    rel = str(rel or "")
    if not rel or rel.startswith(("/", "\\")) or ":" in rel.split("/", 1)[0]:
        return None
    if ".." in rel.split("/"):
        return None
    return root / rel


def verify_manifest(root_dir, max_report: int = 20) -> dict:
    """매니페스트 대조 결과를 반환한다. 반환 dict:
    {ok, skipped, reason?, app_version?, checked, mismatch_count, mismatches[], truncated}

    - 매니페스트 파일이 없으면 ok=True, skipped=True (구버전/맥 호환 통과).
    - 매니페스트 자체가 못 읽는 상태면 부분 교체의 직접 증거로 보고 불일치 처리.
    - 등재 파일: 존재/size 비교 후 size 일치 시에만 sha256 대조(시작 지연 최소화).
    - 여분 파일: extra_scan_dirs 이하에서 매니페스트에 없는 코드 확장자 파일을 잔재로 감지.
    """
    root = Path(root_dir).resolve()
    manifest_path = root / MANIFEST_NAME
    if not manifest_path.is_file():
        return {"ok": True, "skipped": True, "reason": "manifest_missing",
                "checked": 0, "mismatch_count": 0, "mismatches": [], "truncated": False}

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        files = manifest.get("files")
        if not isinstance(files, dict) or not files:
            raise ValueError("files map missing or empty")
    except Exception as exc:  # noqa: BLE001 — 깨진 매니페스트 = 부분 교체 증거
        return {"ok": False, "skipped": False, "reason": "manifest_unreadable",
                "checked": 0, "mismatch_count": 1, "truncated": False,
                "mismatches": [{"path": MANIFEST_NAME,
                                "reason": f"unreadable: {type(exc).__name__}: {exc}"[:200]}]}

    mismatches: list[dict] = []
    checked = 0
    truncated = False

    def _add(path_str: str, reason: str) -> bool:
        mismatches.append({"path": path_str, "reason": reason})
        return len(mismatches) >= max_report

    for rel, meta in files.items():
        if _is_excluded(rel):
            continue
        full = _safe_relative(root, rel)
        if full is None:
            if _add(str(rel)[:300], "invalid_path"):
                truncated = True
                break
            continue
        expected_hash = str((meta or {}).get("sha256") or "")
        expected_size = (meta or {}).get("size")
        try:
            if not full.is_file():
                if _add(rel, "missing"):
                    truncated = True
                    break
                continue
            actual_size = full.stat().st_size
            # size 불일치는 해시 없이 확정(빠른 실패). 일치할 때만 전체 해시로 확인한다.
            if isinstance(expected_size, int) and actual_size != expected_size:
                if _add(rel, f"size_mismatch: expected={expected_size} actual={actual_size}"):
                    truncated = True
                    break
                continue
            if expected_hash and _sha256_with_retry(full) != expected_hash:
                if _add(rel, "hash_mismatch"):
                    truncated = True
                    break
                continue
        except OSError as exc:
            if _add(rel, f"read_error: {exc.__class__.__name__}"[:200]):
                truncated = True
                break
            continue
        checked += 1

    # 여분 파일(이전 세대 잔재) 감지 — 매니페스트에 없는 코드 파일이 남아 있으면 혼합 상태.
    if not truncated:
        for scan_dir in manifest.get("extra_scan_dirs") or []:
            base = _safe_relative(root, str(scan_dir))
            if base is None or not base.is_dir():
                continue
            stop = False
            for dirpath, dirnames, filenames in os.walk(base):
                dirnames.sort()
                for filename in sorted(filenames):
                    full = Path(dirpath) / filename
                    if full.is_symlink():
                        continue
                    rel = full.relative_to(root).as_posix()
                    if rel in files or _is_excluded(rel):
                        continue
                    if not filename.lower().endswith(EXTRA_FILE_SUFFIXES):
                        continue
                    if _add(rel, "unexpected_file"):
                        truncated = True
                        stop = True
                        break
                if stop:
                    break
            if stop:
                break

    return {
        "ok": not mismatches,
        "skipped": False,
        "app_version": manifest.get("app_version"),
        "checked": checked,
        "mismatch_count": len(mismatches),
        "mismatches": mismatches,
        "truncated": truncated,
    }
