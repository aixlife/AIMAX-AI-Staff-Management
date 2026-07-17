import type { Employee, Task } from "../types";
import { TaskStatusBadge } from "./StatusBadge";

interface TaskCardProps {
  task: Task;
  employee?: Employee;
  active?: boolean;
  onSelect: (taskId: string) => void;
}

export function TaskCard({
  task,
  employee,
  active = false,
  onSelect,
}: TaskCardProps) {
  return (
    <button
      className={"task-card" + (active ? " is-active" : "")}
      type="button"
      aria-pressed={active}
      onClick={() => onSelect(task.id)}
    >
      <span className="task-card__topline">
        <span>{employee?.name || "알 수 없는 직원"}</span>
        <TaskStatusBadge task={task} />
      </span>
      <strong>{task.title}</strong>
      <span className="task-card__summary">{task.summary}</span>
      <span className="task-card__footer">
        <span>{task.updatedAt}</span>
        {task.status === "running" ? <span>{task.progress}%</span> : null}
      </span>
      {task.status === "running" ? (
        <span
          className="progress-track"
          aria-label={"진행률 " + task.progress + "%"}
        >
          <span style={{ width: task.progress + "%" }} />
        </span>
      ) : null}
    </button>
  );
}
