import type { ReactNode } from "react";

import { scenarioOptions } from "../data/fixtures";
import { routes } from "../lib/routes";
import type { AppRoute, PreviewScenario } from "../types";
import { Icon } from "./Icon";

interface AppShellProps {
  activeRoute: AppRoute;
  pageTitle: string;
  pageDescription: string;
  scenario: PreviewScenario;
  onScenarioChange: (scenario: PreviewScenario) => void;
  onNavigate: (route: AppRoute) => void;
  onNewTask: () => void;
  children: ReactNode;
}

export function AppShell({
  activeRoute,
  pageTitle,
  pageDescription,
  scenario,
  onScenarioChange,
  onNavigate,
  onNewTask,
  children,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        본문으로 건너뛰기
      </a>

      <aside className="app-sidebar" aria-label="AIMAX 주요 메뉴">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            AX
          </div>
          <div className="brand-copy">
            <strong>AIMAX</strong>
            <span>AI 운영실</span>
          </div>
        </div>

        <nav className="primary-nav">
          {routes.map((item) => (
            <button
              key={item.id}
              className={
                "nav-item" + (item.id === activeRoute ? " is-active" : "")
              }
              type="button"
              aria-current={item.id === activeRoute ? "page" : undefined}
              onClick={() => onNavigate(item.id)}
            >
              <Icon name={item.icon} className="nav-item__icon" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-account">
          <div className="avatar avatar--account" aria-hidden="true">
            민
          </div>
          <div>
            <strong>민수님</strong>
            <span>로컬 검토자</span>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <section className="preview-banner" aria-label="로컬 프리뷰 안내">
          <div className="preview-banner__message">
            <span className="preview-banner__flag">LOCAL PREVIEW</span>
            <span>로그인·서버·API 연결 없음 · 모든 변경은 브라우저 메모리에만 유지</span>
          </div>
          <label className="scenario-control">
            <span>화면 상태</span>
            <select
              value={scenario}
              onChange={(event) =>
                onScenarioChange(event.target.value as PreviewScenario)
              }
            >
              {scenarioOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <header className="page-header">
          <div>
            <p className="page-kicker">AIMAX CONSOLE · REBUILD</p>
            <h1>{pageTitle}</h1>
            <p>{pageDescription}</p>
          </div>
          <button className="button button--primary" type="button" onClick={onNewTask}>
            <Icon name="plus" className="button__icon" />
            새 업무
          </button>
        </header>

        <main id="main-content" className="page-content" tabIndex={-1}>
          {children}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="AIMAX 모바일 주요 메뉴">
        {routes.map((item) => (
          <button
            key={item.id}
            className={
              "mobile-nav__item" + (item.id === activeRoute ? " is-active" : "")
            }
            type="button"
            aria-current={item.id === activeRoute ? "page" : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <Icon name={item.icon} />
            <span>{item.shortLabel}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
