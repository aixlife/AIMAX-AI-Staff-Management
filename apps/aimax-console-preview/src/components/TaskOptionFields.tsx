import type {
  ItemRow,
  OptionValue,
  OptionValues,
  TaskOptionField,
} from "../data/taskOptions";

interface TaskOptionFieldsProps {
  fields: TaskOptionField[];
  values: OptionValues;
  onChange: (fieldId: string, value: OptionValue) => void;
  idPrefix: string;
}

export function TaskOptionFields({
  fields,
  values,
  onChange,
  idPrefix,
}: TaskOptionFieldsProps) {
  return (
    <>
      {fields.map((field) => {
        const fieldId = idPrefix + "-" + field.id;

        if (field.kind === "text" || field.kind === "textarea") {
          const value = typeof values[field.id] === "string"
            ? (values[field.id] as string)
            : "";
          return (
            <div className="field" key={field.id}>
              <label htmlFor={fieldId}>
                {field.label}
                {field.required ? (
                  <em className="field-required" aria-label="필수">필수</em>
                ) : null}
              </label>
              {field.kind === "text" ? (
                <input
                  id={fieldId}
                  value={value}
                  placeholder={field.placeholder}
                  maxLength={120}
                  onChange={(event) => onChange(field.id, event.target.value)}
                />
              ) : (
                <textarea
                  id={fieldId}
                  value={value}
                  placeholder={field.placeholder}
                  maxLength={600}
                  rows={3}
                  onChange={(event) => onChange(field.id, event.target.value)}
                />
              )}
              {field.hint ? (
                <span className="field-hint">{field.hint}</span>
              ) : null}
            </div>
          );
        }

        if (field.kind === "select") {
          const value = typeof values[field.id] === "string"
            ? (values[field.id] as string)
            : field.defaultValue;
          return (
            <div className="field" key={field.id}>
              <label htmlFor={fieldId}>{field.label}</label>
              <select
                id={fieldId}
                value={value}
                onChange={(event) => onChange(field.id, event.target.value)}
              >
                {field.choices.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
              {field.hint ? (
                <span className="field-hint">{field.hint}</span>
              ) : null}
            </div>
          );
        }

        if (field.kind === "choice") {
          const value = typeof values[field.id] === "string"
            ? (values[field.id] as string)
            : field.defaultValue;
          const isCards = field.variant === "cards";
          return (
            <fieldset className="field option-fieldset" key={field.id}>
              <legend>{field.label}</legend>
              <div className={isCards ? "option-cards" : "option-chips"}>
                {field.choices.map((choice) => (
                  <label
                    className={isCards ? "option-card" : "option-chip"}
                    key={choice.value}
                  >
                    <input
                      type="radio"
                      name={fieldId}
                      value={choice.value}
                      checked={value === choice.value}
                      onChange={() => onChange(field.id, choice.value)}
                    />
                    {isCards ? (
                      <span>
                        <strong>{choice.label}</strong>
                        {choice.hint ? <small>{choice.hint}</small> : null}
                      </span>
                    ) : (
                      <span>{choice.label}</span>
                    )}
                  </label>
                ))}
              </div>
              {field.hint ? (
                <span className="field-hint">{field.hint}</span>
              ) : null}
            </fieldset>
          );
        }

        if (field.kind === "checkboxGroup") {
          const selected = Array.isArray(values[field.id])
            ? (values[field.id] as string[])
            : [];
          const toggleValue = (choiceValue: string, checked: boolean) => {
            const next = checked
              ? [...selected, choiceValue]
              : selected.filter((item) => item !== choiceValue);
            onChange(field.id, next);
          };
          return (
            <fieldset className="field option-fieldset" key={field.id}>
              <legend>{field.label}</legend>
              <div className="option-chips">
                {field.choices.map((choice) => (
                  <label className="option-chip" key={choice.value}>
                    <input
                      type="checkbox"
                      value={choice.value}
                      checked={selected.includes(choice.value)}
                      onChange={(event) =>
                        toggleValue(choice.value, event.target.checked)
                      }
                    />
                    <span>{choice.label}</span>
                  </label>
                ))}
              </div>
              {field.hint ? (
                <span className="field-hint">{field.hint}</span>
              ) : null}
            </fieldset>
          );
        }

        if (field.kind === "toggle") {
          const checked = values[field.id] !== false;
          return (
            <div className="field" key={field.id}>
              <span className="field-label-text" id={fieldId + "-label"}>
                {field.label}
              </span>
              <label className="check-row option-toggle">
                <input
                  type="checkbox"
                  checked={checked}
                  aria-labelledby={fieldId + "-label"}
                  onChange={(event) => onChange(field.id, event.target.checked)}
                />
                <span>{checked ? field.onLabel : field.offLabel}</span>
              </label>
              {field.hint ? (
                <span className="field-hint">{field.hint}</span>
              ) : null}
            </div>
          );
        }

        const rows = Array.isArray(values[field.id])
          ? (values[field.id] as ItemRow[])
          : field.defaultRows;
        const updateRow = (
          index: number,
          key: keyof ItemRow,
          value: string,
        ) => {
          const next = rows.map((row, rowIndex) =>
            rowIndex === index ? { ...row, [key]: value } : row,
          );
          onChange(field.id, next);
        };
        return (
          <div className="field" key={field.id}>
            <span className="field-label-text">{field.label}</span>
            <div className="item-table" role="group" aria-label={field.label}>
              <div className="item-table__row item-table__row--head" aria-hidden="true">
                <span>품명</span>
                <span>수량</span>
                <span>단가(원)</span>
              </div>
              {rows.map((row, index) => (
                <div className="item-table__row" key={index}>
                  <input
                    value={row.name}
                    maxLength={60}
                    aria-label={index + 1 + "행 품명"}
                    onChange={(event) =>
                      updateRow(index, "name", event.target.value)
                    }
                  />
                  <input
                    value={row.qty}
                    inputMode="numeric"
                    maxLength={4}
                    aria-label={index + 1 + "행 수량"}
                    onChange={(event) =>
                      updateRow(index, "qty", event.target.value)
                    }
                  />
                  <input
                    value={row.price}
                    inputMode="numeric"
                    maxLength={10}
                    aria-label={index + 1 + "행 단가"}
                    onChange={(event) =>
                      updateRow(index, "price", event.target.value)
                    }
                  />
                </div>
              ))}
            </div>
            {field.hint ? (
              <span className="field-hint">{field.hint}</span>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
