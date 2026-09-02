import { useState } from "react";

import { fieldVisible } from "../data/taskOptions";
import type {
  ItemRow,
  OptionValue,
  OptionValues,
  StyleChoice,
  TaskOptionField,
} from "../data/taskOptions";
import { TemplateWireframe } from "./TemplateWireframe";

interface TaskOptionFieldsProps {
  fields: TaskOptionField[];
  values: OptionValues;
  onChange: (fieldId: string, value: OptionValue) => void;
  idPrefix: string;
}

interface ChoiceCardsProps {
  fieldId: string;
  label: string;
  hint?: string;
  choices: StyleChoice[];
  value: string;
  onSelect: (value: string) => void;
}

/**
 * 카드형 선택. 예시(example)가 있는 카드는 누르면
 * 해당 스타일의 짧은 실물 예시 박스가 토글로 열립니다.
 */
function ChoiceCards({
  fieldId,
  label,
  hint,
  choices,
  value,
  onSelect,
}: ChoiceCardsProps) {
  const [openExample, setOpenExample] = useState<string | null>(null);
  const openChoice = choices.find(
    (choice) => choice.value === openExample && choice.example,
  );

  const selectChoice = (choiceValue: string) => {
    onSelect(choiceValue);
    setOpenExample(choiceValue);
  };

  const clickChoice = (choiceValue: string) => {
    if (value !== choiceValue) return;
    setOpenExample((current) => (current === choiceValue ? null : choiceValue));
  };

  return (
    <fieldset className="field option-fieldset">
      <legend>{label}</legend>
      <div className="option-cards">
        {choices.map((choice) => (
          <label className="option-card" key={choice.value}>
            <input
              type="radio"
              name={fieldId}
              value={choice.value}
              checked={value === choice.value}
              onChange={() => selectChoice(choice.value)}
              onClick={() => clickChoice(choice.value)}
            />
            <span>
              {choice.wireframe ? (
                <TemplateWireframe kind={choice.wireframe} />
              ) : null}
              <strong>{choice.label}</strong>
              {choice.meta ? (
                <small className="option-card__meta">{choice.meta}</small>
              ) : null}
              {choice.hint ? <small>{choice.hint}</small> : null}
              {choice.example ? (
                <small className="option-card__toggle-hint">
                  {openExample === choice.value ? "예시 닫기" : "예시 보기"}
                </small>
              ) : null}
            </span>
          </label>
        ))}
      </div>
      {openChoice?.example ? (
        <div className="style-example" role="note">
          <header>
            <strong>{openChoice.label} 예시</strong>
            <span>가상 데이터</span>
          </header>
          {openChoice.example.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </fieldset>
  );
}

interface TextListFieldProps {
  field: Extract<TaskOptionField, { kind: "textList" }>;
  values: OptionValues;
  onChange: (fieldId: string, value: OptionValue) => void;
}

/**
 * 멘트 목록 + "멘트 초안 만들기" 픽스처.
 * draftFill.profile이 있으면 소개 필드(blogProfile) 값을 반영한 초안을 만들고,
 * 소개가 비어 있으면 일반 초안을 채운 뒤 안내(emptyNotice)를 보여줍니다.
 */
function TextListField({ field, values, onChange }: TextListFieldProps) {
  const [fillNotice, setFillNotice] = useState<string | null>(null);
  const entries = Array.isArray(values[field.id])
    ? (values[field.id] as string[])
    : [""];
  const draftFill = field.draftFill;

  const fillDrafts = () => {
    if (!draftFill) return;
    if (draftFill.profile) {
      const raw = values[draftFill.profile.fieldId];
      const profileValue = typeof raw === "string" ? raw.trim() : "";
      if (profileValue) {
        onChange(field.id, draftFill.profile.build(profileValue));
        setFillNotice(null);
        return;
      }
      onChange(field.id, [...draftFill.drafts]);
      setFillNotice(draftFill.profile.emptyNotice);
      return;
    }
    onChange(field.id, [...draftFill.drafts]);
  };

  return (
    <div className="field">
      {field.hideLabel ? null : (
        <span className="field-label-text">{field.label}</span>
      )}
      <div className="text-list" role="group" aria-label={field.label}>
        {entries.map((entry, index) => (
          <div className="text-list__row" key={index}>
            <textarea
              value={entry}
              rows={2}
              maxLength={300}
              placeholder={field.placeholder}
              aria-label={field.label + " " + (index + 1) + "번"}
              onChange={(event) =>
                onChange(
                  field.id,
                  entries.map((item, itemIndex) =>
                    itemIndex === index ? event.target.value : item,
                  ),
                )
              }
            />
            {entries.length > 1 ? (
              <button
                className="row-remove"
                type="button"
                aria-label={field.label + " " + (index + 1) + "번 삭제"}
                onClick={() =>
                  onChange(
                    field.id,
                    entries.filter((_item, itemIndex) => itemIndex !== index),
                  )
                }
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <div className="field-action-row">
        {draftFill ? (
          <button
            className="button button--secondary button--small"
            type="button"
            onClick={fillDrafts}
          >
            {draftFill.buttonLabel}
          </button>
        ) : null}
        <button
          className="button button--secondary button--small"
          type="button"
          onClick={() => onChange(field.id, [...entries, ""])}
        >
          {field.addLabel}
        </button>
      </div>
      {draftFill ? (
        <span className="field-hint" role="status">
          {fillNotice || draftFill.notice}
        </span>
      ) : null}
      {field.hint ? <span className="field-hint">{field.hint}</span> : null}
    </div>
  );
}

export function TaskOptionFields({
  fields,
  values,
  onChange,
  idPrefix,
}: TaskOptionFieldsProps) {
  const visibleFields = fields.filter((field) => fieldVisible(field, values));

  return (
    <>
      {visibleFields.map((field) => {
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
                  maxLength={200}
                  onChange={(event) => onChange(field.id, event.target.value)}
                />
              ) : (
                <textarea
                  id={fieldId}
                  value={value}
                  placeholder={field.placeholder}
                  maxLength={1200}
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

        if (field.kind === "number") {
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
              <input
                id={fieldId}
                type="number"
                inputMode="numeric"
                min={field.min}
                max={field.max}
                value={value}
                placeholder={field.placeholder}
                onChange={(event) => onChange(field.id, event.target.value)}
              />
              {field.hint ? (
                <span className="field-hint">{field.hint}</span>
              ) : null}
            </div>
          );
        }

        if (field.kind === "date") {
          const value = typeof values[field.id] === "string"
            ? (values[field.id] as string)
            : "";
          return (
            <div className="field" key={field.id}>
              <label htmlFor={fieldId}>{field.label}</label>
              <input
                id={fieldId}
                type="date"
                value={value}
                onChange={(event) => onChange(field.id, event.target.value)}
              />
              {field.hint ? (
                <span className="field-hint">{field.hint}</span>
              ) : null}
            </div>
          );
        }

        if (field.kind === "file") {
          const value = typeof values[field.id] === "string"
            ? (values[field.id] as string)
            : "";
          return (
            <div className="field" key={field.id}>
              <label htmlFor={fieldId}>{field.label}</label>
              <input
                id={fieldId}
                type="file"
                accept={field.accept}
                onChange={(event) =>
                  onChange(field.id, event.target.files?.[0]?.name || "")
                }
              />
              <span className="field-hint">
                {value
                  ? value + " 선택됨 · 프리뷰에서는 업로드하지 않습니다."
                  : "프리뷰에서는 파일 이름만 보관하고 업로드하지 않습니다."}
              </span>
            </div>
          );
        }

        if (field.kind === "select") {
          const value = typeof values[field.id] === "string"
            ? (values[field.id] as string)
            : field.defaultValue;
          const selectedChoice = field.choices.find(
            (choice) => choice.value === value,
          );
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
              {selectedChoice?.hint ? (
                <span className="field-hint field-hint--choice">
                  {selectedChoice.hint}
                </span>
              ) : null}
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
          if (field.variant === "cards") {
            return (
              <ChoiceCards
                key={field.id}
                fieldId={fieldId}
                label={field.label}
                hint={field.hint}
                choices={field.choices}
                value={value}
                onSelect={(next) => onChange(field.id, next)}
              />
            );
          }
          return (
            <fieldset className="field option-fieldset" key={field.id}>
              <legend>{field.label}</legend>
              <div className="option-chips">
                {field.choices.map((choice) => (
                  <label className="option-chip" key={choice.value}>
                    <input
                      type="radio"
                      name={fieldId}
                      value={choice.value}
                      checked={value === choice.value}
                      onChange={() => onChange(field.id, choice.value)}
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

        if (field.kind === "textList") {
          return (
            <TextListField
              key={field.id}
              field={field}
              values={values}
              onChange={onChange}
            />
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
              {rows.map((row, index) => (
                <div className="item-table__row" key={index}>
                  <div className="field">
                    <label htmlFor={fieldId + "-cat-" + index}>항목</label>
                    <input
                      id={fieldId + "-cat-" + index}
                      value={row.category}
                      maxLength={40}
                      placeholder="예: 기본안"
                      onChange={(event) =>
                        updateRow(index, "category", event.target.value)
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={fieldId + "-desc-" + index}>내용</label>
                    <input
                      id={fieldId + "-desc-" + index}
                      value={row.description}
                      maxLength={80}
                      placeholder="작업 내용을 입력"
                      onChange={(event) =>
                        updateRow(index, "description", event.target.value)
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={fieldId + "-price-" + index}>금액</label>
                    <input
                      id={fieldId + "-price-" + index}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1000}
                      value={row.price}
                      placeholder="0"
                      onChange={(event) =>
                        updateRow(index, "price", event.target.value)
                      }
                    />
                  </div>
                  {rows.length > 1 ? (
                    <button
                      className="row-remove"
                      type="button"
                      aria-label={index + 1 + "번 항목 삭제"}
                      onClick={() =>
                        onChange(
                          field.id,
                          rows.filter(
                            (_row, rowIndex) => rowIndex !== index,
                          ),
                        )
                      }
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <button
              className="button button--secondary button--small"
              type="button"
              onClick={() =>
                onChange(field.id, [
                  ...rows,
                  { category: "", description: "", price: "" },
                ])
              }
            >
              {field.addLabel}
            </button>
            {field.hint ? (
              <span className="field-hint">{field.hint}</span>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
