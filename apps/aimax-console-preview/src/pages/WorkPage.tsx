import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { StatusBadge, TaskStatusBadge } from "../components/StatusBadge";
import { TaskCard } from "../components/TaskCard";
import { TaskTimeline } from "../components/TaskTimeline";
import type { FixtureSet, TaskStatus } from "../types";

interface WorkPageProps {
  fixture: FixtureSet;
  selectedTaskId?: string;
  onSelectTask: (taskId: string) => void;
  onConfirmTask: (taskId: string) => void;
  onOpenConnections: () => void;
  onPreviewNotice: (message: string) => void;
}

type TaskFilter = "all" | TaskStatus;

const filters: Array<{ value: TaskFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "waiting_user", label: "확인 필요" },
  { value: "running", label: "실행 중" },
  { value: "done", label: "완료" },
  { value: "failed", label: "실패" },
];

export function WorkPage({
  fixture,
  selectedTaskId,
  onSelectTask,
  onConfirmTask,
  onOpenConnections,
  onPreviewNotice,
}: WorkPageProps) {
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [confirmed, setConfirmed] = useState(false);

  const filtered = useMemo(
    () =>
      filter === "all"
        ? fixture.tasks
        : fixture.tasks.filter((task) => task.status === filter),
    [filter, fixture.tasks],
  );

  const selected =
    fixture.tasks.find((task) => task.id === selectedTaskId) || filtered[0];
  const employee = fixture.employees.find(
    (item) => item.id === selected?.employeeId,
  );

  useEffect(() => {
    setConfirmed(false);
  }, [selected?.id]);

  if (!fixture.tasks.length) {
    return (
      <EmptyState
        title="아직 맡긴 업무가 없습니다"
        description="AI 직원 화면에서 첫 업무를 만들면 접수부터 결과까지 같은 timeline으로 추적합니다."
      />
    );
  }

  return (
    <div className="page-stack">
      <section className="work-filter-bar" aria-label="업무 상태 필터">
        <div className="segmented-control segmented-control--wide">
          {filters.map((item) => {
            const count =
              item.value === "all"
                ? fixture.tasks.length
                : fixture.tasks.filter((task) => task.status === item.value)
                    .length;
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={filter === item.value}
                className={filter === item.value ? "is-active" : ""}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
                <span>{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="master-detail master-detail--work">
        <section className="master-list master-list--tasks" aria-label="업무 목록">
          {filtered.length ? (
            filtered.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                employee={fixture.employees.find(
                  (item) => item.id === task.employeeId,
                )}
                active={task.id === selected?.id}
                onSelect={onSelectTask}
              />
            ))
          ) : (
            <EmptyState
              compact
              title="이 상태의 업무가 없습니다"
              description="다른 상태 필터를 선택해보세요."
            />
          )}
        </section>

        <section className="detail-panel task-detail" aria-live="polite">
          {selected ? (
            <>
              <header className="task-detail__header">
                <div>
                  <div className="badge-row">
                    <TaskStatusBadge task={selected} />
                    <StatusBadge
                      label={employee?.name || "알 수 없는 직원"}
                      tone="neutral"
                    />
                  </div>
                  <h2>{selected.title}</h2>
                  <p>{selected.summary}</p>
                </div>
                {selected.requestId ? (
                  <div className="request-id">
                    <span>요청 ID</span>
                    <code>{selected.requestId}</code>
                  </div>
                ) : null}
              </header>

              {selected.status === "running" ? (
                <div className="task-progress-panel">
                  <div>
                    <span>현재 진행률</span>
                    <strong>{selected.progress}%</strong>
                  </div>
                  <span className="progress-track progress-track--large">
                    <span style={{ width: selected.progress + "%" }} />
                  </span>
                  <p>마지막 상태 업데이트 {selected.updatedAt}</p>
                </div>
              ) : null}

              {selected.status === "waiting_user" ? (
                <section className="confirmation-panel" aria-labelledby="confirmation-title">
                  <div className="confirmation-panel__heading">
                    <Icon name="alert" />
                    <div>
                      <h3 id="confirmation-title">실행 전 확인</h3>
                      <p>확인하기 전에는 유료 작업을 시작하지 않습니다.</p>
                    </div>
                  </div>
                  <div className="cost-summary">
                    <span>예상 비용</span>
                    <strong>{selected.cost || "실행 전 계산"}</strong>
                  </div>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(event) => setConfirmed(event.target.checked)}
                    />
                    <span>표시된 범위와 예상 비용을 확인했습니다.</span>
                  </label>
                  <div className="button-row">
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() =>
                        onPreviewNotice(
                          "범위 편집은 Phase 2의 실제 업무 계약 연결 후 검증합니다.",
                        )
                      }
                    >
                      범위 수정
                    </button>
                    <button
                      className="button button--primary"
                      type="button"
                      disabled={!confirmed}
                      onClick={() => onConfirmTask(selected.id)}
                    >
                      로컬에서 확인 상태만 변경
                    </button>
                  </div>
                  <p className="preview-disclaimer">
                    프리뷰에서는 상태만 바뀌며 API·유료 모델을 호출하지 않습니다.
                  </p>
                </section>
              ) : null}

              {selected.status === "failed" ? (
                <section className="failure-panel" aria-labelledby="failure-heading">
                  <div className="failure-panel__icon">
                    <Icon name="alert" />
                  </div>
                  <div>
                    <h3 id="failure-heading">작업이 중단됐습니다</h3>
                    <p>{selected.errorMessage}</p>
                    <div className="button-row">
                      <button
                        className="button button--primary"
                        type="button"
                        onClick={onOpenConnections}
                      >
                        연결 상태 확인
                      </button>
                      <button
                        className="button button--secondary"
                        type="button"
                        onClick={() =>
                          onPreviewNotice(
                            "오류 보고 연동 전입니다. 도움말의 로컬 접수 흐름을 먼저 확인할 수 있습니다.",
                          )
                        }
                      >
                        오류 보고 미리보기
                      </button>
                    </div>
                    <span>자동 유료 재시도 없음 · 성공한 단계 보존</span>
                  </div>
                </section>
              ) : null}

              {selected.status === "done" ? (
                <section className="result-panel" aria-labelledby="result-heading">
                  <div className="result-panel__heading">
                    <span className="result-panel__icon">
                      <Icon name="check" />
                    </span>
                    <div>
                      <p className="eyebrow">RESULT READY</p>
                      <h3 id="result-heading">결과가 준비됐습니다</h3>
                    </div>
                  </div>
                  <p>{selected.resultSummary || "검토 가능한 결과가 있습니다."}</p>
                  <div className="button-row">
                    <button
                      className="button button--primary"
                      type="button"
                      onClick={() =>
                        onPreviewNotice(
                          "결과 뷰어는 Phase 2에서 기존 결과 형식과 대조한 뒤 연결합니다.",
                        )
                      }
                    >
                      결과 열기
                    </button>
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() =>
                        onPreviewNotice(
                          "직원 간 전달은 실제 업무 계약과 이력 보존 기준 확정 후 연결합니다.",
                        )
                      }
                    >
                      다음 직원에게 넘기기
                    </button>
                  </div>
                </section>
              ) : null}

              {selected.status === "queued" ? (
                <div className="notice notice--info">
                  <Icon name="spark" />
                  <div>
                    <strong>로컬 fixture 대기 상태</strong>
                    <p>실제 연동 전에는 이 업무가 서버 queue나 공급자로 전송되지 않습니다.</p>
                  </div>
                </div>
              ) : null}

              <section className="timeline-section" aria-labelledby="timeline-heading">
                <div className="section-heading section-heading--compact">
                  <h3 id="timeline-heading">업무 진행 기록</h3>
                  <span>{selected.updatedAt}</span>
                </div>
                <TaskTimeline steps={selected.timeline} />
              </section>
            </>
          ) : (
            <EmptyState
              title="업무를 선택해주세요"
              description="왼쪽 목록에서 상태와 진행 기록을 볼 업무를 선택하세요."
            />
          )}
        </section>
      </div>
    </div>
  );
}
