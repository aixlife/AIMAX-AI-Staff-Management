/**
 * 직원별 업무 맡기기 옵션 정의 (Phase 1 픽스처 전용).
 *
 * 입력 항목은 실서비스 웹앱(oracle/aimax-reports-api/static/app.html)의
 * 직원별 폼을 항목·라벨 단위로 그대로 미러링합니다.
 * - 예리: app.html yeriJobForm (키워드~기존 작성글 스타일, 16개 입력)
 * - 현주: app.html hyunjuJobForm (타겟 방식~신청 멘트, 6개 입력)
 * - 윤미: app.html yunmiJobForm (주제~레퍼런스 메모, 5개 입력)
 * - 상수: app.html sangsuJobForm (로고~작성일, 14개 입력)
 * 값은 전부 픽스처이며 어떤 항목도 축약·숨김(details) 처리하지 않습니다.
 *
 * 단가·환율은 실서비스 app.html의 AI_MODEL_PRICES / IMAGE_MODEL_PRICES /
 * USD_KRW_RATE(1476원, 2026-06-24 확인분)를 그대로 옮긴 값입니다.
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

export interface StyleChoice extends OptionChoice {
  example?: StyleExample;
}

export interface ItemRow {
  category: string;
  description: string;
  price: string;
}

export type OptionValue = string | string[] | boolean | ItemRow[];
export type OptionValues = Record<string, OptionValue>;

interface BaseField {
  id: string;
  label: string;
  hint?: string;
  /** 실서비스처럼 다른 값 선택 시에만 노출되는 항목 */
  visibleWhen?: { fieldId: string; equals: string };
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
    })
  | (BaseField & {
      kind: "itemTable";
      addLabel: string;
      defaultRows: ItemRow[];
    });

export interface OptionSection {
  title: string;
  description?: string;
  fields: TaskOptionField[];
}

export type CostBasis = "live" | "estimate" | "free";

export interface CostEstimate {
  headline: string;
  lines: string[];
  basis: CostBasis;
  basisLabel: string;
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
export const USD_KRW_RATE_LABEL = "실서비스 2026-06-24 단가표 기준";

interface TextModelPrice {
  inputUsdPer1m: number;
  outputUsdPer1m: number;
  label: string;
}

export const AI_MODEL_PRICES: Record<string, TextModelPrice> = {
  "gemini-2.5-flash": { inputUsdPer1m: 0.3, outputUsdPer1m: 2.5, label: "Gemini 2.5 Flash" },
  "gemini-3.5-flash": { inputUsdPer1m: 1.5, outputUsdPer1m: 9.0, label: "Gemini 3.5 Flash" },
  "gemini-3.1-pro-preview": { inputUsdPer1m: 1.25, outputUsdPer1m: 10.0, label: "Gemini 3.1 Pro Preview" },
  "gemini-2.5-pro": { inputUsdPer1m: 1.25, outputUsdPer1m: 10.0, label: "Gemini 2.5 Pro" },
  "gpt-5.4-mini": { inputUsdPer1m: 0.75, outputUsdPer1m: 4.5, label: "GPT-5.4 mini" },
  "gpt-5-mini": { inputUsdPer1m: 0.25, outputUsdPer1m: 2.0, label: "GPT-5 mini" },
  claude: { inputUsdPer1m: 3.0, outputUsdPer1m: 15.0, label: "Claude Sonnet" },
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
  const price = AI_MODEL_PRICES[model] || AI_MODEL_PRICES["gemini-2.5-flash"];
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

function fieldVisible(field: TaskOptionField, values: OptionValues): boolean {
  if (!field.visibleWhen) return true;
  return values[field.visibleWhen.fieldId] === field.visibleWhen.equals;
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

const WRITE_MODEL_CHOICES: OptionChoice[] = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (기본/무료 티어 가능)" },
  { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash (고품질/유료)" },
  { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview (유료/고급)" },
  { value: "gpt-5.4-mini", label: "GPT-5.4 mini" },
  { value: "gpt-5-mini", label: "GPT-5 mini" },
  { value: "claude", label: "Claude" },
];

const IMAGE_MODEL_CHOICES: OptionChoice[] = [
  { value: "gpt-image-1", label: "OpenAI gpt-image-1" },
  { value: "gpt-image-2", label: "OpenAI gpt-image-2" },
  { value: "gemini-2.5-flash-image", label: "Gemini Nano Banana" },
  { value: "gemini-3.1-flash-image", label: "Gemini Nano Banana 2" },
  { value: "gemini-3-pro-image", label: "Gemini Nano Banana Pro" },
];

const yeriOptions: EmployeeTaskOptions = {
  employeeId: "yeri",
  sections: [
    {
      title: "무엇을 쓸까요",
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
      title: "발행·모델 설정",
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
          defaultValue: "publish",
        },
        {
          kind: "select",
          id: "aiModel",
          label: "글쓰기 모델",
          choices: WRITE_MODEL_CHOICES,
          defaultValue: "gemini-2.5-flash",
        },
        {
          kind: "select",
          id: "imageModel",
          label: "이미지 모델",
          choices: IMAGE_MODEL_CHOICES,
          defaultValue: "gpt-image-1",
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
          kind: "text",
          id: "category",
          label: "카테고리",
          placeholder: "선택",
        },
      ],
    },
    {
      title: "예약·CTA",
      fields: [
        { kind: "date", id: "scheduleDate", label: "예약 날짜" },
        {
          kind: "number",
          id: "scheduleHour",
          label: "예약 시간",
          min: 0,
          max: 23,
          placeholder: "0-23",
        },
        {
          kind: "number",
          id: "scheduleInterval",
          label: "예약 간격",
          min: 1,
          max: 72,
          defaultValue: "1",
        },
        { kind: "text", id: "ctaLink", label: "CTA 링크", placeholder: "선택" },
        { kind: "text", id: "ctaText", label: "CTA 문구", placeholder: "선택" },
      ],
    },
    {
      title: "작성 품질 옵션",
      fields: [
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
    const model = text(values, "aiModel") || "gemini-2.5-flash";
    const imageModel = text(values, "imageModel") || "gpt-image-1";
    const wordCount = Number(text(values, "wordCount")) || 1500;
    const imageCount = Number(text(values, "imageCount")) || 0;
    const textCost = estimateTextCostWon(model, wordCount);
    const imagePrice =
      IMAGE_MODEL_PRICES[imageModel] || IMAGE_MODEL_PRICES["gpt-image-1"];
    const imageWon = wonFromUsd(imageCount * imagePrice.perImageUsd);
    const totalWon = textCost.won + imageWon;
    const gptMini = estimateTextCostWon("gpt-5.4-mini", wordCount);
    return {
      headline: "예상 원가 약 " + wonLabel(totalWon),
      lines: [
        "글 " +
          wonLabel(textCost.won) +
          " (" +
          textCost.label +
          ") + " +
          imagePrice.label +
          " 이미지 " +
          imageCount +
          "장 " +
          wonLabel(imageWon),
        "이미지 단가: 장당 약 " + wonLabel(wonFromUsd(imagePrice.perImageUsd)),
        "환율 " + USD_KRW_RATE.toLocaleString("ko-KR") + "원/USD",
        "참고: GPT-5.4 mini 글 비용 " + wonLabel(gptMini.won) + " 수준",
      ],
      basis: "live",
      basisLabel: USD_KRW_RATE_LABEL,
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
      title: "서로이웃 신청 멘트",
      fields: [
        {
          kind: "textList",
          id: "messages",
          label: "서로이웃 신청 멘트",
          addLabel: "멘트 칸 추가",
          placeholder:
            "한 줄에 하나씩 입력합니다. 비워두면 로컬 앱에 저장된 멘트를 사용합니다.",
          defaultValues: [""],
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
    };
  },
};

/* ------------------------------------------------------------------ */
/* 윤미 — app.html yunmiJobForm 5개 입력 미러                             */
/* ------------------------------------------------------------------ */

const YUNMI_MODEL_CHOICES: OptionChoice[] = [
  { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
  { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
];

const yunmiOptions: EmployeeTaskOptions = {
  employeeId: "yunmi",
  sections: [
    {
      title: "스크립트 브리프",
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
          kind: "textarea",
          id: "objective",
          label: "목적",
          placeholder: "예: 저장을 유도하기, 상담 전환 만들기, 설명회 기대감 높이기",
        },
      ],
    },
    {
      title: "생성 설정",
      fields: [
        {
          kind: "select",
          id: "aiModel",
          label: "AI 모델",
          choices: YUNMI_MODEL_CHOICES,
          defaultValue: "gemini-3.5-flash",
        },
      ],
    },
    {
      title: "레퍼런스",
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
    const model = labelOf(yunmiOptions, values, "aiModel");
    return joinParts([
      topic ? "주제: " + topic : "",
      "A/B/C 3안",
      model,
    ]);
  },
  estimateCost: (values) => {
    const model = text(values, "aiModel") || "gemini-3.5-flash";
    const combined = [
      text(values, "topic"),
      text(values, "objective"),
      text(values, "referenceUrl"),
      text(values, "referenceText"),
    ]
      .filter(Boolean)
      .join("\n");
    const charCount = Math.max(2200, Math.min(7000, combined.length + 2600));
    const estimate = estimateTextCostWon(model, charCount);
    return {
      headline: "기본 초안: 외부 AI/API 비용 0원",
      lines: [
        "AI 생성으로 전환하면 " +
          estimate.label +
          " 기준 약 " +
          wonLabel(estimate.won) +
          " 예상",
        "입력 " +
          estimate.inputTokens.toLocaleString("ko-KR") +
          "t / 출력 " +
          estimate.outputTokens.toLocaleString("ko-KR") +
          "t 추정 · 환율 " +
          USD_KRW_RATE.toLocaleString("ko-KR") +
          "원/USD",
        "자동 유료 재시도는 하지 않습니다.",
      ],
      basis: "live",
      basisLabel: USD_KRW_RATE_LABEL,
    };
  },
};

/* ------------------------------------------------------------------ */
/* 상수 — app.html sangsuJobForm 14개 입력 미러                           */
/* ------------------------------------------------------------------ */

const sangsuOptions: EmployeeTaskOptions = {
  employeeId: "sangsu",
  sections: [
    {
      title: "견적 기본 정보",
      description:
        "상수는 브라우저 안에서만 견적서를 생성합니다. 유료 AI/API 호출, 로컬 실행기, 외부 전송 없이 현재 기기에서 PDF 저장 화면을 엽니다.",
      fields: [
        { kind: "file", id: "logo", label: "로고", accept: "image/*" },
        { kind: "date", id: "quoteDate", label: "견적일" },
        {
          kind: "text",
          id: "issuerName",
          label: "공급자",
          placeholder: "예: 메이크패밀리",
        },
        {
          kind: "text",
          id: "clientName",
          label: "받는 곳",
          placeholder: "예: 고객사명 또는 담당자",
        },
        {
          kind: "text",
          id: "clientEmail",
          label: "이메일",
          placeholder: "예: customer@example.com",
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
      title: "거래 조건",
      fields: [
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
      ],
    },
    {
      title: "작업 항목",
      fields: [
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
      title: "안내·서명",
      fields: [
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
    const rows = Array.isArray(values.items) ? (values.items as ItemRow[]) : [];
    const filled = rows.filter(
      (row) => row.category.trim().length > 0 || row.description.trim().length > 0,
    );
    let total = 0;
    for (const row of filled) total += Number(row.price) || 0;
    return joinParts([
      client,
      "항목 " + filled.length + "건",
      "합계 " + total.toLocaleString("ko-KR") + "원",
    ]);
  },
  estimateCost: (values) => {
    const rows = Array.isArray(values.items) ? (values.items as ItemRow[]) : [];
    const filled = rows.filter(
      (row) => row.category.trim().length > 0 || row.description.trim().length > 0,
    );
    let total = 0;
    for (const row of filled) total += Number(row.price) || 0;
    return {
      headline: "외부 AI/API 비용 0원 · 견적 합계 " + total.toLocaleString("ko-KR") + "원",
      lines: [
        "브라우저 안에서만 견적서를 만들어 실행 비용이 들지 않습니다 (실서비스 동일 정책).",
        "작업 항목 " + filled.length + "건 금액 합계 기준입니다.",
      ],
      basis: "free",
      basisLabel: "브라우저 생성 · 외부 비용 없음",
    };
  },
};

const optionConfigs: EmployeeTaskOptions[] = [
  yeriOptions,
  hyunjuOptions,
  yunmiOptions,
  sangsuOptions,
];

export function getTaskOptions(
  employeeId: string,
): EmployeeTaskOptions | undefined {
  return optionConfigs.find((config) => config.employeeId === employeeId);
}
