#!/usr/bin/env python3
"""Build an isolated PyInstaller collect-all reduction experiment.

This script writes outputs under /private/tmp by default and does not touch
dist/upload_installers or the production build script.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
TMP_ROOT = Path("/private/tmp/aimax-pyinstaller-collect-experiment")
ENTRY = ROOT / "app.py"
APP_NAME = "AIMAX"


HIDDEN_IMPORTS = [
    "auth",
    "aimax_compliance",
    "browser",
    "bulk",
    "content",
    "content.neighbor_message_ai",
    "content.ai_text",
    "content.gemini_text",
    "content.gemini_image",
    "content.openai_image",
    "content.prompts",
    "content.markdown_parser",
    "engagement",
    "engagement.neighbor_quota",
    "engagement.auto_neighbor",
    "local_agent",
    "local_agent.runtime",
    "local_agent.single_instance",
    "diagnostics",
    "diagnostics.error_reporter",
    "diagnostics.redaction",
    "diagnostics.system_info",
    "posting",
    "scraper",
    "scraper.follower_scraper",
    "utils",
    "web_agent",
    "web_agent.client",
    "ttkbootstrap",
    "ttkbootstrap.themes",
    "selenium_stealth",
    "google.genai",
    "google.genai.types",
    "anthropic",
    "PIL._tkinter_finder",
    "keyring.backends",
    "undetected_chromedriver",
    "undetected_chromedriver.patcher",
    "setuptools",
    "setuptools._distutils",
    "packaging",
]

INTERNAL_COLLECT_SUBMODULES = [
    "content",
    "diagnostics",
    "engagement",
    "local_agent",
    "scraper",
    "web_agent",
]

BASELINE_COLLECT_ALL = [
    "ttkbootstrap",
    "selenium_stealth",
    "undetected_chromedriver",
    "google.genai",
    "anthropic",
]

OPTIMIZED_COLLECT_ALL = [
    "ttkbootstrap",
]

OPTIMIZED_COLLECT_SUBMODULES = [
    "google.genai",
    "anthropic",
    "undetected_chromedriver",
]

EXCLUDES = [
    "IPython",
    "jupyter",
    "matplotlib",
    "numpy",
    "pandas",
    "pytest",
    "tkinter.test",
    "unittest",
]


def run(cmd: list[str], cwd: Path = ROOT, timeout: int | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=cwd,
        timeout=timeout,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )


def size_bytes(path: Path) -> int:
    if not path.exists():
        return 0
    result = run(["du", "-sk", str(path)])
    if result.returncode == 0 and result.stdout.strip():
        return int(result.stdout.split()[0]) * 1024
    if path.is_file() or path.is_symlink():
        return path.lstat().st_size
    return sum(item.lstat().st_size for item in path.rglob("*") if item.is_file() or item.is_symlink())


def human_size(value: int) -> str:
    units = ["B", "KB", "MB", "GB"]
    size = float(value)
    for unit in units:
        if size < 1024 or unit == units[-1]:
            if unit == "B":
                return f"{int(size)}{unit}"
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{value}B"


def build_command(variant: str, out_root: Path) -> list[str]:
    dist_path = out_root / variant / "dist"
    work_path = out_root / variant / "build"
    spec_path = out_root / variant / "spec"
    collect_all = BASELINE_COLLECT_ALL if variant == "baseline" else OPTIMIZED_COLLECT_ALL

    sep = ";" if sys.platform.startswith("win") else ":"
    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--onedir",
        f"--name={APP_NAME}",
        f"--distpath={dist_path}",
        f"--workpath={work_path}",
        f"--specpath={spec_path}",
        "--clean",
        "--noconfirm",
        "--noconsole",
    ]
    for item in HIDDEN_IMPORTS:
        cmd.append(f"--hidden-import={item}")
    if sys.platform == "darwin":
        cmd.append("--hidden-import=keyring.backends.macOS")
        hook = ROOT / "hooks" / "macos_tk_fix.py"
        if hook.exists():
            cmd.extend(["--runtime-hook", str(hook)])
    elif sys.platform.startswith("win"):
        cmd.append("--hidden-import=keyring.backends.Windows")
    for item in INTERNAL_COLLECT_SUBMODULES:
        cmd.append(f"--collect-submodules={item}")
    if variant == "optimized":
        for item in OPTIMIZED_COLLECT_SUBMODULES:
            cmd.append(f"--collect-submodules={item}")
        for item in EXCLUDES:
            cmd.append(f"--exclude-module={item}")
    for item in collect_all:
        cmd.append(f"--collect-all={item}")
    cmd.extend([
        f"--add-data={ROOT / 'config.yaml'}{sep}.",
        f"--add-data={ROOT / 'assets'}{sep}assets",
        str(ENTRY),
    ])
    return cmd


def top_children(path: Path, limit: int = 20) -> list[dict[str, Any]]:
    if not path.exists() or not path.is_dir():
        return []
    rows = []
    for child in path.iterdir():
        size = size_bytes(child)
        rows.append({
            "name": child.name,
            "path": str(child),
            "kind": "dir" if child.is_dir() else "file",
            "size_bytes": size,
            "size": human_size(size),
        })
    rows.sort(key=lambda item: item["size_bytes"], reverse=True)
    return rows[:limit]


def collect_report(out_root: Path, variant: str, returncode: int, output: str, duration_seconds: float) -> dict[str, Any]:
    dist_app = out_root / variant / "dist" / APP_NAME
    internal = dist_app / "_internal"
    total_size = size_bytes(dist_app)
    return {
        "variant": variant,
        "ok": returncode == 0,
        "returncode": returncode,
        "duration_seconds": round(duration_seconds, 2),
        "dist_app": str(dist_app),
        "size_bytes": total_size,
        "size": human_size(total_size),
        "internal_top": top_children(internal, 30),
        "output_tail": output[-8000:],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--variant", choices=["baseline", "optimized"], default="optimized")
    parser.add_argument("--out-root", default=str(TMP_ROOT))
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--report", default="")
    args = parser.parse_args()

    out_root = Path(args.out_root).resolve()
    cmd = build_command(args.variant, out_root)
    if not args.execute:
        print(json.dumps({
            "dry_run": True,
            "variant": args.variant,
            "out_root": str(out_root),
            "command": cmd,
        }, ensure_ascii=False, indent=2))
        return 0

    variant_root = out_root / args.variant
    if variant_root.exists():
        shutil.rmtree(variant_root)
    variant_root.mkdir(parents=True, exist_ok=True)

    started = datetime.now(timezone.utc)
    result = run(cmd, timeout=900)
    ended = datetime.now(timezone.utc)
    report = collect_report(out_root, args.variant, result.returncode, result.stdout, (ended - started).total_seconds())
    report["generated_at"] = ended.astimezone().isoformat(timespec="seconds")
    report["command"] = cmd
    if args.report:
        path = Path(args.report)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "variant": report["variant"],
        "ok": report["ok"],
        "size": report["size"],
        "duration_seconds": report["duration_seconds"],
        "dist_app": report["dist_app"],
        "report": args.report or "",
    }, ensure_ascii=False, indent=2))
    if not report["ok"]:
        print(report["output_tail"])
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
