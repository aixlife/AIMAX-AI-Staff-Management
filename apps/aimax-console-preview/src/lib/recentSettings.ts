import {
  allFields,
  buildDefaultOptionValues,
  type EmployeeTaskOptions,
  type ItemRow,
  type OptionValues,
  type TaskOptionField,
} from "../data/taskOptions.ts";

/**
 * "최근 설정 불러오기" 칩의 저장소 (2026-08-31 카운슬 종합 승인).
 * - 업무 생성 시 그 직원의 폼 설정을 sessionStorage에 저장합니다 (탭 단위).
 * - 폼은 항상 기본값으로 열리고, 저장분이 있으면 칩만 노출합니다.
 *   자동 복원은 하지 않습니다 — 복원은 사용자가 칩을 누를 때만 일어납니다.
 * - API 키·비밀번호·개인정보성 값은 저장 대상이 아닙니다. 프리뷰 폼에는
 *   해당 항목이 없고, 파일 항목은 파일명만 남아 복원 의미가 없어 제외합니다.
 * - 저장 불가 환경(프라이빗 모드 등)에서는 조용히 건너뜁니다.
 */

const STORAGE_PREFIX = "aimax-console-preview:recent-options:";
const STORAGE_VERSION = 1;

interface StoredPayload {
  version: number;
  values: Record<string, unknown>;
}

function storageKey(employeeId: string): string {
  return STORAGE_PREFIX + employeeId;
}

function storable(field: TaskOptionField): boolean {
  return field.kind !== "file";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isItemRowArray(value: unknown): value is ItemRow[] {
  return (
    Array.isArray(value) &&
    value.every(
      (row) =>
        typeof row === "object" &&
        row !== null &&
        typeof (row as ItemRow).category === "string" &&
        typeof (row as ItemRow).description === "string" &&
        typeof (row as ItemRow).price === "string",
    )
  );
}

/** 저장된 값이 그 필드에 넣어도 안전한 형태인지 필드 종류별로 검사합니다. */
function validValueForField(
  field: TaskOptionField,
  value: unknown,
): value is OptionValues[string] {
  if (
    field.kind === "text" ||
    field.kind === "textarea" ||
    field.kind === "number" ||
    field.kind === "date"
  ) {
    return typeof value === "string";
  }
  if (field.kind === "select" || field.kind === "choice") {
    return (
      typeof value === "string" &&
      field.choices.some((choice) => choice.value === value)
    );
  }
  if (field.kind === "checkboxGroup") {
    return (
      isStringArray(value) &&
      value.every((item) =>
        field.choices.some((choice) => choice.value === item),
      )
    );
  }
  if (field.kind === "textList") {
    return isStringArray(value);
  }
  if (field.kind === "itemTable") {
    return isItemRowArray(value);
  }
  return false;
}

export function saveRecentOptionValues(
  employeeId: string,
  config: EmployeeTaskOptions,
  values: OptionValues,
): void {
  try {
    const payloadValues: Record<string, unknown> = {};
    for (const field of allFields(config)) {
      if (!storable(field)) continue;
      const value = values[field.id];
      if (value === undefined) continue;
      payloadValues[field.id] = value;
    }
    const payload: StoredPayload = {
      version: STORAGE_VERSION,
      values: payloadValues,
    };
    sessionStorage.setItem(storageKey(employeeId), JSON.stringify(payload));
  } catch {
    // 저장은 편의 기능이라 실패해도 업무 생성 흐름을 막지 않습니다.
  }
}

/**
 * 저장된 최근 설정을 기본값 위에 얹어 돌려줍니다.
 * 저장분이 없거나 형태가 깨졌으면 null — 칩을 그리지 않습니다.
 */
export function loadRecentOptionValues(
  employeeId: string,
  config: EmployeeTaskOptions,
): OptionValues | null {
  try {
    const raw = sessionStorage.getItem(storageKey(employeeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPayload | null;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.version !== STORAGE_VERSION ||
      !parsed.values ||
      typeof parsed.values !== "object"
    ) {
      return null;
    }
    const restored = buildDefaultOptionValues(config);
    let restoredAny = false;
    for (const field of allFields(config)) {
      if (!storable(field)) continue;
      const value = parsed.values[field.id];
      if (!validValueForField(field, value)) continue;
      if (Array.isArray(value)) {
        restored[field.id] = value.map((item) =>
          typeof item === "string" ? item : { ...item },
        ) as OptionValues[string];
      } else {
        restored[field.id] = value;
      }
      restoredAny = true;
    }
    return restoredAny ? restored : null;
  } catch {
    return null;
  }
}
