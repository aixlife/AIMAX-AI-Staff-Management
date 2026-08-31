/**
 * 외부 링크 정본 — 랜딩에서 쓰는 구매·로그인·파트너 주소는 전부 여기서만 정의합니다.
 *
 * 카페24 스토어(makefamily.kr) 상품번호와 판매가는 2026-08-31 스토어 카테고리
 * "AI 직원 인력사무소"(cate_no=85) 실측값입니다. 목록에 올라온 7개 상품이 모두
 * 30,000원이었습니다. 추적 파라미터(utm 등)는 붙이지 않습니다.
 */

/** 카페24 스토어의 AI 직원 카테고리 — 개별 상품을 못 찾을 때의 대표 주소 */
export const STORE_URL = "https://makefamily.kr/product/list.html?cate_no=85";

/** 회사(주식회사 메이크패밀리) 홈 */
export const COMPANY_URL = "https://makefamily.kr";

/** 이미 구매한 회원이 들어가는 운영실 */
export const CONSOLE_LOGIN_URL = "https://api.aimax.ai.kr/app";

/** 파트너 직원 훔쳐봐(제작 정보람) 전용 페이지 */
export const HOOMCHA_URL = "https://hoomcha.com/aimax";

export interface PurchaseLink {
  employeeId: string;
  /** 카페24 상품명 그대로 (스토어에서 고객이 보는 이름) */
  productName: string;
  /** 원 단위 판매가. 스토어에서 상품을 확인하지 못한 직원은 null */
  priceWon: number | null;
  url: string;
  /** true = 개별 상품 페이지 확인됨, false = 대표 스토어로 보내는 폴백 */
  verified: boolean;
}

const purchaseLinks: PurchaseLink[] = [
  {
    employeeId: "yeri",
    productName: "AI 블로그마케터 예리",
    priceWon: 30000,
    url: "https://makefamily.kr/product/detail.html?product_no=104",
    verified: true,
  },
  {
    employeeId: "sangsu",
    productName: "AI 경리 상수",
    priceWon: 30000,
    url: "https://makefamily.kr/product/detail.html?product_no=112",
    verified: true,
  },
  {
    employeeId: "jieun",
    productName: "AI 오피스 매니저 지은",
    priceWon: 30000,
    url: "https://makefamily.kr/product/detail.html?product_no=129",
    verified: true,
  },
  {
    employeeId: "songi",
    productName: "AI 자료조사 송이씨",
    priceWon: 30000,
    url: "https://makefamily.kr/product/detail.html?product_no=126",
    verified: true,
  },
  {
    employeeId: "yunmi",
    productName: "AI 숏폼작가 윤미씨",
    priceWon: 30000,
    url: "https://makefamily.kr/product/detail.html?product_no=114",
    verified: true,
  },
  {
    employeeId: "nakyung",
    productName: "AI 판서 나경씨",
    priceWon: 30000,
    url: "https://makefamily.kr/product/detail.html?product_no=111",
    verified: true,
  },
  {
    employeeId: "maxalert",
    productName: "PC 알람앱 맥스",
    priceWon: 30000,
    url: "https://makefamily.kr/product/detail.html?product_no=243",
    verified: true,
  },
  // 현주(영업사원)는 2026-08-31 스토어 카테고리에 개별 상품이 없어 대표 주소로 보냅니다.
  {
    employeeId: "hyunju",
    productName: "AI 영업사원 현주",
    priceWon: null,
    url: STORE_URL,
    verified: false,
  },
];

export function getPurchaseLink(employeeId?: string): PurchaseLink | undefined {
  if (!employeeId) return undefined;
  return purchaseLinks.find((link) => link.employeeId === employeeId);
}

/** 판매가를 "30,000원"으로, 확인 못 한 상품은 "스토어에서 확인"으로 보여줍니다. */
export function formatPrice(priceWon: number | null): string {
  if (!priceWon) return "스토어에서 확인";
  return priceWon.toLocaleString("ko-KR") + "원";
}

export default purchaseLinks;
