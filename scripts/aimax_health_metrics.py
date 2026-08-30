#!/usr/bin/env python3
"""AIMAX 서버 데이터 기반 감시 지표 5종 (수리 파이프라인 2차 감시).

기존 watchdog(aimax_report_watchdog.py)은 "사람이 보낸 오류 보고"만 본다.
2026-08-18 분석: 그 지표로는 실사고 3건(현주 무성공, v1.0.60/61 미배달,
카탈로그-번들 불일치) 중 0건을 탐지했다. 이 모듈은 서버가 이미 쌓는 데이터
(jobs.json / agents.json / .env 카탈로그 / 번들 도장)에서 이상 신호를 뽑는다.

지표:
  M1 job_failure_surge      kind별 최근 24h 실패율이 직전 7일 기준선의 2배 이상이며 0.5 이상
  M2 error_code_surge       (kind, failed_stage)별 최근 24h 건수가 직전 7일 일평균의 3배 이상
  M3 worker_zero_success    worker_code별 최근 72h 해결된 시도>=5 인데 성공(done+ready_for_publish) 0
  M4 fleet_version_stagnation  번들 도장이 48h 지났는데 활성 에이전트 중 도장 버전 이상이 0대
  M5 catalog_bundle_mismatch   .env 카탈로그(/api/version 계산과 동일)와 번들 도장 version 불일치

필드 근거 (oracle/aimax-reports-api/server.js 실측):
  - jobs.json  = {"jobs":[{kind,status,created_at,updated_at,failed_stage,failed_reason,
                  worker_code,target_platform,...}]}, 성공 상태 = done + ready_for_publish
  - agents.json= {"agents":[{version,platform,device_label,last_seen_at,updated_at,...}]}
                  (handleAgentHeartbeat 가 last_seen_at/version 을 기록)
  - 카탈로그   = AIMAX_{WINDOWS,MACOS}_LATEST_AGENT_VERSION → AIMAX_LATEST_AGENT_VERSION 폴백
                  (platformVersionConfig 과 동일), 버전 비교는 parseVersion 미러
  - 번들 도장  = <downloads-dir>/aimax-bundle-versions.json {version, stamped_at, files}

반드시 지킬 것:
  - 고객 키워드·본문·개인정보를 detail/evidence 에 넣지 않는다. 카운트·코드·버전만.
  - signature 에 절대시각·경과시간을 넣지 않는다(2026-07-03 알림 폭주 원인 — 시각이
    들어가면 실행마다 서명이 달라져 중복 억제가 영원히 발동하지 않는다).
    서명은 anomaly 의 정체성 필드(code/kind/stage/worker/platform)만 정렬해 해시한다.
  - 소스 파일이 아예 없으면(신규 환경) anomaly 0건으로 조용히 통과한다.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Mapping

DEFAULT_DATA_DIR = Path("/home/ubuntu/aimax-reports/data")
DEFAULT_DOWNLOADS_DIR = Path("/home/ubuntu/aimax-downloads")
DEFAULT_ENV_FILE = Path("/home/ubuntu/aimax-reports-api/.env")
BUNDLE_STAMP_NAME = "aimax-bundle-versions.json"

SUCCESS_STATUSES = {"done", "ready_for_publish"}
# "해결된 시도": 아직 대기/실행 중(queued/generating/running)인 잡은 시도 수에 넣지 않는다.
# 갓 쌓인 대기열만으로 M1/M3 이 오발화하는 것을 막는다. 좀비 잡은 서버 스윕이 failed 로
# 전이시키므로 결국 여기 잡힌다.
RESOLVED_STATUSES = {"done", "ready_for_publish", "failed", "cancelled"}
PLATFORMS = ("macos", "windows")


def utc_now() -> datetime:
    return datetime.now(UTC)


def parse_time(value: Any) -> datetime | None:
    if not value:
        return None
    text = str(value).strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def read_json(path: Path) -> dict[str, Any]:
    try:
        if not path.is_file():
            return {}
        value = json.loads(path.read_text(encoding="utf-8", errors="replace"))
    except (OSError, json.JSONDecodeError):
        return {}
    return value if isinstance(value, dict) else {}


def parse_version(version: Any) -> tuple[int, ...]:
    """server.js parseVersion 미러: 선행 비숫자 제거 후 [.-] 로 쪼개 정수화."""
    text = re.sub(r"^[^\d]*", "", str(version or ""))
    parts: list[int] = []
    for part in re.split(r"[.-]", text):
        try:
            parts.append(int(part, 10))
        except ValueError:
            parts.append(0)
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts)


def compare_versions(a: Any, b: Any) -> int:
    aa, bb = parse_version(a), parse_version(b)
    length = max(len(aa), len(bb))
    for index in range(length):
        diff = (aa[index] if index < len(aa) else 0) - (bb[index] if index < len(bb) else 0)
        if diff:
            return 1 if diff > 0 else -1
    return 0


def normalize_platform(value: Any) -> str:
    """server.js normalizePlatform 미러."""
    raw = str(value or "").strip().lower()
    if raw in {"mac", "macos", "darwin", "osx"} or "mac" in raw or "darwin" in raw:
        return "macos"
    if raw in {"win", "windows", "win32", "win64"} or "win" in raw:
        return "windows"
    return ""


def catalog_versions(env: Mapping[str, str]) -> dict[str, str]:
    """/api/version(platformVersionConfig) 과 동일한 폴백 체인으로 광고 버전을 읽는다.

    server.js 는 env 가 없으면 코드 기본값 v1.0.51 을 쓰지만, 지표에서는 env 부재 =
    카탈로그 불명으로 보고 조용히 건너뛴다(신규 환경 오발화 방지).
    """
    fallback = str(env.get("AIMAX_LATEST_AGENT_VERSION") or "").strip().strip('"').strip("'")
    found: dict[str, str] = {}
    for platform in PLATFORMS:
        value = str(env.get(f"AIMAX_{platform.upper()}_LATEST_AGENT_VERSION") or "").strip().strip('"').strip("'")
        if not value:
            value = fallback
        if value:
            found[platform] = value
    return found


def anomalies_signature(anomalies: list[dict[str, Any]]) -> str:
    """정체성 필드만으로 만드는 안정 서명. 수치·시각을 절대 섞지 않는다."""
    keys = sorted(
        "|".join(
            str(row.get(field) or "")
            for field in ("code", "kind", "stage", "worker_code", "platform")
        )
        for row in anomalies
    )
    return hashlib.sha256("\n".join(keys).encode()).hexdigest()


def _job_created(job: Mapping[str, Any]) -> datetime | None:
    return parse_time(job.get("created_at"))


def _job_resolved_at(job: Mapping[str, Any]) -> datetime | None:
    return parse_time(job.get("updated_at")) or parse_time(job.get("created_at"))


def collect_metrics(
    data_dir: Path | str,
    downloads_dir: Path | str,
    env: Mapping[str, str],
    now: datetime | None = None,
    *,
    m1_min_samples: int = 10,
    m1_baseline_multiplier: float = 2.0,
    m1_min_rate: float = 0.5,
    m2_min_count: int = 5,
    m2_multiplier: float = 3.0,
    m3_min_attempts: int = 5,
    m3_window_hours: int = 72,
    m4_stamp_age_hours: int = 48,
    m4_active_days: int = 7,
    recent_hours: int = 24,
    baseline_days: int = 7,
) -> dict[str, Any]:
    now = now or utc_now()
    data_dir = Path(data_dir)
    downloads_dir = Path(downloads_dir)

    jobs = [row for row in (read_json(data_dir / "jobs.json").get("jobs") or []) if isinstance(row, dict)]
    agents = [row for row in (read_json(data_dir / "agents.json").get("agents") or []) if isinstance(row, dict)]
    stamp = read_json(downloads_dir / BUNDLE_STAMP_NAME)
    catalog = catalog_versions(env)

    recent_start = now - timedelta(hours=recent_hours)
    baseline_start = recent_start - timedelta(days=baseline_days)
    anomalies: list[dict[str, Any]] = []

    # --- M1 job_failure_surge -------------------------------------------------
    per_kind: dict[str, dict[str, int]] = {}
    for job in jobs:
        if str(job.get("status") or "") not in RESOLVED_STATUSES:
            continue
        created = _job_created(job)
        if not created or created > now:
            continue
        kind = str(job.get("kind") or "unknown")
        bucket = per_kind.setdefault(kind, {"rt": 0, "rf": 0, "bt": 0, "bf": 0})
        failed = str(job.get("status")) == "failed"
        if created >= recent_start:
            bucket["rt"] += 1
            bucket["rf"] += failed
        elif created >= baseline_start:
            bucket["bt"] += 1
            bucket["bf"] += failed
    for kind in sorted(per_kind):
        bucket = per_kind[kind]
        if bucket["rt"] < m1_min_samples:
            continue
        rate = bucket["rf"] / bucket["rt"]
        baseline_rate = (bucket["bf"] / bucket["bt"]) if bucket["bt"] else 0.0
        if rate >= m1_min_rate and rate >= baseline_rate * m1_baseline_multiplier:
            anomalies.append({
                "code": "job_failure_surge",
                "kind": kind,
                "detail": (
                    f"{kind} 최근 {recent_hours}h 실패율 {rate:.0%} ({bucket['rf']}/{bucket['rt']}) — "
                    f"직전 {baseline_days}일 기준선 {baseline_rate:.0%}"
                ),
                "evidence": {
                    "recent_failed": bucket["rf"],
                    "recent_total": bucket["rt"],
                    "recent_rate": round(rate, 3),
                    "baseline_failed": bucket["bf"],
                    "baseline_total": bucket["bt"],
                    "baseline_rate": round(baseline_rate, 3),
                },
            })

    # --- M2 error_code_surge --------------------------------------------------
    per_stage: dict[tuple[str, str], dict[str, int]] = {}
    for job in jobs:
        if str(job.get("status") or "") != "failed":
            continue
        stage = str(job.get("failed_stage") or "").strip()
        if not stage:
            continue
        happened = _job_resolved_at(job)
        if not happened or happened > now:
            continue
        key = (str(job.get("kind") or "unknown"), stage)
        bucket = per_stage.setdefault(key, {"recent": 0, "baseline": 0})
        if happened >= recent_start:
            bucket["recent"] += 1
        elif happened >= baseline_start:
            bucket["baseline"] += 1
    for kind, stage in sorted(per_stage):
        bucket = per_stage[(kind, stage)]
        daily_avg = bucket["baseline"] / baseline_days
        if bucket["recent"] >= m2_min_count and bucket["recent"] >= daily_avg * m2_multiplier:
            anomalies.append({
                "code": "error_code_surge",
                "kind": kind,
                "stage": stage,
                "detail": (
                    f"{kind}/{stage} 최근 {recent_hours}h {bucket['recent']}건 — "
                    f"직전 {baseline_days}일 일평균 {daily_avg:.1f}건"
                ),
                "evidence": {
                    "recent_count": bucket["recent"],
                    "baseline_count": bucket["baseline"],
                    "baseline_daily_avg": round(daily_avg, 2),
                },
            })

    # --- M3 worker_zero_success (현주 무성공 사고 역탐지) ----------------------
    m3_start = now - timedelta(hours=m3_window_hours)
    per_worker: dict[str, dict[str, int]] = {}
    for job in jobs:
        worker = str(job.get("worker_code") or "").strip()
        if not worker:
            continue
        if str(job.get("status") or "") not in RESOLVED_STATUSES:
            continue
        created = _job_created(job)
        if not created or created < m3_start or created > now:
            continue
        bucket = per_worker.setdefault(worker, {"attempts": 0, "success": 0})
        bucket["attempts"] += 1
        bucket["success"] += str(job.get("status")) in SUCCESS_STATUSES
    for worker in sorted(per_worker):
        bucket = per_worker[worker]
        if bucket["attempts"] >= m3_min_attempts and bucket["success"] == 0:
            anomalies.append({
                "code": "worker_zero_success",
                "worker_code": worker,
                "detail": f"{worker} 최근 {m3_window_hours}h 해결된 시도 {bucket['attempts']}건 중 성공 0건",
                "evidence": {"attempts": bucket["attempts"], "success": 0},
            })

    # --- M4 fleet_version_stagnation (v1.0.60/61 미배달 사고 역탐지) -----------
    stamp_version = str(stamp.get("version") or "")
    stamped_at = parse_time(stamp.get("stamped_at"))
    active_cutoff = now - timedelta(days=m4_active_days)
    active_agents = [
        row for row in agents
        if (seen := parse_time(row.get("last_seen_at"))) and seen >= active_cutoff
    ]
    on_latest = [
        row for row in active_agents
        if str(row.get("version") or "") and compare_versions(row.get("version"), stamp_version) >= 0
    ] if stamp_version else []
    if (
        stamp_version
        and stamped_at
        and now - stamped_at >= timedelta(hours=m4_stamp_age_hours)
        and active_agents
        and not on_latest
    ):
        anomalies.append({
            "code": "fleet_version_stagnation",
            "detail": (
                f"번들 {stamp_version} 도장 후 {m4_stamp_age_hours}h 경과 — "
                f"활성 에이전트 {len(active_agents)}대 중 해당 버전 이상 0대"
            ),
            "evidence": {
                "bundle_version": stamp_version,
                "active_agents": len(active_agents),
                "agents_on_latest": 0,
            },
        })

    # --- M5 catalog_bundle_mismatch ------------------------------------------
    if stamp_version:
        for platform in PLATFORMS:
            advertised = catalog.get(platform, "")
            if advertised and compare_versions(advertised, stamp_version) != 0:
                anomalies.append({
                    "code": "catalog_bundle_mismatch",
                    "platform": platform,
                    "detail": (
                        f"{platform} 카탈로그는 {advertised} 광고, 실제 번들 도장은 {stamp_version}"
                    ),
                    "evidence": {
                        "advertised_version": advertised,
                        "bundle_version": stamp_version,
                    },
                })

    anomalies.sort(key=lambda row: tuple(
        str(row.get(field) or "") for field in ("code", "kind", "stage", "worker_code", "platform")
    ))
    metrics = {
        "jobs_total": len(jobs),
        "jobs_resolved_recent": sum(bucket["rt"] for bucket in per_kind.values()),
        "kinds_checked": len(per_kind),
        "error_stage_groups": len(per_stage),
        "workers_checked": len(per_worker),
        "agents_total": len(agents),
        "agents_active": len(active_agents),
        "agents_on_latest": len(on_latest),
        "bundle_version": stamp_version,
        "catalog": catalog,
    }
    return {
        "ok": True,
        "anomalies": anomalies,
        "metrics": metrics,
        "signature": anomalies_signature(anomalies),
    }


def load_env_map(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for raw_line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="AIMAX server-data health metrics")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--downloads-dir", type=Path, default=DEFAULT_DOWNLOADS_DIR)
    parser.add_argument("--env-file", type=Path, default=DEFAULT_ENV_FILE)
    parser.add_argument("--m1-min-samples", type=int, default=10)
    parser.add_argument("--m1-baseline-multiplier", type=float, default=2.0)
    parser.add_argument("--m1-min-rate", type=float, default=0.5)
    parser.add_argument("--m2-min-count", type=int, default=5)
    parser.add_argument("--m2-multiplier", type=float, default=3.0)
    parser.add_argument("--m3-min-attempts", type=int, default=5)
    parser.add_argument("--m3-window-hours", type=int, default=72)
    parser.add_argument("--m4-stamp-age-hours", type=int, default=48)
    parser.add_argument("--m4-active-days", type=int, default=7)
    parser.add_argument("--recent-hours", type=int, default=24)
    parser.add_argument("--baseline-days", type=int, default=7)
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    result = collect_metrics(
        args.data_dir,
        args.downloads_dir,
        load_env_map(args.env_file),
        m1_min_samples=args.m1_min_samples,
        m1_baseline_multiplier=args.m1_baseline_multiplier,
        m1_min_rate=args.m1_min_rate,
        m2_min_count=args.m2_min_count,
        m2_multiplier=args.m2_multiplier,
        m3_min_attempts=args.m3_min_attempts,
        m3_window_hours=args.m3_window_hours,
        m4_stamp_age_hours=args.m4_stamp_age_hours,
        m4_active_days=args.m4_active_days,
        recent_hours=args.recent_hours,
        baseline_days=args.baseline_days,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
