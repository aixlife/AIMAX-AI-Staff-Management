import type { DeliverableBlock } from "../data/sampleDeliverables";
import {
  computeQuoteTotals,
  type OptionValues,
} from "../data/taskOptions";
import { DeliverableBlockView } from "./DeliverableDialog";

interface QuotePreviewProps {
  values: OptionValues;
}

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

/**
 * 상수 견적서 실시간 미리보기.
 * 실서비스 sangsuQuoteHtml의 문서 구성(기본 정보 → 작업 항목 →
 * 공급가액·부가세·총액 → 유의사항 → 전달 말씀 → 서명)을
 * DeliverableDialog의 산출물 문서 스타일로 렌더링합니다.
 * 입력값이 바뀔 때마다 그대로 다시 그려집니다 (로컬 전용).
 */
export function QuotePreview({ values }: QuotePreviewProps) {
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

  const itemsTable: DeliverableBlock = {
    type: "table",
    caption:
      "견적 내역 (" +
      (totals.vat > 0 ? "부가세 별도 10% 포함 계산" : "부가세 미적용") +
      ")",
    columns: ["항목", "내용", "금액"],
    rows: tableRows,
  };

  const noteLines = textValue(values, "notes")
    .split("\n")
    .map((line) => line.replace(/^[·\-*]\s*/, "").trim())
    .filter((line) => line.length > 0);
  const notesBlock: DeliverableBlock = {
    type: "list",
    title: "유의사항",
    items: noteLines.length
      ? noteLines
      : ["협의된 작업 범위와 일정에 따라 진행됩니다."],
  };

  const messageBlock: DeliverableBlock = {
    type: "callout",
    label: "전달 말씀",
    text: fallback(
      textValue(values, "message"),
      "검토 후 조율이 필요한 부분이 있으면 편하게 말씀해주세요.",
    ),
  };

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

  return (
    <article className="deliverable-doc quote-doc" aria-label="견적서 실시간 미리보기">
      <header className="quote-doc__head">
        <p className="quote-doc__eyebrow">QUOTATION</p>
        <h3>견 적 서</h3>
      </header>
      <dl className="deliverable-doc__meta">
        {meta.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      <DeliverableBlockView block={itemsTable} />
      <DeliverableBlockView block={notesBlock} />
      <DeliverableBlockView block={messageBlock} />
      <div className="quote-doc__signoff">
        <strong>
          {fallback(textValue(values, "signOffSender"), issuerName)}
        </strong>
        <span>{fallback(textValue(values, "signOffDate"), "작성일 미입력")}</span>
      </div>
      <p className="deliverable-doc__footnote">
        ※ 입력값으로 즉시 그린 로컬 미리보기입니다. 실서비스에서는 같은 구성의
        견적서를 PDF 저장 화면으로 엽니다.
      </p>
    </article>
  );
}
