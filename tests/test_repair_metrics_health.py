#!/usr/bin/env python3
"""지표 5종 + watchdog 통합 + agent.sh 게이트 fixture 테스트 (python3 단독 실행형).

실행: python3 tests/test_repair_metrics_health.py
서버 접속 없음 — 전부 임시 디렉토리 fixture 로만 검증한다.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import UTC, datetime, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SCRIPTS = REPO / "scripts"
sys.path.insert(0, str(SCRIPTS))

import aimax_health_metrics as hm  # noqa: E402

NOW = datetime(2026, 8, 30, 12, 0, 0, tzinfo=UTC)
PASSED: list[str] = []
FAILED: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    if condition:
        PASSED.append(name)
        print(f"PASS {name}")
    else:
        FAILED.append(name)
        print(f"FAIL {name} {detail}")


def iso(now: datetime, hours_ago: float) -> str:
    return (now - timedelta(hours=hours_ago)).strftime("%Y-%m-%dT%H:%M:%SZ")


def job(now: datetime, hours_ago: float, *, kind="yeri_write", status="done",
        failed_stage="", worker_code="", target_platform="windows") -> dict:
    row = {
        "kind": kind,
        "status": status,
        "created_at": iso(now, hours_ago),
        "updated_at": iso(now, hours_ago - 0.1),
        "target_platform": target_platform,
    }
    if failed_stage:
        row["failed_stage"] = failed_stage
        row["failed_reason"] = f"{failed_stage}_reason"
    if worker_code:
        row["worker_code"] = worker_code
    return row


def agent_row(now: datetime, seen_hours_ago: float, version: str, platform="windows") -> dict:
    return {
        "id": f"a-{version}-{seen_hours_ago}",
        "user_id": "u1",
        "version": version,
        "platform": platform,
        "device_label": "",
        "last_seen_at": iso(now, seen_hours_ago),
        "updated_at": iso(now, seen_hours_ago),
    }


def make_dirs(base: Path, jobs=None, agents=None, stamp=None) -> tuple[Path, Path]:
    data_dir = base / "data"
    downloads_dir = base / "downloads"
    data_dir.mkdir(parents=True, exist_ok=True)
    downloads_dir.mkdir(parents=True, exist_ok=True)
    if jobs is not None:
        (data_dir / "jobs.json").write_text(json.dumps({"jobs": jobs}), encoding="utf-8")
    if agents is not None:
        (data_dir / "agents.json").write_text(json.dumps({"agents": agents}), encoding="utf-8")
    if stamp is not None:
        (downloads_dir / "aimax-bundle-versions.json").write_text(json.dumps(stamp), encoding="utf-8")
    return data_dir, downloads_dir


def collect(base: Path, env=None, now=NOW, **kwargs) -> dict:
    return hm.collect_metrics(base / "data", base / "downloads", env or {}, now, **kwargs)


def codes(result: dict) -> list[str]:
    return [row["code"] for row in result["anomalies"]]


def main() -> int:
    tmp = Path(tempfile.mkdtemp(prefix="aimax-metrics-test-"))
    try:
        run_all(tmp)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"\n{len(PASSED)} passed, {len(FAILED)} failed")
    return 1 if FAILED else 0


def run_all(tmp: Path) -> None:
    # ---------- M1 job_failure_surge ----------
    base = tmp / "m1-fire"
    jobs = (
        [job(NOW, h, status="failed") for h in range(1, 9)]           # recent: 8 failed
        + [job(NOW, 10 + h * 0.5, status="done") for h in range(4)]   # recent: 4 done → 8/12=0.667
        + [job(NOW, 30 + h * 3, status="done") for h in range(18)]    # baseline: 18 done
        + [job(NOW, 40, status="failed"), job(NOW, 50, status="failed")]  # baseline: 2 failed → 0.1
    )
    make_dirs(base, jobs=jobs)
    r = collect(base)
    check("M1 fire", "job_failure_surge" in codes(r), json.dumps(codes(r)))

    base = tmp / "m1-nofire-rate"
    jobs = (
        [job(NOW, h, status="failed") for h in range(1, 4)]           # 3 failed / 12 = 0.25 < 0.5
        + [job(NOW, 5 + h, status="done") for h in range(9)]
    )
    make_dirs(base, jobs=jobs)
    check("M1 no-fire (rate<0.5)", "job_failure_surge" not in codes(collect(base)))

    base = tmp / "m1-nofire-samples"
    jobs = [job(NOW, h, status="failed") for h in range(1, 10)]        # 9 < 10 표본
    make_dirs(base, jobs=jobs)
    check("M1 no-fire (표본<10)", "job_failure_surge" not in codes(collect(base)))

    base = tmp / "m1-nofire-baseline"
    jobs = (
        [job(NOW, h, status="failed") for h in range(1, 8)]            # recent 7/12=0.583
        + [job(NOW, 8 + h * 0.2, status="done") for h in range(5)]
        + [job(NOW, 30 + h, status="failed") for h in range(10)]       # baseline 10/20=0.5 → 2배 미달
        + [job(NOW, 45 + h, status="done") for h in range(10)]
    )
    make_dirs(base, jobs=jobs)
    check("M1 no-fire (기준선 2배 미달)", "job_failure_surge" not in codes(collect(base)))

    # ---------- M2 error_code_surge ----------
    base = tmp / "m2-fire"
    jobs = (
        [job(NOW, 1 + h, status="failed", failed_stage="naver_login") for h in range(6)]  # recent 6
        + [job(NOW, 30 + h * 20, status="failed", failed_stage="naver_login") for h in range(7)]  # 일평균 1.0
    )
    make_dirs(base, jobs=jobs)
    r = collect(base)
    check("M2 fire", "error_code_surge" in codes(r), json.dumps(codes(r)))
    m2 = [row for row in r["anomalies"] if row["code"] == "error_code_surge"]
    check("M2 identity fields", m2 and m2[0].get("kind") == "yeri_write" and m2[0].get("stage") == "naver_login")

    base = tmp / "m2-nofire-count"
    jobs = [job(NOW, 1 + h, status="failed", failed_stage="naver_login") for h in range(4)]  # 4 < 5
    make_dirs(base, jobs=jobs)
    check("M2 no-fire (n<5)", "error_code_surge" not in codes(collect(base)))

    base = tmp / "m2-nofire-ratio"
    jobs = (
        [job(NOW, 1 + h, status="failed", failed_stage="naver_login") for h in range(6)]   # recent 6
        + [job(NOW, 30 + h * 5, status="failed", failed_stage="naver_login") for h in range(21)]  # 일평균 3.0 → 3배=9 미달
    )
    make_dirs(base, jobs=jobs)
    check("M2 no-fire (3배 미달)", "error_code_surge" not in codes(collect(base)))

    # ---------- M3 worker_zero_success ----------
    base = tmp / "m3-fire"
    jobs = [job(NOW, 30 + h * 5, status="failed", worker_code="hyunju") for h in range(6)]
    make_dirs(base, jobs=jobs)
    r = collect(base)
    check("M3 fire", "worker_zero_success" in codes(r), json.dumps(codes(r)))

    base = tmp / "m3-nofire-success"
    jobs = (
        [job(NOW, 30 + h * 5, status="failed", worker_code="hyunju") for h in range(6)]
        + [job(NOW, 60, status="ready_for_publish", worker_code="hyunju")]
    )
    make_dirs(base, jobs=jobs)
    check("M3 no-fire (성공 1건)", "worker_zero_success" not in codes(collect(base)))

    base = tmp / "m3-nofire-attempts"
    jobs = [job(NOW, 30 + h * 5, status="failed", worker_code="hyunju") for h in range(4)]  # 4 < 5
    make_dirs(base, jobs=jobs)
    check("M3 no-fire (시도<5)", "worker_zero_success" not in codes(collect(base)))

    base = tmp / "m3-nofire-window"
    jobs = [job(NOW, 80 + h * 5, status="failed", worker_code="hyunju") for h in range(6)]  # 72h 밖
    make_dirs(base, jobs=jobs)
    check("M3 no-fire (72h 밖)", "worker_zero_success" not in codes(collect(base)))

    # ---------- M4 fleet_version_stagnation ----------
    stamp = {"version": "v1.0.63", "stamped_at": iso(NOW, 72), "files": {}}
    base = tmp / "m4-fire"
    make_dirs(base, agents=[agent_row(NOW, 1, "v1.0.59"), agent_row(NOW, 2, "v1.0.61"), agent_row(NOW, 300, "v1.0.63")], stamp=stamp)
    r = collect(base)
    check("M4 fire", "fleet_version_stagnation" in codes(r), json.dumps(codes(r)))
    check("M4 evidence counts", any(row["code"] == "fleet_version_stagnation" and row["evidence"]["active_agents"] == 2 for row in r["anomalies"]))

    base = tmp / "m4-nofire-onlatest"
    make_dirs(base, agents=[agent_row(NOW, 1, "v1.0.59"), agent_row(NOW, 2, "1.0.63")], stamp=stamp)
    check("M4 no-fire (최신 1대, v접두 무시 비교)", "fleet_version_stagnation" not in codes(collect(base)))

    base = tmp / "m4-nofire-fresh"
    make_dirs(base, agents=[agent_row(NOW, 1, "v1.0.59")], stamp={"version": "v1.0.63", "stamped_at": iso(NOW, 24), "files": {}})
    check("M4 no-fire (도장 48h 미만)", "fleet_version_stagnation" not in codes(collect(base)))

    base = tmp / "m4-nofire-noactive"
    make_dirs(base, agents=[agent_row(NOW, 200, "v1.0.59")], stamp=stamp)
    check("M4 no-fire (활성 에이전트 0)", "fleet_version_stagnation" not in codes(collect(base)))

    # ---------- M5 catalog_bundle_mismatch ----------
    env = {"AIMAX_MACOS_LATEST_AGENT_VERSION": "v1.0.63", "AIMAX_WINDOWS_LATEST_AGENT_VERSION": "v1.0.63"}
    base = tmp / "m5-fire"
    make_dirs(base, stamp={"version": "v1.0.61", "stamped_at": iso(NOW, 1), "files": {}})
    r = collect(base, env=env)
    check("M5 fire (양 플랫폼)", codes(r).count("catalog_bundle_mismatch") == 2, json.dumps(r["anomalies"]))

    base = tmp / "m5-nofire-equal"
    make_dirs(base, stamp={"version": "1.0.63", "stamped_at": iso(NOW, 1), "files": {}})
    check("M5 no-fire (v접두 차이는 동일 취급)", "catalog_bundle_mismatch" not in codes(collect(base, env=env)))

    base = tmp / "m5-fallback"
    make_dirs(base, stamp={"version": "v1.0.61", "stamped_at": iso(NOW, 1), "files": {}})
    r = collect(base, env={"AIMAX_LATEST_AGENT_VERSION": "v1.0.63"})
    check("M5 fire (전역 폴백 env)", codes(r).count("catalog_bundle_mismatch") == 2)

    base = tmp / "m5-nofire-noenv"
    make_dirs(base, stamp={"version": "v1.0.61", "stamped_at": iso(NOW, 1), "files": {}})
    check("M5 no-fire (카탈로그 env 없음)", "catalog_bundle_mismatch" not in codes(collect(base, env={})))

    # ---------- 신규 환경: 소스 파일 전무 ----------
    base = tmp / "empty"
    make_dirs(base)
    r = collect(base)
    check("빈 환경 anomaly 0건", r["ok"] and r["anomalies"] == [])

    # ---------- 서명 안정성: 같은 anomaly 집합, 다른 시각 ----------
    def build_shifted(dirname: str, now: datetime) -> dict:
        base = tmp / dirname
        jobs = [job(now, 30 + h * 5, status="failed", worker_code="hyunju") for h in range(6)]
        make_dirs(base, jobs=jobs, agents=[agent_row(now, 1, "v1.0.59")],
                  stamp={"version": "v1.0.63", "stamped_at": iso(now, 72), "files": {}})
        return collect(base, env={"AIMAX_LATEST_AGENT_VERSION": "v1.0.63"}, now=now)

    r1 = build_shifted("sig-a", NOW)
    r2 = build_shifted("sig-b", NOW + timedelta(hours=6, minutes=17))
    check("서명 준비: anomaly 2건 이상", len(r1["anomalies"]) >= 2, json.dumps(codes(r1)))
    check("서명 안정성 (시각 이동 → 동일)", r1["signature"] == r2["signature"],
          f"{r1['signature'][:12]} vs {r2['signature'][:12]}")
    check("서명 구분 (다른 집합 → 다름)", r1["signature"] != hm.anomalies_signature([]))
    for row in r1["anomalies"]:
        text = json.dumps(row, ensure_ascii=False)
        check(f"anomaly에 절대시각 없음 ({row['code']})", "2026-" not in text, text)

    # ---------- watchdog 통합 (subprocess) ----------
    watchdog = str(SCRIPTS / "aimax_report_watchdog.py")

    def run_watchdog(base: Path, *extra: str) -> dict:
        cmd = [sys.executable, watchdog,
               "--data-dir", str(base / "data"),
               "--downloads-dir", str(base / "downloads"),
               "--env-file", str(base / "nonexistent.env"), *extra]
        proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if proc.returncode != 0:
            raise AssertionError(f"watchdog rc={proc.returncode}: {proc.stderr[:400]}")
        return json.loads(proc.stdout)

    base = tmp / "wd-anomaly-only"
    real_now = hm.utc_now()  # subprocess 는 실제 현재시각으로 돌므로 fixture 도 실시간 기준으로 만든다
    make_dirs(base, jobs=[job(real_now, 30 + h * 5, status="failed", worker_code="hyunju") for h in range(6)])
    r = run_watchdog(base)
    check("watchdog: 리포트 0 + anomaly만 → send_allowed", r["send_allowed"] is True, json.dumps(r)[:300])
    check("watchdog: anomaly_count>=1", r["anomaly_count"] >= 1)
    check("watchdog: stale/ticket 0 유지", r["stale_report_count"] == 0 and r["open_ticket_count"] == 0)
    check("watchdog: message에 지표 섹션", "지표 이상:" in r["message"], r["message"])
    check("watchdog: metrics 요약 포함", isinstance(r.get("metrics"), dict) and r["metrics"].get("jobs_total") == 6)
    sig_first = r["signature"]
    r_again = run_watchdog(base)
    check("watchdog: 재실행 서명 동일", r_again["signature"] == sig_first)

    r_off = run_watchdog(base, "--no-metrics")
    check("watchdog: --no-metrics → anomaly 0/발송 없음", r_off["anomaly_count"] == 0 and r_off["send_allowed"] is False)

    base = tmp / "wd-empty"
    make_dirs(base)
    r = run_watchdog(base)
    check("watchdog: 빈 환경 조용히 통과", r["ok"] and r["anomaly_count"] == 0 and r["send_allowed"] is False and "metrics_error" not in r)

    # ---------- watchdog 격리: 지표 계산 실패해도 기존 기능 유지 (in-process) ----------
    import types
    import io
    import contextlib
    import aimax_report_watchdog as wd

    broken = types.ModuleType("aimax_health_metrics")
    def _boom(*_a, **_k):
        raise RuntimeError("boom")
    broken.collect_metrics = _boom
    saved = sys.modules.get("aimax_health_metrics")
    sys.modules["aimax_health_metrics"] = broken
    try:
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            rc = wd.main(["--data-dir", str(base / "data"),
                          "--downloads-dir", str(base / "downloads"),
                          "--env-file", str(base / "nonexistent.env")])
        r = json.loads(buf.getvalue())
        check("watchdog: 지표 실패 격리 (metrics_error만 기록)",
              rc == 0 and r["ok"] and r.get("metrics_error") == "RuntimeError" and r["anomaly_count"] == 0)
    finally:
        if saved is not None:
            sys.modules["aimax_health_metrics"] = saved

    # ---------- agent.sh 게이트 (bash 모킹) ----------
    if not shutil.which("jq") or not shutil.which("bash"):
        check("agent.sh 게이트 (jq/bash 필요)", False, "jq 또는 bash 없음")
        return
    stub_dir = tmp / "stub-bin"
    stub_dir.mkdir(exist_ok=True)
    (stub_dir / "flock").write_text("#!/bin/sh\nexit 0\n")
    openclaw_log = tmp / "openclaw-calls.log"
    (stub_dir / "openclaw-stub").write_text(
        "#!/bin/sh\n"
        f"printf '%s\\n---ARGS-END---\\n' \"$*\" >> '{openclaw_log}'\n"
        "exit 0\n"
    )
    for name in ("flock", "openclaw-stub"):
        os.chmod(stub_dir / name, 0o755)

    def run_agent(base: Path, state: Path) -> dict:
        env2 = dict(os.environ)
        env2.update({
            "PATH": f"{stub_dir}:{env2['PATH']}",
            "AIMAX_REPORT_DATA_DIR": str(base / "data"),
            "AIMAX_REPAIR_AGENT_STATE_FILE": str(state),
            "AIMAX_REPAIR_AGENT_LOCK_FILE": str(tmp / "agent.lock"),
            "AIMAX_REPAIR_AGENT_OPENCLAW_BIN": str(stub_dir / "openclaw-stub"),
        })
        proc = subprocess.run(["bash", str(SCRIPTS / "aimax_error_repair_agent.sh")],
                              capture_output=True, text=True, env=env2, check=False)
        if proc.returncode != 0:
            raise AssertionError(f"agent.sh rc={proc.returncode}: {proc.stderr[:400]}")
        return json.loads(proc.stdout)

    state = tmp / "agent-state.json"
    base = tmp / "wd-anomaly-only"  # anomaly만 있는 fixture 재사용
    r = run_agent(base, state)
    check("agent.sh: anomaly만으로 게이트 통과·실행", r.get("launched") is True and r.get("anomaly_count", 0) >= 1, json.dumps(r))
    log_text = openclaw_log.read_text(encoding="utf-8") if openclaw_log.exists() else ""
    check("agent.sh: 프롬프트에 지표 요약 포함", "지표 이상:" in log_text and "worker_zero_success" in log_text)

    r = run_agent(base, state)
    check("agent.sh: 같은 서명 반복 → repeat_window 억제", r.get("skipped") == "repeat_window", json.dumps(r))

    base = tmp / "wd-empty"
    r = run_agent(base, state)
    check("agent.sh: 전부 0건 → skip", r.get("skipped") == "no_repair_candidates", json.dumps(r))


if __name__ == "__main__":
    raise SystemExit(main())
