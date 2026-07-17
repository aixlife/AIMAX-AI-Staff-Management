import type { Employee } from "../types";
import {
  employeeStatusLabel,
  employeeStatusTone,
  StatusBadge,
} from "./StatusBadge";

interface EmployeeCardProps {
  employee: Employee;
  active?: boolean;
  onSelect: (employeeId: string) => void;
}

export function EmployeeCard({
  employee,
  active = false,
  onSelect,
}: EmployeeCardProps) {
  return (
    <button
      className={"employee-card" + (active ? " is-active" : "")}
      type="button"
      aria-pressed={active}
      onClick={() => onSelect(employee.id)}
    >
      <span className={"avatar avatar--" + employee.id} aria-hidden="true">
        {employee.initials}
      </span>
      <span className="employee-card__body">
        <span className="employee-card__heading">
          <strong>{employee.name}</strong>
          {employee.beta ? (
            <StatusBadge label="BETA" tone="info" />
          ) : null}
        </span>
        <span className="employee-card__role">{employee.role}</span>
        <span className="employee-card__meta">
          <StatusBadge
            label={employeeStatusLabel(employee.status)}
            tone={employeeStatusTone(employee.status)}
            dot
          />
          <span>{employee.execution === "web" ? "웹" : employee.execution === "local" ? "로컬" : employee.execution === "hybrid" ? "웹 + 로컬" : "외부 앱"}</span>
        </span>
      </span>
    </button>
  );
}
