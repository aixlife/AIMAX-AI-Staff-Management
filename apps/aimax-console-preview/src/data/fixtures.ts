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
    team: "자료조사팀",
    initials: "송",
    photo: "/assets/avatar_songi.jpg",
    voiceLine: "출처 없는 정보는 정보가 아니라 소문입니다.",
    summary: "키워드와 URL을 바탕으로 출처가 연결된 조사 브리프를 만듭니다.",
    execution: "web",
    status: "running",
    capabilities: ["웹·SNS 조사", "출처 정리", "브리프 생성"],
    requiredConnections: ["Gemini"],
    inputSummary: "키워드, URL, 조사 목적",
    outputSummary: "근거 링크가 포함된 조사 브리프",
    costSummary: "선택 모델에 따라 과금",
    lastUsed: "8분 전",
    resume: {
      employeeNo: "AIMAX-2026-SONGI",
      team: "자료조사팀",
      experience: "9년차",
      hometown: "충남 공주",
      formerRole: "도서관 기사 스크랩 담당",
      statement: "출처 없는 정보는 정보가 아니라 소문입니다",
      intro: "URL과 메모를 받아 근거, 태그, 핵심 포인트를 정리하고 다음 제작 직원이 바로 쓸 수 있는 브리프를 만듭니다.",
      career: [
        { period: "2015-2018", org: "콘텐츠 리서치랩", note: "기사, 영상, 게시글을 읽고 출처와 핵심 문장을 분리하는 기초 체력을 쌓았습니다." },
        { period: "2018-2023", org: "브랜드 전략팀", note: "벤치마킹 자료를 태그와 인사이트로 정리해 회의 시간을 줄이는 일을 맡았습니다." },
        { period: "2023-현재", org: "AIMAX 자료조사팀", note: "조사한 자료를 예리 등 제작 직원에게 넘기기 좋은 브리프로 정리합니다." },
      ],
      reference: { quote: "송이의 리서치는 자료 더미가 아니라 바로 쓰는 지도였습니다.", from: "전 기획팀장" },
      interviewLine: "궁금한 건 못 넘기는 편이라, 이 일이 제법 잘 맞습니다.",
      skills: [
        { label: "근거 정리", score: 5 },
        { label: "태그 분류", score: 5 },
        { label: "브리프 생성", score: 5 },
        { label: "핵심 포인트 추출", score: 4 },
        { label: "제작 인수인계", score: 4 },
      ],
    },
  },
  {
    id: "yeri",
    name: "예리",
    role: "블로그 글쓰기 직원",
    team: "콘텐츠제작팀",
    initials: "예",
    photo: "/assets/avatar_yeri.jpg",
    voiceLine: "초안은 빠르게, 퇴고는 집요하게.",
    summary: "키워드와 브랜드 맥락을 받아 네이버 블로그 초안을 작성합니다.",
    execution: "hybrid",
    status: "setup_required",
    capabilities: ["키워드 글쓰기", "브랜드 문체", "임시저장"],
    requiredConnections: ["Gemini 또는 OpenAI", "로컬 실행기", "네이버 로그인"],
    inputSummary: "키워드, CTA, 브랜드 프로필",
    outputSummary: "블로그 초안과 네이버 임시저장",
    costSummary: "글 생성 모델 비용",
    lastUsed: "어제",
    resume: {
      employeeNo: "AIMAX-2026-YERI",
      team: "콘텐츠제작팀",
      experience: "8년차",
      hometown: "충북 제천",
      formerRole: "동네 편집실 마감 담당",
      statement: "초안은 빠르게, 퇴고는 집요하게",
      intro: "키워드 하나를 받으면 검색 의도, 문장 흐름, CTA까지 맞춰 블로그 글로 정리하는 콘텐츠 라이터입니다.",
      career: [
        { period: "2016-2019", org: "생활정보 매거진 편집실", note: "지역 상권 소개 글과 체험단 원고를 맡으며 읽히는 제목과 자연스러운 CTA를 익혔습니다." },
        { period: "2019-2023", org: "온라인 마케팅 대행사", note: "병원, 교육, 소상공인 원고를 빠르게 쓰고 고치는 마감형 글쓰기 담당으로 근무했습니다." },
        { period: "2023-현재", org: "AIMAX 콘텐츠제작팀", note: "키워드, 이미지 수, 발행 방식에 맞춰 네이버 블로그 초안을 안정적으로 넘깁니다." },
      ],
      reference: { quote: "예리가 쓴 글은 수정 요청보다 발행 요청이 먼저 왔습니다.", from: "전 직장 편집장" },
      interviewLine: "키워드만 주시면, 읽히는 문장으로 출근하겠습니다.",
      skills: [
        { label: "키워드 글쓰기", score: 5 },
        { label: "CTA 설계", score: 5 },
        { label: "톤 맞춤", score: 4 },
        { label: "예약 발행 흐름", score: 4 },
        { label: "마감 대응", score: 5 },
      ],
    },
  },
  {
    id: "hyunju",
    name: "현주",
    role: "영업개척 직원",
    team: "영업개척팀",
    initials: "현",
    photo: "/assets/avatar_hyunju.jpg",
    voiceLine: "가능성은 다시 찾아가되, 첫인사는 조심스럽게.",
    summary: "검색 키워드에서 잠재 고객을 찾고 안전한 속도로 관계의 첫 문을 엽니다.",
    execution: "hybrid",
    status: "ready",
    capabilities: ["잠재 고객 탐색", "서로이웃 신청", "안전 속도 조절"],
    requiredConnections: ["로컬 실행기", "네이버 로그인"],
    inputSummary: "검색 키워드, 신청 수, 첫인사 문장",
    outputSummary: "잠재 고객 목록과 신청 기록",
    costSummary: "추가 모델 비용 없음 · 실행 전 범위 확인",
    lastUsed: "4일 전",
    resume: {
      employeeNo: "AIMAX-2026-HYUNJU",
      team: "영업개척팀",
      experience: "7년차",
      hometown: "전남 순천",
      formerRole: "거리 영업 노트 정리 담당",
      statement: "거절은 데이터로 남기고, 가능성은 다시 찾아갑니다",
      intro: "검색 키워드에서 잠재 고객을 찾고, 무리하지 않는 속도로 관계의 첫 문을 여는 영업사원입니다.",
      career: [
        { period: "2017-2020", org: "지역 제휴 영업팀", note: "상권별 고객 리스트를 만들고 첫 연락 문장을 다듬으며 안전한 접근 속도를 익혔습니다." },
        { period: "2020-2023", org: "소상공인 마케팅팀", note: "무리한 자동화보다 오래 가는 접점을 우선하며 문의 흐름을 정리했습니다." },
        { period: "2023-현재", org: "AIMAX 영업개척팀", note: "키워드 기반 고객 탐색과 서로이웃 신청을 로컬 실행기와 함께 맡고 있습니다." },
      ],
      reference: { quote: "현주는 숫자를 올리기 전에 먼저 민망하지 않은 첫인사를 챙겼습니다.", from: "전 영업팀장" },
      interviewLine: "리스트는 제가 찾고, 속도는 조심스럽게 맞추겠습니다.",
      skills: [
        { label: "잠재 고객 탐색", score: 5 },
        { label: "서로이웃 신청", score: 5 },
        { label: "안전 속도 조절", score: 4 },
        { label: "멘트 적용", score: 4 },
        { label: "반복 업무 집중력", score: 5 },
      ],
    },
  },
  {
    id: "sangsu",
    name: "상수",
    role: "경리 직원",
    team: "정산관리팀",
    initials: "상",
    photo: "/assets/avatar_sangsu.jpg",
    voiceLine: "숫자는 제가 맞추고, 대표님은 승인만 하시면 됩니다.",
    summary: "항목과 금액을 보기 좋은 견적서로 정리하고 PDF 저장까지 넘깁니다.",
    execution: "web",
    status: "ready",
    capabilities: ["견적서 작성", "항목 정리", "PDF 저장"],
    requiredConnections: [],
    inputSummary: "상호, 작업 항목, 금액, 유의사항",
    outputSummary: "검토 가능한 견적서와 PDF 인쇄 화면",
    costSummary: "추가 모델 비용 없음",
    lastUsed: "지난주",
    resume: {
      employeeNo: "AIMAX-2026-SANGSU",
      team: "정산관리팀",
      experience: "11년차",
      hometown: "대구 달성",
      formerRole: "문구점 장부 담당",
      statement: "금액은 감으로 맞추지 않고, 줄 맞춰 정리합니다",
      intro: "상호, 항목, 금액, 유의사항을 받아 견적서로 정리하고 PDF 저장 흐름까지 넘기는 경리 직원입니다.",
      career: [
        { period: "2013-2017", org: "지역 인쇄소 견적실", note: "작업 항목과 단가를 빠르게 정리하며 헷갈리는 금액 표기를 줄였습니다." },
        { period: "2017-2022", org: "디자인 스튜디오 운영팀", note: "로고, 금액, 비고가 섞인 견적서를 거래처가 보기 좋게 정리했습니다." },
        { period: "2022-현재", org: "AIMAX 정산관리팀", note: "브라우저에서 견적서를 만들고 PDF 인쇄 화면으로 넘기는 일을 맡고 있습니다." },
      ],
      reference: { quote: "상수가 만든 견적서는 설명 전화를 한 통 줄여줬습니다.", from: "전 스튜디오 대표" },
      interviewLine: "숫자는 제가 맞추고, 대표님은 승인만 하시면 됩니다.",
      skills: [
        { label: "견적서 작성", score: 5 },
        { label: "항목 정리", score: 5 },
        { label: "로고 업로드", score: 4 },
        { label: "PDF 저장", score: 5 },
        { label: "비고 정리", score: 4 },
      ],
    },
  },
  {
    id: "jieun",
    name: "지은",
    role: "AI 오피스 지원 직원",
    team: "오피스지원팀",
    initials: "지",
    photo: "/assets/avatar_jieun.jpg",
    voiceLine: "티 안 나는 일이 잘 돼야 사무실이 굴러갑니다.",
    summary: "캡처, 모자이크, OCR, 화면 녹화처럼 번거로운 사무 작업을 조용히 처리합니다.",
    execution: "external",
    status: "ready",
    capabilities: ["화면 캡처", "이미지 모자이크", "OCR·화면 녹화"],
    requiredConnections: ["Mac 또는 Windows 앱"],
    inputSummary: "화면 영역, 파일, 실행할 사무 작업",
    outputSummary: "캡처·가림·텍스트·녹화 결과",
    costSummary: "설치형 도구 · 작업별 추가 과금 없음",
    lastUsed: "5일 전",
    resume: {
      employeeNo: "AIMAX-2026-JIEUN",
      team: "오피스지원팀",
      experience: "10년차",
      hometown: "경남 진주",
      formerRole: "사무실 만능 단축키 담당",
      statement: "티 안 나는 일이 잘 돼야 사무실이 굴러갑니다",
      intro: "캡처, 모자이크, OCR, 화면녹화처럼 자주 쓰지만 번거로운 일을 조용히 처리하는 오피스 지원 직원입니다.",
      career: [
        { period: "2014-2018", org: "교육 운영 사무국", note: "강의 자료 캡처와 개인정보 가림 작업을 반복하며 실수 없는 사무 보조를 익혔습니다." },
        { period: "2018-2023", org: "콘텐츠 운영팀", note: "OCR 텍스트 캡처, 녹화 보조, 자료 정리처럼 손이 많이 가는 일을 맡았습니다." },
        { period: "2023-현재", org: "AIMAX 오피스지원팀", note: "Mac과 Windows 앱으로 화면 작업과 블로그 진입 보조를 담당합니다." },
      ],
      reference: { quote: "지은이 쉬는 날에는 작은 불편들이 줄을 서기 시작했습니다.", from: "전 운영 매니저" },
      interviewLine: "부탁받기 전에 끝내두는 쪽을 선호합니다.",
      skills: [
        { label: "화면 캡처", score: 5 },
        { label: "이미지 모자이크", score: 5 },
        { label: "OCR 텍스트 캡처", score: 4 },
        { label: "화면 녹화", score: 4 },
        { label: "오피스 보조", score: 5 },
      ],
    },
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
    profilePending: true,
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
  {
    id: "task-brief-039",
    employeeId: "songi",
    title: "AI 실무교육 경쟁사 비교 브리프",
    summary: "공개 자료 기준으로 포지션·가격대·빈틈을 비교한 검토용 브리프입니다.",
    status: "done",
    progress: 100,
    updatedAt: "어제",
    requestId: "PREVIEW-BRIEF-039",
    resultSummary: "비교표·근거 링크 자리·다음 행동 후보가 담긴 브리프 1건",
    timeline: [
      { id: "brief", label: "업무 접수", detail: "조사 범위와 비교 기준을 확인했습니다.", state: "complete", at: "어제 09:40" },
      { id: "collect", label: "자료 수집", detail: "공개 웹·SNS 12곳에서 근거를 모았습니다.", state: "complete", at: "어제 10:05" },
      { id: "deliver", label: "브리프 전달", detail: "출처가 연결된 비교 브리프를 저장했습니다.", state: "complete", at: "어제 10:20" },
    ],
  },
  {
    id: "task-blog-021",
    employeeId: "yeri",
    title: "동네 카페 단골 만들기 블로그 초안",
    summary: "제목·소제목·비교표·CTA까지 갖춘 발행 전 초안입니다.",
    status: "done",
    progress: 100,
    updatedAt: "2일 전",
    requestId: "PREVIEW-BLOG-021",
    resultSummary: "비교표 1개와 CTA 문구가 포함된 약 1,800자 초안 1건",
    timeline: [
      { id: "brief", label: "업무 접수", detail: "키워드와 독자 기준을 확인했습니다.", state: "complete", at: "2일 전 14:10" },
      { id: "draft", label: "초안 작성", detail: "소제목 3개와 비교표로 흐름을 잡았습니다.", state: "complete", at: "2일 전 14:22" },
      { id: "deliver", label: "초안 전달", detail: "발행 전 확인 목록과 함께 저장했습니다.", state: "complete", at: "2일 전 14:30" },
    ],
  },
  {
    id: "task-leads-014",
    employeeId: "hyunju",
    title: "서로이웃 신청 후보 탐색과 우선 접촉 정리",
    summary: "후보 20곳을 수집해 우선 접촉 5곳과 첫 행동을 정리했습니다.",
    status: "done",
    progress: 100,
    updatedAt: "3일 전",
    requestId: "PREVIEW-LEADS-014",
    resultSummary: "우선 접촉 후보 5곳과 선정 이유·첫 행동이 담긴 목록 1건",
    timeline: [
      { id: "brief", label: "업무 접수", detail: "검색 키워드와 신청 수 상한을 확인했습니다.", state: "complete", at: "3일 전 11:00" },
      { id: "search", label: "후보 탐색", detail: "휴면·광고성 계정을 제외하고 20곳을 모았습니다.", state: "complete", at: "3일 전 11:18" },
      { id: "deliver", label: "목록 전달", detail: "신청 전 검토용 후보 목록을 저장했습니다.", state: "complete", at: "3일 전 11:25" },
    ],
  },
  {
    id: "task-quote-026",
    employeeId: "sangsu",
    title: "홈페이지 개편 작업 견적서 정리",
    summary: "항목·수량·단가를 정리한 발송 전 검토용 견적서입니다.",
    status: "done",
    progress: 100,
    updatedAt: "4일 전",
    requestId: "PREVIEW-QUOTE-026",
    resultSummary: "항목 3건과 합계·부가세가 정리된 검토용 견적서 1건",
    timeline: [
      { id: "brief", label: "업무 접수", detail: "작업 항목과 금액 기준을 확인했습니다.", state: "complete", at: "4일 전 16:00" },
      { id: "draft", label: "견적서 작성", detail: "항목별 금액과 합계를 계산했습니다.", state: "complete", at: "4일 전 16:08" },
      { id: "deliver", label: "견적서 전달", detail: "발송 전 확인 목록과 함께 저장했습니다.", state: "complete", at: "4일 전 16:12" },
    ],
  },
  {
    id: "task-office-031",
    employeeId: "jieun",
    title: "세미나 신청서 캡처 정리와 개인정보 가림",
    summary: "캡처 12건의 개인정보를 가리고 텍스트를 추출해 정리했습니다.",
    status: "done",
    progress: 100,
    updatedAt: "5일 전",
    requestId: "PREVIEW-OFFICE-031",
    resultSummary: "가림 처리본 12건과 추출 명단 요약 1건",
    timeline: [
      { id: "brief", label: "업무 접수", detail: "가림 대상과 저장 위치를 확인했습니다.", state: "complete", at: "5일 전 10:30" },
      { id: "process", label: "정리 작업", detail: "연락처·이메일을 가리고 텍스트를 추출했습니다.", state: "complete", at: "5일 전 10:37" },
      { id: "deliver", label: "결과 전달", detail: "원본은 보존하고 가림본을 별도 저장했습니다.", state: "complete", at: "5일 전 10:39" },
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
