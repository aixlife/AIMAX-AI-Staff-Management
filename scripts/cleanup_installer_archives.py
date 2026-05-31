#!/usr/bin/env python3
"""Dry-run and optionally delete old installer archive directories.

The safe default is a dry run. The script only considers direct child
directories of dist/upload_installers whose names start with "archive-".
Current upload files are never candidates.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_UPLOAD_DIR = ROOT / "dist" / "upload_installers"


def size_bytes(path: Path) -> int:
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
        for item in path.rglob("*"):
            try:
                if item.is_file() or item.is_symlink():
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


def archive_dirs(upload_dir: Path) -> list[Path]:
    if not upload_dir.exists():
        return []
    return sorted(
        [
            item
            for item in upload_dir.iterdir()
            if item.is_dir() and item.name.startswith("archive-")
        ],
        key=lambda item: item.stat().st_mtime,
        reverse=True,
    )


def row_for(path: Path) -> dict[str, Any]:
    stat = path.stat()
    size = size_bytes(path)
    return {
        "name": path.name,
        "path": str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path),
        "size_bytes": size,
        "size": human_size(size),
        "modified_at": datetime.fromtimestamp(stat.st_mtime).astimezone().isoformat(timespec="seconds"),
    }


def build_plan(upload_dir: Path, keep_newest: int) -> dict[str, Any]:
    archives = archive_dirs(upload_dir)
    keep = archives[:keep_newest]
    candidates = archives[keep_newest:]
    candidate_rows = [row_for(path) for path in candidates]
    keep_rows = [row_for(path) for path in keep]
    candidate_size = sum(row["size_bytes"] for row in candidate_rows)
    return {
        "generated_at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "upload_dir": str(upload_dir),
        "policy": f"keep the {keep_newest} newest archive directories",
        "current_upload_files_protected": True,
        "archive_count": len(archives),
        "keep_count": len(keep_rows),
        "candidate_count": len(candidate_rows),
        "candidate_size_bytes": candidate_size,
        "candidate_size": human_size(candidate_size),
        "kept_archives": keep_rows,
        "candidates": candidate_rows,
    }


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def delete_candidates(upload_dir: Path, plan: dict[str, Any]) -> list[dict[str, Any]]:
    deleted = []
    upload_dir = upload_dir.resolve()
    for item in plan["candidates"]:
        path = (ROOT / item["path"]).resolve()
        if path.parent != upload_dir:
            raise RuntimeError(f"Refusing to delete outside upload dir: {path}")
        if not path.name.startswith("archive-"):
            raise RuntimeError(f"Refusing to delete non-archive dir: {path}")
        if not path.is_dir():
            raise RuntimeError(f"Refusing to delete missing/non-directory path: {path}")
        shutil.rmtree(path)
        deleted.append(item)
    return deleted


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--upload-dir", default=str(DEFAULT_UPLOAD_DIR))
    parser.add_argument("--keep-newest", type=int, default=10)
    parser.add_argument("--manifest", default="")
    parser.add_argument("--execute-delete", action="store_true")
    parser.add_argument("--i-understand-delete-archives", action="store_true")
    args = parser.parse_args()

    if args.keep_newest < 1:
        raise SystemExit("--keep-newest must be at least 1")

    upload_dir = Path(args.upload_dir).resolve()
    plan = build_plan(upload_dir, args.keep_newest)
    if args.manifest:
        write_json(Path(args.manifest), plan)

    print(json.dumps({
        "upload_dir": plan["upload_dir"],
        "policy": plan["policy"],
        "archive_count": plan["archive_count"],
        "candidate_count": plan["candidate_count"],
        "candidate_size": plan["candidate_size"],
        "execute_delete": bool(args.execute_delete),
        "manifest": args.manifest or "",
    }, ensure_ascii=False, indent=2))

    if args.execute_delete:
        if not args.i_understand_delete_archives:
            raise SystemExit("--execute-delete requires --i-understand-delete-archives")
        deleted = delete_candidates(upload_dir, plan)
        print(json.dumps({
            "deleted_count": len(deleted),
            "deleted_size": plan["candidate_size"],
        }, ensure_ascii=False, indent=2))
    else:
        print("DRY_RUN_ONLY: no files were deleted")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
