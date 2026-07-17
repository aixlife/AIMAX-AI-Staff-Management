import type { Connection } from "../types";
import { Icon } from "./Icon";
import {
  connectionStatusLabel,
  connectionStatusTone,
  StatusBadge,
} from "./StatusBadge";

interface ConnectionCardProps {
  connection: Connection;
  onInspect: (connection: Connection) => void;
}

export function ConnectionCard({
  connection,
  onInspect,
}: ConnectionCardProps) {
  return (
    <article className="connection-card">
      <div className="connection-card__icon" aria-hidden="true">
        <Icon name={connection.category === "runtime" ? "settings" : "connections"} />
      </div>
      <div className="connection-card__body">
        <div className="connection-card__heading">
          <h3>{connection.name}</h3>
          <StatusBadge
            label={connectionStatusLabel(connection.status)}
            tone={connectionStatusTone(connection.status)}
            dot
          />
        </div>
        <p>{connection.summary}</p>
        <span>{connection.usage}</span>
        {connection.updatedAt ? (
          <small>업데이트 {connection.updatedAt}</small>
        ) : null}
      </div>
      <button
        className="button button--quiet"
        type="button"
        onClick={() => onInspect(connection)}
      >
        {connection.status === "connected" ? "상세 보기" : "연결 안내"}
        <Icon name="arrow" className="button__icon button__icon--end" />
      </button>
    </article>
  );
}
