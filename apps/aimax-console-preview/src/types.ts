export type AppRoute = "home" | "employees" | "work" | "connections" | "help";

export type PreviewScenario =
  | "normal"
  | "attention"
  | "disconnected"
  | "empty"
  | "long-content";

export type StatusTone = "neutral" | "positive" | "warning" | "critical" | "info";

export type EmployeeExecution = "web" | "local" | "hybrid" | "external";

export type EmployeeStatus = "ready" | "setup_required" | "running" | "unavailable";

export interface ResumeCareer {
  period: string;
  org: string;
  note: string;
}

export interface ResumeSkill {
  label: string;
  score: number;
}

export interface EmployeeResume {
  employeeNo: string;
  team: string;
  experience: string;
  hometown: string;
  formerRole: string;
  statement: string;
  intro: string;
  career: ResumeCareer[];
  reference: {
    quote: string;
    from: string;
  };
  interviewLine: string;
  skills: ResumeSkill[];
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  team: string;
  initials: string;
  photo?: string;
  voiceLine?: string;
  summary: string;
  execution: EmployeeExecution;
  status: EmployeeStatus;
  capabilities: string[];
  requiredConnections: string[];
  inputSummary: string;
  outputSummary: string;
  costSummary: string;
  lastUsed?: string;
  beta?: boolean;
  profilePending?: boolean;
  resume?: EmployeeResume;
}

export type TaskStatus =
  | "queued"
  | "running"
  | "waiting_user"
  | "failed"
  | "done";

export interface TimelineStep {
  id: string;
  label: string;
  detail: string;
  state: "complete" | "current" | "upcoming" | "failed";
  at?: string;
}

export interface Task {
  id: string;
  employeeId: string;
  title: string;
  summary: string;
  status: TaskStatus;
  progress: number;
  updatedAt: string;
  cost?: string;
  requestId?: string;
  timeline: TimelineStep[];
  needsConfirmation?: boolean;
  resultSummary?: string;
  errorMessage?: string;
}

export type ConnectionCategory = "ai" | "data" | "runtime";

export interface Connection {
  id: string;
  name: string;
  category: ConnectionCategory;
  status: "connected" | "missing" | "attention";
  summary: string;
  usage: string;
  updatedAt?: string;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  tone: Exclude<StatusTone, "neutral">;
  route: AppRoute;
  taskId?: string;
}

export interface FixtureSet {
  scenario: PreviewScenario;
  label: string;
  description: string;
  employees: Employee[];
  tasks: Task[];
  connections: Connection[];
  notices: Notice[];
}
