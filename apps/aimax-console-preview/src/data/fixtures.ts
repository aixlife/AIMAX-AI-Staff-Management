import type {
  Connection,
  Employee,
  FixtureSet,
  Notice,
  PreviewScenario,
  Task,
} from "../types";

export const scenarioOptions: Array<{
  value: PreviewScenario;
  label: string;
  description: string;
}> = [
  {
    value: "normal",
    label: "일반 운영",
    description: "실행 중·완료·확인 필요 상태가 함께 있는 대표 화면",
  },
  {
    value: "attention",
    label: "확인 필요 집중",
    description: "비용 확인과 사용자 입력 대기 업무가 많은 상태",
  },
  {
    value: "disconnected",
    label: "연결 오류",
    description: "실행기와 공급자 연결 문제, 실패 복구 상태",
  },
  {
    value: "empty",
    label: "첫 사용자",
    description: "직원과 업무 기록이 아직 없는 초기 상태",
  },
  {
    value: "long-content",
    label: "긴 콘텐츠",
    description: "긴 한국어 제목·설명·상태 문구 내구성 확인",
  },
];

const employees: Employee[] = [
  {
    id: "songi",
    name: "송이",
    role: "자료조사 직원",
    team: "리서치팀",
    initials: "송",
    summary: "키워드와 URL을 바탕으로 출처가 연결된 조사 브리프를 만듭니다.",
    execution: "web",
    status: "running",
    capabilities: ["웹·SNS 조사", "출처 정리", "브리프 생성"],
    requiredConnections: ["Gemini"],
    inputSummary: "키워드, URL, 조사 목적",
    outputSummary: "근거 링크가 포함된 조사 브리프",
    costSummary: "선택 모델에 따라 과금",
    lastUsed: "8분 전",
  },
  {
    id: "yeri",
    name: "예리",
    role: "블로그 글쓰기 직원",
    team: "콘텐츠팀",
    initials: "예",
    summary: "키워드와 브랜드 맥락을 받아 네이버 블로그 초안을 작성합니다.",
    execution: "hybrid",
    status: "setup_required",
    capabilities: ["키워드 글쓰기", "브랜드 문체", "임시저장"],
    requiredConnections: ["Gemini 또는 OpenAI", "로컬 실행기", "네이버 로그인"],
    inputSummary: "키워드, CTA, 브랜드 프로필",
    outputSummary: "블로그 초안과 네이버 임시저장",
    costSummary: "글 생성 모델 비용",
    lastUsed: "어제",
  },
  {
    id: "yunmi",
    name: "윤미",
    role: "마케팅 분석 직원",
    team: "마케팅팀",
    initials: "윤",
    summary: "시장 키워드와 채널 데이터를 분석해 실행 우선순위를 제안합니다.",
    execution: "web",
    status: "ready",
    capabilities: ["키워드 분석", "채널 비교", "실행 제안"],
    requiredConnections: ["Gemini 또는 OpenAI"],
    inputSummary: "사업 맥락, 키워드, 채널",
    outputSummary: "분석표와 다음 행동",
    costSummary: "분석 전 예상 비용 확인",
    lastUsed: "3일 전",
  },
  {
    id: "semu",
    name: "세무",
    role: "세금계산서 직원",
    team: "경영지원팀",
    initials: "세",
    summary: "거래 정보를 검토해 세금계산서 초안을 만들고 발행 전 확인을 돕습니다.",
    execution: "web",
    status: "ready",
    capabilities: ["거래처 검토", "초안 저장", "발행 전 점검"],
    requiredConnections: ["팝빌 회사 설정"],
    inputSummary: "거래처, 품목, 공급가액",
    outputSummary: "검증된 세금계산서 초안",
    costSummary: "발행 전 단가·잔여 포인트 확인",
  },
  {
    id: "cardnews",
    name: "카드뉴스",
    role: "카드뉴스 제작 직원",
    team: "콘텐츠팀",
    initials: "카",
    summary: "원고를 카드 구조로 바꾸고 이미지와 디자인을 조합해 내보냅니다.",
    execution: "web",
    status: "ready",
    capabilities: ["3개 카피 모델", "AI·무료 이미지", "PNG·ZIP"],
    requiredConnections: ["카피 모델 키", "AI 이미지 선택 시 OpenAI 또는 Gemini"],
    inputSummary: "원고, 카피 모델, 이미지 방식",
    outputSummary: "편집 가능한 카드뉴스와 PNG·ZIP",
    costSummary: "무료 이미지 경로 제공 · AI 이미지는 실행 전 확인",
    beta: true,
  },
];

const tasks: Task[] = [
  {
    id: "task-research-042",
    employeeId: "songi",
    title: "2026 하반기 AI 교육 시장 경쟁사 조사",
    summary: "공개 웹·SNS 자료를 바탕으로 포지셔닝과 콘텐츠 기회를 정리합니다.",
    status: "running",
    progress: 42,
    updatedAt: "2분 전",
    requestId: "PREVIEW-RESEARCH-042",
    timeline: [
      {
        id: "brief",
        label: "업무 접수",
        detail: "조사 범위와 공개 출처 기준을 확인했습니다.",
        state: "complete",
        at: "10:24",
      },
      {
        id: "collect",
        label: "자료 수집",
        detail: "공식 사이트와 공개 채널을 수집하고 있습니다.",
        state: "current",
        at: "10:26",
      },
      {
        id: "synthesize",
        label: "브리프 작성",
        detail: "출처를 연결해 핵심 패턴을 정리합니다.",
        state: "upcoming",
      },
      {
        id: "deliver",
        label: "결과 전달",
        detail: "복사·다운로드 가능한 결과를 제공합니다.",
        state: "upcoming",
      },
    ],
  },
  {
    id: "task-keyword-017",
    employeeId: "yunmi",
    title: "AIMAX 핵심 키워드 전환 가능성 분석",
    summary: "선택한 분석 모델의 예상 비용을 확인하면 작업을 시작합니다.",
    status: "waiting_user",
    progress: 12,
    updatedAt: "7분 전",
    cost: "예상 $0.04 · 최대 $0.07",
    requestId: "PREVIEW-KEYWORD-017",
    needsConfirmation: true,
    timeline: [
      {
        id: "brief",
        label: "업무 접수",
        detail: "키워드 18개와 비교 채널 3개를 확인했습니다.",
        state: "complete",
        at: "10:17",
      },
      {
        id: "confirm",
        label: "사용자 확인",
        detail: "예상 비용과 모델 범위를 확인해주세요.",
        state: "current",
      },
      {
        id: "analyze",
        label: "분석",
        detail: "확인 후 분석을 시작합니다.",
        state: "upcoming",
      },
      {
        id: "deliver",
        label: "결과 전달",
        detail: "우선순위와 실행 제안을 제공합니다.",
        state: "upcoming",
      },
    ],
  },
  {
    id: "task-tax-008",
    employeeId: "semu",
    title: "7월 디자인 용역 세금계산서 초안",
    summary: "실제 발행 없이 거래처와 금액을 검토한 초안입니다.",
    status: "done",
    progress: 100,
    updatedAt: "어제",
    requestId: "PREVIEW-TAX-008",
    resultSummary: "공급가액·세액·거래처 정보를 검증한 초안 1건",
    timeline: [
      {
        id: "brief",
        label: "업무 접수",
        detail: "거래처와 품목 정보를 확인했습니다.",
        state: "complete",
        at: "어제 15:20",
      },
      {
        id: "draft",
        label: "초안 생성",
        detail: "공급가액과 세액을 계산했습니다.",
        state: "complete",
        at: "어제 15:21",
      },
      {
        id: "deliver",
        label: "초안 전달",
        detail: "발행되지 않은 검토용 초안을 저장했습니다.",
        state: "complete",
        at: "어제 15:22",
      },
    ],
  },
];

const connections: Connection[] = [
  {
    id: "gemini",
    name: "Gemini",
    category: "ai",
    status: "connected",
    summary: "글쓰기·분석·이미지 모델",
    usage: "키 원문은 표시하지 않고 연결 상태만 확인합니다.",
    updatedAt: "7월 17일",
  },
  {
    id: "openai",
    name: "OpenAI",
    category: "ai",
    status: "connected",
    summary: "카피·분석·이미지 생성",
    usage: "실행 전 선택 모델과 예상 비용을 확인합니다.",
    updatedAt: "7월 15일",
  },
  {
    id: "claude",
    name: "Claude",
    category: "ai",
    status: "missing",
    summary: "카피라이팅과 문서 생성",
    usage: "선택한 직원이 필요할 때만 연결합니다.",
  },
  {
    id: "pexels",
    name: "Pexels",
    category: "data",
    status: "missing",
    summary: "무료 스톡 이미지 검색",
    usage: "선택 연결 · 없으면 Openverse 경로를 안내합니다.",
  },
  {
    id: "apify",
    name: "Apify",
    category: "data",
    status: "connected",
    summary: "공개 SNS 자료 수집",
    usage: "수집 범위와 예상 크레딧을 실행 전에 확인합니다.",
    updatedAt: "7월 16일",
  },
  {
    id: "local-agent",
    name: "AIMAX 로컬 실행기",
    category: "runtime",
    status: "connected",
    summary: "네이버 브라우저·로컬 파일 작업",
    usage: "Windows v1.0.51 · 마지막 연결 2분 전",
    updatedAt: "방금",
  },
];

const normalNotices: Notice[] = [
  {
    id: "confirm-cost",
    title: "비용 확인이 필요한 업무 1건",
    body: "윤미의 키워드 분석이 확인을 기다리고 있습니다.",
    tone: "warning",
    route: "work",
    taskId: "task-keyword-017",
  },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function fixtureBase(
  scenario: PreviewScenario,
  label: string,
  description: string,
): FixtureSet {
  return {
    scenario,
    label,
    description,
    employees: clone(employees),
    tasks: clone(tasks),
    connections: clone(connections),
    notices: clone(normalNotices),
  };
}

function disconnectedFixture(): FixtureSet {
  const fixture = fixtureBase(
    "disconnected",
    "연결 오류",
    "실행기와 공급자 연결 문제, 실패 복구 상태",
  );
  fixture.connections = fixture.connections.map((connection) => {
    if (connection.id === "gemini" || connection.id === "local-agent") {
      return {
        ...connection,
        status: "attention",
        updatedAt: "연결 끊김",
      };
    }
    return connection;
  });
  fixture.tasks[0] = {
    ...fixture.tasks[0],
    status: "failed",
    progress: 42,
    updatedAt: "방금",
    errorMessage: "자료 수집 중 연결이 끊겼습니다. 수집된 공개 자료 12건은 보존됐습니다.",
    timeline: fixture.tasks[0].timeline.map((step) => {
      if (step.id === "collect") {
        return {
          ...step,
          state: "failed",
          detail: "연결이 끊겨 중단됐습니다. 자동 유료 재시도는 실행하지 않았습니다.",
        };
      }
      return step;
    }),
  };
  fixture.notices = [
    {
      id: "runtime-offline",
      title: "연결 확인이 필요합니다",
      body: "Gemini와 로컬 실행기 연결 상태를 확인한 뒤 실패한 단계만 다시 실행할 수 있습니다.",
      tone: "critical",
      route: "connections",
      taskId: "task-research-042",
    },
  ];
  return fixture;
}

function attentionFixture(): FixtureSet {
  const fixture = fixtureBase(
    "attention",
    "확인 필요 집중",
    "비용 확인과 사용자 입력 대기 업무가 많은 상태",
  );
  const copy = clone(fixture.tasks[1]);
  copy.id = "task-cardnews-003";
  copy.employeeId = "cardnews";
  copy.title = "7월 강의 홍보 카드뉴스 이미지 범위 확인";
  copy.summary = "표지 1장 또는 추천 카드 3장의 AI 이미지 생성 범위를 선택해주세요.";
  copy.cost = "표지 1장 예상 $0.04 · 추천 3장 예상 $0.12";
  copy.requestId = "PREVIEW-CARDNEWS-003";
  fixture.tasks.push(copy);
  fixture.notices = [
    ...fixture.notices,
    {
      id: "cardnews-cost",
      title: "카드뉴스 이미지 범위 확인",
      body: "무료 이미지로 전환하거나 AI 이미지 장수를 선택할 수 있습니다.",
      tone: "warning",
      route: "work",
      taskId: "task-cardnews-003",
    },
  ];
  return fixture;
}

function longContentFixture(): FixtureSet {
  const fixture = fixtureBase(
    "long-content",
    "긴 콘텐츠",
    "긴 한국어 제목·설명·상태 문구 내구성 확인",
  );
  fixture.employees[0] = {
    ...fixture.employees[0],
    role: "공개 웹·SNS·공식 문서를 교차 검증하는 장문 자료조사 및 의사결정 브리프 작성 직원",
    summary:
      "여러 국가와 채널에 흩어진 공개 자료를 수집하고, 서로 충돌하는 주장과 날짜를 구분해 근거 링크·확실성·추가 확인이 필요한 항목을 한 번에 검토할 수 있는 긴 브리프로 정리합니다.",
  };
  fixture.tasks[0] = {
    ...fixture.tasks[0],
    title:
      "2026년 하반기 국내 AI 실무교육 시장에서 소상공인·1인 기업·중소기업 교육 담당자가 실제로 구매를 결정할 때 사용하는 표현과 비교 기준 장문 조사",
    summary:
      "공식 교육 페이지, 공개 후기, 정책 자료, 경쟁사 강의 소개를 교차 검토하며 출처가 불명확하거나 서로 충돌하는 주장은 별도로 표시합니다.",
  };
  return fixture;
}

export function buildFixture(scenario: PreviewScenario): FixtureSet {
  if (scenario === "attention") return attentionFixture();
  if (scenario === "disconnected") return disconnectedFixture();
  if (scenario === "empty") {
    return {
      scenario: "empty",
      label: "첫 사용자",
      description: "직원과 업무 기록이 아직 없는 초기 상태",
      employees: [],
      tasks: [],
      connections: clone(connections).map((connection) => ({
        ...connection,
        status: "missing",
        updatedAt: undefined,
      })),
      notices: [],
    };
  }
  if (scenario === "long-content") return longContentFixture();
  return fixtureBase(
    "normal",
    "일반 운영",
    "실행 중·완료·확인 필요 상태가 함께 있는 대표 화면",
  );
}

export function findEmployee(
  fixture: FixtureSet,
  employeeId: string | undefined,
): Employee | undefined {
  return fixture.employees.find((employee) => employee.id === employeeId);
}

export function findTask(
  fixture: FixtureSet,
  taskId: string | undefined,
): Task | undefined {
  return fixture.tasks.find((task) => task.id === taskId);
}
