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

// ---- AIMAX 명시 상품 코드 매핑 (2026-08-30) ----
// 서버 server.js 의 CAFE24_STAFF_PRODUCT_RULES / CAFE24_NON_STAFF_PRODUCT_PATTERNS 사본.
// 코드값·패턴·평가 순서를 서버와 정확히 일치시켜야 한다. 서버 규칙이 바뀌면 이 표도 같이 갱신할 것.
// 매칭 실패(모르는 상품)나 비직원 상품이면 aimax_product 필드를 아예 넣지 않는다 — 서버 추론 폴백 유지.
function normalizeAimaxProductText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '');
}

const AIMAX_NON_STAFF_PRODUCT_PATTERNS = [
  /회원가입을하셨습니다|회원가입|입금처리가확인/,
  /ai로직원만드는법|ai로직원만드는/,
  /일본구매대행/,
  /창업프로그램\d+기|aimax창업프로그램/,
  /제2의뇌|제의뇌|나같이생각하는ai비서/,
  /공동구매수익화/,
  /사업자pt/,
  /평생회원제/,
  /무료배포판|무료배포/,
  /전자책|스레드가이드북|컨셉의정석|ai에게시켰는데|내생각을영상으로만드는ai직원|노트한장에서유튜브업로드/,
  /무료특강|무료웨비나|패밀리데이|8주클래스|무자본해외수출/,
];

// 서버 규칙과 같은 순서 — blog_team 이 예리/현주보다 먼저 평가돼야 한다.
const AIMAX_PRODUCT_CODE_RULES = [
  { code: 'blog_team', pattern: /블로그마케팅팀|블로그마케팅.*예리.*현주|예리.*현주|현주.*예리|blogteam|blog_team/ },
  { code: 'yeri', pattern: /예리|yeri|블로그마케터/ },
  { code: 'hyunju', pattern: /현주|hyunju|영업사원/ },
  { code: 'songi', pattern: /송이|songi|자료조사|자료조사원|리서치|research/ },
  { code: 'yunmi', pattern: /윤미|yunmi|스크립트작가|스크립트/ },
  { code: 'jieun', pattern: /지은|jieun|오피스매니저|오피스지원|office/ },
  { code: 'nakyung', pattern: /나경|nakyung|판서쌤|판서|pencil/ },
  { code: 'maxalert', pattern: /맥스|maxalert|max_alert|알람앱/ },
  { code: 'hyojin', pattern: /효진|hyojin|영상제작|아나운서/ },
  { code: 'sangsu', pattern: /상수|sangsu|경리|견적|견적서|quote|quotation|estimate/ },
  { code: 'bundle', pattern: /전체통합|통합권한|통합설치|bundle|올인원|allinone/ },
];

function mapAimaxProductCode(name) {
  const normalized = normalizeAimaxProductText(name);
  if (!normalized) return '';
  if (AIMAX_NON_STAFF_PRODUCT_PATTERNS.some((pattern) => pattern.test(normalized))) return '';
  const rule = AIMAX_PRODUCT_CODE_RULES.find((entry) => entry.pattern.test(normalized));
  return rule ? rule.code : '';
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

// 품목별 명시 코드: 매칭된 품목에만 aimax_product 를 붙인다 (실패 시 필드 없음).
const items = extractItems(html).map((row) => {
  const code = mapAimaxProductCode(row.name);
  return code ? { ...row, aimax_product: code } : row;
});

// top-level 명시 코드는 주문 전체가 단일 코드로 확정될 때만 넣는다.
// 서버 explicit 경로(buildCafe24Order)는 products 를 [코드] 하나로 고정하므로,
// 다품목·복수 코드 주문에 top-level 을 보내면 나머지 상품 권한이 유실된다.
const itemCodes = [];
for (const row of items) {
  if (row.aimax_product && !itemCodes.includes(row.aimax_product)) itemCodes.push(row.aimax_product);
}
let aimaxProduct = '';
if (items.length) {
  if (itemCodes.length === 1 && items.every((row) => row.aimax_product)) aimaxProduct = itemCodes[0];
} else {
  aimaxProduct = mapAimaxProductCode(product);
}

const output = {
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
};
if (aimaxProduct) output.aimax_product = aimaxProduct;

return [{json: output}];
