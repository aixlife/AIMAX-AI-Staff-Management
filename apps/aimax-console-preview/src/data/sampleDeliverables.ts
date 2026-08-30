import type { Employee } from "../types";

/**
 * 공개 직원 5명의 대표 샘플 산출물.
 * 전부 가상 데이터이며 실존 상호·인명·연락처와 무관합니다.
 * 실제 API·네트워크 호출 없이 화면 형식 검토에만 사용합니다.
 */

export type DeliverableBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string; lead?: boolean }
  | { type: "list"; title?: string; ordered?: boolean; items: string[] }
  | { type: "table"; caption?: string; columns: string[]; rows: string[][] }
  | { type: "callout"; label: string; text: string };

export interface SampleDeliverable {
  employeeId: Employee["id"];
  docType: string;
  title: string;
  meta: Array<{ label: string; value: string }>;
  blocks: DeliverableBlock[];
  footnote: string;
}

const SAMPLE_FOOTNOTE =
  "산출물 형식을 보여주기 위한 가상 샘플입니다. 실존 상호·인명·연락처와 무관하며, 실제 업무는 실행되지 않았습니다.";

export const sampleDeliverables: Record<string, SampleDeliverable> = {
  songi: {
    employeeId: "songi",
    docType: "경쟁사 비교 브리프",
    title: "AI 실무교육 시장 경쟁사 비교 브리프",
    meta: [
      { label: "조사 범위", value: "공개 웹·SNS 12곳" },
      { label: "기준 시점", value: "2026년 8월 4주" },
      { label: "근거 자료", value: "출처 링크 9건 보관" },
      { label: "상태", value: "검토용 브리프" },
    ],
    blocks: [
      {
        type: "paragraph",
        lead: true,
        text: "두 경쟁사 모두 커리큘럼 분량을 앞세우고 있습니다. 반면 수강 후기에서 반복되는 불만은 “배웠는데 내 업무에 못 붙인다”였습니다. 우리 서비스가 파고들 자리는 강의 수가 아니라 적용까지 걸리는 시간입니다.",
      },
      {
        type: "table",
        caption: "핵심 비교 (공개 자료 기준)",
        columns: ["구분", "A사 · 온라인 클래스", "B사 · 기업 교육", "우리 서비스"],
        rows: [
          ["포지션", "취미·입문 강의 백화점", "대기업 집합 교육", "소상공인 실무 적용"],
          ["가격대", "월 구독 2만원대", "기업 견적 협의", "업무 단위 과금"],
          ["강점", "콘텐츠 수가 많음", "커리큘럼 신뢰도", "내 업무로 바로 연결"],
          ["빈틈", "수료 후 적용 지원 없음", "소규모 사업자 접근 어려움", "인지도 확보 필요"],
        ],
      },
      {
        type: "list",
        title: "근거 링크 자리 (실제 조사에서는 출처가 함께 저장됩니다)",
        items: [
          "A사 공식 소개 페이지 · 가격 공지 - 수집 링크 보관",
          "B사 교육 프로그램 안내서 PDF - 수집 링크 보관",
          "양사 공개 수강 후기 게시글 6건 - 캡처 보관",
        ],
      },
      { type: "heading", text: "다음 행동 후보" },
      {
        type: "list",
        ordered: true,
        items: [
          "“적용까지 걸리는 시간”을 비교하는 콘텐츠를 예리에게 이어서 맡깁니다.",
          "A사 구독자가 이탈하는 시점의 후기를 추가 수집합니다.",
          "B사가 다루지 않는 소상공인 사례를 첫 랜딩 문구로 검토합니다.",
        ],
      },
      {
        type: "callout",
        label: "확실성 표시",
        text: "가격 정보는 공개 페이지 기준입니다. 프로모션 변동 여부는 실제 조사에서 추가 확인이 필요합니다.",
      },
    ],
    footnote: SAMPLE_FOOTNOTE,
  },

  yeri: {
    employeeId: "yeri",
    docType: "블로그 초안",
    title: "처음 온 손님을 단골로 만드는 동네 카페 운영 노하우 3가지",
    meta: [
      { label: "발행 채널", value: "네이버 블로그" },
      { label: "핵심 키워드", value: "동네 카페 단골" },
      { label: "분량", value: "약 1,800자 · 이미지 자리 2곳" },
      { label: "상태", value: "발행 전 초안" },
    ],
    blocks: [
      {
        type: "paragraph",
        lead: true,
        text: "카페를 열고 나면 가장 어려운 일이 신규 손님 모으기라고 생각하기 쉽습니다. 그런데 매출 장부를 열어보면 답은 반대인 경우가 많습니다. 한 번 온 손님이 다시 오게 만드는 일이 광고보다 먼저입니다.",
      },
      { type: "heading", text: "1. 첫 방문 손님에게는 기억할 이유를 하나만 남깁니다" },
      {
        type: "paragraph",
        text: "메뉴 자랑을 세 가지 하면 하나도 기억에 남지 않습니다. “여기는 원두를 일주일마다 바꾸는 집”처럼 한 문장으로 남을 특징을 정하고, 계산대·컵홀더·영수증 문구를 전부 그 한 가지에 맞춥니다.",
      },
      { type: "heading", text: "2. 재방문 알림은 채널마다 성격이 다릅니다" },
      {
        type: "paragraph",
        text: "같은 알림이라도 손님이 받아들이는 온도가 다릅니다. 우리 가게 손님 연령대와 준비할 수 있는 시간에 맞는 방식 하나를 고르는 편이 셋을 어설프게 하는 것보다 낫습니다.",
      },
      {
        type: "table",
        caption: "재방문 알림 방식 비교",
        columns: ["방식", "준비 난도", "어울리는 가게"],
        rows: [
          ["종이 쿠폰 도장", "낮음 · 당일 시작 가능", "회전이 빠른 테이크아웃 중심"],
          ["문자 재방문 안내", "중간 · 명단 정리 필요", "예약·주문 제작이 있는 가게"],
          ["카카오 채널 소식", "중간 · 주 1회 발행", "신메뉴 주기가 있는 가게"],
        ],
      },
      { type: "heading", text: "3. 후기 요청은 계산대에서 끝내지 않습니다" },
      {
        type: "paragraph",
        text: "계산할 때 후기를 부탁하면 손님은 부담을 느끼고, 집에 가면 잊어버립니다. 방문 다음 날 오전, 사진 한 장과 함께 짧게 안부처럼 보내는 요청이 후기로 이어지는 비율이 훨씬 높았습니다.",
      },
      {
        type: "callout",
        label: "CTA 문구",
        text: "이번 주에도 새 원두가 들어왔습니다. 이웃추가를 해두시면 신메뉴와 원두 소식을 가장 먼저 받아보실 수 있습니다.",
      },
      {
        type: "list",
        title: "발행 전 확인",
        items: [
          "이미지 자리 2곳에 매장 실사진을 넣습니다.",
          "상호·가격 표기가 실제와 일치하는지 확인합니다.",
          "과장 표현·의료성 문구가 없는지 마지막으로 점검합니다.",
        ],
      },
    ],
    footnote: SAMPLE_FOOTNOTE,
  },

  hyunju: {
    employeeId: "hyunju",
    docType: "잠재고객 후보 목록",
    title: "잠재고객 후보 20곳 중 우선 접촉 5곳",
    meta: [
      { label: "검색 키워드", value: "수제 디저트 · 공방 창업" },
      { label: "수집 결과", value: "후보 20곳 중 5곳 선별" },
      { label: "신청 속도", value: "하루 10건 이하 안전 속도" },
      { label: "상태", value: "신청 전 검토용" },
    ],
    blocks: [
      {
        type: "paragraph",
        lead: true,
        text: "최근 30일 안에 글을 올렸고, 이웃과 실제로 댓글을 주고받는 곳만 남겼습니다. 숫자를 채우는 신청보다, 첫인사가 민망하지 않을 상대를 고르는 것이 기준입니다.",
      },
      {
        type: "table",
        caption: "우선 접촉 후보 (전부 가상 상호)",
        columns: ["후보", "선정 이유", "첫 행동"],
        rows: [
          ["달빛제과 · 디저트 공방", "주 2회 신메뉴 글 발행, 댓글 응답 활발", "신메뉴 글에 댓글 후 서로이웃 신청"],
          ["숲결공방 · 원목 소품", "공방 운영기 연재 중, 같은 창업 관심사", "운영기 최신 글에 공감 먼저"],
          ["다솜플라워 · 꽃집", "클래스 모집 글 반응 좋음", "클래스 후기 글에 댓글 후 신청"],
          ["여울책방 · 독립서점", "동네 가게 인터뷰 연재, 교류 지향", "인터뷰 글 언급하며 첫인사"],
          ["온기클래스 · 베이킹 강습", "수강생 후기 축적, 협업 여지", "후기 글 댓글 후 다음 날 신청"],
        ],
      },
      {
        type: "list",
        title: "제외한 후보 유형",
        items: [
          "최근 3개월 게시글이 없는 휴면 계정 9곳",
          "이미 서로이웃이거나 신청 이력이 있는 4곳",
          "판매 링크만 반복 게시하는 광고성 계정 2곳",
        ],
      },
      {
        type: "callout",
        label: "안전 속도 안내",
        text: "실제 신청은 실행 전에 범위와 하루 신청 수를 확인받은 뒤 시작합니다. 무리한 속도의 신청은 계정과 관계 모두에 좋지 않아 하지 않습니다.",
      },
    ],
    footnote: SAMPLE_FOOTNOTE,
  },

  sangsu: {
    employeeId: "sangsu",
    docType: "견적서",
    title: "홈페이지 개편 작업 견적서",
    meta: [
      { label: "문서 번호", value: "SAMPLE-2026-0830" },
      { label: "수신", value: "온들스튜디오 (가상 거래처)" },
      { label: "유효 기간", value: "발행일로부터 14일" },
      { label: "상태", value: "발송 전 검토용" },
    ],
    blocks: [
      {
        type: "table",
        caption: "견적 내역 (부가세 별도)",
        columns: ["항목", "수량", "단가", "금액"],
        rows: [
          ["메인 페이지 리뉴얼", "1식", "1,200,000원", "1,200,000원"],
          ["서브 페이지 제작", "4페이지", "150,000원", "600,000원"],
          ["모바일 반응형 대응", "1식", "300,000원", "300,000원"],
          ["공급가액 합계", "", "", "2,100,000원"],
          ["부가세 (10%)", "", "", "210,000원"],
          ["총 금액", "", "", "2,310,000원"],
        ],
      },
      {
        type: "paragraph",
        text: "위 금액은 부가세 별도 기준이며, 작업 범위가 확정되면 일정과 함께 최종 금액을 다시 안내드립니다. 계약금과 잔금 비율, 입금 계좌는 발송 단계에서 대표님 확인 후 채워집니다.",
      },
      {
        type: "list",
        title: "발송 전 확인",
        items: [
          "수신 상호와 담당자 표기를 확인합니다.",
          "항목 누락과 수량·단가 계산을 다시 봅니다.",
          "유효 기간과 일정 문구가 이번 거래에 맞는지 확인합니다.",
        ],
      },
      {
        type: "callout",
        label: "대표님이 결정할 것",
        text: "금액 승인과 발송 여부만 결정하시면 됩니다. PDF 저장과 인쇄 화면 전환은 준비되어 있습니다.",
      },
    ],
    footnote: SAMPLE_FOOTNOTE,
  },

  jieun: {
    employeeId: "jieun",
    docType: "사무 지원 결과",
    title: "세미나 신청서 캡처 12건 정리 결과",
    meta: [
      { label: "요청 작업", value: "캡처 정리 · 개인정보 가림 · 텍스트 추출" },
      { label: "처리 파일", value: "12건" },
      { label: "소요 시간", value: "약 9분" },
      { label: "상태", value: "원본 보존 · 가림본 전달" },
    ],
    blocks: [
      {
        type: "paragraph",
        lead: true,
        text: "신청서 캡처 12건에서 연락처와 이메일을 가리고, 표에 적힌 내용을 텍스트로 뽑아 정리했습니다. 원본은 손대지 않고 그대로 두었습니다.",
      },
      {
        type: "table",
        caption: "처리 내역",
        columns: ["파일", "처리 내용", "상태"],
        rows: [
          ["신청서_01~05.png", "연락처 2곳 · 이메일 1곳 가림", "완료"],
          ["신청서_06~09.png", "연락처 1곳 가림 · 기울기 보정", "완료"],
          ["신청서_10~12.png", "텍스트 추출 후 표 정리", "완료"],
          ["명단_요약.txt", "추출 텍스트 12건 통합", "완료"],
        ],
      },
      {
        type: "paragraph",
        text: "추출한 내용 기준으로 신청자 12명 중 10명이 오후 세션을 선택했고, 8명이 노트북을 지참한다고 적었습니다. 좌석과 콘센트 배치를 잡을 때 바로 쓸 수 있는 숫자입니다.",
      },
      {
        type: "list",
        title: "다음 행동",
        items: [
          "가림 처리본으로 후기 자료를 만들 수 있습니다.",
          "추출 명단은 스프레드시트로 옮겨 출석 확인에 씁니다.",
          "원본 폴더는 백업 후 접근 권한을 정리합니다.",
        ],
      },
      {
        type: "callout",
        label: "보존 안내",
        text: "원본 파일은 수정 없이 로컬 폴더에 그대로 보존했습니다. 가림 처리본은 별도 폴더에 저장되어 원본과 섞이지 않습니다.",
      },
    ],
    footnote: SAMPLE_FOOTNOTE,
  },
};

export function getSampleDeliverable(
  employeeId: string | undefined,
): SampleDeliverable | undefined {
  if (!employeeId) return undefined;
  return sampleDeliverables[employeeId];
}
