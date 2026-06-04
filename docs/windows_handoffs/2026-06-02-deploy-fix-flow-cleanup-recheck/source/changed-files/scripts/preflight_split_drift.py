"""Preflight checks for split_version drift-sensitive entrypoints.

The split builds intentionally carry a customized app.py, so a full text diff is
too noisy. These checks guard the small invariants that previously caused
Windows/macOS split-runtime regressions.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_text(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def extract_function(source: str, name: str) -> str:
    pattern = re.compile(rf"^def {re.escape(name)}\([^)]*\):\n(?:(?:    .*\n)|\n)*", re.MULTILINE)
    match = pattern.search(source)
    return match.group(0) if match else ""


def require(condition: bool, message: str, failures: list[str]) -> None:
    if not condition:
        failures.append(message)


def check_split_keychain(failures: list[str]) -> None:
    root_app = read_text("app.py")
    split_app = read_text("split_version/app.py")

    require(
        "def _keyring_get_password(service, key):" in root_app,
        "root app.py is missing _keyring_get_password",
        failures,
    )
    require(
        "def _keyring_get_password(service, key):" in split_app,
        "split_version/app.py is missing _keyring_get_password",
        failures,
    )

    helper = extract_function(split_app, "_keyring_get_password")
    require("thread.join(timeout)" in helper, "split keychain helper must join with timeout", failures)
    require("thread.is_alive()" in helper, "split keychain helper must return on timeout", failures)

    getter = extract_function(split_app, "_keyring_get")
    require("_keyring_get_password(_KR_SERVICE, key)" in getter, "split _keyring_get must use timed primary keychain read", failures)
    require(
        "_keyring_get_password(_KR_LEGACY_SERVICE, key)" in getter,
        "split _keyring_get must use timed legacy keychain read",
        failures,
    )
    require(
        "keyring.get_password" not in getter,
        "split _keyring_get must not call keyring.get_password directly",
        failures,
    )


def check_split_entrypoint(relative_path: str, failures: list[str]) -> None:
    source = read_text(relative_path)
    require("_EARLY_AGENT_LOCK" in source, f"{relative_path} must import/use _EARLY_AGENT_LOCK", failures)
    require("_run_diagnostics_probe" in source, f"{relative_path} must import/use _run_diagnostics_probe", failures)
    require(f"if _run_diagnostics_probe(args):" in source, f"{relative_path} must run diagnostics probe before app start", failures)
    require(
        "app._single_instance_lock = _EARLY_AGENT_LOCK" in source,
        f"{relative_path} must pass early single-instance lock into the app",
        failures,
    )


def main() -> int:
    failures: list[str] = []
    check_split_keychain(failures)
    for relative_path in (
        "split_version/app_find.py",
        "split_version/app_write.py",
        "split_version/app_engage.py",
        "split_version/app_engage_write.py",
    ):
        check_split_entrypoint(relative_path, failures)

    if failures:
        print("split drift preflight failed:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1

    print("split drift preflight passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
