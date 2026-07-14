#!/usr/bin/env python3
"""Patch the production n8n Cafe24 workflow to add partner attribution.

Run this on the Oracle host after reviewing the companion maintenance note.
The patch keeps the existing Telegram/Notion destinations by reading them from
the current workflow, backs up the n8n database/workflow JSON, and only updates
the two Code nodes used by the Cafe24 order-email flow.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sqlite3
import uuid
from pathlib import Path


WORKFLOW_ID = "eXVG8GAQdtx8q8gm"
PARSE_NODE = "주문 정보 파싱"
PAYLOAD_NODE = "노션 페이로드 빌드"
DEFAULT_DB = Path("/home/ubuntu/.n8n/database.sqlite")
DEFAULT_BACKUP_DIR = Path("/home/ubuntu/aimax-backups/n8n")


def load_json(value: str, fallback):
    try:
        return json.loads(value or "")
    except json.JSONDecodeError:
        return fallback


def dump_json(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def js_literal(value: str) -> str:
    return json.dumps(str(value), ensure_ascii=False)


def extract_required(pattern: str, text: str, label: str) -> str:
    match = re.search(pattern, text, re.S)
    if not match:
        raise RuntimeError(f"could not preserve {label} from existing n8n code")
    return match.group(1)


def extract_existing_values(payload_code: str) -> dict[str, str]:
    thread_expr = extract_required(r"const\s+PAYMENT_THREAD_ID\s*=\s*([^;]+);", payload_code, "PAYMENT_THREAD_ID").strip()
    if not re.fullmatch(r"(?:null|\d+)", thread_expr):
        raise RuntimeError("PAYMENT_THREAD_ID expression is not a simple null/number")
    return {
        "notion_database_id": extract_required(r"database_id:\s*['\"]([^'\"]+)['\"]", payload_code, "Notion database id"),
        "telegram_chat_id": extract_required(r"chat_id:\s*['\"]([^'\"]+)['\"]", payload_code, "Telegram chat id"),
        "payment_thread_expr": thread_expr,
    }


def parse_code() -> str:
    return r"""const item = $input.first().json;
const html = item.textHtml || '';
const plain = item.textPlain || item.text || '';
const sourceText = [html, plain, item.subject || ''].join('\n');

function decodeBasicEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// th 바로 다음 td 추출 (greedy 패턴 없이 정확하게)
function extractCell(label, src) {
  const re = new RegExp('<th[^>]*>[^<]*' + label + '[^<]*<\\/th>\\s*<td[^>]*>([^<]+)', 'i');
  const m = src.match(re);
  return m ? decodeBasicEntities(m[1]).trim() : '';
}

function extractPartnerHint(src) {
  const decoded = decodeBasicEntities(src);
  const urls = Array.from(decoded.matchAll(/https?:\/\/[^\s"'<>]+/gi))
    .map((match) => match[0].replace(/[),.;]+$/, ''));

  function extractProductNo(value) {
    let text = String(value || '').trim();
    for (let i = 0; i < 2; i += 1) {
      try {
        const decodedText = decodeURIComponent(text);
        if (decodedText === text) break;
        text = decodedText;
      } catch (error) {
        break;
      }
    }
    const match = text.match(/(?:^|[?&#/\s])product_no\s*=?\s*([0-9]{1,10})(?:\D|$)/i)
      || text.match(/\bproduct_no(?:%3D|=)([0-9]{1,10})\b/i);
    return match ? match[1] : '';
  }

  const productUrl = urls.find((url) => /(?:[?&]product_no=|\/product\/detail)/i.test(url)) || '';
  const productNo = extractProductNo(productUrl) || extractProductNo(decoded);
  const partnerUrl = productUrl || urls.find((url) => {
    if (!/[?&](partner|ref|utm_source|utm_campaign|coupon|code)=/i.test(url)) return false;
    return !/notion\.|telegram|googleapis|gstatic|w3\.org/i.test(url);
  }) || '';
  const refMatch = decoded.match(/(?:partner|ref|utm_source|utm_campaign|coupon|code)\s*(?:=|:|：)\s*([A-Za-z0-9_-]{3,})/i);
  return {
    partnerUrl,
    productNo,
    partnerRef: refMatch ? refMatch[1].trim() : '',
  };
}

function extractOrderId(src) {
  const decoded = decodeBasicEntities(src);
  const cell = extractCell('주문번호', html) || extractCell('주문 번호', html) || extractCell('주문코드', html);
  if (cell) return cell.replace(/\s+/g, '').trim();
  const patterns = [
    /주문\s*번호\s*(?:<[^>]+>|\s|:|：|=)*([0-9A-Za-z-]{8,40})/i,
    /order[_\s-]*(?:id|no|number)\s*(?:<[^>]+>|\s|:|：|=)*([0-9A-Za-z-]{8,40})/i,
  ];
  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (match) return String(match[1] || '').replace(/\s+/g, '').trim();
  }
  return '';
}

// 이름: 받으시는분 (배송지)
const deliveryName = extractCell('받으시는분', html);
const ordererCell = extractCell('주문자', html);
const ordererMatch = ordererCell.match(/[^(]+\(([^)]+)\)/);
const name = (deliveryName || (ordererMatch ? ordererMatch[1] : ordererCell) || '확인필요').trim();

// 연락처: 휴대전화 (colspan 없는 td 직접 탐색)
const phoneRe = /<th[^>]*>\s*휴대전화\s*<\/th>\s*<td[^>]*>([^<]+)/i;
const phoneMatch = html.match(phoneRe);
const phone = phoneMatch ? decodeBasicEntities(phoneMatch[1]).trim() : '';

// 이메일: Noto Sans KR 스팬 내부
const emailSpanRe = /Noto Sans KR[^>]*>([^<\s]+@[^<\s]+)/i;
const emailMatch = html.match(emailSpanRe);
const email = emailMatch ? emailMatch[1].trim() : '';

// 상품명: 상품명 th 이후 첫 td
const productRe = /<th[^>]*>\s*상품명\s*<\/th>[\s\S]*?<td[^>]*>\s*([^\n<]+)/i;
const productMatch = html.match(productRe);
const product = productMatch ? decodeBasicEntities(productMatch[1]).trim() : (item.subject || '');

// 금액: 총 결제금액 strong 태그
const amountRe = /총\s*결제금액[^<]*<\/th>\s*<td[^>]*>\s*<strong>([\d,]+)<\/strong>/i;
const amountMatch = html.match(amountRe);
const amount = amountMatch ? parseInt(amountMatch[1].replace(/,/g, '')) : 0;

// 주문일자
const dateRe = /(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}:\d{2}/;
const dateMatch = html.match(dateRe);
const orderDate = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];

const partnerHint = extractPartnerHint(sourceText);
const orderId = extractOrderId(sourceText);

return [{json: {
  orderId,
  name,
  phone,
  email,
  product,
  amount,
  orderDate,
  partnerUrl: partnerHint.partnerUrl,
  productNo: partnerHint.productNo,
  partnerRef: partnerHint.partnerRef
}}];"""


def payload_code(values: dict[str, str]) -> str:
    notion_database_id = js_literal(values["notion_database_id"])
    telegram_chat_id = js_literal(values["telegram_chat_id"])
    payment_thread_expr = values["payment_thread_expr"]
    return f"""const d = $input.first().json;

function safeAmount(value) {{
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}}

// 연락처 마스킹: 마지막 4자리 -> ****
const maskedPhone = d.phone
  ? String(d.phone).replace(/\\d{{4}}$/, '****')
  : '-';

const amount = safeAmount(d.amount);

async function requestPartnerAttribution(context, secret, payload) {{
  const url = 'https://api.aimax.ai.kr/api/integrations/cafe24/partner-attribution';
  const headers = {{
    'Content-Type': 'application/json',
    'X-AIMAX-Cafe24-Secret': secret
  }};
  if (typeof fetch === 'function') {{
    const response = await fetch(url, {{
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    }});
    if (!response.ok) return null;
    return await response.json();
  }}
  if (context && context.helpers && typeof context.helpers.httpRequest === 'function') {{
    return await context.helpers.httpRequest({{
      method: 'POST',
      url,
      headers,
      body: payload,
      json: true,
      timeout: 7000
    }});
  }}
  return null;
}}

let partnerLine = '';
try {{
  const secret = (typeof $vars !== 'undefined' && $vars.AIMAX_CAFE24_WEBHOOK_SECRET)
    ? String($vars.AIMAX_CAFE24_WEBHOOK_SECRET)
    : '';
  if (secret) {{
    const payload = {{
      source: 'cafe24_order_email',
      orderId: d.orderId || '',
      order_id: d.orderId || '',
      name: d.name,
      phone: d.phone,
      email: d.email,
      product: d.product,
      amount,
      orderDate: d.orderDate,
      partnerUrl: d.partnerUrl || '',
      productNo: d.productNo || '',
      product_no: d.productNo || '',
      partnerRef: d.partnerRef || '',
      ref: d.ref || '',
      coupon: d.coupon || '',
      coupon_code: d.coupon_code || '',
      utm_source: d.utm_source || '',
      utm_campaign: d.utm_campaign || ''
    }};
    const context = typeof this !== 'undefined' ? this : null;
    const attribution = await requestPartnerAttribution(context, secret, payload);
    partnerLine = attribution && attribution.partner_line
      ? String(attribution.partner_line).trim()
      : '';
  }}
}} catch (error) {{
  partnerLine = '';
}}

// 노션 페이로드
const notionPayload = {{
  parent: {{ database_id: {notion_database_id} }},
  properties: {{
    '이름': {{ title: [{{ text: {{ content: d.name || '확인필요' }} }}] }},
    '연락처': {{ rich_text: [{{ text: {{ content: maskedPhone }} }}] }},
    '이메일': {{ email: d.email || null }},
    '상품명': {{ rich_text: [{{ text: {{ content: d.product || '' }} }}] }},
    '금액': {{ number: amount }},
    '신청일': {{ date: {{ start: d.orderDate }} }},
    '출처': {{ select: {{ name: '카페24' }} }},
    '상태': {{ status: {{ name: '신규' }} }}
  }}
}};

// 0원이면 알림 스킵
const skipTelegram = (amount === 0);

// 채널 분류: 입금/계약 토픽 thread_id
const PAYMENT_THREAD_ID = {payment_thread_expr};
const partnerBlock = partnerLine ? partnerLine + '\\n' : '';

const tgBody = {{
  chat_id: {telegram_chat_id},
  text: '💰 새 주문 접수\\n\\n' + partnerBlock + '주문자: ' + (d.name || '확인필요') + '\\n연락처: ' + maskedPhone + '\\n상품: ' + (d.product || '-') + '\\n금액: ' + amount.toLocaleString() + '원\\n주문일: ' + d.orderDate,
  parse_mode: 'Markdown'
}};
if (PAYMENT_THREAD_ID !== null) {{
  tgBody.message_thread_id = PAYMENT_THREAD_ID;
}}

// n8n 버그 우회: 객체 대신 JSON 문자열로 전달
return [{{ json: {{
  ...d,
  amount,
  maskedPhone,
  partnerLine,
  skipTelegram,
  notionBody: JSON.stringify(notionPayload),
  telegramBody: skipTelegram ? null : JSON.stringify(tgBody)
}} }}];"""


def patch_workflow(conn: sqlite3.Connection) -> tuple[int, Path | None]:
    row = conn.execute(
        "select id, name, nodes, connections from workflow_entity where id = ?",
        (WORKFLOW_ID,),
    ).fetchone()
    if not row:
        raise RuntimeError(f"workflow not found: {WORKFLOW_ID}")

    workflow_id, name, nodes_raw, connections_raw = row
    nodes = load_json(nodes_raw, [])
    connections = load_json(connections_raw, {})
    if not isinstance(nodes, list):
        raise RuntimeError("workflow nodes are not a JSON list")

    parse_node = next((node for node in nodes if node.get("name") == PARSE_NODE), None)
    payload_node = next((node for node in nodes if node.get("name") == PAYLOAD_NODE), None)
    if not parse_node or not payload_node:
        raise RuntimeError("required Code nodes were not found")

    old_payload_code = (payload_node.get("parameters") or {}).get("jsCode") or ""
    preserved = extract_existing_values(old_payload_code)
    parse_node.setdefault("parameters", {})["jsCode"] = parse_code()
    payload_node.setdefault("parameters", {})["jsCode"] = payload_code(preserved)

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
            "Add Cafe24 partner attribution line before Telegram payment alerts.",
        ),
    )
    return len(nodes), None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--backup-dir", type=Path, default=DEFAULT_BACKUP_DIR)
    args = parser.parse_args()

    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    args.backup_dir.mkdir(parents=True, exist_ok=True)
    db_backup = args.backup_dir / f"database-before-cafe24-partner-attribution-{stamp}.sqlite"
    workflow_backup = args.backup_dir / f"workflow-{WORKFLOW_ID}-before-cafe24-partner-attribution-{stamp}.json"

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

        node_count, _ = patch_workflow(conn)
        conn.commit()

    print("workflow=updated")
    print(f"nodes={node_count}")
    print(f"db_backup={db_backup}")
    print(f"workflow_backup={workflow_backup}")
    print("updated_nodes=주문 정보 파싱,노션 페이로드 빌드")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
