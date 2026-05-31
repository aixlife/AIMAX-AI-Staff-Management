#!/usr/bin/env python3
"""Print a sanitized AIMAX operations snapshot.

Run on the Oracle server or with AIMAX_REPORT_DATA_DIR pointing at the
production data folder. This intentionally prints counts and redacted report
summaries only.
"""

from __future__ import annotations

import collections
import datetime as dt
import json
import os
from pathlib import Path


BASE = Path(os.environ.get("AIMAX_REPORT_DATA_DIR") or "/home/ubuntu/aimax-reports/data")
NOW = dt.datetime.now(dt.timezone.utc)


def load_json(name: str, default: dict) -> dict:
    try:
        return json.loads((BASE / name).read_text(encoding="utf-8"))
    except Exception:
        return default


def parse_time(value: object) -> dt.datetime | None:
    if not value:
        return None
    try:
        parsed = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=dt.timezone.utc)
    except Exception:
        return None


def within(value: object, days: int) -> bool:
    parsed = parse_time(value)
    return bool(parsed and NOW - parsed <= dt.timedelta(days=days))


def within_minutes(value: object, minutes: int) -> bool:
    parsed = parse_time(value)
    return bool(parsed and NOW - parsed <= dt.timedelta(minutes=minutes))


def count_by(items, key_fn):
    counts = collections.Counter()
    for item in items:
        key = key_fn(item)
        if isinstance(key, (list, tuple, set)):
            for value in key:
                counts[str(value or "-")] += 1
        else:
            counts[str(key or "-")] += 1
    return dict(counts.most_common())


def read_report_rows() -> list[dict]:
    path = BASE / "reports-index.jsonl"
    if not path.exists():
        return []
    rows: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            rows.append(json.loads(line))
        except Exception:
            pass
    return rows


def classify_report(row: dict) -> str:
    text = " ".join(
        str(row.get(key, "")).lower()
        for key in ("visible_error", "work_context", "public_message", "next_update_message")
    )
    patterns = [
        ("key_missing", ["api key", "api_key", "키", "토큰", "필요합니다"]),
        ("quota_429", ["quota", "429", "할당량"]),
        ("editor_contract", ["unexpected keyword", "input_content", "image_provider"]),
        ("login_credentials", ["invalid_credentials", "비밀번호", "맞지 않습니다"]),
        ("safe_storage", ["안전 저장소", "세션 토큰"]),
        ("agent_hang", ["진행이 안", "무한", "loading", "로딩"]),
        ("chromedriver_bounds", ["move target out of bounds"]),
    ]
    for label, needles in patterns:
        if any(needle in text for needle in needles):
            return label
    return "other"


def classify_job_failure(job: dict) -> str:
    text_parts: list[str] = []
    result = job.get("result") if isinstance(job.get("result"), dict) else {}
    text_parts.append(str(result.get("stage") or ""))
    text_parts.append(str(result.get("error") or ""))
    for log in (job.get("logs") or [])[-5:]:
        if isinstance(log, dict):
            text_parts.append(str(log.get("message") or ""))
    text = " ".join(text_parts).lower()
    patterns = [
        ("local_key_missing", ["api key", "키", "토큰", "필요합니다", "gemini", "openai", "claude"]),
        ("quota_429", ["quota", "429", "할당량"]),
        ("editor_contract", ["unexpected keyword", "input_content", "image_provider"]),
        ("editor_input", ["smart_editor_input", "본문 입력", "에디터"]),
        ("browser_driver", ["chromedriver", "move target", "session"]),
        ("encoding_result", ["인코딩", "결과 전송"]),
        ("content_generation", ["content_generation", "글 생성 실패"]),
    ]
    for label, needles in patterns:
        if any(needle in text for needle in needles):
            return label
    return "other"


def main() -> None:
    users = load_json("users.json", {"users": []}).get("users", [])
    agents = load_json("agents.json", {"agents": []}).get("agents", [])
    jobs = load_json("jobs.json", {"jobs": []}).get("jobs", [])
    commands = load_json("commands.json", {"commands": []}).get("commands", [])
    secrets = load_json("user-secrets.json", {"secrets": []}).get("secrets", [])
    reports = read_report_rows()

    print("=== USERS ===")
    print(
        {
            "total": len(users),
            "active": sum(user.get("status") == "active" for user in users),
            "must_change_password": sum(bool(user.get("must_change_password")) for user in users),
        }
    )
    print("products", count_by(users, lambda user: (user.get("entitlements") or {}).get("product") or user.get("product") or "-"))

    print("=== AGENTS ===")
    print(
        {
            "total_rows": len(agents),
            "seen_15m": sum(within_minutes(agent.get("last_seen_at") or agent.get("updated_at"), 15) for agent in agents),
            "seen_1h": sum(within_minutes(agent.get("last_seen_at") or agent.get("updated_at"), 60) for agent in agents),
            "seen_1d": sum(within(agent.get("last_seen_at") or agent.get("updated_at"), 1) for agent in agents),
            "seen_7d": sum(within(agent.get("last_seen_at") or agent.get("updated_at"), 7) for agent in agents),
            "connected_or_busy": sum(agent.get("status") in ("connected", "busy") for agent in agents),
            "distinct_seen_1h_users": len(
                {
                    agent.get("user_id")
                    for agent in agents
                    if agent.get("user_id") and within_minutes(agent.get("last_seen_at") or agent.get("updated_at"), 60)
                }
            ),
            "distinct_seen_1d_users": len(
                {
                    agent.get("user_id")
                    for agent in agents
                    if agent.get("user_id") and within(agent.get("last_seen_at") or agent.get("updated_at"), 1)
                }
            ),
        }
    )
    print("agent_platforms", count_by(agents, lambda agent: agent.get("platform") or agent.get("detected_platform") or "-"))
    print("agent_versions", count_by(agents, lambda agent: agent.get("version") or "-"))
    print("agent_status", count_by(agents, lambda agent: agent.get("status") or "-"))
    print("worker_yeri", count_by(agents, lambda agent: (((agent.get("readiness") or {}).get("workers") or {}).get("yeri_write") or "-")))
    print("worker_hyunju", count_by(agents, lambda agent: (((agent.get("readiness") or {}).get("workers") or {}).get("hyunju_find") or "-")))
    print("ai_gemini", count_by(agents, lambda agent: (((agent.get("readiness") or {}).get("ai_keys") or {}).get("gemini") or "-")))
    print("ai_openai", count_by(agents, lambda agent: (((agent.get("readiness") or {}).get("ai_keys") or {}).get("openai") or "-")))
    print("ai_claude", count_by(agents, lambda agent: (((agent.get("readiness") or {}).get("ai_keys") or {}).get("claude") or "-")))
    print("ai_apify", count_by(agents, lambda agent: (((agent.get("readiness") or {}).get("ai_keys") or {}).get("apify") or "-")))

    print("=== WEB_SECRETS ===")
    print("provider_counts", count_by(secrets, lambda secret: secret.get("provider") or "-"))
    print({"distinct_secret_users": len({secret.get("user_id") for secret in secrets if secret.get("user_id")})})

    print("=== JOBS ===")
    jobs_7d = [job for job in jobs if within(job.get("created_at"), 7)]
    jobs_30d = [job for job in jobs if within(job.get("created_at"), 30)]
    print({"total": len(jobs), "7d": len(jobs_7d), "30d": len(jobs_30d)})
    print("jobs_by_kind_status_30d", count_by(jobs_30d, lambda job: f"{job.get('kind') or '-'}:{job.get('status') or '-'}"))
    print("jobs_by_kind_status_7d", count_by(jobs_7d, lambda job: f"{job.get('kind') or '-'}:{job.get('status') or '-'}"))
    print("failed_yeri_classes_7d", count_by([job for job in jobs_7d if job.get("kind") == "yeri_write" and job.get("status") == "failed"], classify_job_failure))

    print("=== COMMANDS_7D ===")
    print(count_by([command for command in commands if within(command.get("created_at"), 7)], lambda command: f"{command.get('type') or '-'}:{command.get('status') or '-'}"))

    print("=== REPORTS ===")
    recent_reports = [row for row in reports if within(row.get("stored_at") or row.get("server_received_at"), 7)]
    print({"total_index": len(reports), "7d": len(recent_reports), "30d": sum(within(row.get("stored_at") or row.get("server_received_at"), 30) for row in reports)})
    print("reports_status_7d", count_by(recent_reports, lambda row: row.get("status") or "new"))
    print("reports_os_7d", count_by(recent_reports, lambda row: row.get("os") or "-"))
    print("reports_app_version_7d", count_by(recent_reports, lambda row: row.get("app_version") or "-"))
    print("reports_classes_7d", count_by(recent_reports, classify_report))

    print("latest_reports_redacted")
    for row in reports[-8:]:
        print({key: row.get(key, "") for key in ("report_id", "stored_at", "status", "os", "app_version", "work_context", "visible_error")})


if __name__ == "__main__":
    main()
