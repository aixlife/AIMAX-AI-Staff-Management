import { useMemo, useState, type FormEvent } from "react";

import {
  buildDefaultOptionValues,
  getTaskOptions,
  missingRequiredLabels,
  type OptionValue,
  type OptionValues,
} from "../data/taskOptions";
import { downloadDeliverable } from "../lib/deliverableFile";
import { buildQuoteDeliverable } from "../lib/quoteDocument";
import {
  loadRecentOptionValues,
  saveRecentOptionValues,
} from "../lib/recentSettings";
import type { Employee } from "../types";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { QuotePreview } from "./QuotePreview";
import { TaskOptionFields } from "./TaskOptionFields";

interface NewTaskDialogProps {
  employee: Employee;
  onClose: () => void;
  /** 직원 선택 모달에서 열렸을 때 다시 선택으로 돌아가는 경로 */
  onBack?: () => void;
  onCreate: (
    employee: Employee,
    title: string,
    optionSummary?: string,
  ) => void;
  /**
   * 상수 즉시형 예외: 업무를 완료 상태로 조용히 적재하고 taskId를 돌려받습니다.
   * 이동·강조 없이 다이얼로그 안에서 완성 견적서를 바로 보여줍니다.
   */
  onQuoteCreate?: (
    employee: Employee,
    title: string,
    optionSummary?: string,
  ) => string;
  /** 결과 화면의 "업무 기록에서 보기" 링크 경로 */
  onOpenTask?: (taskId: string) => void;
}

interface QuoteResultState {
  taskId: string;
  title: string;
  values: OptionValues;
}

function executionLabel(employee: Employee): string {
  if (employee.execution === "web") return "웹";
  if (employee.execution === "hybrid") return "웹 + 로컬";
  if (employee.execution === "local") return "로컬";
  return "외부 앱";
}

interface PreflightSummaryProps {
  execution: string;
  connections: string;
  cost: string;
}

function PreflightSummary({
  execution,
  connections,
  cost,
}: PreflightSummaryProps) {
  return (
    <div className="preflight-summary">
      <div>
        <span>실행 방식</span>
        <strong>{execution}</strong>
      </div>
      <div>
        <span>필요 연결</span>
        <strong>{connections || "없음"}</strong>
      </div>
      <div>
        <span>비용</span>
        <strong>{cost}</strong>
      </div>
    </div>
  );
}

/**
 * 송이(자료조사) 업무 맡기기 대체 화면.
 * 웹 자료조사 폼은 폐기됐고, 파트너 직원 '훔쳐봐'로 안내합니다.
 * 명칭·제작자·설명·주소는 실서비스 server.js 파트너 카드와 동일합니다.
 */
function SongiHandoffPanel({
  onBack,
  onClose,
}: {
  onBack?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="task-preflight">
      <div className="notice notice--info">
        <Icon name="spark" />
        <div>
          <strong>웹 자료조사 업무는 종료됐습니다</strong>
          <p>
            웹에서 진행하던 자료조사 폼 대신, 레퍼런스 수집은 파트너 직원
            훔쳐봐가 이어받습니다.
          </p>
        </div>
      </div>

      <section className="partner-panel" aria-label="훔쳐봐 안내">
        <header className="partner-panel__head">
          <strong>훔쳐봐</strong>
          <span>레퍼런스 수집 직원 · 파트너(제작 정보람)</span>
        </header>
        <p>
          유튜브·인스타·틱톡·스레드·X에서 레퍼런스를 자동으로 모아 AI가
          요약·분류해줍니다.
        </p>
        <ul className="partner-panel__meta">
          <li>레퍼런스 수집</li>
          <li>AI 요약</li>
          <li>채널 5종</li>
        </ul>
        <div className="partner-panel__link">
          <span>훔쳐봐 체험 시작</span>
          <code>hoomcha.com/aimax</code>
        </div>
        <p className="preview-disclaimer">
          프리뷰에서는 외부 링크로 이동하지 않습니다. 실서비스에서는 위 주소의
          체험 페이지가 새 창으로 열립니다.
        </p>
      </section>

      <PreflightSummary
        execution="외부 서비스 (파트너)"
        connections="훔쳐봐 계정"
        cost="훔쳐봐 요금제 기준"
      />

      <div className="dialog-actions">
        {onBack ? (
          <button
            className="button button--secondary"
            type="button"
            onClick={onBack}
          >
            다른 직원 선택
          </button>
        ) : null}
        <button className="button button--primary" type="button" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}

/**
 * 지은(설치형 오피스 지원) 업무 맡기기 대체 화면.
 * 업무 지시 폼 없이 다운로드 안내만 제공합니다.
 * 라벨·버전·설명은 실서비스 지은 executionOptions와 동일합니다.
 */
function JieunDownloadPanel({
  employee,
  onBack,
  onClose,
}: {
  employee: Employee;
  onBack?: () => void;
  onClose: () => void;
}) {
  const [notice, setNotice] = useState("");

  const pressDownload = (label: string) => {
    setNotice(
      label +
        " 버튼은 픽스처입니다. 프리뷰에서는 파일을 내려받지 않고, 실서비스에서 같은 버튼이 설치 파일을 내려받습니다.",
    );
  };

  return (
    <div className="task-preflight">
      <div className="notice notice--info">
        <Icon name="spark" />
        <div>
          <strong>지은은 설치해서 쓰는 직원입니다</strong>
          <p>
            업무 지시 폼 대신 데스크톱 앱을 설치하면 캡처, 모자이크, OCR, 화면
            녹화 같은 사무 작업을 바로 맡길 수 있습니다.
          </p>
        </div>
      </div>

      <section className="download-panel" aria-label="지은 다운로드">
        <div className="download-option">
          <div>
            <strong>Windows Setup 다운로드</strong>
            <p>Windows용 지은 안정 버전 v0.1.6 설치 파일입니다.</p>
          </div>
          <button
            className="button button--primary"
            type="button"
            onClick={() => pressDownload("Windows Setup 다운로드")}
          >
            Windows 다운로드
          </button>
        </div>
        <div className="download-option">
          <div>
            <strong>Apple Silicon Mac 앱 다운로드</strong>
            <p>
              Apple Silicon Mac용 Tauri v0.2.1 DMG입니다. 첫 실행 시 macOS 보안
              확인이 뜨면 시스템 설정에서 허용 후 열어주세요.
            </p>
          </div>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => pressDownload("Apple Silicon Mac 앱 다운로드")}
          >
            macOS 다운로드
          </button>
        </div>
        {notice ? (
          <p className="download-panel__notice" role="status">
            {notice}
          </p>
        ) : (
          <p className="preview-disclaimer">
            픽스처 버튼입니다. 프리뷰에서는 실제 다운로드가 시작되지 않습니다.
          </p>
        )}
      </section>

      <PreflightSummary
        execution={executionLabel(employee)}
        connections={employee.requiredConnections.join(" · ")}
        cost={employee.costSummary}
      />

      <div className="dialog-actions">
        {onBack ? (
          <button
            className="button button--secondary"
            type="button"
            onClick={onBack}
          >
            다른 직원 선택
          </button>
        ) : null}
        <button className="button button--primary" type="button" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}

export function NewTaskDialog({
  employee,
  onClose,
  onBack,
  onCreate,
  onQuoteCreate,
  onOpenTask,
}: NewTaskDialogProps) {
  const [title, setTitle] = useState(employee.name + " 새 업무 프리뷰");
  const [acknowledged, setAcknowledged] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const isQuote = employee.id === "sangsu";
  const optionConfig = useMemo(
    () => getTaskOptions(employee.id),
    [employee.id],
  );
  // 폼은 항상 기본값으로 엽니다. 저장분이 있어도 자동 복원하지 않고
  // 상단 칩을 누를 때만 복원합니다 (2026-08-31 카운슬 종합 승인).
  const [optionValues, setOptionValues] = useState<OptionValues>(() =>
    optionConfig ? buildDefaultOptionValues(optionConfig) : {},
  );
  const [recentValues] = useState<OptionValues | null>(() =>
    optionConfig ? loadRecentOptionValues(employee.id, optionConfig) : null,
  );
  const [recentApplied, setRecentApplied] = useState(false);
  const [quoteResult, setQuoteResult] = useState<QuoteResultState | null>(null);

  const setOption = (fieldId: string, value: OptionValue) => {
    setOptionValues((current) => ({ ...current, [fieldId]: value }));
  };

  const applyRecentValues = () => {
    if (!recentValues) return;
    setOptionValues({ ...recentValues });
    setRecentApplied(true);
  };

  const missingLabels = optionConfig
    ? missingRequiredLabels(optionConfig, optionValues)
    : [];
  const optionSummary = optionConfig
    ? optionConfig.summarize(optionValues)
    : "";
  const costEstimate = optionConfig
    ? optionConfig.estimateCost(optionValues)
    : undefined;
  const canSubmit =
    acknowledged && Boolean(title.trim()) && missingLabels.length === 0;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    // "최근 설정 불러오기" 칩용 저장 — 4개 폼 직원 공통, 키·개인정보성 값 없음.
    if (optionConfig) {
      saveRecentOptionValues(employee.id, optionConfig, optionValues);
    }
    if (isQuote && onQuoteCreate) {
      // 상수 즉시형 예외: 업무 페이지로 이동하지 않고 그 자리에서 결과를 엽니다.
      const taskId = onQuoteCreate(
        employee,
        title.trim(),
        optionSummary || undefined,
      );
      setQuoteResult({
        taskId,
        title: title.trim(),
        values: { ...optionValues },
      });
      return;
    }
    onCreate(employee, title.trim(), optionSummary || undefined);
  };

  const downloadQuote = (result: QuoteResultState) => {
    downloadDeliverable(
      buildQuoteDeliverable(result.values, result.title),
      employee,
    );
  };

  if (employee.id === "songi") {
    return (
      <Modal
        title={employee.name + "에게 업무 맡기기"}
        description="자료조사 업무는 파트너 직원 훔쳐봐 안내로 대체됐습니다."
        onClose={onClose}
        labelId="new-task-title"
      >
        <SongiHandoffPanel onBack={onBack} onClose={onClose} />
      </Modal>
    );
  }

  if (isQuote && quoteResult) {
    return (
      <Modal
        title="견적서가 완성됐습니다"
        description="입력값으로 즉시 만든 완성 견적서입니다. 업무 페이지로 이동하지 않고 이 자리에서 확인합니다."
        onClose={onClose}
        labelId="new-task-title"
        className="modal-panel--quote-result"
      >
        <div className="task-preflight quote-result">
          <QuotePreview values={quoteResult.values} />
          <p className="preview-disclaimer">
            업무 기록에는 완료 상태로 조용히 저장됐습니다. 실서비스에서는 같은
            화면에서 PDF 저장까지 이어집니다.
          </p>
          <div className="dialog-actions dialog-actions--quote-result">
            <button
              className="text-link-button"
              type="button"
              onClick={() => {
                onOpenTask?.(quoteResult.taskId);
                onClose();
              }}
            >
              업무 기록에서 보기
            </button>
            <button
              className="button button--secondary"
              type="button"
              onClick={onClose}
            >
              닫기
            </button>
            <button
              className="button button--primary"
              type="button"
              onClick={() => downloadQuote(quoteResult)}
            >
              견적서 다운로드
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  if (employee.id === "jieun") {
    return (
      <Modal
        title={employee.name + "에게 업무 맡기기"}
        description="설치형 직원 안내입니다. 다운로드 버튼은 픽스처입니다."
        onClose={onClose}
        labelId="new-task-title"
      >
        <JieunDownloadPanel employee={employee} onBack={onBack} onClose={onClose} />
      </Modal>
    );
  }

  return (
    <Modal
      title={employee.name + "에게 업무 맡기기"}
      description={
        isQuote
          ? "입력하면 오른쪽 견적서 문서가 즉시 갱신되는 로컬 fixture 흐름입니다."
          : "실제 실행 전 점검을 검토하는 로컬 fixture 흐름입니다."
      }
      onClose={onClose}
      labelId="new-task-title"
      className={isQuote ? "modal-panel--quote" : undefined}
    >
      <form
        className={"task-preflight" + (isQuote ? " task-preflight--split" : "")}
        onSubmit={onSubmit}
      >
        <div className="task-preflight__main">
        {optionConfig && recentValues ? (
          <div className="recent-settings-row">
            <button
              type="button"
              className="recent-settings-chip"
              onClick={applyRecentValues}
              disabled={recentApplied}
            >
              {recentApplied ? "최근 설정을 불러왔습니다" : "최근 설정 불러오기"}
            </button>
            <span className="field-hint">
              이 탭에서 마지막으로 맡긴 {employee.name} 업무의 폼 설정입니다.
              자동으로 적용하지 않고, 칩을 누를 때만 복원합니다.
            </span>
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="preview-task-name">업무 이름</label>
          <input
            id="preview-task-name"
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
          />
          <span className="field-hint">대표 결과 목록에서 구분할 수 있게 적어주세요.</span>
        </div>

        {optionConfig ? (
          <>
            {optionConfig.sections.map((section) =>
              section.advanced ? (
                <details
                  className="option-group option-group--advanced"
                  key={section.title}
                >
                  <summary className="option-group__summary">
                    <strong>{section.title}</strong>
                    <span
                      className="option-group__toggle-hint"
                      aria-hidden="true"
                    />
                  </summary>
                  {section.description ? (
                    <p className="option-group__desc">{section.description}</p>
                  ) : null}
                  <TaskOptionFields
                    fields={section.fields}
                    values={optionValues}
                    onChange={setOption}
                    idPrefix={"opt-" + employee.id}
                  />
                </details>
              ) : (
                <section
                  className="option-group"
                  aria-label={section.title}
                  key={section.title}
                >
                  <header className="option-group__head">
                    <strong>{section.title}</strong>
                  </header>
                  {section.description ? (
                    <p className="option-group__desc">{section.description}</p>
                  ) : null}
                  <TaskOptionFields
                    fields={section.fields}
                    values={optionValues}
                    onChange={setOption}
                    idPrefix={"opt-" + employee.id}
                  />
                </section>
              ),
            )}

            {isQuote ? (
              <div className="quote-live-preview quote-live-preview--inline">
                <button
                  className="button button--secondary quote-preview-toggle"
                  type="button"
                  aria-expanded={mobilePreviewOpen}
                  onClick={() => setMobilePreviewOpen((open) => !open)}
                >
                  {mobilePreviewOpen ? "견적서 미리보기 접기" : "견적서 미리보기"}
                </button>
                {mobilePreviewOpen ? <QuotePreview values={optionValues} /> : null}
              </div>
            ) : null}

            {costEstimate ? (
              <section
                className="cost-estimate"
                data-basis={costEstimate.basis}
                aria-live="polite"
                aria-label="예상 비용"
              >
                <header>
                  <strong>예상 비용</strong>
                  <span>{costEstimate.basisLabel}</span>
                </header>
                <p className="cost-estimate__headline">{costEstimate.headline}</p>
                <ul>
                  {costEstimate.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {optionSummary ? (
              <p className="option-summary">
                <span>업무 카드에 표시될 요약</span>
                <strong data-testid="option-summary-preview">{optionSummary}</strong>
              </p>
            ) : null}
          </>
        ) : null}

        <PreflightSummary
          execution={executionLabel(employee)}
          connections={employee.requiredConnections.join(" · ")}
          cost={employee.costSummary}
        />

        <div className="notice notice--info">
          <Icon name="spark" />
          <div>
            <strong>Phase 1 로컬 프리뷰</strong>
            <p>업무 카드만 브라우저 메모리에 만듭니다. API·실행기·유료 모델은 호출하지 않습니다.</p>
          </div>
        </div>

        <label className="check-row">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <span>로컬 fixture만 생성되고 실제 업무는 실행되지 않음을 확인했습니다.</span>
        </label>

        <div className="dialog-actions">
          {onBack ? (
            <button
              className="button button--secondary"
              type="button"
              onClick={onBack}
            >
              다른 직원 선택
            </button>
          ) : null}
          <button className="button button--secondary" type="button" onClick={onClose}>
            취소
          </button>
          <button
            className="button button--primary"
            type="submit"
            disabled={!canSubmit}
          >
            {isQuote ? "견적서 생성하기" : "로컬 업무 만들기"}
          </button>
        </div>
        </div>

        {isQuote ? (
          <aside
            className="quote-live-preview quote-live-preview--desktop"
            aria-label="견적서 실시간 미리보기"
          >
            <QuotePreview values={optionValues} />
          </aside>
        ) : null}
      </form>
    </Modal>
  );
}
