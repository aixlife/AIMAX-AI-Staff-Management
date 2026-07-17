import { useMemo, useState } from "react";

import { EmployeeCard } from "../components/EmployeeCard";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import {
  employeeStatusLabel,
  employeeStatusTone,
  StatusBadge,
} from "../components/StatusBadge";
import type { Employee, EmployeeExecution, FixtureSet } from "../types";

interface EmployeesPageProps {
  fixture: FixtureSet;
  selectedEmployeeId?: string;
  onSelectEmployee: (employeeId: string) => void;
  onStartTask: (employee: Employee) => void;
}

type EmployeeFilter = "all" | EmployeeExecution;

const executionLabels: Record<EmployeeExecution, string> = {
  web: "웹",
  local: "로컬",
  hybrid: "웹 + 로컬",
  external: "외부 앱",
};

export function EmployeesPage({
  fixture,
  selectedEmployeeId,
  onSelectEmployee,
  onStartTask,
}: EmployeesPageProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<EmployeeFilter>("all");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return fixture.employees.filter((employee) => {
      if (filter !== "all" && employee.execution !== filter) return false;
      if (!normalized) return true;
      return [
        employee.name,
        employee.role,
        employee.team,
        employee.summary,
        ...employee.capabilities,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [filter, fixture.employees, query]);

  const selected =
    fixture.employees.find((employee) => employee.id === selectedEmployeeId) ||
    filtered[0];

  if (!fixture.employees.length) {
    return (
      <EmptyState
        title="아직 사용할 수 있는 AI 직원이 없습니다"
        description="첫 사용자 fixture입니다. 실제 제품에서는 계정 권한과 공개 직원 catalog를 확인해 안내합니다."
      />
    );
  }

  return (
    <div className="page-stack">
      <section className="catalog-toolbar" aria-label="AI 직원 검색과 필터">
        <label className="search-field">
          <Icon name="search" />
          <span className="sr-only">직원 검색</span>
          <input
            type="search"
            placeholder="이름, 역할, 할 수 있는 일 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="segmented-control" aria-label="실행 방식 필터">
          {(["all", "web", "hybrid", "local", "external"] as EmployeeFilter[]).map(
            (item) => (
              <button
                key={item}
                type="button"
                aria-pressed={filter === item}
                className={filter === item ? "is-active" : ""}
                onClick={() => setFilter(item)}
              >
                {item === "all" ? "전체" : executionLabels[item]}
              </button>
            ),
          )}
        </div>
      </section>

      <div className="master-detail">
        <section className="master-list" aria-label="AI 직원 목록">
          <div className="list-summary">
            <strong>{filtered.length}명</strong>
            <span>현재 조건에 맞는 직원</span>
          </div>
          {filtered.length ? (
            filtered.map((employee) => (
              <EmployeeCard
                key={employee.id}
                employee={employee}
                active={employee.id === selected?.id}
                onSelect={onSelectEmployee}
              />
            ))
          ) : (
            <EmptyState
              compact
              title="검색 결과가 없습니다"
              description="검색어나 실행 방식 필터를 바꿔보세요."
            />
          )}
        </section>

        <section className="detail-panel" aria-live="polite">
          {selected ? (
            <>
              <header className="employee-detail-header">
                <span className={"avatar avatar--xl avatar--" + selected.id}>
                  {selected.initials}
                </span>
                <div>
                  <div className="badge-row">
                    <StatusBadge
                      label={employeeStatusLabel(selected.status)}
                      tone={employeeStatusTone(selected.status)}
                      dot
                    />
                    <StatusBadge
                      label={executionLabels[selected.execution]}
                      tone="neutral"
                    />
                    {selected.beta ? (
                      <StatusBadge label="비공개 베타" tone="info" />
                    ) : null}
                  </div>
                  <h2>{selected.name}</h2>
                  <p>{selected.role} · {selected.team}</p>
                </div>
              </header>

              <p className="employee-detail-summary">{selected.summary}</p>

              <div className="employee-contract-grid">
                <div>
                  <span>받는 정보</span>
                  <strong>{selected.inputSummary}</strong>
                </div>
                <div>
                  <span>만드는 결과</span>
                  <strong>{selected.outputSummary}</strong>
                </div>
                <div>
                  <span>비용 기준</span>
                  <strong>{selected.costSummary}</strong>
                </div>
              </div>

              <div className="detail-section">
                <h3>할 수 있는 일</h3>
                <div className="capability-list">
                  {selected.capabilities.map((capability) => (
                    <span key={capability}>
                      <Icon name="check" />
                      {capability}
                    </span>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>실행 전 필요한 연결</h3>
                <div className="requirement-list">
                  {selected.requiredConnections.length ? (
                    selected.requiredConnections.map((requirement) => (
                      <div key={requirement}>
                        <span className="requirement-dot" />
                        <span>{requirement}</span>
                        <StatusBadge
                          label={
                            selected.status === "setup_required"
                              ? "확인 필요"
                              : "실행 전 점검"
                          }
                          tone={
                            selected.status === "setup_required"
                              ? "warning"
                              : "neutral"
                          }
                        />
                      </div>
                    ))
                  ) : (
                    <p className="muted-copy">추가 연결 없이 사용할 수 있습니다.</p>
                  )}
                </div>
              </div>

              <footer className="detail-actions">
                <div>
                  <span>최근 사용</span>
                  <strong>{selected.lastUsed || "아직 없음"}</strong>
                </div>
                <button
                  className="button button--primary"
                  type="button"
                  onClick={() => onStartTask(selected)}
                >
                  업무 맡기기
                  <Icon name="arrow" className="button__icon button__icon--end" />
                </button>
              </footer>
            </>
          ) : (
            <EmptyState
              title="직원을 선택해주세요"
              description="왼쪽 목록에서 역할과 실행 조건을 확인할 직원을 선택하세요."
            />
          )}
        </section>
      </div>
    </div>
  );
}
