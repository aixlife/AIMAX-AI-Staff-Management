import type { Employee } from "../types";
import { EmployeePortrait } from "./EmployeePortrait";
import { Modal } from "./Modal";
import {
  employeeStatusLabel,
  employeeStatusTone,
  StatusBadge,
} from "./StatusBadge";

interface EmployeePickerDialogProps {
  employees: Employee[];
  onSelect: (employee: Employee) => void;
  onClose: () => void;
}

/**
 * "새 업무" 진입용 직원 선택 모달.
 * 카드 그리드로 아바타·이름·한 줄 설명·상태를 보여주고,
 * 훔쳐봐 안내(송이)·다운로드 안내(지은)도 같은 그리드에서
 * 각자의 안내 화면으로 연결합니다.
 */
function handoffNote(employee: Employee): string | null {
  if (employee.id === "songi") return "파트너 직원 훔쳐봐 안내로 연결";
  if (employee.id === "jieun") return "설치형 앱 다운로드 안내로 연결";
  return null;
}

export function EmployeePickerDialog({
  employees,
  onSelect,
  onClose,
}: EmployeePickerDialogProps) {
  return (
    <Modal
      title="누구에게 맡길까요?"
      description="직원을 선택하면 해당 업무 맡기기 화면으로 이어집니다. Esc 키로 닫을 수 있습니다."
      onClose={onClose}
      labelId="employee-picker-title"
      className="modal-panel--picker"
    >
      <div className="employee-picker-grid" aria-label="업무를 맡길 직원 선택">
        {employees.map((employee) => {
          const note = handoffNote(employee);
          return (
            <button
              key={employee.id}
              type="button"
              className="employee-card employee-picker-card"
              onClick={() => onSelect(employee)}
            >
              <EmployeePortrait employee={employee} size="medium" showStatus />
              <span className="employee-card__body">
                <span className="employee-card__heading">
                  <strong>{employee.name}</strong>
                  {employee.beta ? (
                    <StatusBadge label="BETA" tone="info" />
                  ) : null}
                </span>
                <span className="employee-card__role">{employee.role}</span>
                <span className="employee-picker-card__summary">
                  {employee.summary}
                </span>
                <span className="employee-card__meta">
                  <StatusBadge
                    label={employeeStatusLabel(employee.status)}
                    tone={employeeStatusTone(employee.status)}
                    dot
                  />
                  {note ? <span>{note}</span> : null}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
