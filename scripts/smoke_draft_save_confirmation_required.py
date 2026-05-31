from __future__ import annotations

import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.py"


def _is_draft_confirmation_guard(node: ast.AST) -> bool:
    return (
        isinstance(node, ast.UnaryOp)
        and isinstance(node.op, ast.Not)
        and isinstance(node.operand, ast.Name)
        and node.operand.id == "draft_save_confirmed"
    )


def _is_positive_draft_confirmation_guard(node: ast.AST) -> bool:
    return isinstance(node, ast.Name) and node.id == "draft_save_confirmed"


def _contains_raise(nodes: list[ast.stmt]) -> bool:
    return any(isinstance(child, ast.Raise) for stmt in nodes for child in ast.walk(stmt))


def main() -> None:
    tree = ast.parse(APP.read_text(encoding="utf-8"), filename=str(APP))
    for node in ast.walk(tree):
        if isinstance(node, ast.If) and _is_draft_confirmation_guard(node.test):
            if _contains_raise(node.body):
                print("DRAFT_SAVE_CONFIRMATION_REQUIRED_SMOKE_OK")
                return
        if isinstance(node, ast.If) and _is_positive_draft_confirmation_guard(node.test):
            if _contains_raise(node.orelse):
                print("DRAFT_SAVE_CONFIRMATION_REQUIRED_SMOKE_OK")
                return
    raise SystemExit("draft_save_confirmed false path must raise before success accounting")


if __name__ == "__main__":
    main()
