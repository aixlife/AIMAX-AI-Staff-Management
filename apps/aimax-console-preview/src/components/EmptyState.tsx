import type { ReactNode } from "react";

import { Icon } from "./Icon";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div className={"empty-state" + (compact ? " empty-state--compact" : "")}>
      <div className="empty-state__icon">
        <Icon name="spark" />
      </div>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
