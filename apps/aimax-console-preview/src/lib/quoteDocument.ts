import type {
  DeliverableBlock,
  SampleDeliverable,
} from "../data/sampleDeliverables";
import { computeQuoteTotals, type OptionValues } from "../data/taskOptions.ts";

/**
 * 상수 즉시형 결과의 다운로드용 문서 직렬화 (2026-08-31 카운슬 종합 승인).
 * QuotePreview가 화면에 그리는 것과 같은 구성(기본 정보 → 작업 항목 →
 * 공급가액·부가세·총액 → 유의사항 → 전달 말씀 → 서명)을
 * SampleDeliverable 형태로 만들어 downloadDeliverable로 내려받게 합니다.
 * 전부 브라우저 안 데이터이며 외부 전송이 없습니다.
 */

function won(value: number): string {
  return value.toLocaleString("ko-KR") + "원";
}

function textValue(values: OptionValues, id: string): string {
  const value = values[id];
  return typeof value === "string" ? value.trim() : "";
}

function fallback(value: string, replacement: string): string {
  return value.length > 0 ? value : replacement;
}

export function buildQuoteDeliverable(
  values: OptionValues,
  title: string,
): SampleDeliverable {
  const totals = computeQuoteTotals(values);
  const itemRows = totals.rows.length
    ? totals.rows
    : [{ category: "-", description: "-", price: "" }];

  const tableRows: string[][] = itemRows.map((row) => [
    fallback(row.category.trim(), "-"),
    fallback(row.description.trim(), "-"),
    won(Number(row.price) || 0),
  ]);
  tableRows.push(["공급가액", "", won(totals.subtotal)]);
  if (totals.vat > 0) {
    tableRows.push(["부가세 (10%)", "", won(totals.vat)]);
  }
  tableRows.push(["총 견적 금액", "", won(totals.total)]);

  const noteLines = textValue(values, "notes")
    .split("\n")
    .map((line) => line.replace(/^[·\-*]\s*/, "").trim())
    .filter((line) => line.length > 0);

  const issuerName = fallback(textValue(values, "issuerName"), "공급자명");
  const logoName = textValue(values, "logo");
  const meta: Array<{ label: string; value: string }> = [
    { label: "견적일", value: fallback(textValue(values, "quoteDate"), "-") },
    {
      label: "유효기간",
      value: fallback(textValue(values, "validDuration"), "-"),
    },
    { label: "공급자", value: issuerName },
    {
      label: "받는 곳",
      value: fallback(textValue(values, "clientName"), "고객명"),
    },
    { label: "이메일", value: fallback(textValue(values, "clientEmail"), "-") },
    {
      label: "프로젝트명",
      value: fallback(textValue(values, "projectName"), "프로젝트명"),
    },
    {
      label: "납기 예정",
      value: fallback(textValue(values, "deliverySchedule"), "-"),
    },
    {
      label: "납품 형식",
      value: fallback(textValue(values, "deliveryFormat"), "-"),
    },
  ];
  if (logoName) {
    meta.unshift({ label: "로고", value: logoName + " (인쇄 화면에 표시)" });
  }

  const blocks: DeliverableBlock[] = [
    {
      type: "table",
      caption:
        "견적 내역 (" +
        (totals.vat > 0 ? "부가세 별도 10% 포함 계산" : "부가세 미적용") +
        ")",
      columns: ["항목", "내용", "금액"],
      rows: tableRows,
    },
    {
      type: "list",
      title: "유의사항",
      items: noteLines.length
        ? noteLines
        : ["협의된 작업 범위와 일정에 따라 진행됩니다."],
    },
    {
      type: "callout",
      label: "전달 말씀",
      text: fallback(
        textValue(values, "message"),
        "검토 후 조율이 필요한 부분이 있으면 편하게 말씀해주세요.",
      ),
    },
    {
      type: "paragraph",
      text:
        fallback(textValue(values, "signOffSender"), issuerName) +
        " · " +
        fallback(textValue(values, "signOffDate"), "작성일 미입력"),
    },
  ];

  return {
    employeeId: "sangsu",
    docType: "견적서",
    title: fallback(title.trim(), "견적서"),
    meta,
    blocks,
    footnote:
      "입력값으로 브라우저 안에서 즉시 만든 견적서입니다. 외부 전송 없이 이 파일로만 저장됐고, 실서비스에서는 같은 구성의 PDF 저장 화면이 열립니다.",
  };
}
