import type {
  DeliverableBlock,
  SampleDeliverable,
} from "../data/sampleDeliverables";
import type { Employee } from "../types";

/**
 * 완료 업무 결과의 다운로드 직렬화.
 * 프리뷰는 네트워크 없이 브라우저 Blob으로 샘플 텍스트 파일만 만듭니다.
 * 실서비스에서는 같은 버튼이 실제 업무 결과 파일을 저장합니다.
 */
export function deliverableToText(
  deliverable: SampleDeliverable,
  employee?: Employee,
): string {
  const lines: string[] = [];
  lines.push(deliverable.title);
  lines.push(
    deliverable.docType +
      (employee ? " · " + employee.name + " " + employee.role : ""),
  );
  lines.push("");
  for (const item of deliverable.meta) {
    lines.push("- " + item.label + ": " + item.value);
  }
  for (const block of deliverable.blocks) {
    lines.push("");
    lines.push(...blockToLines(block));
  }
  lines.push("");
  lines.push("※ " + deliverable.footnote);
  return lines.join("\n");
}

function blockToLines(block: DeliverableBlock): string[] {
  if (block.type === "heading") return ["[" + block.text + "]"];
  if (block.type === "paragraph") return [block.text];
  if (block.type === "list") {
    const lines = block.title ? [block.title] : [];
    block.items.forEach((item, index) => {
      lines.push((block.ordered ? index + 1 + ". " : "- ") + item);
    });
    return lines;
  }
  if (block.type === "table") {
    const lines = block.caption ? [block.caption] : [];
    lines.push(block.columns.join(" | "));
    for (const row of block.rows) lines.push(row.join(" | "));
    return lines;
  }
  return ["[" + block.label + "] " + block.text];
}

export function deliverableFileName(deliverable: SampleDeliverable): string {
  const safeTitle = deliverable.title.replace(/[\\/:*?"<>|]/g, " ").trim();
  return safeTitle + ".txt";
}

/** 브라우저 안에서만 파일을 만들어 내려받습니다 (외부 전송 없음). */
export function downloadDeliverable(
  deliverable: SampleDeliverable,
  employee?: Employee,
): void {
  const blob = new Blob(["﻿" + deliverableToText(deliverable, employee)], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = deliverableFileName(deliverable);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
