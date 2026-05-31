"""No-paid smoke for Legacy AppData self-heal.

Creates a synthetic AppData parent with legacy NaverBlog folders and stale
request files, then verifies AIMAX quarantines them without deleting data.
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path
from time import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from local_agent.state_repair import (  # noqa: E402
    LOCK_FILE_NAME,
    REQUEST_FILE_NAMES,
    collect_local_state_diagnostics,
    quarantine_local_state_conflicts,
)


def _touch(path: Path, content: str = "x", *, mtime: float | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    if mtime is not None:
        os.utime(path, (mtime, mtime))


def main() -> int:
    now = time()
    stale_time = now - 7200
    with tempfile.TemporaryDirectory() as temp:
        parent = Path(temp)
        current = parent / "AIMAX"
        current.mkdir()

        legacy_a = parent / "NaverBlogAuto"
        legacy_b = parent / "naverblog-old"
        legacy_a.mkdir()
        legacy_b.mkdir()
        _touch(legacy_a / "settings.json", '{"legacy": true}', mtime=stale_time)
        _touch(legacy_a / "logs" / "app.log", "old log", mtime=stale_time)
        _touch(legacy_b / "debug" / "error.html", "<html></html>", mtime=stale_time)

        stale_request = current / REQUEST_FILE_NAMES[0]
        fresh_request = current / REQUEST_FILE_NAMES[1]
        lock_file = current / LOCK_FILE_NAME
        _touch(stale_request, '{"kind": "open_settings"}', mtime=stale_time)
        _touch(fresh_request, '{"kind": "connect"}', mtime=now)
        _touch(lock_file, "12345", mtime=stale_time)

        before = collect_local_state_diagnostics(current, now=now, stale_seconds=3600)
        assert before["legacy_candidate_count"] == 2, before
        assert before["stale_request_count"] == 1, before
        assert before["lock_file"]["exists"] is True, before

        dry_run = quarantine_local_state_conflicts(current, now=now, stale_seconds=3600, dry_run=True)
        assert dry_run["ok"] is True, dry_run
        assert legacy_a.exists() and legacy_b.exists() and stale_request.exists(), dry_run

        result = quarantine_local_state_conflicts(current, now=now, stale_seconds=3600)
        assert result["ok"] is True, result
        assert not legacy_a.exists(), result
        assert not legacy_b.exists(), result
        assert not stale_request.exists(), result
        assert fresh_request.exists(), result
        assert lock_file.exists(), result
        assert result["diagnostics_after"]["legacy_candidate_count"] == 0, result
        assert result["diagnostics_after"]["stale_request_count"] == 0, result

        moved_targets = [Path(item["target"]) for item in result["moved"] if item.get("ok")]
        assert any(path.name == "NaverBlogAuto" for path in moved_targets), moved_targets
        assert any(path.name == "naverblog-old" for path in moved_targets), moved_targets
        assert any(path.name == REQUEST_FILE_NAMES[0] for path in moved_targets), moved_targets

        print(
            json.dumps(
                {
                    "ok": True,
                    "legacy_candidates_before": before["legacy_candidate_count"],
                    "moved_count": len(moved_targets),
                    "quarantine_root": result["quarantine_root"],
                    "lock_file_preserved": lock_file.exists(),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    print("R3K_LEGACY_APPDATA_SELF_HEAL_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
