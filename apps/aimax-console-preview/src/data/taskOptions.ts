/**
 * 직원별 업무 맡기기 옵션 정의 (Phase 1 픽스처 전용).
 *
 * 입력 항목은 실서비스 웹앱(oracle/aimax-reports-api/static/app.html)의
 * 직원별 폼을 항목·라벨 단위로 그대로 미러링합니다.
 * - 예리: app.html yeriJobForm (키워드~기존 작성글 스타일, 16개 입력)
 * - 현주: app.html hyunjuJobForm (타겟 방식~신청 멘트, 6개 입력)
 * - 송이: app.html songiJobForm (키워드 찾기·링크 분석, 13개 입력)
 * - 윤미: app.html yunmiJobForm (주제~레퍼런스 메모, 5개 입력)
 * - 상수: app.html sangsuJobForm (로고~작성일, 14개 입력)
 * 값은 전부 픽스처이며 어떤 항목도 삭제하지 않습니다. 예리·윤미·상수 폼은
 * 필수 / 자주 쓰는 설정 / 고급(토글 1개) 3단으로 재그룹했습니다.
 * 상수 폼에는 실서비스 견적서 렌더러의 부가세 10% 자동 계산을 화면에서
 * 고를 수 있게 부가세 토글 1개를 프리뷰 추가 항목으로 뒀고, 윤미 목적은
 * 실서비스 placeholder 예시 3종을 카드로 제공해 목적별 대본 샘플을 엽니다.
 *
 * 글쓰기 단가는 2026-08 라인업(아래 AI_MODEL_PRICES)이 기준이고,
 * 환율 USD_KRW_RATE(1476원)와 토큰 추정식은 기존 그대로입니다.
 * 예약 발행 시각은 네이버 예약 발행과 동일하게 30분 단위만 고를 수 있게
 * 시(select)·분(00/30 select)으로 제공합니다 (2026-08 웹 실측).
 *
 * 2026-08-31 CEO 지시 반영:
 * - 예리 발행 방식 기본값은 임시 저장(save)입니다 (옵션 순서·라벨은 실서비스 미러).
 * - 이미지 모델은 실서비스 단가를 장당 원화(환율 1476)로 표기하고
 *   gpt-image-2를 추천합니다 (이미지 속 한글 유일 지원, 2026-08-18 실측).
 * - CTA 링크·문구는 상담 유도형/계정 기본 스타일에서만 노출합니다 (값 보존).
 * - 섹션 제목과 같은 필드 라벨 중복은 hideLabel로 제거했습니다 (현주 멘트).
 *
 * 2026-08-31 카운슬 종합 6건 CEO 승인분 반영:
 * - 글쓰기 모델 select는 작성 모드 3단(표준·균형·프리미엄) 카드로 교체했습니다
 *   (예리·윤미 공통, 모드명 + 실제 모델명·단가 보조 표기, 기본값 표준.
 *   이미지 모델 select는 그대로 유지). 예상 비용 박스는 모드 기준으로 갱신됩니다.
 * - 예리 카테고리는 기본 화면에서 빼고, 발행 방식이 즉시(바로)·예약 발행일 때만
 *   고급 설정 안에 "발행할 네이버 게시판"으로 노출합니다.
 * - 스타일 템플릿 카드에는 미니 와이어프레임(wireframe 마커)을 붙였습니다
 *   (계정 기본 카드는 현행 유지 — 와이어프레임 없음).
 * - 윤미 예상 비용 박스는 "기본 초안은 무료 · AI 완성 전환은 결과 확인 후 선택"을
 *   명시합니다 (설명 없는 0원 표기 금지). 폼에는 유료 전환 선택이 없고,
 *   작성 모드는 나중에 AI 완성으로 전환할 때 쓸 모드를 미리 고르는 항목입니다.
 *
 * 2026-08-31 CEO 피드백 6라운드 반영:
 * - 작성 모드 카드에서 "$0.75/$3.75 (1M 토큰)" 같은 개발자 표기를 없앴습니다.
 *   보조 표기는 "글 1편(1500자 기준) 약 N원"의 결과물 단위 원화이고, 모델명은
 *   작은 보조 글씨로만 유지합니다 (청중 = 비개발자 대표). 상세 단가는 예상 비용
 *   박스 안의 한 줄(원화)로만 남습니다.
 * - 윤미 예상 비용은 두 줄 고정: "기본 초안 만들기: 무료" /
 *   "AI 완성으로 전환 시: 약 N원 (선택한 작성 모드 기준)".
 * - 모든 폼 직원의 예상 비용에 submitRecap(생성 버튼 직전 요약)을 추가했습니다.
 * - 현주 폼에 "내 블로그 소개" textarea를 신설했습니다. 실서비스가 웹 작업 설정의
 *   블로그 소개(blog_profile → generateNeighborMessageDrafts(profile))로 멘트
 *   초안을 만드는 것을 폼 안에서 완결되게 미러링합니다. 멘트 초안 만들기는
 *   입력한 소개를 반영한 픽스처 멘트를 만들고, 소개가 비면 일반 멘트 + 안내를
 *   보여줍니다.
 *
 * 2026-08-31 CEO 재정정 반영:
 * - 직원 선택·맡기기 화면에는 현주의 이름·사진·직무를 그대로 표시합니다.
 * - 현주의 레퍼런스 업무 시작 CTA만 연결된 외부 서비스로 이동합니다.
 * - 송이는 실서비스의 독립된 자료조사/잡 폼이 살아 있으므로 키워드 찾기와 링크 분석
 *   두 작업 방식을 픽스처 옵션으로 복원합니다. 여기서는 외부 API를 호출하지 않습니다.
 */

export interface OptionChoice {
  value: string;
  label: string;
  hint?: string;
}

export interface StyleExample {
  /** 카드 클릭 시 토글로 열리는 짧은 실물 예시 (가상 데이터) */
  lines: string[];
}

/** 스타일 템플릿 카드에 그리는 미니 와이어프레임 종류 (SVG 스켈레톤) */
export type WireframeKind = "consult" | "info" | "review";

export interface StyleChoice extends OptionChoice {
  example?: StyleExample;
  /** 모드명 아래에 붙는 보조 표기 (예: 실제 모델명 · 단가) */
  meta?: string;
  /** 카드 안 작은 그림 — 계정 기본 카드처럼 없으면 그리지 않습니다 */
  wireframe?: WireframeKind;
}

export interface ItemRow {
  category: string;
  description: string;
  price: string;
}

export type OptionValue = string | string[] | boolean | ItemRow[];
export type OptionValues = Record<string, OptionValue>;

interface VisibilityCondition {
  fieldId: string;
  equals?: string;
  oneOf?: string[];
}

interface BaseField {
  id: string;
  label: string;
  hint?: string;
  /** 실서비스처럼 다른 값 선택 시에만 노출되는 항목 (equals 또는 oneOf 하나만 사용) */
  visibleWhen?: VisibilityCondition;
  /** 작업 방식과 하위 선택처럼 조건이 둘 이상이면 모든 조건을 만족해야 합니다. */
  visibleWhenAll?: VisibilityCondition[];
  /** 섹션 제목과 라벨이 같을 때 화면 라벨만 숨깁니다 (aria-label은 유지) */
  hideLabel?: boolean;
}

export type TaskOptionField =
  | (BaseField & {
      kind: "text";
      placeholder?: string;
      required?: boolean;
      defaultValue?: string;
    })
  | (BaseField & {
      kind: "textarea";
      placeholder?: string;
      required?: boolean;
      defaultValue?: string;
    })
  | (BaseField & {
      kind: "number";
      min: number;
      max: number;
      placeholder?: string;
      required?: boolean;
      defaultValue?: string;
    })
  | (BaseField & { kind: "date" })
  | (BaseField & { kind: "file"; accept?: string })
  | (BaseField & {
      kind: "select";
      choices: OptionChoice[];
      defaultValue: string;
    })
  | (BaseField & {
      kind: "choice";
      variant: "chips" | "cards";
      choices: StyleChoice[];
      defaultValue: string;
    })
  | (BaseField & {
      kind: "checkboxGroup";
      choices: OptionChoice[];
      defaultValues: string[];
    })
  | (BaseField & {
      kind: "textList";
      addLabel: string;
      placeholder?: string;
      defaultValues: string[];
      /** 픽스처 초안 채우기 버튼 (실서비스 AI 생성 버튼의 프리뷰 대응) */
      draftFill?: {
        buttonLabel: string;
        notice: string;
        /** 소개가 비어 있을 때 채우는 일반 초안 */
        drafts: string[];
        /** 다른 입력 필드(소개 문구)를 반영해 초안을 만드는 픽스처 규칙 */
        profile?: {
          fieldId: string;
          build: (profile: string) => string[];
          emptyNotice: string;
        };
      };
    })
  | (BaseField & {
      kind: "itemTable";
      addLabel: string;
      defaultRows: ItemRow[];
    });

export interface OptionSection {
  title: string;
  description?: string;
  /** true면 다이얼로그에서 접힌 토글(고급 설정)로 렌더링합니다. */
  advanced?: boolean;
  fields: TaskOptionField[];
}

export type CostBasis = "live" | "estimate" | "free";

export interface CostEstimate {
  headline: string;
  lines: string[];
  basis: CostBasis;
  basisLabel: string;
  /**
   * 생성 버튼 직전(확인 체크 근처)에 다시 보여줄 요약 1~2줄.
   * "0원" 단독 표기 금지 — 무료라면 왜 무료인지, 유료 전환이 있으면
   * 언제 얼마가 드는지 같이 적습니다 (2026-08-31 CEO 피드백).
   */
  submitRecap: string[];
}

export interface EmployeeTaskOptions {
  employeeId: string;
  sections: OptionSection[];
  summarize: (values: OptionValues) => string;
  estimateCost: (values: OptionValues) => CostEstimate;
}

/* ------------------------------------------------------------------ */
/* 실서비스 단가표 미러 (app.html 상수와 동일 값)                          */
/* ------------------------------------------------------------------ */

export const USD_KRW_RATE = 1476;
export const USD_KRW_RATE_LABEL = "2026-08 글쓰기 모델 단가표 기준";

interface TextModelPrice {
  inputUsdPer1m: number;
  outputUsdPer1m: number;
  label: string;
}

/** 2026-08 글쓰기 모델 라인업. GPT-5.6 Sol은 2026-08-22 인하가 기준. */
export const AI_MODEL_PRICES: Record<string, TextModelPrice> = {
  "gemini-3.5-flash": { inputUsdPer1m: 1.5, outputUsdPer1m: 9.0, label: "Gemini 3.5 Flash" },
  // 2026-08-13 출시 신형. 12/31까지 인트로가 $0.75/$3.75가 적용됩니다.
  "gemini-3.7-flash": { inputUsdPer1m: 0.75, outputUsdPer1m: 3.75, label: "Gemini 3.7 Flash" },
  "gpt-5.6-terra": { inputUsdPer1m: 2.0, outputUsdPer1m: 12.0, label: "GPT-5.6 Terra" },
  "claude-sonnet-5": { inputUsdPer1m: 3.0, outputUsdPer1m: 15.0, label: "Claude Sonnet 5" },
  "gpt-5.6-sol": { inputUsdPer1m: 4.0, outputUsdPer1m: 20.0, label: "GPT-5.6 Sol" },
  "claude-haiku-4.5": { inputUsdPer1m: 1.0, outputUsdPer1m: 5.0, label: "Claude Haiku 4.5" },
};

export const IMAGE_MODEL_PRICES: Record<string, { perImageUsd: number; label: string }> = {
  "gpt-image-1": { perImageUsd: 0.042, label: "OpenAI gpt-image-1" },
  "gpt-image-2": { perImageUsd: 0.053, label: "OpenAI gpt-image-2" },
  "gemini-2.5-flash-image": { perImageUsd: 0.039, label: "Gemini Nano Banana" },
  "gemini-3.1-flash-image": { perImageUsd: 0.067, label: "Gemini Nano Banana 2" },
  "gemini-3-pro-image": { perImageUsd: 0.134, label: "Gemini Nano Banana Pro" },
};

function estimateTokens(charCount: number): { inputTokens: number; outputTokens: number } {
  const chars = Math.max(300, Math.min(6000, Number(charCount) || 1500));
  return { inputTokens: 2200, outputTokens: Math.ceil(chars * 0.8) };
}

function wonFromUsd(usd: number): number {
  return Math.ceil((Number(usd) || 0) * USD_KRW_RATE);
}

export function wonLabel(value: number): string {
  return Math.ceil(Number(value) || 0).toLocaleString("ko-KR") + "원";
}

function estimateTextCostWon(model: string, charCount: number) {
  const price = AI_MODEL_PRICES[model] || AI_MODEL_PRICES["gemini-3.5-flash"];
  const tokens = estimateTokens(charCount);
  const usd =
    (tokens.inputTokens / 1_000_000) * price.inputUsdPer1m +
    (tokens.outputTokens / 1_000_000) * price.outputUsdPer1m;
  return { usd, won: wonFromUsd(usd), ...tokens, label: price.label };
}

/* ------------------------------------------------------------------ */
/* 공통 헬퍼                                                            */
/* ------------------------------------------------------------------ */

export function allFields(config: EmployeeTaskOptions): TaskOptionField[] {
  return config.sections.flatMap((section) => section.fields);
}

/**
 * 실서비스 항목 수와 대조하기 위한 입력 컨트롤 수.
 * checkboxGroup은 실서비스처럼 체크박스 개수만큼 계산합니다.
 */
export function countInputControls(config: EmployeeTaskOptions): number {
  return allFields(config).reduce(
    (total, field) =>
      total + (field.kind === "checkboxGroup" ? field.choices.length : 1),
    0,
  );
}

export function buildDefaultOptionValues(
  config: EmployeeTaskOptions,
): OptionValues {
  const values: OptionValues = {};
  for (const field of allFields(config)) {
    if (
      field.kind === "text" ||
      field.kind === "textarea" ||
      field.kind === "number"
    ) {
      values[field.id] = field.defaultValue || "";
    } else if (field.kind === "date" || field.kind === "file") {
      values[field.id] = "";
    } else if (field.kind === "select" || field.kind === "choice") {
      values[field.id] = field.defaultValue;
    } else if (field.kind === "checkboxGroup") {
      values[field.id] = [...field.defaultValues];
    } else if (field.kind === "textList") {
      values[field.id] = [...field.defaultValues];
    } else {
      values[field.id] = field.defaultRows.map((row) => ({ ...row }));
    }
  }
  return values;
}

export function fieldVisible(
  field: TaskOptionField,
  values: OptionValues,
): boolean {
  const conditions = [
    ...(field.visibleWhen ? [field.visibleWhen] : []),
    ...(field.visibleWhenAll || []),
  ];
  return conditions.every((condition) => {
    const current = values[condition.fieldId];
    if (condition.oneOf) {
      return typeof current === "string" && condition.oneOf.includes(current);
    }
    return current === condition.equals;
  });
}

export function missingRequiredLabels(
  config: EmployeeTaskOptions,
  values: OptionValues,
): string[] {
  const missing: string[] = [];
  for (const field of allFields(config)) {
    if (!fieldVisible(field, values)) continue;
    if (
      (field.kind === "text" ||
        field.kind === "textarea" ||
        field.kind === "number") &&
      field.required &&
      !String(values[field.id] || "").trim()
    ) {
      missing.push(field.label);
    }
  }
  return missing;
}

function text(values: OptionValues, id: string): string {
  const value = values[id];
  return typeof value === "string" ? value.trim() : "";
}

function choiceLabel(field: TaskOptionField, values: OptionValues): string {
  if (field.kind !== "select" && field.kind !== "choice") return "";
  const value = text(values, field.id) || values[field.id];
  const found = field.choices.find((choice) => choice.value === value);
  return found ? found.label : "";
}

function findField(
  config: EmployeeTaskOptions,
  id: string,
): TaskOptionField | undefined {
  return allFields(config).find((field) => field.id === id);
}

function labelOf(
  config: EmployeeTaskOptions,
  values: OptionValues,
  id: string,
): string {
  const field = findField(config, id);
  return field ? choiceLabel(field, values) : "";
}

function joinParts(parts: string[]): string {
  return parts.filter((part) => part.length > 0).join(" · ");
}

/* ------------------------------------------------------------------ */
/* 예리 — app.html yeriJobForm 16개 입력 미러 + 스타일 템플릿(프리뷰 추가)  */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* 작성 모드 3단 (예리·윤미 공통) — 2026-08-31 카운슬 종합 CEO 승인        */
/* ------------------------------------------------------------------ */

export interface WriteMode {
  value: string;
  /** 모드명 (표준·균형·프리미엄) */
  label: string;
  /** AI_MODEL_PRICES 키 — 실제 과금 모델 */
  model: string;
  /** 모드 성격 한 줄 */
  character: string;
}

export const DEFAULT_WRITE_MODE = "standard";

/**
 * 작성 모드 3단. GPT 포함 3가지 모드로 좁히되 실제 모델명·단가를
 * 함께 보여줍니다 (CEO: 모델명도 같이 보이게). 기본값은 표준입니다.
 */
export const WRITE_MODES: WriteMode[] = [
  {
    value: "standard",
    label: "표준",
    model: "gemini-3.7-flash",
    character: "속도·비용 균형이 좋아 대부분의 글에 맞는 기본 모드입니다.",
  },
  {
    value: "balanced",
    label: "균형",
    model: "gpt-5.6-terra",
    character: "문단 구성과 정확도가 한 단계 안정적인 중간 모드입니다.",
  },
  {
    value: "premium",
    label: "프리미엄",
    model: "claude-sonnet-5",
    character: "문장 품질이 가장 꾸준해 중요한 글에 맞는 상위 모드입니다.",
  },
];

export function writeModeById(value: string): WriteMode {
  return WRITE_MODES.find((mode) => mode.value === value) || WRITE_MODES[0];
}

/** 결과물 단위 비용 표기의 기준 분량 (글 1편). */
export const WRITE_MODE_ARTICLE_CHARS = 1500;

/** 글 1편(1500자 기준) 예상 원가 — 카드 보조 표기·상세 단가 한 줄 공용. */
export function writeModePerArticleWon(modeValue: string): number {
  const mode = writeModeById(modeValue);
  return estimateTextCostWon(mode.model, WRITE_MODE_ARTICLE_CHARS).won;
}

/** 카드에 작은 보조 글씨로만 남기는 실제 모델명. */
export function writeModeModelLabel(mode: WriteMode): string {
  return AI_MODEL_PRICES[mode.model].label;
}

/**
 * 모드 카드 보조 표기: "글 1편(1500자 기준) 약 N원 · 모델명".
 * "$0.75/$3.75 (1M 토큰)" 같은 개발자 표기는 쓰지 않습니다
 * (청중 = 비개발자 대표, 2026-08-31 CEO 피드백).
 */
export function writeModeMeta(mode: WriteMode): string {
  return (
    "글 1편(" +
    WRITE_MODE_ARTICLE_CHARS.toLocaleString("ko-KR") +
    "자 기준) 약 " +
    wonLabel(writeModePerArticleWon(mode.value)) +
    " · " +
    writeModeModelLabel(mode)
  );
}

/** 상세 단가가 궁금한 사람용 한 줄 (예상 비용 박스 전용, 원화만). */
export function writeModeDetailPriceLine(): string {
  return (
    "상세 단가(1,500자 1편 기준): " +
    WRITE_MODES.map(
      (mode) => mode.label + " 약 " + wonLabel(writeModePerArticleWon(mode.value)),
    ).join(" · ")
  );
}

/** 작성 모드 기준 글 비용 추정 (예상 비용 박스·윤미 전환 CTA 공용) */
export function estimateWriteModeCost(modeValue: string, charCount: number) {
  const mode = writeModeById(modeValue);
  const cost = estimateTextCostWon(mode.model, charCount);
  return { ...cost, modeLabel: mode.label, modelLabel: cost.label };
}

const WRITE_MODE_CARD_CHOICES: StyleChoice[] = WRITE_MODES.map((mode) => ({
  value: mode.value,
  label: mode.label + (mode.value === DEFAULT_WRITE_MODE ? " (기본값)" : ""),
  meta: writeModeMeta(mode),
  hint: mode.character,
}));

/** 네이버 예약 발행 미러: 시각은 시 select + 분(00/30) select로만 선택합니다. */
const SCHEDULE_HOUR_CHOICES: OptionChoice[] = Array.from(
  { length: 24 },
  (_, hour) => {
    const meridiem = hour < 12 ? "오전" : "오후";
    const display = hour % 12 === 0 ? 12 : hour % 12;
    return { value: String(hour), label: meridiem + " " + display + "시" };
  },
);

const SCHEDULE_MINUTE_CHOICES: OptionChoice[] = [
  { value: "00", label: "00분" },
  { value: "30", label: "30분" },
];

/** 실서비스 단가를 장당 원화(환율 1476원/USD)로 환산해 표기합니다. */
function imageModelChoiceLabel(value: string, badge?: string): string {
  const price = IMAGE_MODEL_PRICES[value];
  const perImageWon = wonLabel(wonFromUsd(price.perImageUsd));
  return (
    price.label + (badge ? " (" + badge + ")" : "") + " · 장당 약 " + perImageWon
  );
}

const IMAGE_MODEL_CHOICES: OptionChoice[] = [
  { value: "gpt-image-1", label: imageModelChoiceLabel("gpt-image-1") },
  {
    value: "gpt-image-2",
    label: imageModelChoiceLabel("gpt-image-2", "추천"),
    hint: "이미지 속 한글을 깨지 않고 넣을 수 있는 유일한 모델입니다 (2026-08-18 실측, 다른 모델은 한글이 깨집니다).",
  },
  {
    value: "gemini-2.5-flash-image",
    label: imageModelChoiceLabel("gemini-2.5-flash-image"),
  },
  {
    value: "gemini-3.1-flash-image",
    label: imageModelChoiceLabel("gemini-3.1-flash-image"),
  },
  {
    value: "gemini-3-pro-image",
    label: imageModelChoiceLabel("gemini-3-pro-image"),
  },
];

const yeriOptions: EmployeeTaskOptions = {
  employeeId: "yeri",
  sections: [
    {
      title: "필수 입력",
      description: "이 두 가지만 정하면 바로 맡길 수 있습니다.",
      fields: [
        {
          kind: "text",
          id: "keywords",
          label: "키워드",
          placeholder: "예: 강남 피부관리, 리프팅 후기",
          hint: "키워드를 여러 개 입력하면 키워드마다 1편씩 작성됩니다.",
          required: true,
        },
        {
          kind: "choice",
          variant: "cards",
          id: "template",
          label: "이번 글 스타일 템플릿",
          hint: "카드를 누르면 그 스타일의 짧은 예시가 열립니다. 프리뷰 추가 항목입니다.",
          choices: [
            {
              value: "account-default",
              label: "계정 기본 스타일",
              hint: "이 계정에 저장된 문체 프로필을 그대로 씁니다.",
              example: {
                lines: [
                  "제목: 순천 점심 맛집, 세 번 가보고 정리했습니다",
                  "지난주에도 같은 골목을 지나다 결국 또 들렀습니다.",
                  "평소 쓰던 말투 그대로, 소제목과 사진 위치도 이전 글 흐름을 잇습니다.",
                  "첫 방문 때는 몰랐는데, 두 번째부터 보이는 게 있더라고요.",
                  "마무리: 다음 글은 저녁 메뉴 편으로 이어가겠습니다.",
                ],
              },
            },
            {
              value: "consult",
              label: "상담 유도형",
              hint: "문의·상담 신청으로 자연스럽게 이어지는 흐름입니다.",
              wireframe: "consult",
              example: {
                lines: [
                  "제목: 순천 점심 맛집, 모임 장소로 고민된다면",
                  "인원과 예산부터 정리해드립니다. 4인 기준 상차림과 예약 팁까지.",
                  "비슷한 고민 상담이 많아 자주 묻는 질문을 중간에 모았습니다.",
                  "마무리: 더 자세한 안내가 필요하면 댓글이나 문의를 남겨주세요.",
                  "CTA: 상담 신청으로 연결되는 문단으로 끝납니다.",
                ],
              },
            },
            {
              value: "info",
              label: "정보 정리형",
              hint: "목록과 비교표 중심으로 검색 의도를 채웁니다.",
              wireframe: "info",
              example: {
                lines: [
                  "제목: 순천 점심 맛집 5곳 비교 (주차·대기·가격)",
                  "본문은 목록과 비교표 중심으로 검색 의도를 바로 채웁니다.",
                  "1) 가격대 요약 2) 주차 여부 3) 대기 시간",
                  "표: 가게별 대표 메뉴·가격·영업시간 정리",
                  "마무리: 상황별 추천 한 줄 요약으로 닫습니다.",
                ],
              },
            },
            {
              value: "review",
              label: "후기 추천형",
              hint: "직접 써 본 경험담 톤으로 신뢰를 쌓습니다.",
              wireframe: "review",
              example: {
                lines: [
                  "제목: 순천 점심 맛집, 직접 다녀온 솔직 후기",
                  "12시 10분 도착, 대기 3팀. 자리부터 잡고 주문했습니다.",
                  "경험담 톤으로 사진, 감상, 팁 순서로 흘러갑니다.",
                  "아쉬운 점도 한 가지는 꼭 적어 신뢰를 만듭니다.",
                  "마무리: 재방문 의사와 한 줄 평으로 닫습니다.",
                ],
              },
            },
          ],
          defaultValue: "account-default",
        },
      ],
    },
    {
      title: "자주 쓰는 설정",
      description: "실사용률이 높은 항목만 항상 펼쳐 둡니다 (CTA 42%).",
      fields: [
        {
          kind: "select",
          id: "mode",
          label: "발행 방식",
          choices: [
            { value: "publish", label: "즉시 발행" },
            { value: "save", label: "임시 저장" },
            { value: "schedule", label: "예약 발행" },
          ],
          // 옵션 순서·라벨은 실서비스 미러, 기본값만 임시 저장 (실서비스 UX 관례).
          defaultValue: "save",
        },
        {
          kind: "date",
          id: "scheduleDate",
          label: "예약 날짜",
          visibleWhen: { fieldId: "mode", equals: "schedule" },
        },
        {
          kind: "select",
          id: "scheduleHour",
          label: "예약 시간",
          hint: "네이버 예약 발행과 동일하게 목록에서만 고를 수 있습니다.",
          choices: SCHEDULE_HOUR_CHOICES,
          defaultValue: "9",
          visibleWhen: { fieldId: "mode", equals: "schedule" },
        },
        {
          kind: "select",
          id: "scheduleMinute",
          label: "예약 분",
          hint: "네이버는 30분 단위 예약만 지원해 00분·30분만 선택할 수 있습니다.",
          choices: SCHEDULE_MINUTE_CHOICES,
          defaultValue: "00",
          visibleWhen: { fieldId: "mode", equals: "schedule" },
        },
        {
          kind: "number",
          id: "scheduleInterval",
          label: "예약 간격",
          min: 1,
          max: 72,
          defaultValue: "1",
          hint: "키워드가 여러 개면 이 간격(시간)만큼 벌려 예약합니다.",
          visibleWhen: { fieldId: "mode", equals: "schedule" },
        },
        {
          kind: "choice",
          variant: "cards",
          id: "writeMode",
          label: "작성 모드",
          hint: "모드만 고르면 모델·단가가 함께 맞춰지고, 아래 예상 비용도 모드 기준으로 갱신됩니다.",
          choices: WRITE_MODE_CARD_CHOICES,
          defaultValue: DEFAULT_WRITE_MODE,
        },
        {
          kind: "select",
          id: "wordCount",
          label: "분량",
          choices: [
            { value: "300", label: "300자" },
            { value: "800", label: "800자" },
            { value: "1500", label: "1500자" },
            { value: "2500", label: "2500자" },
          ],
          defaultValue: "1500",
        },
        {
          kind: "select",
          id: "imageCount",
          label: "이미지",
          choices: [
            { value: "0", label: "0장" },
            { value: "1", label: "1장" },
            { value: "2", label: "2장" },
            { value: "3", label: "3장" },
            { value: "4", label: "4장" },
            { value: "5", label: "5장" },
            { value: "6", label: "6장" },
          ],
          defaultValue: "3",
        },
        {
          kind: "select",
          id: "imageModel",
          label: "이미지 모델",
          choices: IMAGE_MODEL_CHOICES,
          defaultValue: "gpt-image-1",
        },
        {
          kind: "text",
          id: "ctaLink",
          label: "CTA 링크",
          placeholder: "선택",
          visibleWhen: {
            fieldId: "template",
            oneOf: ["account-default", "consult"],
          },
        },
        {
          kind: "text",
          id: "ctaText",
          label: "CTA 문구",
          placeholder: "선택",
          hint: "상담 유도형·계정 기본 스타일에서만 표시됩니다. 다른 템플릿으로 바꿔도 입력값은 보존됩니다.",
          visibleWhen: {
            fieldId: "template",
            oneOf: ["account-default", "consult"],
          },
        },
      ],
    },
    {
      title: "고급 설정",
      description:
        "발행할 네이버 게시판, SEO 참고자료·품질 체크, 기존 작성글 문체 참고(사용률 8%) 같은 세부 옵션입니다.",
      advanced: true,
      fields: [
        {
          // 실서비스 category 항목. 기본 화면에서 빼고, 바로(즉시)·예약 발행일 때만
          // 고급 설정 안에 노출합니다 (임시 저장에는 게시판 지정이 무의미).
          kind: "text",
          id: "category",
          label: "발행할 네이버 게시판",
          placeholder: "선택",
          hint: "비워두면 기본 게시판에 발행됩니다.",
          visibleWhen: { fieldId: "mode", oneOf: ["publish", "schedule"] },
        },
        {
          kind: "checkboxGroup",
          id: "quality",
          label: "작성 품질 옵션",
          choices: [
            { value: "seoResearch", label: "SEO 자동조사" },
            { value: "keywordEmphasis", label: "핵심 키워드 강조" },
          ],
          defaultValues: ["seoResearch"],
        },
        {
          kind: "textarea",
          id: "seoReferences",
          label: "SEO 참고자료",
          placeholder:
            "선택 입력: 상위글 URL 또는 참고 본문을 붙여넣으세요. 여러 글은 --- 로 구분합니다.",
        },
        {
          kind: "textarea",
          id: "styleReference",
          label: "기존 작성글 스타일",
          placeholder:
            "선택 입력: 예전에 쓴 글을 붙이면 문장 길이와 어투만 참고합니다.",
        },
      ],
    },
  ],
  summarize: (values) => {
    const template = labelOf(yeriOptions, values, "template");
    const mode = labelOf(yeriOptions, values, "mode");
    const length = text(values, "wordCount");
    const images = text(values, "imageCount");
    return joinParts([
      template,
      length ? length + "자" : "",
      images ? "이미지 " + images + "장" : "",
      mode,
    ]);
  },
  estimateCost: (values) => {
    const modeValue = text(values, "writeMode") || DEFAULT_WRITE_MODE;
    const imageModel = text(values, "imageModel") || "gpt-image-1";
    const wordCount = Number(text(values, "wordCount")) || 1500;
    const imageCount = Number(text(values, "imageCount")) || 0;
    const textCost = estimateWriteModeCost(modeValue, wordCount);
    const imagePrice =
      IMAGE_MODEL_PRICES[imageModel] || IMAGE_MODEL_PRICES["gpt-image-1"];
    const imageWon = wonFromUsd(imageCount * imagePrice.perImageUsd);
    const totalWon = textCost.won + imageWon;
    return {
      headline: "예상 원가 약 " + wonLabel(totalWon),
      lines: [
        "글 " +
          wonLabel(textCost.won) +
          " (" +
          textCost.modeLabel +
          " 모드 · " +
          textCost.modelLabel +
          ") + " +
          imagePrice.label +
          " 이미지 " +
          imageCount +
          "장 " +
          wonLabel(imageWon),
        "이미지 단가: 장당 약 " + wonLabel(wonFromUsd(imagePrice.perImageUsd)),
        writeModeDetailPriceLine(),
      ],
      basis: "live",
      basisLabel: USD_KRW_RATE_LABEL,
      submitRecap: [
        "예상 원가 약 " +
          wonLabel(totalWon) +
          " (" +
          textCost.modeLabel +
          " 모드 · 이미지 " +
          imageCount +
          "장 포함)",
      ],
    };
  },
};

/* ------------------------------------------------------------------ */
/* 송이 — app.html songiJobForm 13개 입력 + 작업 방식(프리뷰 추가)         */
/* ------------------------------------------------------------------ */

const SONGI_DISCOVERY_PRICING_USD: Record<
  string,
  { start: number; perResult: number }
> = {
  instagram: { start: 0.005, perResult: 0.0026 },
  tiktok: { start: 0.012, perResult: 0.0017 },
  threads: { start: 0.01, perResult: 0.002 },
  meta_ads: { start: 0.005, perResult: 0.00075 },
};

function songiUrlCount(values: OptionValues): number {
  return text(values, "urls")
    .split(/\n+/)
    .map((url) => url.trim())
    .filter(Boolean).length;
}

const songiOptions: EmployeeTaskOptions = {
  employeeId: "songi",
  sections: [
    {
      title: "작업 방식",
      description:
        "실서비스 송이 폼의 두 작업을 그대로 고릅니다. 이 화면은 입력과 비용 안내만 재현하며 외부 API를 호출하지 않습니다.",
      fields: [
        {
          kind: "choice",
          variant: "chips",
          id: "taskMode",
          label: "자료조사 방식",
          choices: [
            {
              value: "discover",
              label: "키워드로 찾기",
              hint: "플랫폼 후보를 모아 반응을 비교합니다.",
            },
            {
              value: "links",
              label: "링크로 분석",
              hint: "지정한 영상·웹 링크로 기획 브리프를 만듭니다.",
            },
          ],
          defaultValue: "discover",
        },
      ],
    },
    {
      title: "키워드로 찾기",
      description:
        "유튜브 공개 검색은 무료이며, 다른 플랫폼은 실행 전 Apify 예상 비용을 확인합니다.",
      fields: [
        {
          kind: "select",
          id: "discoveryProject",
          label: "저장할 프로젝트",
          choices: [
            { value: "current", label: "현재 프로젝트" },
            { value: "new", label: "새 프로젝트" },
          ],
          defaultValue: "current",
          visibleWhen: { fieldId: "taskMode", equals: "discover" },
        },
        {
          kind: "text",
          id: "discoveryProjectName",
          label: "새 프로젝트명",
          placeholder: "예: AI 직원 벤치마킹",
          hint: "새 프로젝트로 저장할 때만 입력합니다.",
          visibleWhenAll: [
            { fieldId: "taskMode", equals: "discover" },
            { fieldId: "discoveryProject", equals: "new" },
          ],
        },
        {
          kind: "text",
          id: "discoveryKeyword",
          label: "찾고 싶은 키워드",
          placeholder: "예: 30대 피부관리 쇼츠, AI 직원",
          required: true,
          visibleWhen: { fieldId: "taskMode", equals: "discover" },
        },
        {
          kind: "select",
          id: "discoveryPlatform",
          label: "플랫폼",
          choices: [
            { value: "youtube", label: "유튜브 (무료)" },
            { value: "instagram", label: "인스타그램 (Apify 유료)" },
            { value: "tiktok", label: "틱톡 (Apify 유료)" },
            { value: "threads", label: "스레드 (Apify 유료)" },
            { value: "meta_ads", label: "메타 광고 (Apify 유료)" },
          ],
          defaultValue: "youtube",
          visibleWhen: { fieldId: "taskMode", equals: "discover" },
        },
        {
          kind: "select",
          id: "discoverySort",
          label: "수집 모드",
          choices: [
            { value: "top", label: "인기 우선" },
            { value: "recent", label: "최신 우선" },
          ],
          defaultValue: "top",
          visibleWhen: { fieldId: "taskMode", equals: "discover" },
        },
        {
          kind: "select",
          id: "discoveryDays",
          label: "최근성 기준",
          choices: [
            { value: "7", label: "최근 7일" },
            { value: "30", label: "최근 30일" },
            { value: "90", label: "최근 90일" },
          ],
          defaultValue: "30",
          visibleWhen: { fieldId: "taskMode", equals: "discover" },
        },
        {
          kind: "select",
          id: "discoveryMaxResults",
          label: "후보 수",
          choices: [
            { value: "8", label: "8개" },
            { value: "12", label: "12개" },
            { value: "20", label: "20개" },
          ],
          defaultValue: "12",
          visibleWhen: { fieldId: "taskMode", equals: "discover" },
        },
      ],
    },
    {
      title: "링크로 분석",
      description:
        "링크와 내 채널 맥락을 함께 넣으면 성과 해석과 적용 포인트를 담은 브리프를 준비합니다.",
      fields: [
        {
          kind: "select",
          id: "linkProject",
          label: "프로젝트",
          choices: [
            { value: "current", label: "현재 프로젝트" },
            { value: "new", label: "새 프로젝트" },
          ],
          defaultValue: "current",
          visibleWhen: { fieldId: "taskMode", equals: "links" },
        },
        {
          kind: "text",
          id: "linkProjectName",
          label: "새 프로젝트명",
          placeholder: "예: 뷰티 릴스 후킹 연구",
          hint: "새 프로젝트로 저장할 때만 입력합니다.",
          visibleWhenAll: [
            { fieldId: "taskMode", equals: "links" },
            { fieldId: "linkProject", equals: "new" },
          ],
        },
        {
          kind: "text",
          id: "instagramProfile",
          label: "내 인스타그램 프로필 링크",
          placeholder: "instagram.com/your_account",
          visibleWhen: { fieldId: "taskMode", equals: "links" },
        },
        {
          kind: "text",
          id: "contentCategory",
          label: "영상 카테고리",
          placeholder: "예: 뷰티, 교육, 부동산",
          visibleWhen: { fieldId: "taskMode", equals: "links" },
        },
        {
          kind: "text",
          id: "contentTopic",
          label: "만들고 싶은 주제",
          placeholder: "예: 30대 피부관리 루틴",
          visibleWhen: { fieldId: "taskMode", equals: "links" },
        },
        {
          kind: "textarea",
          id: "urls",
          label: "벤치마킹하고 싶은 링크",
          placeholder:
            "YouTube, Instagram Reels, TikTok 링크를 붙여넣으세요. 여러 개는 줄바꿈으로 입력합니다.",
          required: true,
          visibleWhen: { fieldId: "taskMode", equals: "links" },
        },
      ],
    },
  ],
  summarize: (values) => {
    const taskMode = text(values, "taskMode") || "discover";
    if (taskMode === "links") {
      const count = songiUrlCount(values);
      return joinParts([
        "링크로 분석",
        count ? "링크 " + count + "개" : "링크 입력 대기",
        text(values, "contentTopic"),
      ]);
    }
    return joinParts([
      "키워드로 찾기",
      labelOf(songiOptions, values, "discoveryPlatform"),
      text(values, "discoveryKeyword"),
      labelOf(songiOptions, values, "discoveryMaxResults"),
    ]);
  },
  estimateCost: (values) => {
    const taskMode = text(values, "taskMode") || "discover";
    if (taskMode === "links") {
      const count = songiUrlCount(values);
      return {
        headline: count
          ? "링크 " + count + "개 · 실서비스 실행 전 비용 확인"
          : "링크를 넣으면 예상 비용을 안내합니다",
        lines: [
          "링크별 Gemini 분석과 SNS 원문 수집 필요 여부에 따라 비용이 달라집니다.",
          "이 프리뷰는 외부 API를 호출하지 않으며 실제 실행 전 확인 절차를 재현합니다.",
        ],
        basis: "estimate",
        basisLabel: "실서비스 링크 분석 비용 안내 미러",
        submitRecap: [
          count
            ? "링크 " + count + "개 · 실제 실행 전 Gemini·Apify 비용 확인"
            : "링크 입력 후 실제 실행 전 Gemini·Apify 비용 확인",
        ],
      };
    }

    const platform = text(values, "discoveryPlatform") || "youtube";
    const requestedCount = Math.max(
      1,
      Number(text(values, "discoveryMaxResults")) || 12,
    );
    const count = platform === "meta_ads" ? Math.max(10, requestedCount) : requestedCount;
    const platformLabel =
      labelOf(songiOptions, values, "discoveryPlatform").replace(/\s*\(.+\)$/, "") ||
      platform;
    if (platform === "youtube") {
      return {
        headline: "유튜브 공개 검색: 무료",
        lines: [
          "AIMAX 공개 검색으로 후보 " + count + "개를 찾으며 외부 API 비용은 0원입니다.",
          "이 프리뷰에서는 검색을 실행하지 않고 입력과 결과 흐름만 확인합니다.",
        ],
        basis: "free",
        basisLabel: "실서비스 무료 공개 검색 정책",
        submitRecap: [
          "외부 AI/API 비용 0원 (무료 공개 검색) · 후보 " + count + "개",
        ],
      };
    }
    const pricing = SONGI_DISCOVERY_PRICING_USD[platform];
    const usd = pricing
      ? pricing.start + count * pricing.perResult
      : 0;
    const won = wonFromUsd(usd);
    return {
      headline: platformLabel + " 예상 최대 비용 약 " + wonLabel(won),
      lines: [
        "후보 " +
          count +
          "개 기준 · 내 Apify 크레딧에서 차감 · 실행 시작 고정비 포함",
        "프리뷰에서는 비용만 계산하고 Apify를 호출하지 않습니다.",
      ],
      basis: "estimate",
      basisLabel: "실서비스 Apify 폴백 단가 미러",
      submitRecap: [
        platformLabel +
          " 후보 " +
          count +
          "개 · 예상 최대 비용 약 " +
          wonLabel(won) +
          " (Apify)",
      ],
    };
  },
};

/* ------------------------------------------------------------------ */
/* 현주 — app.html hyunjuJobForm 6개 입력 미러                            */
/* ------------------------------------------------------------------ */

const HYUNJU_SPEED_SECONDS: Record<string, number> = {
  safe: 90,
  normal: 60,
  fast: 40,
};

/** 블로그 소개가 비어 있을 때 채우는 일반 멘트 (기존 픽스처 3종). */
export const HYUNJU_GENERIC_MESSAGE_DRAFTS: string[] = [
  "안녕하세요. 블로그 글이 좋아서 들렀습니다. 앞으로 자주 소통하고 싶어 서로이웃 신청드립니다.",
  "안녕하세요. 좋은 글을 꾸준히 보고 싶어서 서로이웃 신청드립니다. 자주 들러 인사드릴게요.",
  "글 잘 보고 갑니다. 비슷한 관심사로 블로그를 운영하고 있어 서로이웃으로 소통하고 싶습니다.",
];

/**
 * 실서비스 generateNeighborMessageDrafts(profile) 미러 (app.html:14614).
 * 입력한 블로그 소개(명사구로 정돈)를 반영한 픽스처 멘트 3종을 만듭니다.
 * 소개가 비어 있으면 일반 멘트를 돌려줍니다.
 */
export function buildHyunjuMessageDrafts(profile: string): string[] {
  let intro = profile.replace(/\s+/g, " ").trim();
  intro = intro.replace(/[.!?…]+$/, "");
  intro = intro.replace(/(입니다|이에요|예요|에요|합니다)$/, "").trim();
  if (intro.length > 60) intro = intro.slice(0, 60).trim();
  if (!intro) return [...HYUNJU_GENERIC_MESSAGE_DRAFTS];
  return [
    "안녕하세요. " +
      intro +
      " 운영자입니다. 이웃님 글이 좋아 서로이웃 신청드립니다. 자주 들러 소통하고 싶습니다.",
    "반갑습니다. " +
      intro +
      " 운영자입니다. 관심사가 비슷해 글을 재미있게 봤고, 서로이웃으로 자주 소통하고 싶어 신청드립니다.",
    "안녕하세요. " +
      intro +
      " 운영자예요. 좋은 글 오래 보고 싶어 서로이웃 신청드립니다. 제 블로그에도 놀러 오세요.",
  ];
}

const hyunjuOptions: EmployeeTaskOptions = {
  employeeId: "hyunju",
  sections: [
    {
      title: "타겟 설정",
      fields: [
        {
          kind: "select",
          id: "targetMode",
          label: "타겟 방식",
          choices: [
            { value: "keyword", label: "키워드 검색" },
            { value: "blogger_followers", label: "타겟 블로거 팔로워" },
          ],
          defaultValue: "keyword",
        },
        {
          kind: "text",
          id: "keywords",
          label: "검색 키워드",
          placeholder: "예: 강남 피부관리, 웨딩 준비",
          required: true,
        },
        {
          kind: "text",
          id: "bloggerUrl",
          label: "타겟 블로거 URL",
          placeholder: "예: blog.naver.com/example",
          hint: "타겟 방식이 '타겟 블로거 팔로워'일 때만 사용합니다.",
          visibleWhen: { fieldId: "targetMode", equals: "blogger_followers" },
        },
      ],
    },
    {
      title: "신청 설정",
      fields: [
        {
          kind: "number",
          id: "count",
          label: "키워드당 신청 수",
          min: 1,
          max: 50,
          defaultValue: "10",
          required: true,
        },
        {
          kind: "select",
          id: "speed",
          label: "속도",
          choices: [
            { value: "safe", label: "안전" },
            { value: "normal", label: "보통" },
            { value: "fast", label: "빠름" },
          ],
          defaultValue: "normal",
        },
      ],
    },
    {
      // 섹션 제목과 필드 라벨이 같아 화면 라벨은 숨깁니다 (중복 라벨 제거).
      title: "서로이웃 신청 멘트",
      fields: [
        {
          // 실서비스 웹 작업 설정의 블로그 소개(blog_profile) 미러 — 멘트 초안의
          // 재료라 멘트 바로 위에 둬 폼 안에서 완결합니다 (2026-08-31 CEO 피드백,
          // 프리뷰 추가 입력 1개).
          kind: "textarea",
          id: "blogProfile",
          label: "내 블로그 소개",
          placeholder:
            "어떤 블로그인지 한두 문장 (예: 순천 맛집과 동네 카페를 기록하는 블로그)",
          hint: "아래 '멘트 초안 만들기'가 이 소개 문구를 바탕으로 멘트를 만듭니다. 비워두면 일반 멘트를 만듭니다.",
        },
        {
          kind: "textList",
          id: "messages",
          label: "서로이웃 신청 멘트",
          hideLabel: true,
          addLabel: "멘트 칸 추가",
          placeholder:
            "한 줄에 하나씩 입력합니다. 비워두면 로컬 앱에 저장된 멘트를 사용합니다.",
          defaultValues: [""],
          // 실서비스 설정 탭 generateNeighborMessagesBtn(AI 생성) 미러.
          draftFill: {
            buttonLabel: "멘트 초안 만들기",
            notice:
              "입력한 블로그 소개를 바탕으로 만듭니다. 프리뷰에서는 소개를 반영한 픽스처 멘트 3종을 채웁니다.",
            drafts: HYUNJU_GENERIC_MESSAGE_DRAFTS,
            profile: {
              fieldId: "blogProfile",
              build: buildHyunjuMessageDrafts,
              emptyNotice:
                "블로그 소개가 비어 있어 일반 멘트 3종을 채웠습니다. 위 '내 블로그 소개'를 입력하고 다시 누르면 소개를 반영한 멘트를 만듭니다.",
            },
          },
        },
      ],
    },
  ],
  summarize: (values) => {
    const targetMode = labelOf(hyunjuOptions, values, "targetMode");
    const count = text(values, "count");
    const speed = labelOf(hyunjuOptions, values, "speed");
    return joinParts([
      targetMode,
      count ? "키워드당 " + count + "건" : "",
      speed ? "속도 " + speed : "",
    ]);
  },
  estimateCost: (values) => {
    const keywords = text(values, "keywords")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const keywordCount = Math.max(1, keywords.length);
    const perKeyword = Math.min(
      50,
      Math.max(1, Number(text(values, "count")) || 10),
    );
    const totalRequests = keywordCount * perKeyword;
    const speed = text(values, "speed") || "normal";
    const seconds = HYUNJU_SPEED_SECONDS[speed] || 60;
    const minutes = Math.max(1, Math.ceil((totalRequests * seconds) / 60));
    const speedLabel = labelOf(hyunjuOptions, values, "speed") || "보통";
    return {
      headline: "외부 AI/API 비용 0원 · 신청 " + totalRequests + "건 예정",
      lines: [
        "로컬 실행기에서 네이버 자동화로 실행되어 모델 비용이 들지 않습니다.",
        "작업량: 키워드 " +
          keywordCount +
          "개 × 키워드당 " +
          perKeyword +
          "건 = " +
          totalRequests +
          "건",
        "예상 소요 약 " +
          minutes +
          "분 (속도 '" +
          speedLabel +
          "' 기준 · 추정치)",
      ],
      basis: "estimate",
      basisLabel: "작업량 추정 (실서비스에 단가 표기 없음)",
      submitRecap: [
        "외부 AI/API 비용 0원 (로컬 자동화) · 신청 " +
          totalRequests +
          "건 · 약 " +
          minutes +
          "분 예상",
      ],
    };
  },
};

/* ------------------------------------------------------------------ */
/* 윤미 — app.html yunmiJobForm 5개 입력 미러                             */
/* ------------------------------------------------------------------ */

/**
 * 윤미 기본 초안의 기본 글자 수 추정치 (topic 등 입력이 비어 있을 때 기준).
 * 업무 페이지의 "AI로 완성하기" CTA도 같은 기준으로 모드별 비용을 계산합니다.
 */
export const YUNMI_UPGRADE_CHAR_COUNT = 2600;

/** 윤미 AI 완성 전환의 모드별 예상 비용 (업무 페이지 CTA·확인 다이얼로그 공용) */
export function yunmiUpgradeEstimateWon(modeValue: string): number {
  return estimateWriteModeCost(modeValue, YUNMI_UPGRADE_CHAR_COUNT).won;
}

const yunmiOptions: EmployeeTaskOptions = {
  employeeId: "yunmi",
  sections: [
    {
      title: "필수 입력",
      description:
        "기본 초안은 외부 AI/API 비용 0원으로 만듭니다. 주제와 목적만 정확히 넣으면 윤미가 A/B/C 타깃별 스크립트를 추천합니다.",
      fields: [
        {
          kind: "text",
          id: "topic",
          label: "주제",
          placeholder: "예: 30대 피부관리 루틴, 학부모 설명회 오프닝",
          hint: "실서비스에서는 주제·목적·레퍼런스 메모 중 하나만 있어도 됩니다.",
          required: true,
        },
        {
          kind: "choice",
          variant: "cards",
          id: "objective",
          label: "목적",
          hint: "실서비스에서는 자유 입력 항목입니다. 프리뷰에서는 대표 목적 3종을 카드로 제공하고, 카드를 누르면 이 설정으로 나오는 짧은 대본 샘플이 열립니다.",
          choices: [
            {
              value: "save-lead",
              label: "저장을 유도하기",
              hint: "다시 볼 가치를 앞세워 저장 버튼을 누르게 합니다.",
              example: {
                lines: [
                  "후킹: 피부과 가기 전, 이 3가지는 집에서 끝내세요.",
                  "전개: 아침·저녁 루틴을 화면 자막 3줄로 끊어 보여줍니다.",
                  "대사: 둘째, 세안 후 3분 안에 보습까지가 한 세트입니다.",
                  "자막: 핵심 단계마다 번호 자막을 붙여 저장 캡처를 유도합니다.",
                  "CTA: 나중에 다시 보게 저장해두세요. (저장 유도형)",
                ],
              },
            },
            {
              value: "consult-lead",
              label: "상담 전환 만들기",
              hint: "문제를 좁혀 상담 신청으로 자연스럽게 잇습니다.",
              example: {
                lines: [
                  "후킹: 견적 받고 고민만 3주째라면, 순서가 틀린 겁니다.",
                  "전개: 흔한 실패 사례 1개를 보여주고 판단 기준 2가지로 좁힙니다.",
                  "대사: 예산보다 먼저 확인할 건 우리 매장 동선입니다.",
                  "자막: 마지막 3초에 상담 신청 방법을 고정 자막으로 띄웁니다.",
                  "CTA: 프로필 링크에서 무료 상담을 신청하세요. (댓글 유도 병행)",
                ],
              },
            },
            {
              value: "event-hype",
              label: "설명회 기대감 높이기",
              hint: "현장에서만 얻는 것을 예고해 참석 동기를 만듭니다.",
              example: {
                lines: [
                  "후킹: 이번 설명회에서 이 질문 하나는 꼭 하세요.",
                  "전개: 현장에서만 공개하는 자료 목차를 3컷으로 예고합니다.",
                  "대사: 작년 참석자들이 가장 아까워한 건 질문 시간이었습니다.",
                  "자막: 날짜·장소는 마지막 컷에 큰 자막 한 줄로 못박습니다.",
                  "CTA: 참석 전 체크리스트는 팔로우하면 먼저 보내드립니다. (팔로우 유도형)",
                ],
              },
            },
          ],
          defaultValue: "save-lead",
        },
      ],
    },
    {
      title: "자주 쓰는 설정",
      description:
        "결과 확인 후 AI 완성으로 전환할 때 쓸 작성 모드입니다. 기본 초안 생성에는 과금되지 않습니다.",
      fields: [
        // 유료 전환 여부를 폼에서 미리 고르는 항목이 아닙니다 — 전환 선택은
        // 업무 페이지의 결과 화면에서만 합니다 (2026-08-31 CEO 승인).
        {
          kind: "choice",
          variant: "cards",
          id: "writeMode",
          label: "작성 모드",
          hint: "모드만 고르면 모델·단가가 함께 맞춰집니다. 전환 여부는 결과 확인 후 업무 페이지에서 선택합니다.",
          choices: WRITE_MODE_CARD_CHOICES,
          defaultValue: DEFAULT_WRITE_MODE,
        },
      ],
    },
    {
      title: "고급 설정",
      description: "레퍼런스 참고자료 같은 세부 옵션입니다. 기본 초안에는 없어도 됩니다.",
      advanced: true,
      fields: [
        {
          kind: "text",
          id: "referenceUrl",
          label: "레퍼런스 URL",
          placeholder: "선택: 참고 링크",
        },
        {
          kind: "textarea",
          id: "referenceText",
          label: "레퍼런스에서 좋았던 점",
          placeholder: "참고한 영상 흐름, 첫 문장, 고객 반응, 꼭 살릴 표현",
        },
      ],
    },
  ],
  summarize: (values) => {
    const topic = text(values, "topic");
    const mode = writeModeById(
      text(values, "writeMode") || DEFAULT_WRITE_MODE,
    );
    return joinParts([
      topic ? "주제: " + topic : "",
      labelOf(yunmiOptions, values, "objective"),
      "A/B/C 3안",
      mode.label + " 모드",
    ]);
  },
  estimateCost: (values) => {
    const modeValue = text(values, "writeMode") || DEFAULT_WRITE_MODE;
    const combined = [
      text(values, "topic"),
      text(values, "objective"),
      text(values, "referenceUrl"),
      text(values, "referenceText"),
    ]
      .filter(Boolean)
      .join("\n");
    const charCount = Math.max(
      2200,
      Math.min(7000, combined.length + YUNMI_UPGRADE_CHAR_COUNT),
    );
    const estimate = estimateWriteModeCost(modeValue, charCount);
    const upgradeLine =
      "AI 완성으로 전환 시: 약 " +
      wonLabel(estimate.won) +
      " (선택한 작성 모드 '" +
      estimate.modeLabel +
      "' · " +
      estimate.modelLabel +
      " 기준)";
    return {
      // 설명 없는 0원 단독 표기 금지: 무료/유료 전환을 두 줄로 나눠 보여줍니다.
      headline: "기본 초안 만들기: 무료",
      lines: [
        upgradeLine,
        "전환 여부는 결과 확인 후 업무 페이지에서 선택합니다 · 자동 유료 재시도는 하지 않습니다.",
        writeModeDetailPriceLine(),
      ],
      basis: "live",
      basisLabel: USD_KRW_RATE_LABEL,
      submitRecap: ["기본 초안 만들기: 무료", upgradeLine],
    };
  },
};

/* ------------------------------------------------------------------ */
/* 상수 — app.html sangsuJobForm 14개 미러 + 부가세 토글(프리뷰 추가 1개)   */
/* ------------------------------------------------------------------ */

/** 실서비스 견적서 렌더러의 부가세 10% 자동 계산을 화면에서 고르는 프리뷰 추가 항목. */
const VAT_MODE_CHOICES: OptionChoice[] = [
  { value: "separate", label: "부가세 별도 (10% 추가)" },
  { value: "none", label: "부가세 미적용" },
];

export interface QuoteTotals {
  rows: ItemRow[];
  filledCount: number;
  subtotal: number;
  vat: number;
  total: number;
  vatMode: string;
}

/** 실서비스 sangsuQuoteHtml과 같은 계산: 공급가액 합계에 부가세 10% 반올림. */
export function computeQuoteTotals(values: OptionValues): QuoteTotals {
  const rows = Array.isArray(values.items) ? (values.items as ItemRow[]) : [];
  const vatMode =
    typeof values.vatMode === "string" ? values.vatMode : "separate";
  const filled = rows.filter(
    (row) =>
      row.category.trim().length > 0 || row.description.trim().length > 0,
  );
  let subtotal = 0;
  for (const row of rows) subtotal += Number(row.price) || 0;
  const vat = vatMode === "separate" ? Math.round(subtotal * 0.1) : 0;
  return {
    rows,
    filledCount: filled.length,
    subtotal,
    vat,
    total: subtotal + vat,
    vatMode,
  };
}

const sangsuOptions: EmployeeTaskOptions = {
  employeeId: "sangsu",
  sections: [
    {
      title: "필수 입력",
      description:
        "상수는 브라우저 안에서만 견적서를 생성합니다. 유료 AI/API 호출, 로컬 실행기, 외부 전송 없이 현재 기기에서 PDF 저장 화면을 엽니다.",
      fields: [
        {
          kind: "text",
          id: "clientName",
          label: "받는 곳",
          placeholder: "예: 고객사명 또는 담당자",
          hint: "견적서를 받을 거래처명 또는 담당자입니다.",
          required: true,
        },
        {
          kind: "itemTable",
          id: "items",
          label: "작업 항목",
          addLabel: "항목 추가",
          defaultRows: [
            { category: "기본안", description: "상세페이지 시안 1종", price: "150000" },
            { category: "수정", description: "수정 2회 대응", price: "30000" },
          ],
        },
      ],
    },
    {
      title: "자주 쓰는 설정",
      description: "입력을 바꾸면 견적서 미리보기에 바로 반영됩니다.",
      fields: [
        {
          kind: "choice",
          variant: "chips",
          id: "vatMode",
          label: "부가세",
          hint: "실서비스 견적서는 공급가액에 부가세 10%를 더해 총액을 계산합니다. 프리뷰 추가 항목입니다.",
          choices: VAT_MODE_CHOICES,
          defaultValue: "separate",
        },
        { kind: "date", id: "quoteDate", label: "견적일" },
        {
          kind: "text",
          id: "issuerName",
          label: "공급자",
          placeholder: "예: 메이크패밀리",
        },
        {
          kind: "text",
          id: "projectName",
          label: "프로젝트명",
          placeholder: "예: 상세페이지 제작 견적",
        },
      ],
    },
    {
      title: "고급 설정",
      description: "안내 문구·서명·납품 조건 같은 세부 항목입니다.",
      advanced: true,
      fields: [
        { kind: "file", id: "logo", label: "로고", accept: "image/*" },
        {
          kind: "text",
          id: "clientEmail",
          label: "이메일",
          placeholder: "예: customer@example.com",
        },
        {
          kind: "text",
          id: "validDuration",
          label: "유효기간",
          placeholder: "예: 견적일로부터 14일",
        },
        {
          kind: "text",
          id: "deliverySchedule",
          label: "납기 예정",
          placeholder: "예: 착수 후 7영업일",
        },
        {
          kind: "text",
          id: "deliveryFormat",
          label: "납품 형식",
          placeholder: "예: PDF, 이미지, 원본 파일",
        },
        {
          kind: "textarea",
          id: "notes",
          label: "유의사항",
          placeholder: "수정 횟수, 결제 조건, 납품 기준 등을 줄바꿈으로 입력",
        },
        {
          kind: "textarea",
          id: "message",
          label: "전달 말씀",
          placeholder: "고객에게 전할 안내 문구",
        },
        {
          kind: "text",
          id: "signOffSender",
          label: "보낸 사람",
          placeholder: "예: 메이크패밀리 드림",
        },
        {
          kind: "text",
          id: "signOffDate",
          label: "작성일",
          placeholder: "예: 2026년 6월 1일",
        },
      ],
    },
  ],
  summarize: (values) => {
    const client = text(values, "clientName");
    const totals = computeQuoteTotals(values);
    return joinParts([
      client,
      "항목 " + totals.filledCount + "건",
      "합계 " +
        totals.total.toLocaleString("ko-KR") +
        "원" +
        (totals.vat > 0 ? " (부가세 포함)" : " (부가세 미적용)"),
    ]);
  },
  estimateCost: (values) => {
    const totals = computeQuoteTotals(values);
    return {
      headline:
        "외부 AI/API 비용 0원 · 총 견적 금액 " +
        totals.total.toLocaleString("ko-KR") +
        "원" +
        (totals.vat > 0 ? " (부가세 포함)" : " (부가세 미적용)"),
      lines: [
        "브라우저 안에서만 견적서를 만들어 실행 비용이 들지 않습니다 (실서비스 동일 정책).",
        "작업 항목 " +
          totals.filledCount +
          "건 · 공급가액 " +
          totals.subtotal.toLocaleString("ko-KR") +
          "원" +
          (totals.vat > 0
            ? " · 부가세 " + totals.vat.toLocaleString("ko-KR") + "원"
            : ""),
      ],
      basis: "free",
      basisLabel: "브라우저 생성 · 외부 비용 없음",
      submitRecap: [
        "총 견적 금액 " +
          totals.total.toLocaleString("ko-KR") +
          "원" +
          (totals.vat > 0 ? " (부가세 포함)" : " (부가세 미적용)") +
          " · 외부 AI/API 비용 0원 (브라우저 생성)",
      ],
    };
  },
};

const optionConfigs: EmployeeTaskOptions[] = [
  yeriOptions,
  songiOptions,
  hyunjuOptions,
  yunmiOptions,
  sangsuOptions,
];

export function getTaskOptions(
  employeeId: string,
): EmployeeTaskOptions | undefined {
  return optionConfigs.find((config) => config.employeeId === employeeId);
}
