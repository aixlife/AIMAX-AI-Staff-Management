import type { Employee } from "../types";

interface EmployeePortraitProps {
  employee: Employee;
  size?: "small" | "medium" | "large" | "hero";
  className?: string;
  decorative?: boolean;
  showStatus?: boolean;
}

export function EmployeePortrait({
  employee,
  size = "medium",
  className = "",
  decorative = true,
  showStatus = false,
}: EmployeePortraitProps) {
  return (
    <span
      className={
        "employee-portrait employee-portrait--" +
        size +
        (className ? " " + className : "")
      }
      aria-hidden={decorative ? "true" : undefined}
    >
      {employee.photo ? (
        <img
          src={employee.photo}
          alt={decorative ? "" : employee.name + " AI 직원 프로필"}
        />
      ) : (
        <span className="employee-portrait__fallback">{employee.initials}</span>
      )}
      {showStatus ? (
        <span
          className={
            "employee-portrait__status employee-portrait__status--" +
            employee.status
          }
        />
      ) : null}
    </span>
  );
}
