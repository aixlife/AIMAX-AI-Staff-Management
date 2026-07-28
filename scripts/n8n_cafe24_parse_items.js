const item = $input.first().json;
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

// 상품 목록 전체: 상품명/수량/판매가/상품구매금액 4열 테이블의 품목 행
// (기존 product는 첫 품목만 집어서 다품목 주문이 유실됐음 — 2026-07-28)
function extractItems(src) {
  const items = [];
  const tableMatch = src.match(/<th[^>]*>[^<]*상품명[^<]*<\/th>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tableMatch) return items;
  const rowRe = /<tr[^>]*>\s*<td(?![^>]*colspan)[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
  const clean = (v) => decodeBasicEntities(String(v || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  const num = (v) => parseInt(String(clean(v)).replace(/[^\d]/g, ''), 10) || 0;
  let m;
  while ((m = rowRe.exec(tableMatch[1]))) {
    const itemName = clean(m[1]);
    if (!itemName || /총\s*상품구매금액/.test(itemName)) continue;
    items.push({ name: itemName, qty: num(m[2]) || 1, price: num(m[3]), line_total: num(m[4]) });
  }
  return items;
}

const partnerHint = extractPartnerHint(sourceText);
const orderId = extractOrderId(sourceText);
const items = extractItems(html);

return [{json: {
  orderId,
  name,
  phone,
  email,
  product,
  amount,
  items,
  orderDate,
  partnerUrl: partnerHint.partnerUrl,
  productNo: partnerHint.productNo,
  partnerRef: partnerHint.partnerRef
}}];