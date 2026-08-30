import { useMemo, useState, type FormEvent } from "react";

import {
  buildDefaultOptionValues,
  getTaskOptions,
  missingRequiredLabels,
  type OptionValue,
  type OptionValues,
} from "../data/taskOptions";
import type { Employee } from "../types";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { TaskOptionFields } from "./TaskOptionFields";

interface NewTaskDialogProps {
  employee: Employee;
  onClose: () => void;
  onCreate: (
    employee: Employee,
    title: string,
    optionSummary?: string,
  ) => void;
}

export function NewTaskDialog({
  employee,
  onClose,
  onCreate,
}: NewTaskDialogProps) {
  const [title, setTitle] = useState(employee.name + " 새 업무 프리뷰");
  const [acknowledged, setAcknowledged] = useState(false);
  const optionConfig = useMemo(
    () => getTaskOptions(employee.id),
    [employee.id],
  );
  const [optionValues, setOptionValues] = useState<OptionValues>(() =>
    optionConfig ? buildDefaultOptionValues(optionConfig) : {},
  );

  const setOption = (fieldId: string, value: OptionValue) => {
    setOptionValues((current) => ({ ...current, [fieldId]: value }));
  };

  const missingLabels = optionConfig
    ? missingRequiredLabels(optionConfig, optionValues)
    : [];
  const optionSummary = optionConfig
    ? optionConfig.summarize(optionValues)
    : "";
  const canSubmit =
    acknowledged && Boolean(title.trim()) && missingLabels.length === 0;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    onCreate(employee, title.trim(), optionSummary || undefined);
  };

  return (
    <Modal
      title={employee.name + "에게 업무 맡기기"}
      description="실제 실행 전 점검을 검토하는 로컬 fixture 흐름입니다."
      onClose={onClose}
      labelId="new-task-title"
    >
      <form className="task-preflight" onSubmit={onSubmit}>
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
            <section className="option-group" aria-label="필수 입력">
              <header className="option-group__head">
                <strong>필수 입력</strong>
                <span>이것만 채우면 맡길 수 있어요</span>
              </header>
              <TaskOptionFields
                fields={optionConfig.required}
                values={optionValues}
                onChange={setOption}
                idPrefix={"opt-" + employee.id + "-required"}
              />
            </section>

            <section className="option-group" aria-label="자주 쓰는 설정">
              <header className="option-group__head">
                <strong>자주 쓰는 설정</strong>
                <span>기본값 그대로 둬도 됩니다</span>
              </header>
              <TaskOptionFields
                fields={optionConfig.frequent}
                values={optionValues}
                onChange={setOption}
                idPrefix={"opt-" + employee.id + "-frequent"}
              />
            </section>

            <details className="option-group option-group--advanced">
              <summary>
                <strong>고급 설정</strong>
                <span>필요할 때만 펼치세요</span>
              </summary>
              <div className="option-group__fields">
                <TaskOptionFields
                  fields={optionConfig.advanced}
                  values={optionValues}
                  onChange={setOption}
                  idPrefix={"opt-" + employee.id + "-advanced"}
                />
              </div>
            </details>

            {optionSummary ? (
              <p className="option-summary">
                <span>업무 카드에 표시될 요약</span>
                <strong data-testid="option-summary-preview">{optionSummary}</strong>
              </p>
            ) : null}
          </>
        ) : null}

        <div className="preflight-summary">
          <div>
            <span>실행 방식</span>
            <strong>
              {employee.execution === "web"
                ? "웹"
                : employee.execution === "hybrid"
                  ? "웹 + 로컬"
                  : employee.execution === "local"
                    ? "로컬"
                    : "외부 앱"}
            </strong>
          </div>
          <div>
            <span>필요 연결</span>
            <strong>{employee.requiredConnections.join(" · ") || "없음"}</strong>
          </div>
          <div>
            <span>비용</span>
            <strong>{employee.costSummary}</strong>
          </div>
        </div>

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
          <button className="button button--secondary" type="button" onClick={onClose}>
            취소
          </button>
          <button
            className="button button--primary"
            type="submit"
            disabled={!canSubmit}
          >
            로컬 업무 만들기
          </button>
        </div>
      </form>
    </Modal>
  );
}
