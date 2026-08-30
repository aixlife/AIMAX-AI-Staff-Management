import type { Employee } from "../types";

export interface OptionChoice {
  value: string;
  label: string;
  hint?: string;
}

export interface ItemRow {
  name: string;
  qty: string;
  price: string;
}

export type OptionValue = string | string[] | boolean | ItemRow[];
export type OptionValues = Record<string, OptionValue>;

interface BaseField {
  id: string;
  label: string;
  hint?: string;
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
      kind: "select";
      choices: OptionChoice[];
      defaultValue: string;
    })
  | (BaseField & {
      kind: "choice";
      variant: "chips" | "cards";
      choices: OptionChoice[];
      defaultValue: string;
    })
  | (BaseField & {
      kind: "checkboxGroup";
      choices: OptionChoice[];
      defaultValues: string[];
    })
  | (BaseField & {
      kind: "toggle";
      defaultValue: boolean;
      onLabel: string;
      offLabel: string;
    })
  | (BaseField & {
      kind: "itemTable";
      defaultRows: ItemRow[];
    });

export interface EmployeeTaskOptions {
  employeeId: Employee["id"];
  required: TaskOptionField[];
  frequent: TaskOptionField[];
  advanced: TaskOptionField[];
  summarize: (values: OptionValues) => string;
}

function allFields(config: EmployeeTaskOptions): TaskOptionField[] {
  return [...config.required, ...config.frequent, ...config.advanced];
}

export function buildDefaultOptionValues(
  config: EmployeeTaskOptions,
): OptionValues {
  const values: OptionValues = {};
  for (const field of allFields(config)) {
    if (field.kind === "text" || field.kind === "textarea") {
      values[field.id] = field.defaultValue || "";
    } else if (field.kind === "select" || field.kind === "choice") {
      values[field.id] = field.defaultValue;
    } else if (field.kind === "checkboxGroup") {
      values[field.id] = [...field.defaultValues];
    } else if (field.kind === "toggle") {
      values[field.id] = field.defaultValue;
    } else {
      values[field.id] = field.defaultRows.map((row) => ({ ...row }));
    }
  }
  return values;
}

export function missingRequiredLabels(
  config: EmployeeTaskOptions,
  values: OptionValues,
): string[] {
  const missing: string[] = [];
  for (const field of config.required) {
    if (
      (field.kind === "text" || field.kind === "textarea") &&
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

function choiceLabel(
  field: TaskOptionField,
  values: OptionValues,
): string {
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

const yeriOptions: EmployeeTaskOptions = {
  employeeId: "yeri",
  required: [
    {
      kind: "text",
      id: "keyword",
      label: "키워드",
      placeholder: "예: 순천 점심 맛집",
      hint: "글의 중심이 되는 검색어 하나를 적어주세요.",
      required: true,
    },
    {
      kind: "choice",
      variant: "cards",
      id: "template",
      label: "이번 글 스타일 템플릿",
      choices: [
        {
          value: "account-default",
          label: "계정 기본 스타일",
          hint: "이 계정에 저장된 문체 프로필을 그대로 씁니다.",
        },
        {
          value: "consult",
          label: "상담 유도형",
          hint: "문의·상담 신청으로 자연스럽게 이어지는 흐름입니다.",
        },
        {
          value: "info",
          label: "정보 정리형",
          hint: "목록과 비교표 중심으로 검색 의도를 채웁니다.",
        },
        {
          value: "review",
          label: "후기 추천형",
          hint: "직접 써 본 경험담 톤으로 신뢰를 쌓습니다.",
        },
      ],
      defaultValue: "account-default",
    },
  ],
  frequent: [
    {
      kind: "select",
      id: "model",
      label: "글쓰기 모델",
      hint: "추천 모델이 기본으로 선택돼 있습니다.",
      choices: [
        { value: "gemini-flash", label: "Gemini Flash — 추천 기본" },
        { value: "gemini-pro", label: "Gemini Pro — 긴 글 집중" },
        { value: "openai-gpt", label: "OpenAI GPT — 문체 다양" },
      ],
      defaultValue: "gemini-flash",
    },
    {
      kind: "select",
      id: "length",
      label: "분량 (글자수)",
      choices: [
        { value: "300", label: "300자 — 짧은 안내" },
        { value: "800", label: "800자 — 표준" },
        { value: "1500", label: "1500자 — 정보형 상세" },
        { value: "2500", label: "2500자 — 전환형 롱폼" },
      ],
      defaultValue: "800",
    },
    {
      kind: "select",
      id: "images",
      label: "이미지 수",
      choices: [
        { value: "0", label: "0장 — 글만" },
        { value: "1", label: "1장" },
        { value: "2", label: "2장" },
        { value: "3", label: "3장 — 표준" },
        { value: "4", label: "4장" },
        { value: "5", label: "5장" },
        { value: "6", label: "6장" },
      ],
      defaultValue: "3",
    },
  ],
  advanced: [
    {
      kind: "text",
      id: "category",
      label: "발행 카테고리",
      placeholder: "예: 지역 맛집",
    },
    {
      kind: "text",
      id: "cta",
      label: "CTA 링크",
      placeholder: "예: blog.naver.com/aimax",
      hint: "프리뷰에서는 연결하지 않고 문구만 보관합니다.",
    },
    {
      kind: "select",
      id: "schedule",
      label: "예약 발행",
      choices: [
        { value: "draft-now", label: "바로 임시저장 — 기본" },
        { value: "tonight", label: "오늘 21시 예약" },
        { value: "tomorrow", label: "내일 오전 9시 예약" },
      ],
      defaultValue: "draft-now",
    },
    {
      kind: "textarea",
      id: "seo",
      label: "SEO 참고 메모",
      placeholder: "참고할 상위 노출 글이나 꼭 들어갈 문구를 적어주세요.",
    },
  ],
  summarize: (values) => {
    const template = labelOf(yeriOptions, values, "template");
    const length = text(values, "length");
    const images = text(values, "images");
    return joinParts([
      template,
      length ? length + "자" : "",
      images ? "이미지 " + images + "장" : "",
    ]);
  },
};

const songiOptions: EmployeeTaskOptions = {
  employeeId: "songi",
  required: [
    {
      kind: "textarea",
      id: "topic",
      label: "조사 주제",
      placeholder: "예: 2026 하반기 숏폼 커머스 동향과 주요 플레이어",
      hint: "무엇을 왜 조사하는지 한두 문장이면 충분합니다.",
      required: true,
    },
  ],
  frequent: [
    {
      kind: "checkboxGroup",
      id: "sources",
      label: "소스 범위",
      hint: "체크한 곳에서만 자료를 모읍니다.",
      choices: [
        { value: "web", label: "웹 문서" },
        { value: "news", label: "뉴스" },
        { value: "community", label: "커뮤니티" },
      ],
      defaultValues: ["web", "news"],
    },
    {
      kind: "choice",
      variant: "chips",
      id: "format",
      label: "결과 형식",
      choices: [
        { value: "brief", label: "조사 브리프" },
        { value: "table", label: "비교표" },
      ],
      defaultValue: "brief",
    },
  ],
  advanced: [
    {
      kind: "select",
      id: "cap",
      label: "수집 상한",
      hint: "상한이 높을수록 시간이 더 걸립니다.",
      choices: [
        { value: "10", label: "10건 — 빠르게" },
        { value: "20", label: "20건 — 표준" },
        { value: "40", label: "40건 — 깊게" },
      ],
      defaultValue: "20",
    },
  ],
  summarize: (values) => {
    const format = labelOf(songiOptions, values, "format");
    const sourcesField = findField(songiOptions, "sources");
    const selected = Array.isArray(values.sources)
      ? (values.sources as string[])
      : [];
    const sourceLabels =
      sourcesField && sourcesField.kind === "checkboxGroup"
        ? sourcesField.choices
            .filter((choice) => selected.includes(choice.value))
            .map((choice) => choice.label)
        : [];
    const cap = text(values, "cap");
    return joinParts([
      format,
      sourceLabels.length ? sourceLabels.join("+") : "소스 미선택",
      cap ? "최대 " + cap + "건" : "",
    ]);
  },
};

const hyunjuOptions: EmployeeTaskOptions = {
  employeeId: "hyunju",
  required: [
    {
      kind: "text",
      id: "keyword",
      label: "대상 키워드",
      placeholder: "예: 성수동 카페 창업",
      required: true,
    },
    {
      kind: "text",
      id: "region",
      label: "지역",
      placeholder: "예: 서울 성동구",
      hint: "이 지역에서 활동하는 블로그를 우선 찾습니다.",
      required: true,
    },
  ],
  frequent: [
    {
      kind: "select",
      id: "daily",
      label: "하루 작업량",
      hint: "안전 속도를 지키는 범위에서만 진행합니다.",
      choices: [
        { value: "10", label: "10건 — 조심스럽게" },
        { value: "20", label: "20건 — 표준" },
        { value: "30", label: "30건 — 최대 허용" },
      ],
      defaultValue: "20",
    },
    {
      kind: "choice",
      variant: "cards",
      id: "message",
      label: "보낼 메시지",
      hint: "저장해 둔 메시지 중에서 고릅니다.",
      choices: [
        {
          value: "calm",
          label: "차분한 첫인사",
          hint: "“안녕하세요, 이웃 글 잘 보고 있습니다…”",
        },
        {
          value: "review",
          label: "후기 중심 인사",
          hint: "“후기 글이 인상 깊어 인사드립니다…”",
        },
      ],
      defaultValue: "calm",
    },
  ],
  advanced: [
    {
      kind: "textarea",
      id: "exclude",
      label: "제외 목록",
      placeholder: "제외할 아이디나 블로그 주소를 줄바꿈으로 적어주세요.",
    },
  ],
  summarize: (values) => {
    const region = text(values, "region");
    const daily = text(values, "daily");
    const message = labelOf(hyunjuOptions, values, "message");
    return joinParts([
      region,
      daily ? "하루 " + daily + "건" : "",
      message,
    ]);
  },
};

const sangsuOptions: EmployeeTaskOptions = {
  employeeId: "sangsu",
  required: [
    {
      kind: "text",
      id: "client",
      label: "거래처명",
      placeholder: "예: 주식회사 공생",
      required: true,
    },
  ],
  frequent: [
    {
      kind: "itemTable",
      id: "items",
      label: "품목",
      hint: "품명·수량·단가를 바로 고칠 수 있습니다.",
      defaultRows: [
        { name: "디자인 시안", qty: "1", price: "150000" },
        { name: "수정 대응", qty: "2", price: "30000" },
      ],
    },
    {
      kind: "toggle",
      id: "vat",
      label: "부가세",
      defaultValue: true,
      onLabel: "부가세 포함",
      offLabel: "부가세 별도",
    },
  ],
  advanced: [
    {
      kind: "textarea",
      id: "note",
      label: "안내 문구",
      defaultValue: "본 견적은 발행일로부터 30일간 유효합니다.",
    },
  ],
  summarize: (values) => {
    const rows = Array.isArray(values.items)
      ? (values.items as ItemRow[])
      : [];
    const filled = rows.filter((row) => row.name.trim().length > 0);
    let total = 0;
    for (const row of filled) {
      const qty = Number(row.qty) || 0;
      const price = Number(row.price) || 0;
      total += qty * price;
    }
    const vat = values.vat === false ? "부가세 별도" : "부가세 포함";
    return joinParts([
      "품목 " + filled.length + "건",
      "합계 " + total.toLocaleString("ko-KR") + "원",
      vat,
    ]);
  },
};

const jieunOptions: EmployeeTaskOptions = {
  employeeId: "jieun",
  required: [
    {
      kind: "textarea",
      id: "request",
      label: "요청 내용",
      placeholder: "예: 계약서 스캔본에서 연락처만 가려주세요.",
      hint: "어떤 화면·파일을 어떻게 처리할지 적어주세요.",
      required: true,
    },
  ],
  frequent: [
    {
      kind: "select",
      id: "deadline",
      label: "마감",
      choices: [
        { value: "today", label: "오늘 중" },
        { value: "tomorrow", label: "내일 오전" },
        { value: "week", label: "이번 주 중" },
      ],
      defaultValue: "today",
    },
    {
      kind: "choice",
      variant: "chips",
      id: "format",
      label: "산출물 형식",
      choices: [
        { value: "doc", label: "문서" },
        { value: "table", label: "표" },
      ],
      defaultValue: "doc",
    },
  ],
  advanced: [
    {
      kind: "textarea",
      id: "reference",
      label: "참고 자료 메모",
      placeholder: "파일 위치나 참고할 화면을 적어주세요.",
    },
  ],
  summarize: (values) => {
    const deadline = labelOf(jieunOptions, values, "deadline");
    const format = labelOf(jieunOptions, values, "format");
    return joinParts([
      deadline ? deadline + " 마감" : "",
      format ? format + "로 정리" : "",
    ]);
  },
};

const optionConfigs: EmployeeTaskOptions[] = [
  yeriOptions,
  songiOptions,
  hyunjuOptions,
  sangsuOptions,
  jieunOptions,
];

export function getTaskOptions(
  employeeId: string,
): EmployeeTaskOptions | undefined {
  return optionConfigs.find((config) => config.employeeId === employeeId);
}
