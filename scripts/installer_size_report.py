#!/usr/bin/env python3
"""Report AIMAX installer and bundle sizes without deleting anything."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PATHS = [
    "dist/upload_installers/aimax-bundle-macos.dmg",
    "dist/upload_installers/aimax-bundle-windows.exe",
    "dist/AIMAX-macos.dmg",
    "dist/AIMAX.app",
    "dist/AIMAX",
    "dist/upload_installers",
    "build",
    "venv",
]


def size_bytes(path: Path) -> int:
    if not path.exists():
        return 0
    try:
        result = subprocess.run(
            ["du", "-sk", str(path)],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
        )
        return int(result.stdout.split()[0]) * 1024
    except Exception:
        if path.is_file() or path.is_symlink():
            return path.lstat().st_size
        total = 0
        for root, dirs, files in os.walk(path):
            root_path = Path(root)
            for name in files:
                item = root_path / name
                try:
                    total += item.lstat().st_size
                except OSError:
                    pass
            for name in dirs:
                item = root_path / name
                if item.is_symlink():
                    try:
                        total += item.lstat().st_size
                    except OSError:
                        pass
        return total


def human_size(value: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(value)
    for unit in units:
        if size < 1024 or unit == units[-1]:
            if unit == "B":
                return f"{int(size)}{unit}"
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{value}B"


def item_info(root: Path, rel_path: str) -> dict[str, Any]:
    path = root / rel_path
    return {
        "path": rel_path,
        "exists": path.exists(),
        "size_bytes": size_bytes(path),
        "size": human_size(size_bytes(path)),
        "kind": "dir" if path.is_dir() else "file" if path.is_file() else "missing",
    }


def child_sizes(path: Path, limit: int = 30) -> list[dict[str, Any]]:
    if not path.exists() or not path.is_dir():
        return []
    rows = []
    for child in path.iterdir():
        rows.append({
            "name": child.name,
            "path": str(child.relative_to(ROOT)) if child.is_relative_to(ROOT) else str(child),
            "kind": "dir" if child.is_dir() else "file",
            "size_bytes": size_bytes(child),
        })
    rows.sort(key=lambda item: item["size_bytes"], reverse=True)
    return [
        {
            **row,
            "size": human_size(row["size_bytes"]),
        }
        for row in rows[:limit]
    ]


def archive_summary(upload_dir: Path) -> dict[str, Any]:
    if not upload_dir.exists():
        return {
            "exists": False,
            "archive_count": 0,
            "archive_size_bytes": 0,
            "archive_size": "0B",
            "current_files": [],
            "largest_archives": [],
        }
    archives = [item for item in upload_dir.iterdir() if item.is_dir() and item.name.startswith("archive-")]
    current_files = [item for item in upload_dir.iterdir() if item.is_file()]
    archive_rows = [
        {
            "name": item.name,
            "path": str(item.relative_to(ROOT)),
            "size_bytes": size_bytes(item),
            "modified_at": datetime.fromtimestamp(item.stat().st_mtime).astimezone().isoformat(timespec="seconds"),
        }
        for item in archives
    ]
    archive_rows.sort(key=lambda item: item["size_bytes"], reverse=True)
    archive_rows_by_time = sorted(archive_rows, key=lambda item: item["modified_at"], reverse=True)
    cleanup_candidates = archive_rows_by_time[10:]
    cleanup_size = sum(item["size_bytes"] for item in cleanup_candidates)
    archive_size = sum(item["size_bytes"] for item in archive_rows)
    return {
        "exists": True,
        "archive_count": len(archives),
        "archive_size_bytes": archive_size,
        "archive_size": human_size(archive_size),
        "dry_run_cleanup": {
            "policy": "keep current upload files and the 10 newest archive directories",
            "candidate_count": len(cleanup_candidates),
            "candidate_size_bytes": cleanup_size,
            "candidate_size": human_size(cleanup_size),
            "candidates": [
                {
                    **row,
                    "size": human_size(row["size_bytes"]),
                }
                for row in cleanup_candidates[:20]
            ],
        },
        "current_files": [
            {
                "name": item.name,
                "path": str(item.relative_to(ROOT)),
                "size_bytes": size_bytes(item),
                "size": human_size(size_bytes(item)),
            }
            for item in sorted(current_files)
        ],
        "largest_archives": [
            {
                **row,
                "size": human_size(row["size_bytes"]),
            }
            for row in archive_rows[:12]
        ],
    }


def build_report(root: Path) -> dict[str, Any]:
    upload_dir = root / "dist" / "upload_installers"
    mac_internal = root / "dist" / "AIMAX.app" / "Contents" / "Frameworks"
    onedir_internal = root / "dist" / "AIMAX" / "_internal"
    return {
        "generated_at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "root": str(root),
        "artifacts": [item_info(root, rel_path) for rel_path in DEFAULT_PATHS],
        "upload_installers": archive_summary(upload_dir),
        "dist_top": child_sizes(root / "dist", limit=40),
        "mac_frameworks_top": child_sizes(mac_internal, limit=25),
        "onedir_internal_top": child_sizes(onedir_internal, limit=25),
        "notes": [
            "This report is read-only and does not delete archives.",
            "Archive cleanup should keep enough rollback evidence before removing old installer copies.",
            "Installer optimization changes must pass macOS and Windows installed-runner user-path gates before deployment.",
        ],
    }


def markdown_table(rows: list[dict[str, Any]], columns: list[tuple[str, str]]) -> list[str]:
    lines = [
        "| " + " | ".join(label for label, _key in columns) + " |",
        "| " + " | ".join("---" for _label, _key in columns) + " |",
    ]
    for row in rows:
        lines.append("| " + " | ".join(str(row.get(key, "")) for _label, key in columns) + " |")
    return lines


def to_markdown(report: dict[str, Any]) -> str:
    archive = report["upload_installers"]
    cleanup = archive["dry_run_cleanup"]
    lines = [
        "# AIMAX Installer Size Report",
        "",
        f"- generated_at: `{report['generated_at']}`",
        f"- root: `{report['root']}`",
        f"- archive_count: `{archive['archive_count']}`",
        f"- archive_size: `{archive['archive_size']}`",
        f"- cleanup_dry_run_policy: `{cleanup['policy']}`",
        f"- cleanup_dry_run_candidates: `{cleanup['candidate_count']}` directories / `{cleanup['candidate_size']}`",
        "",
        "## Key Artifacts",
        "",
        *markdown_table(report["artifacts"], [("Path", "path"), ("Exists", "exists"), ("Kind", "kind"), ("Size", "size")]),
        "",
        "## Current Upload Files",
        "",
        *markdown_table(archive["current_files"], [("Name", "name"), ("Size", "size")]),
        "",
        "## Largest Archives",
        "",
        *markdown_table(archive["largest_archives"], [("Name", "name"), ("Size", "size"), ("Modified", "modified_at")]),
        "",
        "## Cleanup Dry Run",
        "",
        f"- Policy: {cleanup['policy']}",
        f"- Candidate directories: {cleanup['candidate_count']}",
        f"- Candidate size: {cleanup['candidate_size']}",
        "- No files were deleted.",
        "",
        *markdown_table(cleanup["candidates"], [("Name", "name"), ("Size", "size"), ("Modified", "modified_at")]),
        "",
        "## dist Top",
        "",
        *markdown_table(report["dist_top"], [("Path", "path"), ("Kind", "kind"), ("Size", "size")]),
        "",
        "## macOS Frameworks Top",
        "",
        *markdown_table(report["mac_frameworks_top"], [("Path", "path"), ("Kind", "kind"), ("Size", "size")]),
        "",
        "## PyInstaller _internal Top",
        "",
        *markdown_table(report["onedir_internal_top"], [("Path", "path"), ("Kind", "kind"), ("Size", "size")]),
        "",
        "## Notes",
        "",
        *[f"- {note}" for note in report["notes"]],
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=str(ROOT), help="Project root")
    parser.add_argument("--json", action="store_true", help="Print JSON instead of Markdown")
    parser.add_argument("--write-markdown", default="", help="Optional markdown output path")
    parser.add_argument("--write-json", default="", help="Optional JSON output path")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    report = build_report(root)
    if args.write_json:
        path = Path(args.write_json)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.write_markdown:
        path = Path(args.write_markdown)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(to_markdown(report), encoding="utf-8")
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(to_markdown(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
