import { useEffect, useMemo, useState } from "react";

import { AppShell } from "./components/AppShell";
import { EmployeePickerDialog } from "./components/EmployeePickerDialog";
import { NewTaskDialog } from "./components/NewTaskDialog";
import { ResumeDialog } from "./components/ResumeDialog";
import { Toast } from "./components/Toast";
import { buildFixture } from "./data/fixtures";
import { landingHash, routeHash, routes, viewFromHash } from "./lib/routes";
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

export function App() {
  const [view, setView] = useState(() => viewFromHash(window.location.hash));
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
    setNewTaskEmployee(undefined);
    setEmployeePickerOpen(false);
    setTaskFromPicker(false);
  }, [fixture]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

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
    setNewTaskEmployee(undefined);
    setTaskFromPicker(false);
    navigate("work");
    setToast({
      id: Date.now(),
      message: "로컬 fixture 업무를 만들었습니다. 서버에는 전송되지 않았습니다.",
    });
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
          onEnterConsole={() => navigate("home")}
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
