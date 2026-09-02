/**
 * 라이브 운영실 모드의 데이터 계층.
 *
 * 서버 응답(스네이크 케이스 워커·잡)을 프리뷰가 쓰던 화면 데이터 구조(FixtureSet)로
 * 변환합니다. 화면 컴포넌트는 손대지 않고 데이터만 실물로 바꿔 끼우는 것이
 * 실전환 Phase 1의 핵심 전략입니다.
 *
 * 원칙:
 * - 서버가 주는 사실(이름·역할·상태·실행 방식·보유 여부)이 항상 우선입니다.
 * - 프리뷰 픽스처는 이력서·소개문 같은 연출 콘텐츠의 보강용으로만 씁니다.
 * - 서버에 없는 값을 지어내지 않습니다. 없으면 비워 둡니다.
 */

import { buildFixture } from "../data/fixtures";
import type {
  Connection,
  Employee,
  EmployeeExecution,
  EmployeeStatus,
  FixtureSet,
  Notice,
  Task,
  TaskStatus,
  TimelineStep,
} from "../types";
import { apiFetch } from "./client";

/* ── 서버 응답 타입 (server.js publicWorker / publicJob / publicUser) ── */

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  status: string;
  account_segment: string;
  must_change_password: boolean;
  entitlements: {
    product?: string;
    products?: string[];
    status?: string;
    expires_at?: string | null;
  } | null;
}

export interface ApiMeResponse {
  ok: boolean;
  requires_password_change: boolean;
  can_execute: boolean;
  user: ApiUser;
}

export interface ApiLoginResponse extends ApiMeResponse {
  session_token: string;
  expires_at: string;
}

export interface ApiWorker {
  code: string;
  staff_code: string;
  name: string;
  label: string;
  role: string;
  product: string;
  job_kind: string;
  execution: string;
  type: string;
  status: string;
  access_policy: string;
  required_settings: string[];
  profile_image: string;
  avatar_image: string;
  external_url?: string;
  cta_label?: string;
  short_description: string;
  capabilities: string[];
}

export interface ApiJob {
  id: string;
  kind: string;
  label: string;
  staff_code: string;
  worker_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
  failed_stage: string;
  failed_reason: string;
  progress_stage: string;
  retry_count: number;
  logs: Array<{ at?: string; message?: string; stage?: string }>;
  result: Record<string, unknown> | null;
}

/* ── 매핑 ── */

const EXECUTION_MAP: Record<string, EmployeeExecution> = {
  web_module: "web",
  local_agent: "local",
  partner_external: "external",
  external_download: "external",
  external_tool: "external",
  multi_channel: "web",
  planned: "web",
};

const STATUS_MAP: Record<string, EmployeeStatus> = {
  available: "ready",
  beta: "ready",
  needs_setup: "setup_required",
  planned: "unavailable",
};

export function ownedProducts(user: ApiUser): string[] {
  const entitlements = user.entitlements;
  if (!entitlements || entitlements.status !== "active") return [];
  const products = Array.isArray(entitlements.products) ? entitlements.products : [];
  if (entitlements.product && !products.includes(entitlements.product)) {
    return [entitlements.product, ...products];
  }
  return products;
}

/** 보유 여부와 무관하게 모두에게 열린 워커인지 (파트너 소개·무료 공개) */
function isOpenAccess(worker: ApiWorker): boolean {
  return worker.access_policy === "partner" || worker.access_policy === "free";
}

export function isWorkerOwned(worker: ApiWorker, user: ApiUser): boolean {
  if (isOpenAccess(worker)) return true;
  const products = ownedProducts(user);
  if (products.includes("bundle")) return true;
  if (products.includes(worker.product)) return true;
  // blog_team 묶음은 예리·현주를 포함한다 (서버 productList 계약과 동일 방향).
  if (products.includes("blog_team") && (worker.product === "yeri" || worker.product === "hyunju")) {
    return true;
  }
  return false;
}

export function mapWorkerToEmployee(worker: ApiWorker, user: ApiUser): Employee {
  const enrichment = buildFixture("normal").employees.find(
    (employee) => employee.id === worker.staff_code,
  );
  const owned = isWorkerOwned(worker, user);
  const execution = EXECUTION_MAP[worker.execution] || EXECUTION_MAP[worker.type] || "web";
  const status: EmployeeStatus = owned
    ? STATUS_MAP[worker.status] || "ready"
    : "unavailable";

  return {
    id: worker.staff_code || worker.code,
    name: worker.name || worker.label,
    role: worker.role || enrichment?.role || "AI 직원",
    team: enrichment?.team || `${worker.role || "AI 직원"}팀`,
    initials: (worker.name || worker.label || "?").slice(0, 1),
    photo: worker.profile_image || enrichment?.photo,
    voiceLine: enrichment?.voiceLine,
    summary: worker.short_description || enrichment?.summary || "",
    execution,
    status,
    capabilities: worker.capabilities?.length
      ? worker.capabilities
      : enrichment?.capabilities || [],
    requiredConnections: enrichment?.requiredConnections || [],
    inputSummary: enrichment?.inputSummary || "",
    outputSummary: enrichment?.outputSummary || "",
    costSummary: enrichment?.costSummary || "",
    lastUsed: undefined,
    beta: worker.status === "beta" || undefined,
    resume: enrichment?.resume,
  };
}

const TASK_STATUS_MAP: Record<string, TaskStatus> = {
  queued: "queued",
  pending: "queued",
  assigned: "running",
  running: "running",
  waiting_user: "waiting_user",
  failed: "failed",
  cancelled: "failed",
  done: "done",
};

const TASK_PROGRESS: Record<TaskStatus, number> = {
  queued: 8,
  running: 55,
  waiting_user: 70,
  failed: 100,
  done: 100,
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  const date = new Date(time);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function jobTimeline(job: ApiJob, status: TaskStatus): TimelineStep[] {
  const doneOrFailed = status === "done" || status === "failed";
  const steps: TimelineStep[] = [
    {
      id: `${job.id}-created`,
      label: "업무 접수",
      detail: formatWhen(job.created_at),
      state: "complete",
      at: formatWhen(job.created_at),
    },
    {
      id: `${job.id}-progress`,
      label: job.progress_stage || "진행",
      detail: job.failed_stage ? `중단 지점: ${job.failed_stage}` : "",
      state: status === "queued" ? "upcoming" : doneOrFailed ? "complete" : "current",
    },
    {
      id: `${job.id}-final`,
      label: status === "failed" ? "실패" : "완료",
      detail: formatWhen(job.finished_at),
      state: status === "done" ? "complete" : status === "failed" ? "failed" : "upcoming",
      at: formatWhen(job.finished_at),
    },
  ];
  return steps;
}

export function mapJobToTask(job: ApiJob): Task {
  const status = TASK_STATUS_MAP[job.status] || "queued";
  const failedNote =
    job.status === "cancelled" ? "사용자가 취소한 업무입니다." : job.failed_reason || "";
  return {
    id: job.id,
    employeeId: job.staff_code || "unknown",
    title: job.label || job.kind,
    summary: job.progress_stage || job.label || "",
    status,
    progress: TASK_PROGRESS[status],
    updatedAt: formatWhen(job.updated_at || job.created_at),
    requestId: job.id.slice(0, 8),
    timeline: jobTimeline(job, status),
    resultSummary: status === "done" ? "결과는 담당 채널(네이버 임시저장 등)에서 확인합니다." : undefined,
    errorMessage: status === "failed" ? failedNote || "실패 사유가 기록되지 않았습니다." : undefined,
  };
}

function liveNotices(me: ApiMeResponse, tasks: Task[]): Notice[] {
  const notices: Notice[] = [];
  if (me.requires_password_change) {
    notices.push({
      id: "notice-password",
      title: "비밀번호 변경이 필요합니다",
      body: "임시 비밀번호 상태입니다. 기존 운영실에서 비밀번호를 먼저 변경해주세요.",
      tone: "warning",
      route: "help",
    });
  }
  for (const task of tasks) {
    if (task.status === "waiting_user") {
      notices.push({
        id: `notice-${task.id}`,
        title: `${task.title} 업무가 확인을 기다립니다`,
        body: "진행하려면 기존 운영실에서 확인해주세요. 베타에서는 조회만 됩니다.",
        tone: "info",
        route: "work",
        taskId: task.id,
      });
    }
  }
  return notices;
}

export interface LiveData {
  me: ApiMeResponse;
  fixture: FixtureSet;
}

/** 워커 노출 순서: 보유 직원 먼저, 그다음 열린 직원, 마지막 미보유. */
function employeeOrder(a: Employee, b: Employee): number {
  const rank = (employee: Employee) => (employee.status === "unavailable" ? 1 : 0);
  return rank(a) - rank(b);
}

export async function loadLiveData(): Promise<LiveData> {
  const me = await apiFetch<ApiMeResponse>("/api/auth/me");
  const [workersResponse, jobsResponse] = await Promise.all([
    apiFetch<{ workers: ApiWorker[] }>("/api/workers"),
    apiFetch<{ jobs: ApiJob[] }>("/api/jobs"),
  ]);

  const employees = (workersResponse.workers || [])
    .filter((worker) => worker.status !== "planned" && worker.execution !== "planned")
    .map((worker) => mapWorkerToEmployee(worker, me.user))
    .sort(employeeOrder);
  const tasks = (jobsResponse.jobs || []).map(mapJobToTask);

  const connections: Connection[] = [];

  return {
    me,
    fixture: {
      scenario: "normal",
      label: "라이브",
      description: "실제 계정 데이터",
      employees,
      tasks,
      connections,
      notices: liveNotices(me, tasks),
    },
  };
}

export async function login(email: string, password: string): Promise<ApiLoginResponse> {
  return apiFetch<ApiLoginResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password, device_label: "aimax-console-beta" },
  });
}

export async function logout(): Promise<void> {
  try {
    await apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST", body: {} });
  } catch {
    // 세션이 이미 만료됐어도 로컬 토큰만 지우면 됩니다.
  }
}
