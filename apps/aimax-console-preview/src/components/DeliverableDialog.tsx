import type { DeliverableBlock, SampleDeliverable } from "../data/sampleDeliverables";
import type { Employee } from "../types";
import { Modal } from "./Modal";

interface DeliverableDialogProps {
  deliverable: SampleDeliverable;
  employee?: Employee;
  onClose: () => void;
}

export function DeliverableBlockView({ block }: { block: DeliverableBlock }) {
  if (block.type === "heading") {
    return <h3>{block.text}</h3>;
  }
  if (block.type === "paragraph") {
    return (
      <p className={block.lead ? "deliverable-doc__lead" : undefined}>
        {block.text}
      </p>
    );
  }
  if (block.type === "list") {
    const items = block.items.map((item) => <li key={item}>{item}</li>);
    return (
      <div className="deliverable-doc__list">
        {block.title ? (
          <span className="deliverable-doc__list-title">{block.title}</span>
        ) : null}
        {block.ordered ? <ol>{items}</ol> : <ul>{items}</ul>}
      </div>
    );
  }
  if (block.type === "table") {
    return (
      <div className="deliverable-doc__table-wrap">
        <table>
          {block.caption ? <caption>{block.caption}</caption> : null}
          <thead>
            <tr>
              {block.columns.map((column) => (
                <th key={column} scope="col">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    data-label={block.columns[cellIndex]}
                    className={cell === "" ? "is-empty" : undefined}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="deliverable-doc__callout">
      <span>{block.label}</span>
      <p>{block.text}</p>
    </div>
  );
}

export function DeliverableDialog({
  deliverable,
  employee,
  onClose,
}: DeliverableDialogProps) {
  const description = employee
    ? deliverable.docType + " · " + employee.name + " " + employee.role
    : deliverable.docType;

  return (
    <Modal
      title={deliverable.title}
      description={description}
      labelId="deliverable-detail-title"
      className="modal-panel--deliverable"
      onClose={onClose}
      footer={
        <div className="deliverable-dialog__actions">
          <span>LOCAL PREVIEW · 샘플 산출물</span>
          <button className="button button--primary" type="button" onClick={onClose}>
            닫기
          </button>
        </div>
      }
    >
      <article className="deliverable-doc">
        <dl className="deliverable-doc__meta">
          {deliverable.meta.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
        {deliverable.blocks.map((block, index) => (
          <DeliverableBlockView key={index} block={block} />
        ))}
        <p className="deliverable-doc__footnote">※ {deliverable.footnote}</p>
      </article>
    </Modal>
  );
}
