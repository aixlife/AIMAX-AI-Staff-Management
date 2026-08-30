import type { WireframeKind } from "../data/taskOptions";

/**
 * 스타일 템플릿 카드 안의 미니 와이어프레임 (2026-08-31 카운슬 종합 승인).
 * 텍스트 예시보다 먼저 "이 스타일이 어떤 구조인지"를 작은 그림으로 보여줍니다.
 * - consult: 회색 본문 블록 + 하단 강조색 CTA 배너
 * - info: 목차 박스 + 불릿 리스트
 * - review: 전후 비교 프레임 + 평점 카드
 * 의미는 카드의 목적 한 줄(hint)이 전달하므로 그림 자체는 장식으로 둡니다.
 */
export function TemplateWireframe({ kind }: { kind: WireframeKind }) {
  return (
    <svg
      className={"tpl-wireframe tpl-wireframe--" + kind}
      viewBox="0 0 120 64"
      aria-hidden="true"
      focusable="false"
    >
      {kind === "consult" ? (
        <>
          <rect className="wf-bar" x="10" y="9" width="58" height="6" rx="2" />
          <rect className="wf-soft" x="10" y="21" width="100" height="5" rx="2" />
          <rect className="wf-soft" x="10" y="30" width="100" height="5" rx="2" />
          <rect className="wf-soft" x="10" y="39" width="66" height="5" rx="2" />
          <rect className="wf-accent" x="10" y="49" width="100" height="11" rx="3" />
          <rect className="wf-on-accent" x="42" y="53" width="36" height="3" rx="1.5" />
        </>
      ) : null}
      {kind === "info" ? (
        <>
          <rect className="wf-frame" x="10" y="9" width="38" height="46" rx="3" />
          <rect className="wf-bar" x="15" y="15" width="22" height="4" rx="2" />
          <rect className="wf-soft" x="15" y="24" width="28" height="3.5" rx="1.5" />
          <rect className="wf-soft" x="15" y="31" width="28" height="3.5" rx="1.5" />
          <rect className="wf-soft" x="15" y="38" width="22" height="3.5" rx="1.5" />
          <circle className="wf-accent" cx="60" cy="16" r="2.5" />
          <rect className="wf-bar" x="67" y="13.5" width="43" height="5" rx="2" />
          <circle className="wf-accent" cx="60" cy="30" r="2.5" />
          <rect className="wf-bar" x="67" y="27.5" width="43" height="5" rx="2" />
          <circle className="wf-accent" cx="60" cy="44" r="2.5" />
          <rect className="wf-bar" x="67" y="41.5" width="33" height="5" rx="2" />
        </>
      ) : null}
      {kind === "review" ? (
        <>
          <rect className="wf-soft-fill" x="10" y="9" width="47" height="28" rx="3" />
          <rect className="wf-bar" x="16" y="29" width="22" height="4" rx="2" />
          <rect className="wf-accent-frame" x="63" y="9" width="47" height="28" rx="3" />
          <rect className="wf-accent" x="69" y="29" width="22" height="4" rx="2" />
          <rect className="wf-frame" x="10" y="44" width="100" height="14" rx="3" />
          <circle className="wf-accent" cx="21" cy="51" r="3" />
          <circle className="wf-accent" cx="30" cy="51" r="3" />
          <circle className="wf-accent" cx="39" cy="51" r="3" />
          <circle className="wf-accent" cx="48" cy="51" r="3" />
          <circle className="wf-soft-dot" cx="57" cy="51" r="3" />
          <rect className="wf-bar" x="68" y="48.5" width="34" height="5" rx="2" />
        </>
      ) : null}
    </svg>
  );
}
