import type { FixtureSet } from "../types";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import {
  employeeStatusLabel,
  employeeStatusTone,
  StatusBadge,
} from "../components/StatusBadge";

interface HomePageProps {
  fixture: FixtureSet;
  onOpenTask: (taskId: string) => void;
  onOpenEmployee: (employeeId: string) => void;
  onOpenEmployees: () => void;
  onOpenConnections: () => void;
  onNewTask: () => void;
}

export function HomePage({
  fixture,
  onOpenTask,
  onOpenEmployee,
  onOpenEmployees,
  onOpenConnections,
  onNewTask,
}: HomePageProps) {
  const waitingCount = fixture.tasks.filter(
    (task) => task.status === "waiting_user",
  ).length;
  const running = fixture.tasks.filter((task) => task.status === "running");
  const completed = fixture.tasks.filter((task) => task.status === "done");
  const connectionIssues = fixture.connections.filter(
    (connection) => connection.status === "attention",
  ).length;

  if (!fixture.employees.length && !fixture.tasks.length) {
    return (
      <div className="page-stack">
        <section className="welcome-panel">
          <div className="welcome-panel__copy">
            <StatusBadge label="FIRST RUN" tone="info" />
            <h2>첫 업무를 맡길 준비를 해볼까요?</h2>
            <p>
              아직 사용 가능한 직원과 업무 기록이 없습니다. 직원의 역할과 필요한
              연결을 먼저 살펴보고 시작할 수 있습니다.
            </p>
            <div className="button-row">
              <button className="button button--primary" type="button" onClick={onOpenEmployees}>
                AI 직원 둘러보기
                <Icon name="arrow" className="button__icon button__icon--end" />
              </button>
              <button className="button button--secondary" type="button" onClick={onOpenConnections}>
                연결 상태 보기
              </button>
            </div>
          </div>
          <div className="welcome-orbit" aria-hidden="true">
            <div className="welcome-orbit__core">AX</div>
            <span>직원</span>
            <span>업무</span>
            <span>결과</span>
          </div>
        </section>

        <EmptyState
          title="아직 업무 기록이 없습니다"
          description="이 빈 상태는 첫 사용자와 권한이 없는 계정의 화면 내구성을 확인하기 위한 fixture입니다."
        />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="home-hero">
        <div className="home-hero__copy">
          <p className="eyebrow">오늘의 운영</p>
          <h2>
            확인할 일부터 결과까지,
            <br />
            한 흐름으로 운영합니다.
          </h2>
          <p>
            직원이 달라도 비용 확인, 실행 상태, 결과 전달은 같은 업무 계약을
            사용합니다.
          </p>
          <button className="button button--primary" type="button" onClick={onNewTask}>
            <Icon name="plus" className="button__icon" />
            새 업무 맡기기
          </button>
        </div>
        <div className="home-hero__signal" aria-label="현재 업무 요약">
          <div className="signal-ring">
            <strong>{running.length}</strong>
            <span>실행 중</span>
          </div>
          <div className="signal-list">
            <span>
              <i className="signal-dot signal-dot--warning" />
              확인 필요 {waitingCount}
            </span>
            <span>
              <i className="signal-dot signal-dot--positive" />
              최근 완료 {completed.length}
            </span>
            <span>
              <i className="signal-dot signal-dot--critical" />
              연결 문제 {connectionIssues}
            </span>
          </div>
        </div>
      </section>

      <section aria-labelledby="attention-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">WAITING FOR YOU</p>
            <h2 id="attention-heading">확인이 필요해요</h2>
          </div>
          <StatusBadge
            label={fixture.notices.length + "건"}
            tone={fixture.notices.length ? "warning" : "positive"}
          />
        </div>

        {fixture.notices.length ? (
          <div className="attention-grid">
            {fixture.notices.map((notice) => (
              <button
                key={notice.id}
                className={"attention-card attention-card--" + notice.tone}
                type="button"
                onClick={() => {
                  if (notice.taskId) onOpenTask(notice.taskId);
                  else if (notice.route === "connections") onOpenConnections();
                }}
              >
                <span className="attention-card__icon">
                  <Icon name="alert" />
                </span>
                <span>
                  <strong>{notice.title}</strong>
                  <span>{notice.body}</span>
                </span>
                <Icon name="arrow" className="attention-card__arrow" />
              </button>
            ))}
          </div>
        ) : (
          <div className="quiet-success">
            <Icon name="check" />
            <div>
              <strong>지금 바로 확인할 일은 없습니다</strong>
              <span>새 상태가 생기면 이 영역에 이유와 다음 행동을 표시합니다.</span>
            </div>
          </div>
        )}
      </section>

      <div className="dashboard-grid">
        <section className="surface surface--span-7" aria-labelledby="running-heading">
          <div className="section-heading section-heading--compact">
            <div>
              <p className="eyebrow">IN PROGRESS</p>
              <h2 id="running-heading">실행 중인 업무</h2>
            </div>
            <button className="text-button" type="button" onClick={() => onOpenTask(running[0]?.id || fixture.tasks[0]?.id)}>
              전체 업무
              <Icon name="arrow" />
            </button>
          </div>

          {running.length ? (
            <div className="running-list">
              {running.map((task) => {
                const employee = fixture.employees.find(
                  (item) => item.id === task.employeeId,
                );
                return (
                  <button
                    key={task.id}
                    className="running-row"
                    type="button"
                    onClick={() => onOpenTask(task.id)}
                  >
                    <span className={"avatar avatar--" + task.employeeId}>
                      {employee?.initials || "AI"}
                    </span>
                    <span className="running-row__body">
                      <span className="running-row__top">
                        <strong>{task.title}</strong>
                        <span>{task.progress}%</span>
                      </span>
                      <span>{employee?.name} · {task.updatedAt}</span>
                      <span className="progress-track">
                        <span style={{ width: task.progress + "%" }} />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              compact
              title="실행 중인 업무가 없습니다"
              description="업무를 시작하면 진행률과 마지막 상태가 여기에 표시됩니다."
            />
          )}
        </section>

        <section className="surface surface--span-5" aria-labelledby="results-heading">
          <div className="section-heading section-heading--compact">
            <div>
              <p className="eyebrow">RECENT RESULTS</p>
              <h2 id="results-heading">최근 결과</h2>
            </div>
          </div>

          {completed.length ? (
            <div className="result-list">
              {completed.map((task) => {
                const employee = fixture.employees.find(
                  (item) => item.id === task.employeeId,
                );
                return (
                  <button
                    key={task.id}
                    className="result-row"
                    type="button"
                    onClick={() => onOpenTask(task.id)}
                  >
                    <span className="result-row__icon">
                      <Icon name="check" />
                    </span>
                    <span>
                      <strong>{task.title}</strong>
                      <span>{employee?.name} · {task.updatedAt}</span>
                    </span>
                    <Icon name="arrow" />
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              compact
              title="아직 완료 결과가 없습니다"
              description="완료된 업무의 결과와 다음 행동을 모아 보여줍니다."
            />
          )}
        </section>
      </div>

      <section aria-labelledby="quick-employees-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">QUICK START</p>
            <h2 id="quick-employees-heading">자주 쓰는 직원</h2>
          </div>
          <button className="text-button" type="button" onClick={onOpenEmployees}>
            모든 직원
            <Icon name="arrow" />
          </button>
        </div>
        <div className="employee-shortcuts">
          {fixture.employees.slice(0, 5).map((employee) => (
            <button
              key={employee.id}
              className="employee-shortcut"
              type="button"
              onClick={() => onOpenEmployee(employee.id)}
            >
              <span className={"avatar avatar--large avatar--" + employee.id}>
                {employee.initials}
              </span>
              <strong>{employee.name}</strong>
              <span>{employee.role}</span>
              <StatusBadge
                label={employeeStatusLabel(employee.status)}
                tone={employeeStatusTone(employee.status)}
                dot
              />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
