import type {
  Connection,
  Employee,
  StatusTone,
  Task,
  TaskStatus,
} from "../types";

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  dot?: boolean;
}

export function StatusBadge({
  label,
  tone = "neutral",
  dot = false,
}: StatusBadgeProps) {
  return (
    <span className={"status-badge status-badge--" + tone}>
      {dot ? <span className="status-badge__dot" aria-hidden="true" /> : null}
      {label}
    </span>
  );
}

export function taskStatusLabel(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    queued: "대기",
    running: "실행 중",
    waiting_user: "확인 필요",
    failed: "실패",
    done: "완료",
  };
  return labels[status];
}

export function taskStatusTone(status: TaskStatus): StatusTone {
  if (status === "done") return "positive";
  if (status === "running") return "info";
  if (status === "waiting_user") return "warning";
  if (status === "failed") return "critical";
  return "neutral";
}

export function TaskStatusBadge({ task }: { task: Task }) {
  return (
    <StatusBadge
      label={taskStatusLabel(task.status)}
      tone={taskStatusTone(task.status)}
      dot
    />
  );
}

export function employeeStatusLabel(status: Employee["status"]): string {
  const labels: Record<Employee["status"], string> = {
    ready: "바로 사용",
    setup_required: "설정 필요",
    running: "업무 중",
    unavailable: "사용 불가",
  };
  return labels[status];
}

export function employeeStatusTone(
  status: Employee["status"],
): StatusTone {
  if (status === "ready") return "positive";
  if (status === "running") return "info";
  if (status === "setup_required") return "warning";
  return "critical";
}

export function connectionStatusLabel(
  status: Connection["status"],
): string {
  if (status === "connected") return "연결됨";
  if (status === "attention") return "확인 필요";
  return "연결 안 됨";
}

export function connectionStatusTone(
  status: Connection["status"],
): StatusTone {
  if (status === "connected") return "positive";
  if (status === "attention") return "critical";
  return "neutral";
}
