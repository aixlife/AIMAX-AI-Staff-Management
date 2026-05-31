#!/usr/bin/env python3
"""Patch the production n8n Cafe24 workflow to enqueue AIMAX orders.

This script is intended to run on the Oracle host. It uses only Python's
standard library so it can be copied to /tmp and executed without installing
dependencies.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sqlite3
import uuid
from pathlib import Path


WORKFLOW_ID = "eXVG8GAQdtx8q8gm"
NODE_NAME = "AIMAX 주문 대기열 저장"
SOURCE_NODE = "주문 정보 파싱"
VARIABLE_KEY = "AIMAX_CAFE24_WEBHOOK_SECRET"
DEFAULT_DB = Path("/home/ubuntu/.n8n/database.sqlite")
DEFAULT_ENV = Path("/home/ubuntu/aimax-reports-api/.env")
DEFAULT_BACKUP_DIR = Path("/home/ubuntu/aimax-backups/n8n")


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
    body_expression = (
        "={{ JSON.stringify({"
        "source: 'cafe24_order_email', "
        "external_id: ($json.email || '') + '|' + ($json.product || '') + '|' + ($json.amount || '') + '|' + ($json.orderDate || ''), "
        "name: $json.name, "
        "email: $json.email, "
        "phone: $json.phone, "
        "product: $json.product, "
        "amount: $json.amount, "
        "orderDate: $json.orderDate"
        "}) }}"
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


def patch_workflow(conn: sqlite3.Connection) -> tuple[str, int]:
    row = conn.execute(
        "select id, name, nodes, connections, settings, staticData, pinData, meta, description from workflow_entity where id = ?",
        (WORKFLOW_ID,),
    ).fetchone()
    if not row:
        raise RuntimeError(f"workflow not found: {WORKFLOW_ID}")

    workflow_id, name, nodes_raw, connections_raw, *_rest = row
    nodes = load_json(nodes_raw, [])
    connections = load_json(connections_raw, {})
    if not isinstance(nodes, list):
        raise RuntimeError("workflow nodes are not a JSON list")
    if not isinstance(connections, dict):
        raise RuntimeError("workflow connections are not a JSON object")

    existing = next((node for node in nodes if node.get("name") == NODE_NAME), None)
    action = "updated"
    if existing:
        preserved_id = existing.get("id") or str(uuid.uuid4())
        existing.clear()
        existing.update(aimax_node())
        existing["id"] = preserved_id
    else:
        nodes.append(aimax_node())
        action = "inserted"

    source = connections.setdefault(SOURCE_NODE, {}).setdefault("main", [[]])
    if not source:
        source.append([])
    first_output = source[0]
    if not any(link.get("node") == NODE_NAME for link in first_output):
        first_output.append({"node": NODE_NAME, "type": "main", "index": 0})

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
        (version_id, workflow_id, "Codex", now, now, nodes_text, connections_text, name, 0, "Add AIMAX Cafe24 order queue webhook."),
    )
    return action, len(nodes)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--env", type=Path, default=DEFAULT_ENV)
    parser.add_argument("--backup-dir", type=Path, default=DEFAULT_BACKUP_DIR)
    args = parser.parse_args()

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
        workflow_action, node_count = patch_workflow(conn)
        conn.commit()

    print(f"variable={variable_action}")
    print(f"workflow={workflow_action}")
    print(f"nodes={node_count}")
    print(f"db_backup={db_backup}")
    print(f"workflow_backup={workflow_backup}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
