#!/usr/bin/env python3
"""Capture AIMAX Codex session/status snapshots into the synced Obsidian vault."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


KST = ZoneInfo("Asia/Seoul")
PROJECT = "AIMAX-AI-Staff-Management"
REPO = Path("/Users/aixlife/Projects/AIMAX-AI-Staff-Management")
CODEX_SESSIONS = Path.home() / ".codex" / "sessions"
VAULT = Path.home() / "Documents" / "creator-os-vault"
REPORT_DIR = VAULT / "reports" / "aimax"
OBSIDIAN_SESSION_DIR = VAULT / "sessions" / PROJECT
PROJECT_MOC = VAULT / "projects" / f"{PROJECT}.md"
CURRENT_MARKERS = (
    "지금까지 작업끝을 못맺은것도",
    "맥에 자동화두면서",
    "오라킁",
    "오라클은 싱크띵",
)
AIMAX_TERMS = (
    "AIMAX-AI-Staff-Management",
    "aimax-reports-api",
    "/Users/aixlife/Projects/AIMAX-AI-Staff-Management",
    "Shared-Bridge/20_Deploy-To-Windows",
    "WINDOWS_RESULT_",
    "oracle-deploy-202605",
    "R3-",
    "R3K",
    "R3-K",
    "v1.0.",
    "로컬 실행기",
    "Local Agent",
    "회사비서",
)
NON_REPO_TERMS = (
    "aimax-reports-api",
    "api.aimax.ai.kr/app",
    "Shared-Bridge/20_Deploy-To-Windows",
    "AIMAX.app",
    "Songi To Yunmi",
    "송이 결과",
    "윤미 스크립트",
    "로컬 실행기",
)
ARTIFACT_DIRS = (
    REPO / "docs" / "deployments",
    REPO / "docs" / "testing",
    REPO / "docs" / "maintenance_reports",
    REPO / "handoffs",
    Path.home() / "Documents" / "Shared-Bridge" / "20_Deploy-To-Windows",
)


@dataclass
class SessionSummary:
    started_at: str
    updated_at: str
    session_id: str
    cwd: str
    path: str
    first_user: str
    last_user: str
    last_answer: str
    mentioned_files: list[str]
    source_status: str


@dataclass
class ArtifactSummary:
    updated_at: str
    path: str
    title: str
    signal: str


def kst_now() -> datetime:
    return datetime.now(KST)


def parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized).astimezone(KST)
    except ValueError:
        return None


def clean_text(text: str, limit: int = 420) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    if len(text) > limit:
        return text[: limit - 1].rstrip() + "…"
    return text


def text_from_content(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                parts.append(item.get("text") or item.get("input_text") or item.get("output_text") or "")
        return "\n".join(part for part in parts if part)
    return ""


def is_bootstrap_or_approval_text(text: str) -> bool:
    stripped = text.strip()
    return (
        stripped.startswith("# AGENTS.md instructions")
        or stripped.startswith("<environment_context>")
        or stripped.startswith("The following is the Codex agent history added since your last approval assessment")
        or stripped.startswith("<turn_aborted>")
    )


def is_approval_review_text(text: str) -> bool:
    stripped = text.strip()
    return stripped.startswith("The following is the Codex agent history")


def extract_paths(text: str) -> list[str]:
    patterns = [
        r"/Users/aixlife/[^\s\]\)\"']+",
        r"(?:docs|scripts|handoffs|oracle|local_agent)/[^\s\]\)\"']+",
        r"WINDOWS_[A-Z0-9_]+\.md",
        r"aimax-[^\s\]\)\"']+",
    ]
    found: list[str] = []
    for pattern in patterns:
        found.extend(re.findall(pattern, text))
    deduped = []
    seen = set()
    for item in found:
        item = item.rstrip(".,")
        if item not in seen:
            seen.add(item)
            deduped.append(item)
    return deduped[:12]


def iter_jsonl(path: Path):
    with path.open("r", encoding="utf-8", errors="replace") as handle:
        for line in handle:
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def summarize_session(path: Path, current_paths: set[Path]) -> SessionSummary | None:
    if path in current_paths:
        return None

    meta: dict = {}
    first_user = ""
    last_user = ""
    last_answer = ""
    activity_window: list[str] = []
    mentioned_files: list[str] = []
    relevant = False

    for obj in iter_jsonl(path):
        payload = obj.get("payload") or {}
        if obj.get("type") == "session_meta":
            meta = payload
            cwd = str(payload.get("cwd") or "")
            if PROJECT in cwd or "AIMAX" in cwd:
                relevant = True

        if obj.get("type") == "response_item":
            role = payload.get("role")
            if role == "user":
                text = clean_text(text_from_content(payload.get("content")), 700)
                if text and not is_bootstrap_or_approval_text(text):
                    if not first_user:
                        first_user = text
                    last_user = text
                    activity_window.append(text)
            elif role == "assistant" and payload.get("phase") == "final_answer":
                text = clean_text(text_from_content(payload.get("content")), 900)
                if text:
                    last_answer = text
                    activity_window.append(text)

        if obj.get("type") == "event_msg":
            event_payload = payload or {}
            if event_payload.get("phase") == "final_answer":
                text = clean_text(event_payload.get("message") or event_payload.get("last_agent_message") or "", 900)
                if text:
                    last_answer = text
                    activity_window.append(text)

        if len(activity_window) > 20:
            activity_window = activity_window[-20:]

    if last_answer.strip().startswith('{"risk_level"') or is_approval_review_text(first_user):
        return None

    combined = "\n".join(activity_window)
    cwd = str(meta.get("cwd") or "")
    if not cwd.startswith(str(REPO)) and not any(term in combined for term in NON_REPO_TERMS):
        return None

    if any(term in combined for term in AIMAX_TERMS):
        relevant = True
    if not relevant:
        return None

    mentioned_files = extract_paths(combined)
    stat = path.stat()
    updated = datetime.fromtimestamp(stat.st_mtime, KST)
    started = parse_timestamp(meta.get("timestamp")) or updated
    return SessionSummary(
        started_at=started.strftime("%Y-%m-%d %H:%M:%S %Z"),
        updated_at=updated.strftime("%Y-%m-%d %H:%M:%S %Z"),
        session_id=str(meta.get("id") or path.stem),
        cwd=str(meta.get("cwd") or ""),
        path=str(path),
        first_user=first_user,
        last_user=last_user,
        last_answer=last_answer,
        mentioned_files=mentioned_files,
        source_status="backfilled",
    )


def find_current_session_paths(since: datetime | None = None) -> set[Path]:
    current = set()
    for path in CODEX_SESSIONS.glob("2026/05/**/*.jsonl"):
        if since is not None:
            try:
                updated = datetime.fromtimestamp(path.stat().st_mtime, KST)
            except OSError:
                continue
            if updated < since:
                continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        if any(marker in text for marker in CURRENT_MARKERS):
            current.add(path)
    return current


def collect_sessions(since: datetime, current_paths: set[Path]) -> list[SessionSummary]:
    sessions: list[SessionSummary] = []
    for path in CODEX_SESSIONS.glob("2026/05/**/*.jsonl"):
        try:
            updated = datetime.fromtimestamp(path.stat().st_mtime, KST)
        except OSError:
            continue
        if updated < since:
            continue
        summary = summarize_session(path, current_paths)
        if summary:
            sessions.append(summary)
    sessions.sort(key=lambda item: item.updated_at)
    return sessions


def artifact_title_and_signal(path: Path) -> tuple[str, str]:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return path.name, ""
    title = path.name
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            title = stripped.lstrip("#").strip()
            break
    signal_lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        lowered = stripped.lower()
        if (
            "verdict:" in lowered
            or "status" in lowered
            or "pass" == lowered
            or "deployed" in lowered
            or "verification" in lowered
            or "version:" in lowered
            or "live deployment" in lowered
        ):
            signal_lines.append(stripped)
        if len(signal_lines) >= 4:
            break
    return title, " / ".join(signal_lines)


def collect_artifacts(since: datetime) -> list[ArtifactSummary]:
    artifacts: list[ArtifactSummary] = []
    for root in ARTIFACT_DIRS:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in {".md", ".json"}:
                continue
            try:
                updated = datetime.fromtimestamp(path.stat().st_mtime, KST)
            except OSError:
                continue
            if updated < since:
                continue
            title, signal = artifact_title_and_signal(path)
            artifacts.append(
                ArtifactSummary(
                    updated_at=updated.strftime("%Y-%m-%d %H:%M:%S %Z"),
                    path=str(path),
                    title=title,
                    signal=clean_text(signal, 360),
                )
            )
    artifacts.sort(key=lambda item: item.updated_at)
    return artifacts[-24:]


def infer_current_status(sessions: list[SessionSummary], artifacts: list[ArtifactSummary]) -> dict:
    corpus = "\n".join(
        [item.last_answer for item in sessions[-20:]]
        + [f"{item.title} {item.signal}" for item in artifacts[-20:]]
    )

    today_progress: list[str] = []
    if "R3-K" in corpus or "v1.0.26" in corpus:
        today_progress.append("직원들이 AIMAX를 안정적으로 실행할 수 있도록 PC 실행 문제를 점검했고, 맥과 윈도우에서 실행 확인까지 마쳤습니다.")
    if "Songi To Yunmi" in corpus or "송이" in corpus and "윤미" in corpus:
        today_progress.append("송이가 조사한 내용을 윤미가 글 작성에 활용할 수 있도록 넘기는 흐름을 확인했습니다.")
    if "회사비서" in corpus or "aimax_evening_staff_report" in corpus:
        today_progress.append("회사비서의 오후 6시 진행상황 보고는 실제 발송 전 테스트 문장 생성까지 확인했습니다.")
    if not today_progress:
        today_progress.append("최근 작업 기록을 모아 현재 진행상황을 다시 정리했습니다.")

    return {
        "generated_at": kst_now().strftime("%Y-%m-%d %H:%M:%S %Z"),
        "source": "mac-codex-session-snapshot",
        "project": PROJECT,
        "session_count": len(sessions),
        "artifact_count": len(artifacts),
        "summary": "PC 실행 문제를 먼저 잡고, 송이→윤미 연결과 회사비서 보고 테스트까지 확인했습니다.",
        "today_progress": today_progress,
        "staff_status": {
            "송이": "자료조사 연결 준비, 실제 링크 테스트 남음",
            "윤미": "송이 자료로 글 초안 만들 준비 완료",
            "나경": "직원용 앱 테스트 대기",
            "회사비서": "그룹방 자동 보고 전, 테스트 보고 확인 중",
        },
        "delays": [
            "송이 실제 링크 테스트",
            "회사비서 오후 6시 자동 발송 등록",
        ],
        "reason": "직원들이 프로그램을 안정적으로 실행하는 문제가 먼저 확인되어 우선 처리했습니다.",
        "next_goal": "실제 링크로 송이를 테스트하고, 회사비서 18시 보고 자동화를 연결합니다.",
        "latest_sessions": [asdict(item) for item in sessions[-12:]],
        "latest_artifacts": [asdict(item) for item in artifacts[-12:]],
    }


def render_backfill(sessions: list[SessionSummary], artifacts: list[ArtifactSummary], current_paths: set[Path]) -> str:
    now = kst_now().strftime("%Y-%m-%d %H:%M:%S %Z")
    lines = [
        "---",
        "type: codex-session-backfill",
        f"project: {PROJECT}",
        f"created: {now}",
        "source: mac-codex-session-snapshot",
        "tags: [codex, aimax-ai-staff-management, backfill]",
        "---",
        "",
        f"# AIMAX 미종료 Codex 세션 백필 - {now[:10]}",
        "",
        f"- 생성 시각: {now}",
        f"- 제외한 현재 대화 파일: {', '.join(str(path) for path in sorted(current_paths)) or '없음'}",
        f"- 백필 세션 수: {len(sessions)}",
        f"- 최근 산출물 수: {len(artifacts)}",
        "",
        "## 요약",
        "- 이 노트는 `작업끝`으로 저장되지 않은 AIMAX 관련 Mac Codex 세션을 현재 대화 제외 조건으로 한 번에 묶은 백필 기록이다.",
        "- 세션 원문은 Mac `~/.codex/sessions`에 남아 있고, 이 노트는 Oracle 회사비서가 Syncthing Obsidian에서 읽기 쉬운 판단용 색인이다.",
        "- 세부 완료 여부는 아래 세션 결과와 최근 Windows/배포 산출물 링크를 함께 보고 판단한다.",
        "",
        "## 백필 세션",
    ]

    by_date: dict[str, list[SessionSummary]] = {}
    for session in sessions:
        by_date.setdefault(session.updated_at[:10], []).append(session)

    for day, items in sorted(by_date.items()):
        lines += ["", f"### {day}"]
        for item in items:
            lines += [
                "",
                f"#### {item.updated_at[11:19]} / {item.session_id}",
                f"- CWD: `{item.cwd}`",
                f"- 원본: `{item.path}`",
            ]
            if item.first_user:
                lines.append(f"- 시작 요청: {item.first_user}")
            if item.last_user and item.last_user != item.first_user:
                lines.append(f"- 마지막 요청: {item.last_user}")
            if item.last_answer:
                lines.append(f"- 마지막 결과: {item.last_answer}")
            if item.mentioned_files:
                lines.append("- 언급 파일:")
                lines.extend(f"  - `{path}`" for path in item.mentioned_files[:8])

    lines += ["", "## 최근 산출물"]
    for artifact in artifacts:
        lines += [
            "",
            f"- {artifact.updated_at} — `{artifact.path}`",
            f"  - {artifact.title}",
        ]
        if artifact.signal:
            lines.append(f"  - 신호: {artifact.signal}")

    lines += [
        "",
        "## 연결 맥락",
        f"- [[projects/{PROJECT}|{PROJECT}]] — AIMAX 진행/배포/직원 개발 상태를 이어서 판단하기 위한 프로젝트 지도",
        "- [[concepts/자동화시스템|자동화시스템]] — Mac 캡처, Syncthing 공유, Oracle 보고 루틴을 연결하는 반복 운영 구조",
        "- [[concepts/운영보고|운영보고]] — 대표/팀원이 이해할 수 있는 짧은 보고 형식으로 변환할 대상",
        "",
    ]
    return "\n".join(lines)


def render_current_markdown(status: dict) -> str:
    lines = [
        "---",
        "type: aimax-current-status",
        f"project: {PROJECT}",
        f"updated: {status['generated_at']}",
        "source: mac-codex-session-snapshot",
        "tags: [aimax, current-status, company-assistant]",
        "---",
        "",
        "# AIMAX Current Status",
        "",
        f"- 업데이트: {status['generated_at']}",
        f"- 세션 수: {status['session_count']}",
        f"- 산출물 수: {status['artifact_count']}",
        f"- 한 줄 요약: {status.get('summary', '')}",
        "",
        "## 오늘 진행",
    ]
    lines.extend(f"- {item}" for item in status["today_progress"])
    lines += ["", "## 직원별 현황"]
    for staff, text in status["staff_status"].items():
        lines.append(f"- {staff}: {text}")
    lines += ["", "## 지연"]
    lines.extend(f"- {item}" for item in status["delays"])
    lines += ["", "## 이유", f"- {status['reason']}", "", "## 다음 목표", f"- {status['next_goal']}", ""]
    return "\n".join(lines)


def write_outputs(status: dict, backfill: str, write_session_backfill: bool = True) -> dict[str, str]:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    current_json = REPORT_DIR / "current-status.json"
    current_md = REPORT_DIR / "current-status.md"
    latest_backfill = REPORT_DIR / "latest-backfill.md"

    current_json.write_text(json.dumps(status, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    current_md.write_text(render_current_markdown(status), encoding="utf-8")
    latest_backfill.write_text(backfill, encoding="utf-8")

    written = {
        "current_json": str(current_json),
        "current_md": str(current_md),
        "latest_backfill": str(latest_backfill),
    }

    if write_session_backfill:
        OBSIDIAN_SESSION_DIR.mkdir(parents=True, exist_ok=True)
        backfill_name = f"{kst_now().strftime('%Y-%m-%d')}_{PROJECT}_codex_backfill_{kst_now().strftime('%H%M%S')}.md"
        backfill_path = OBSIDIAN_SESSION_DIR / backfill_name
        backfill_path.write_text(backfill, encoding="utf-8")
        written["backfill"] = str(backfill_path)

        if PROJECT_MOC.exists():
            content = PROJECT_MOC.read_text(encoding="utf-8", errors="replace")
            line = f"- [[sessions/{PROJECT}/{backfill_path.stem}|{kst_now().strftime('%Y-%m-%d')} 미종료 세션 백필]] — Mac Codex 세션과 최근 AIMAX 산출물을 묶어 Oracle 회사비서가 읽을 수 있게 정리"
            if line not in content:
                if "## Sessions" not in content:
                    content = content.rstrip() + "\n\n## Sessions\n"
                content = content.rstrip() + f"\n{line}\n"
                PROJECT_MOC.write_text(content, encoding="utf-8")

    return written


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Capture AIMAX Mac Codex status into Obsidian")
    parser.add_argument("--since", default="2026-05-23", help="KST date to include sessions/artifacts from")
    parser.add_argument("--write", action="store_true", help="Write Obsidian outputs")
    parser.add_argument("--json", action="store_true", help="Print machine-readable status")
    parser.add_argument(
        "--no-session-backfill",
        action="store_true",
        help="Update current report files only; do not create a dated Obsidian session note or update the project MOC",
    )
    parser.add_argument(
        "--exclude-current-markers",
        action="store_true",
        help="Exclude sessions containing the one-time current-conversation marker phrases",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    since_date = datetime.fromisoformat(args.since).replace(tzinfo=KST)
    current_paths = find_current_session_paths() if args.exclude_current_markers else set()
    sessions = collect_sessions(since_date, current_paths)
    artifacts = collect_artifacts(since_date)
    status = infer_current_status(sessions, artifacts)
    backfill = render_backfill(sessions, artifacts, current_paths)

    written: dict[str, str] = {}
    if args.write:
        written = write_outputs(status, backfill, write_session_backfill=not args.no_session_backfill)

    if args.json:
        print(
            json.dumps(
                {
                    "ok": True,
                    "sessions": len(sessions),
                    "artifacts": len(artifacts),
                    "current_excluded": [str(path) for path in sorted(current_paths)],
                    "written": written,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    else:
        print(render_current_markdown(status))
        if written:
            print(json.dumps(written, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
