import type { TimelineStep } from "../types";
import { Icon } from "./Icon";

export function TaskTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="timeline" aria-label="업무 진행 단계">
      {steps.map((step) => (
        <li
          key={step.id}
          className={"timeline__item timeline__item--" + step.state}
        >
          <span className="timeline__marker" aria-hidden="true">
            {step.state === "complete" ? (
              <Icon name="check" />
            ) : step.state === "failed" ? (
              <Icon name="alert" />
            ) : (
              <span />
            )}
          </span>
          <div className="timeline__body">
            <div className="timeline__heading">
              <strong>{step.label}</strong>
              {step.at ? <time>{step.at}</time> : null}
            </div>
            <p>{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
