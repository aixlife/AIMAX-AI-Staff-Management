import { useEffect, useRef, type ReactNode } from "react";

import { Icon } from "./Icon";

interface ModalProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  labelId: string;
}

export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  labelId,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>(
      "button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("modal-open");
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-layer" role="presentation" onMouseDown={onClose}>
      <div
        ref={panelRef}
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-panel__header">
          <div>
            <h2 id={labelId}>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="닫기"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="modal-panel__body">{children}</div>
        {footer ? <footer className="modal-panel__footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
