#!/usr/bin/env python3
"""Patch the production n8n Cafe24 workflow to enqueue AIMAX orders.

This script is intended to run on the Oracle host. It uses only Python's
standard library so it can be copied to /tmp and executed without installing
dependencies. Copy the companion parse-code file next to it:

    scp scripts/patch_n8n_cafe24_aimax.py scripts/n8n_cafe24_parse_items.js ubuntu@host:/tmp/

2026-08-30 확장 (명시 상품 코드 주입 준비):
- 파싱 노드("주문 정보 파싱")의 jsCode 를 정본 파일 n8n_cafe24_parse_items.js 로 교체한다
  (품목별/전체 aimax_product 명시 코드 주입 버전).
- AIMAX 대기열 HTTP 노드 body 에 order_id / items / aimax_product 를 추가한다.
- --dry-run: DB 를 읽기 전용으로 열어 적용될 노드 코드 diff 만 출력하고 아무것도 쓰지 않는다.
  라이브 적용 전 반드시 --dry-run 으로 라이브 노드와의 차이를 눈으로 확인할 것
  (AIMAX 노드는 통째 교체 방식이라 라이브에만 있는 수정이 diff 에 드러난다).
- 실제 적용 시 백업(기존 로직 유지): n8n sqlite 전체 + 워크플로 JSON 을 backup-dir 에 저장.
"""

from __future__ import annotations

import argparse
import copy
import datetime as dt
import difflib
import json
import sqlite3
import uuid
from pathlib import Path


WORKFLOW_ID = "eXVG8GAQdtx8q8gm"
NODE_NAME = "AIMAX 주문 대기열 저장"
PARSE_NODE = "주문 정보 파싱"
SOURCE_NODE = "주문 정보 파싱"
VARIABLE_KEY = "AIMAX_CAFE24_WEBHOOK_SECRET"
DEFAULT_DB = Path("/home/ubuntu/.n8n/database.sqlite")
DEFAULT_ENV = Path("/home/ubuntu/aimax-reports-api/.env")
DEFAULT_BACKUP_DIR = Path("/home/ubuntu/aimax-backups/n8n")
DEFAULT_PARSE_CODE = Path(__file__).resolve().parent / "n8n_cafe24_parse_items.js"


def read_env_value(path: Path, key: str) -> str:
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        if name.strip() != key:
            continue
        value = value.strip()
        if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
            value = value[1:-1]
        return value
    return ""


def load_json(value: str, fallback):
    try:
        return json.loads(value or "")
    except json.JSONDecodeError:
        return fallback


def dump_json(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def aimax_node() -> dict:
    # aimax_product 는 파스 노드가 단일 코드로 확정한 경우에만 body 에 포함된다.
    # 없으면 필드 자체가 빠져 서버(buildCafe24Order)의 기존 추론 폴백이 그대로 동작한다.
    body_expression = (
        "={{ JSON.stringify(Object.assign({"
        "source: 'cafe24_order_email', "
        "external_id: ($json.email || '') + '|' + ($json.product || '') + '|' + ($json.amount || '') + '|' + ($json.orderDate || ''), "
        "order_id: $json.orderId || '', "
        "name: $json.name, "
        "email: $json.email, "
        "phone: $json.phone, "
        "product: $json.product, "
        "amount: $json.amount, "
        "items: Array.isArray($json.items) ? $json.items : [], "
        "orderDate: $json.orderDate"
        "}, $json.aimax_product ? { aimax_product: $json.aimax_product } : {})) }}"
    )
    return {
        "parameters": {
            "method": "POST",
            "url": "https://api.aimax.ai.kr/api/integrations/cafe24/orders",
            "sendHeaders": True,
            "headerParameters": {
                "parameters": [
                    {"name": "X-AIMAX-Cafe24-Secret", "value": "={{ $vars.AIMAX_CAFE24_WEBHOOK_SECRET }}"},
                    {"name": "Content-Type", "value": "application/json"},
                ],
            },
            "sendBody": True,
            "contentType": "raw",
            "rawContentType": "application/json",
            "body": body_expression,
        },
        "id": str(uuid.uuid4()),
        "name": NODE_NAME,
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4,
        "position": [760, 80],
        "continueOnFail": True,
    }


def upsert_variable(conn: sqlite3.Connection, secret: str) -> str:
    existing = conn.execute(
        'select id from variables where "key" = ? and projectId is null',
        (VARIABLE_KEY,),
    ).fetchone()
    if existing:
        conn.execute(
            'update variables set type = ?, value = ? where id = ?',
            ("string", secret, existing[0]),
        )
        return "updated"
    conn.execute(
        'insert into variables (id, "key", type, value, projectId) values (?, ?, ?, ?, null)',
        (str(uuid.uuid4()), VARIABLE_KEY, "string", secret),
    )
    return "inserted"


def build_patched(nodes: list, connections: dict, parse_code_text: str) -> dict:
    """nodes/connections 를 제자리 수정하고 변경 요약(diff 재료)을 돌려준다."""
    parse_node = next((node for node in nodes if node.get("name") == PARSE_NODE), None)
    if not parse_node:
        raise RuntimeError(f"parse node not found: {PARSE_NODE}")
    old_parse_code = (parse_node.get("parameters") or {}).get("jsCode") or ""
    parse_node.setdefault("parameters", {})["jsCode"] = parse_code_text

    existing = next((node for node in nodes if node.get("name") == NODE_NAME), None)
    old_aimax_json = (
        json.dumps(existing, ensure_ascii=False, indent=2, sort_keys=True) if existing else ""
    )
    if existing:
        preserved_id = existing.get("id") or str(uuid.uuid4())
        existing.clear()
        existing.update(aimax_node())
        existing["id"] = preserved_id
        aimax_action = "updated"
        new_node = existing
    else:
        new_node = aimax_node()
        nodes.append(new_node)
        aimax_action = "inserted"

    source = connections.setdefault(SOURCE_NODE, {}).setdefault("main", [[]])
    if not source:
        source.append([])
    first_output = source[0]
    connection_action = "kept"
    if not any(link.get("node") == NODE_NAME for link in first_output):
        first_output.append({"node": NODE_NAME, "type": "main", "index": 0})
        connection_action = "added"

    return {
        "aimax_action": aimax_action,
        "connection_action": connection_action,
        "old_parse_code": old_parse_code,
        "new_parse_code": parse_code_text,
        "old_aimax_json": old_aimax_json,
        "new_aimax_json": json.dumps(new_node, ensure_ascii=False, indent=2, sort_keys=True),
        "node_count": len(nodes),
    }


def print_unified_diff(label: str, old_text: str, new_text: str) -> None:
    lines = list(
        difflib.unified_diff(
            old_text.splitlines(),
            new_text.splitlines(),
            fromfile=f"{label} (현재)",
            tofile=f"{label} (적용 후)",
            lineterm="",
        )
    )
    if not lines:
        print(f"[dry-run] {label}: 변경 없음")
        return
    print(f"[dry-run] ---- {label} diff ----")
    for line in lines:
        print(line)
    print(f"[dry-run] ---- {label} diff 끝 ----")


def fetch_workflow(conn: sqlite3.Connection):
    row = conn.execute(
        "select id, name, nodes, connections from workflow_entity where id = ?",
        (WORKFLOW_ID,),
    ).fetchone()
    if not row:
        raise RuntimeError(f"workflow not found: {WORKFLOW_ID}")
    nodes = load_json(row[2], [])
    connections = load_json(row[3], {})
    if not isinstance(nodes, list):
        raise RuntimeError("workflow nodes are not a JSON list")
    if not isinstance(connections, dict):
        raise RuntimeError("workflow connections are not a JSON object")
    return row[0], row[1], nodes, connections


def dry_run(db_path: Path, parse_code_text: str) -> int:
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    try:
        _wf_id, wf_name, nodes, connections = fetch_workflow(conn)
        variable_row = conn.execute(
            'select 1 from variables where "key" = ? and projectId is null',
            (VARIABLE_KEY,),
        ).fetchone()
    finally:
        conn.close()

    changes = build_patched(copy.deepcopy(nodes), copy.deepcopy(connections), parse_code_text)
    print(f"[dry-run] workflow={WORKFLOW_ID} ({wf_name})")
    print(f"[dry-run] variable {VARIABLE_KEY}: {'update 예정' if variable_row else 'insert 예정'}")
    print(f"[dry-run] AIMAX 노드({NODE_NAME}): {changes['aimax_action']} 예정")
    print(f"[dry-run] 연결({SOURCE_NODE} -> {NODE_NAME}): {changes['connection_action']}")
    print_unified_diff(f"파싱 노드 jsCode ({PARSE_NODE})", changes["old_parse_code"], changes["new_parse_code"])
    print_unified_diff(f"AIMAX 노드 정의 ({NODE_NAME})", changes["old_aimax_json"], changes["new_aimax_json"])
    print("[dry-run] 어떤 변경도 쓰지 않았습니다 (DB 읽기 전용).")
    return 0


def patch_workflow(conn: sqlite3.Connection, parse_code_text: str) -> tuple[str, int]:
    workflow_id, name, nodes, connections = fetch_workflow(conn)
    changes = build_patched(nodes, connections, parse_code_text)

    now = dt.datetime.now(dt.UTC).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    version_id = str(uuid.uuid4())
    nodes_text = dump_json(nodes)
    connections_text = dump_json(connections)

    conn.execute(
        """
        update workflow_entity
        set nodes = ?, connections = ?, versionId = ?, activeVersionId = ?, updatedAt = ?
        where id = ?
        """,
        (nodes_text, connections_text, version_id, version_id, now, workflow_id),
    )
    conn.execute(
        """
        insert into workflow_history
          (versionId, workflowId, authors, createdAt, updatedAt, nodes, connections, name, autosaved, description)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            version_id,
            workflow_id,
            "Codex",
            now,
            now,
            nodes_text,
            connections_text,
            name,
            0,
            "Cafe24: explicit aimax_product mapping in parse node + AIMAX queue node order_id/items/aimax_product.",
        ),
    )
    return changes["aimax_action"], changes["node_count"]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--env", type=Path, default=DEFAULT_ENV)
    parser.add_argument("--backup-dir", type=Path, default=DEFAULT_BACKUP_DIR)
    parser.add_argument("--parse-code", type=Path, default=DEFAULT_PARSE_CODE,
                        help="파싱 노드에 넣을 정본 JS 파일 (기본: 스크립트 옆 n8n_cafe24_parse_items.js)")
    parser.add_argument("--dry-run", action="store_true",
                        help="적용될 노드 코드 diff 만 출력하고 아무것도 쓰지 않는다")
    args = parser.parse_args()

    if not args.parse_code.is_file():
        raise RuntimeError(
            f"parse code file not found: {args.parse_code} — "
            "n8n_cafe24_parse_items.js 를 이 스크립트 옆에 함께 복사하세요"
        )
    parse_code_text = args.parse_code.read_text(encoding="utf-8")
    if "aimax_product" not in parse_code_text:
        raise RuntimeError("parse code file has no aimax_product mapping — 정본 파일이 맞는지 확인하세요")

    if args.dry_run:
        return dry_run(args.db, parse_code_text)

    secret = read_env_value(args.env, VARIABLE_KEY)
    if not secret:
        raise RuntimeError(f"{VARIABLE_KEY} not found in {args.env}")

    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    args.backup_dir.mkdir(parents=True, exist_ok=True)
    db_backup = args.backup_dir / f"database-before-cafe24-aimax-{stamp}.sqlite"
    workflow_backup = args.backup_dir / f"workflow-{WORKFLOW_ID}-before-cafe24-aimax-{stamp}.json"

    with sqlite3.connect(args.db) as conn:
        backup_conn = sqlite3.connect(db_backup)
        try:
            conn.backup(backup_conn)
        finally:
            backup_conn.close()

        row = conn.execute(
            "select id, name, nodes, connections from workflow_entity where id = ?",
            (WORKFLOW_ID,),
        ).fetchone()
        if not row:
            raise RuntimeError(f"workflow not found: {WORKFLOW_ID}")
        workflow_backup.write_text(
            json.dumps(
                {
                    "id": row[0],
                    "name": row[1],
                    "nodes": load_json(row[2], []),
                    "connections": load_json(row[3], {}),
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        variable_action = upsert_variable(conn, secret)
        workflow_action, node_count = patch_workflow(conn, parse_code_text)
        conn.commit()

    print(f"variable={variable_action}")
    print(f"workflow={workflow_action}")
    print(f"nodes={node_count}")
    print(f"db_backup={db_backup}")
    print(f"workflow_backup={workflow_backup}")
    print(f"updated_nodes={PARSE_NODE},{NODE_NAME}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
