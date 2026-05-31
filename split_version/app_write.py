"""분리 실행 진입점: 고객을 설득할게요."""
import multiprocessing
import os

if __name__ == "__main__":
    multiprocessing.freeze_support()

os.environ.setdefault("APP_MODE", "write")
os.environ.setdefault("INIT_PANEL", "write")

from app import HeadlessNaverBlogAgent, NaverBlogApp, _EARLY_AGENT_LOCK, _parse_runtime_args, _run_diagnostics_probe
from local_agent.runtime import agent_mode_requested


if __name__ == "__main__":
    args = _parse_runtime_args()
    if _run_diagnostics_probe(args):
        raise SystemExit(0)
    app = HeadlessNaverBlogAgent("write") if agent_mode_requested(args) else NaverBlogApp("write")
    if _EARLY_AGENT_LOCK is not None and agent_mode_requested(args):
        app._single_instance_lock = _EARLY_AGENT_LOCK
    app.run()
