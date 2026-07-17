import { useState, type FormEvent } from "react";

import type { Employee } from "../types";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

interface NewTaskDialogProps {
  employee: Employee;
  onClose: () => void;
  onCreate: (employee: Employee, title: string) => void;
}

export function NewTaskDialog({
  employee,
  onClose,
  onCreate,
}: NewTaskDialogProps) {
  const [title, setTitle] = useState(employee.name + " 새 업무 프리뷰");
  const [acknowledged, setAcknowledged] = useState(false);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!acknowledged || !title.trim()) return;
    onCreate(employee, title.trim());
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
            disabled={!acknowledged || !title.trim()}
          >
            로컬 업무 만들기
          </button>
        </div>
      </form>
    </Modal>
  );
}
