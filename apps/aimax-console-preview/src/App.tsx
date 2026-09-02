import { useEffect, useMemo, useState } from "react";

import { AppShell } from "./components/AppShell";
import { EmployeePickerDialog } from "./components/EmployeePickerDialog";
import { NewTaskDialog } from "./components/NewTaskDialog";
import { ResumeDialog } from "./components/ResumeDialog";
import { Toast } from "./components/Toast";
import { buildFixture } from "./data/fixtures";
import { landingHash, routeHash, routes, viewFromHash } from "./lib/routes";
import type { AppView } from "./lib/routes";
import { ConnectionsPage } from "./pages/ConnectionsPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { HelpPage } from "./pages/HelpPage";
import { HomePage } from "./pages/HomePage";
import { LandingPage } from "./pages/LandingPage";
import { WorkPage } from "./pages/WorkPage";
import type {
  AppRoute,
  Employee,
  PreviewScenario,
  Task,
} from "./types";

interface ToastState {
  id: number;
  message: string;
}

function nextPreviewTaskId(tasks: Task[]): string {
  return "preview-task-" + String(tasks.length + 1).padStart(3, "0");
}

interface AppProps {
  /**
   * 첫 렌더에 보여줄 화면입니다.
   * 정적 프리렌더(서버)에는 window가 없으므로 항상 랜딩으로 시작하고,
   * 브라우저에서는 main.tsx가 주소창 해시로 계산한 값을 넘겨 하이드레이션을 맞춥니다.
   */
  initialView?: AppView;
}

export function App({ initialView = "landing" }: AppProps = {}) {
  const [view, setView] = useState<AppView>(initialView);
  const route: AppRoute = view === "landing" ? "home" : view;
  const [scenario, setScenario] = useState<PreviewScenario>("normal");
  const fixture = useMemo(() => buildFixture(scenario), [scenario]);
  const landingEmployees = useMemo(() => buildFixture("normal").employees, []);
  const [tasks, setTasks] = useState<Task[]>(fixture.tasks);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | undefined>(
    fixture.employees[0]?.id,
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(
    fixture.tasks[0]?.id,
  );
  const [newTaskEmployee, setNewTaskEmployee] = useState<Employee | undefined>();
  /** 방금 만든 업무를 업무 페이지 목록 맨 위에서 잠시 강조하기 위한 ID */
  const [highlightTaskId, setHighlightTaskId] = useState<string | undefined>();
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [taskFromPicker, setTaskFromPicker] = useState(false);
  const [resumeEmployee, setResumeEmployee] = useState<Employee | undefined>();
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    const onHashChange = () => setView(viewFromHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [view]);

  useEffect(() => {
    setTasks(fixture.tasks);
    setSelectedEmployeeId(fixture.employees[0]?.id);
    setSelectedTaskId(fixture.tasks[0]?.id);
    setHighlightTaskId(undefined);
    setNewTaskEmployee(undefined);
    setEmployeePickerOpen(false);
    setTaskFromPicker(false);
  }, [fixture]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /** 생성 직후 강조는 수 초만 유지하고 자동 해제합니다. */
  useEffect(() => {
    if (!highlightTaskId) return;
    const timer = window.setTimeout(() => setHighlightTaskId(undefined), 4000);
    return () => window.clearTimeout(timer);
  }, [highlightTaskId]);

  const runtimeFixture = useMemo(
    () => ({
      ...fixture,
      tasks,
    }),
    [fixture, tasks],
  );

  const activeRoute = routes.find((item) => item.id === route) || routes[0];

  const navigate = (nextRoute: AppRoute) => {
    window.location.hash = routeHash(nextRoute);
    setView(nextRoute);
  };

  const openLanding = () => {
    window.location.hash = landingHash();
    setView("landing");
  };

  const openEmployee = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    navigate("employees");
  };

  const openTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    navigate("work");
  };

  const startTask = (employee: Employee) => {
    setTaskFromPicker(false);
    setNewTaskEmployee(employee);
  };

  /** "새 업무" 버튼 공통 진입: 직원 선택 모달을 먼저 엽니다. */
  const openEmployeePicker = () => {
    if (!runtimeFixture.employees.length) {
      navigate("employees");
      return;
    }
    setEmployeePickerOpen(true);
  };

  const pickEmployeeForTask = (employee: Employee) => {
    setEmployeePickerOpen(false);
    setTaskFromPicker(true);
    setNewTaskEmployee(employee);
  };

  const backToEmployeePicker = () => {
    setNewTaskEmployee(undefined);
    setTaskFromPicker(false);
    setEmployeePickerOpen(true);
  };

  const closeNewTask = () => {
    setNewTaskEmployee(undefined);
    setTaskFromPicker(false);
  };

  const showPreviewNotice = (message: string) => {
    setToast({ id: Date.now(), message });
  };

  const hireFromResume = (employee: Employee) => {
    setResumeEmployee(undefined);
    setSelectedEmployeeId(employee.id);
    navigate("employees");
    setToast({
      id: Date.now(),
      message: employee.name + "의 운영실 프로필을 열었습니다. 실제 업무는 실행되지 않았습니다.",
    });
  };

  const createPreviewTask = (
    employee: Employee,
    title: string,
    optionSummary?: string,
  ) => {
    const taskId = nextPreviewTaskId(tasks);
    const task: Task = {
      id: taskId,
      employeeId: employee.id,
      title,
      summary:
        optionSummary ||
        "로컬 프리뷰에서 만든 fixture 업무입니다. 서버·API·유료 모델에는 전송되지 않았습니다.",
      status: "queued",
      progress: 0,
      updatedAt: "방금",
      requestId: "LOCAL-" + taskId.toUpperCase(),
      timeline: [
        {
          id: "draft",
          label: "로컬 초안 생성",
          detail: "브라우저 메모리에만 fixture 업무를 만들었습니다.",
          state: "complete",
          at: "방금",
        },
        {
          id: "preflight",
          label: "실행 전 점검",
          detail: "실제 연동 단계에서는 권한·키·비용·환경을 확인합니다.",
          state: "current",
        },
        {
          id: "run",
          label: "실행",
          detail: "Phase 1에서는 실행하지 않습니다.",
          state: "upcoming",
        },
      ],
    };
    setTasks((current) => [task, ...current]);
    setSelectedTaskId(taskId);
    setHighlightTaskId(taskId);
    setNewTaskEmployee(undefined);
    setTaskFromPicker(false);
    navigate("work");
    setToast({
      id: Date.now(),
      message: "로컬 fixture 업무를 만들었습니다. 서버에는 전송되지 않았습니다.",
    });
  };

  /**
   * 상수 즉시형 예외 (2026-08-31 카운슬 종합 승인).
   * 결과는 업무 맡기기 다이얼로그 안에서 바로 보여주므로, 업무 페이지에는
   * 완료 상태로만 조용히 적재합니다 — 이동·강조·토스트 없음.
   */
  const createQuoteDoneTask = (
    employee: Employee,
    title: string,
    optionSummary?: string,
  ): string => {
    const taskId = nextPreviewTaskId(tasks);
    const task: Task = {
      id: taskId,
      employeeId: employee.id,
      title,
      summary:
        optionSummary ||
        "브라우저 안에서 즉시 만든 견적서 픽스처입니다. 외부 전송은 없습니다.",
      status: "done",
      progress: 100,
      updatedAt: "방금",
      requestId: "LOCAL-" + taskId.toUpperCase(),
      resultSummary: "생성 화면에서 바로 확인한 완성 견적서 1건 · 다운로드 제공",
      timeline: [
        {
          id: "draft",
          label: "입력 확인",
          detail: "받는 곳과 작업 항목·금액을 확인했습니다.",
          state: "complete",
          at: "방금",
        },
        {
          id: "render",
          label: "견적서 생성",
          detail: "브라우저 안에서 완성 견적서 문서를 즉시 그렸습니다.",
          state: "complete",
          at: "방금",
        },
        {
          id: "deliver",
          label: "완료",
          detail: "결과는 생성 화면에서 바로 확인·다운로드했습니다.",
          state: "complete",
          at: "방금",
        },
      ],
    };
    setTasks((current) => [task, ...current]);
    return taskId;
  };

  const confirmTask = (taskId: string) => {
    setTasks((current) =>
      current.map((task) => {
        if (task.id !== taskId) return task;
        return {
          ...task,
          status: "queued",
          progress: Math.max(task.progress, 15),
          updatedAt: "방금",
          needsConfirmation: false,
          timeline: task.timeline.map((step) => {
            if (step.id === "confirm") {
              return {
                ...step,
                state: "complete",
                detail: "로컬 프리뷰에서 확인 상태만 변경했습니다.",
                at: "방금",
              };
            }
            if (step.id === "analyze") return { ...step, state: "current" };
            return step;
          }),
        };
      }),
    );
    setToast({
      id: Date.now(),
      message: "확인 상태를 로컬에서만 변경했습니다. 유료 작업은 실행되지 않았습니다.",
    });
  };

  const renderPage = () => {
    if (route === "employees") {
      return (
        <EmployeesPage
          fixture={runtimeFixture}
          selectedEmployeeId={selectedEmployeeId}
          onSelectEmployee={setSelectedEmployeeId}
          onStartTask={startTask}
          onShowResume={setResumeEmployee}
        />
      );
    }
    if (route === "work") {
      return (
        <WorkPage
          fixture={runtimeFixture}
          selectedTaskId={selectedTaskId}
          highlightTaskId={highlightTaskId}
          onSelectTask={setSelectedTaskId}
          onConfirmTask={confirmTask}
          onOpenConnections={() => navigate("connections")}
          onPreviewNotice={showPreviewNotice}
        />
      );
    }
    if (route === "connections") {
      return <ConnectionsPage fixture={runtimeFixture} />;
    }
    if (route === "help") {
      return (
        <HelpPage
          fixture={runtimeFixture}
          onPreviewNotice={showPreviewNotice}
        />
      );
    }
    return (
      <HomePage
        fixture={runtimeFixture}
        onOpenTask={openTask}
        onOpenEmployee={openEmployee}
        onOpenEmployees={() => navigate("employees")}
        onOpenConnections={() => navigate("connections")}
        onNewTask={openEmployeePicker}
      />
    );
  };

  if (view === "landing") {
    return (
      <>
        <LandingPage
          employees={landingEmployees}
          onShowResume={setResumeEmployee}
        />
        {resumeEmployee ? (
          <ResumeDialog
            employee={resumeEmployee}
            onClose={() => setResumeEmployee(undefined)}
            onHire={hireFromResume}
          />
        ) : null}
        <Toast toast={toast} />
      </>
    );
  }

  return (
    <>
      <AppShell
        activeRoute={route}
        pageTitle={activeRoute.label}
        pageDescription={activeRoute.description}
        scenario={scenario}
        onScenarioChange={setScenario}
        onNavigate={navigate}
        onOpenLanding={openLanding}
        onNewTask={openEmployeePicker}
      >
        {renderPage()}
      </AppShell>

      {employeePickerOpen ? (
        <EmployeePickerDialog
          employees={runtimeFixture.employees}
          onSelect={pickEmployeeForTask}
          onClose={() => setEmployeePickerOpen(false)}
        />
      ) : null}

      {newTaskEmployee ? (
        <NewTaskDialog
          employee={newTaskEmployee}
          onClose={closeNewTask}
          onBack={taskFromPicker ? backToEmployeePicker : undefined}
          onCreate={createPreviewTask}
          onQuoteCreate={createQuoteDoneTask}
          onOpenTask={openTask}
        />
      ) : null}

      {resumeEmployee ? (
        <ResumeDialog
          employee={resumeEmployee}
          onClose={() => setResumeEmployee(undefined)}
          onHire={hireFromResume}
        />
      ) : null}

      <Toast toast={toast} />
    </>
  );
}
