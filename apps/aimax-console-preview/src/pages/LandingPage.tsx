import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { EmployeePortrait } from "../components/EmployeePortrait";
import { Icon } from "../components/Icon";
import type { Employee } from "../types";

interface LandingPageProps {
  employees: Employee[];
  onEnterConsole: () => void;
  onShowResume: (employee: Employee) => void;
}

interface TaskChoice {
  id: "research" | "blog" | "quote" | "leads";
  label: string;
  employeeId: string;
  request: string;
  resultTitle: string;
  resultItems: [string, string, string];
  ownerDecision: string;
}

interface TaskChoiceWithEmployee extends TaskChoice {
  employee: Employee;
}

const taskChoices: TaskChoice[] = [
  {
    id: "research",
    label: "경쟁사 조사",
    employeeId: "songi",
    request: "우리와 비슷한 서비스를 비교해줘",
    resultTitle: "경쟁사 비교 브리프",
    resultItems: ["핵심 차이와 포지션", "확인할 수 있는 근거", "다음 행동 후보"],
    ownerDecision: "어떤 기회를 먼저 볼지만 정합니다.",
  },
  {
    id: "blog",
    label: "블로그 초안",
    employeeId: "yeri",
    request: "이번 주 블로그 글을 준비해줘",
    resultTitle: "발행 전 블로그 초안",
    resultItems: ["독자에게 맞춘 글의 흐름", "제목과 CTA 후보", "발행 전 확인할 부분"],
    ownerDecision: "브랜드에 맞는지만 확인합니다.",
  },
  {
    id: "quote",
    label: "견적서 준비",
    employeeId: "sangsu",
    request: "보내기 좋은 견적서로 정리해줘",
    resultTitle: "검토용 견적서",
    resultItems: ["항목과 금액 구조", "거래처가 볼 안내", "보내기 전 확인 사항"],
    ownerDecision: "금액과 발송 여부만 승인합니다.",
  },
  {
    id: "leads",
    label: "잠재고객 찾기",
    employeeId: "hyunju",
    request: "먼저 연락할 고객 후보를 찾아줘",
    resultTitle: "잠재고객 후보 정리",
    resultItems: ["우선 볼 고객 후보", "후보를 고른 이유", "접점별 첫 행동"],
    ownerDecision: "누구에게 먼저 다가갈지 정합니다.",
  },
];

export function LandingPage({
  employees,
  onEnterConsole,
  onShowResume,
}: LandingPageProps) {
  const landingRef = useRef<HTMLDivElement>(null);
  const taskProofRef = useRef<HTMLElement>(null);
  const taskSelectorRef = useRef<HTMLDivElement>(null);
  const teamStoryRef = useRef<HTMLDivElement>(null);
  const publicEmployees = useMemo(
    () => employees.filter((employee) => employee.photo && employee.resume).slice(0, 5),
    [employees],
  );
  const availableTasks = useMemo<TaskChoiceWithEmployee[]>(
    () =>
      taskChoices.flatMap((task) => {
        const employee = publicEmployees.find((item) => item.id === task.employeeId);
        return employee ? [{ ...task, employee }] : [];
      }),
    [publicEmployees],
  );
  const [selectedTaskId, setSelectedTaskId] = useState<TaskChoice["id"]>("blog");
  const [selectedTeamEmployeeId, setSelectedTeamEmployeeId] = useState(
    publicEmployees.find((employee) => employee.id === "yeri")?.id || publicEmployees[0]?.id,
  );
  const [motionRun, setMotionRun] = useState(0);
  const [motionPaused, setMotionPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [taskProofInView, setTaskProofInView] = useState(false);

  const activeTask =
    availableTasks.find((task) => task.id === selectedTaskId) || availableTasks[0];
  const selectedTeamEmployee =
    publicEmployees.find((employee) => employee.id === selectedTeamEmployeeId) ||
    publicEmployees.find((employee) => employee.id === "yeri") ||
    publicEmployees[0];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(media.matches);
    syncPreference();
    media.addEventListener("change", syncPreference);
    return () => media.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    const root = landingRef.current;
    if (!root) return undefined;

    const revealTargets = Array.from(root.querySelectorAll<HTMLElement>(".motion-reveal"));
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      revealTargets.forEach((target) => target.classList.add("is-visible"));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12%", threshold: 0.14 },
    );
    revealTargets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  useEffect(() => {
    const target = taskProofRef.current;
    if (!target) return undefined;
    if (!("IntersectionObserver" in window)) {
      setTaskProofInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setTaskProofInView(entry.isIntersecting),
      { threshold: 0.42 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (
      !taskProofInView ||
      motionPaused ||
      prefersReducedMotion ||
      availableTasks.length < 2
    ) return undefined;

    const timer = window.setTimeout(() => {
      const currentIndex = availableTasks.findIndex((task) => task.id === selectedTaskId);
      const nextTask = availableTasks[(currentIndex + 1) % availableTasks.length];
      if (!nextTask) return;
      setSelectedTaskId(nextTask.id);
      setMotionRun((current) => current + 1);
    }, motionRun === 0 ? 5200 : 4000);

    return () => window.clearTimeout(timer);
  }, [
    availableTasks,
    motionPaused,
    motionRun,
    prefersReducedMotion,
    selectedTaskId,
    taskProofInView,
  ]);

  useEffect(() => {
    const story = teamStoryRef.current;
    if (!story || publicEmployees.length === 0) return undefined;

    let frame = 0;
    const syncEmployeeToScroll = () => {
      frame = 0;
      const rect = story.getBoundingClientRect();
      const stickyTop = window.innerWidth <= 760 ? 66 : 76;
      const stickyHeight = Math.max(1, window.innerHeight - stickyTop);
      const travel = Math.max(1, rect.height - stickyHeight);
      const isPinned = rect.top <= stickyTop && rect.bottom >= stickyTop + stickyHeight;
      if (!isPinned) return;

      const progress = Math.min(1, Math.max(0, (stickyTop - rect.top) / travel));
      const index = Math.min(
        publicEmployees.length - 1,
        Math.floor(progress * publicEmployees.length),
      );
      const employee = publicEmployees[index];
      if (!employee) return;
      setSelectedTeamEmployeeId((current) => current === employee.id ? current : employee.id);
    };

    const scheduleSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(syncEmployeeToScroll);
    };

    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);
    syncEmployeeToScroll();
    return () => {
      window.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [publicEmployees]);

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: prefersReducedMotion || motionPaused ? "auto" : "smooth",
      block: "start",
    });
  };

  const focusTaskChoices = () => {
    scrollToSection("task-proof");
    window.requestAnimationFrame(() => {
      taskSelectorRef.current?.querySelector<HTMLButtonElement>("button")?.focus({
        preventScroll: true,
      });
    });
  };

  const selectTask = (task: TaskChoiceWithEmployee) => {
    setSelectedTaskId(task.id);
    setMotionRun((current) => current + 1);
  };

  return (
    <div
      ref={landingRef}
      className={
        "landing-page landing-page--focus" +
        (motionPaused ? " is-motion-paused" : "") +
        (prefersReducedMotion ? " is-reduced-motion" : "")
      }
    >
      <a className="skip-link" href="#landing-main">본문으로 건너뛰기</a>

      <div className="landing-preview-bar" aria-label="로컬 프리뷰 안내">
        <span><strong>LOCAL PREVIEW</strong> 로그인·서버·API 없이 화면과 모션을 검토합니다.</span>
        <button type="button" onClick={onEnterConsole}>운영실 체험</button>
      </div>

      <header className="public-header public-header--focus">
        <a className="public-brand" href="#/" aria-label="AIMAX 홈">
          <span>AX</span>
          <strong>AIMAX</strong>
        </a>
        <nav aria-label="랜딩페이지 메뉴">
          <button type="button" onClick={() => scrollToSection("work-proof")}>일하는 방식</button>
          <button type="button" onClick={() => scrollToSection("team-resume")}>AI 직원</button>
          <button type="button" onClick={() => scrollToSection("trust")}>운영 기준</button>
        </nav>
        <div className="public-header__actions">
          <button
            className="landing-motion-toggle"
            type="button"
            aria-pressed={motionPaused}
            onClick={() => setMotionPaused((current) => !current)}
          >
            <span aria-hidden="true">{motionPaused ? "▶" : "Ⅱ"}</span>
            {motionPaused ? "모션 켜기" : "모션 끄기"}
          </button>
          <button className="public-cta public-cta--small" type="button" onClick={focusTaskChoices}>
            업무 골라보기
          </button>
        </div>
      </header>

      <main id="landing-main">
        <section className="landing-hero landing-hero--proof" aria-labelledby="landing-hero-title">
          <div className="landing-hero__glow" aria-hidden="true"><i /><i /><i /></div>
          <div className="landing-hero__copy hero-entrance">
            <span className="landing-kicker">START WITH ONE TASK</span>
            <h1 id="landing-hero-title">
              <span>설명보다,</span>
              <em>일 하나</em>
              <span>맡겨보세요.</span>
            </h1>
            <p>
              대표님의 할 일 목록에서 자꾸 밀리는 일을 하나 고르세요. 누가 맡고,
              어떻게 진행하고, 무엇을 돌려주는지 바로 확인할 수 있습니다.
            </p>
            <div className="landing-hero__actions">
              <button className="public-cta" type="button" onClick={focusTaskChoices}>
                이번 주 밀린 일 골라보기 <Icon name="arrow" />
              </button>
              <button className="landing-hero__text-link" type="button" onClick={() => scrollToSection("team-resume")}>
                직원 입사지원서 보기 <Icon name="arrow" />
              </button>
            </div>
            <p className="landing-hero__honesty">
              실제 실행 전에는 직원별 환경과 예상 비용을 먼저 안내합니다.
            </p>
          </div>

          <aside ref={taskProofRef} id="task-proof" className="task-proof-card hero-entrance hero-entrance--delay" aria-label="업무 자동 시연과 직접 선택">
            <header className="task-proof-card__header">
              <div>
                <span>이번 주에 미뤄둔 일은?</span>
                <small>{motionPaused || prefersReducedMotion ? "직접 선택해서 확인하세요" : "자동 시연 중 · 직접 선택 가능"}</small>
              </div>
              <i className={taskProofInView && !motionPaused && !prefersReducedMotion ? "is-running" : ""} aria-hidden="true" />
            </header>
            <div ref={taskSelectorRef} className="task-choice-grid" aria-label="맡길 업무 선택">
              {availableTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  aria-pressed={task.id === activeTask?.id}
                  onClick={() => selectTask(task)}
                >
                  {task.label}
                </button>
              ))}
            </div>

            {activeTask ? (
              <div key={`${activeTask.id}-${motionRun}`} className="task-proof-motion">
                <div className="task-proof-motion__request">
                  <span>대표님이 맡긴 일</span>
                  <strong>“{activeTask.request}”</strong>
                </div>
                <div className="task-proof-motion__beam" aria-hidden="true"><i /></div>
                <article className="task-proof-motion__result">
                  <div className="task-proof-motion__employee">
                    <EmployeePortrait employee={activeTask.employee} size="large" decorative={false} showStatus />
                    <div><span>담당 직원</span><strong>{activeTask.employee.name}</strong><small>{activeTask.employee.role}</small></div>
                  </div>
                  <div className="task-proof-motion__document">
                    <span>받게 될 결과</span>
                    <h2>{activeTask.resultTitle}</h2>
                    <ul>{activeTask.resultItems.map((item) => <li key={item}>{item}<i /></li>)}</ul>
                  </div>
                </article>
              </div>
            ) : (
              <p className="task-proof-card__empty">공개 준비가 끝난 직원을 연결하고 있습니다.</p>
            )}
            <p className="sr-only" aria-live="polite">
              {activeTask ? `${activeTask.label} 업무는 ${activeTask.employee.name} ${activeTask.employee.role}이 맡고 ${activeTask.resultTitle}을 준비합니다.` : ""}
            </p>
          </aside>
        </section>

        {activeTask ? (
          <section id="work-proof" className="landing-section work-proof work-proof--focused" aria-labelledby="work-proof-title">
            <header className="landing-section__heading landing-section__heading--light motion-reveal">
              <div>
                <span className="landing-kicker">FROM REQUEST TO RESULT</span>
                <h2 id="work-proof-title" className="heading-lines">
                  <span>맡기면,</span>
                  <span>다음 확인할 일만</span>
                  <span>남습니다.</span>
                </h2>
              </div>
              <p>요청을 남긴 뒤에는 담당 직원이 필요한 단계를 이어갑니다. 대표님에게는 진행 상황과 결정할 부분만 돌아옵니다.</p>
            </header>

            <div className="work-journey motion-reveal" aria-label={`${activeTask.label} 업무 진행 예시`}>
              <div className="work-journey__topline">
                <span><i /> {activeTask.employee.name}가 업무를 이어가는 중</span>
                <strong>{activeTask.label}</strong>
              </div>
              <div key={`${activeTask.id}-${motionRun}`} className="work-journey__scenes">
                <article className="work-journey__scene work-journey__scene--request">
                  <span>01 · 맡길 일</span>
                  <strong>“{activeTask.request}”</strong>
                  <small>필요한 목적과 범위를 먼저 확인합니다.</small>
                </article>
                <div className="work-journey__connector" aria-hidden="true"><i /></div>
                <article className="work-journey__scene work-journey__scene--employee">
                  <span>02 · 직원이 처리</span>
                  <div><EmployeePortrait employee={activeTask.employee} size="large" decorative={false} showStatus /><p><strong>{activeTask.employee.name}</strong><small>{activeTask.employee.role}</small></p></div>
                  <small>필요한 근거와 내용을 정리해 결과 형태로 바꿉니다.</small>
                </article>
                <div className="work-journey__connector" aria-hidden="true"><i /></div>
                <article className="work-journey__scene work-journey__scene--result">
                  <span>03 · 대표님이 결정</span>
                  <strong>{activeTask.resultTitle}</strong>
                  <small>{activeTask.ownerDecision}</small>
                </article>
              </div>
              <div className="work-journey__decision"><span>대표님에게 돌아오는 것</span><strong>{activeTask.ownerDecision}</strong></div>
            </div>
          </section>
        ) : null}

        <section id="team-resume" className="team-resume" aria-labelledby="team-resume-title">
          <div
            ref={teamStoryRef}
            className="team-scroll-story"
          >
            <div className="landing-section team-scroll-story__sticky">
              <header className="landing-section__heading motion-reveal">
                <div>
                  <span className="landing-kicker">A TEAM WITH NAMES</span>
                  <h2 id="team-resume-title" className="heading-lines">
                    <span>일이 생길 때마다,</span>
                    <span>맡을 사람이</span>
                    <span>떠오릅니다.</span>
                  </h2>
                </div>
                <p>자료조사는 송이, 글은 예리처럼 이름과 역할을 함께 기억합니다. 필요한 직원의 입사지원서를 읽고 우리 회사에 맞는지 판단하세요.</p>
              </header>

              <div className="staff-lineup motion-reveal" aria-label="스크롤에 따라 소개되는 AIMAX AI 직원">
                <div className="staff-lineup__track" aria-hidden="true"><i /></div>
                {publicEmployees.map((employee, index) => (
                  <button
                    key={employee.id}
                    type="button"
                    className={employee.id === selectedTeamEmployee?.id ? "is-active" : ""}
                    style={{ "--staff-index": index } as CSSProperties}
                    aria-pressed={employee.id === selectedTeamEmployee?.id}
                    onClick={() => setSelectedTeamEmployeeId(employee.id)}
                  >
                    <EmployeePortrait employee={employee} size="large" decorative={false} />
                    <span><strong>{employee.name}</strong><small>{employee.role}</small></span>
                  </button>
                ))}
              </div>
              <p className="sr-only" aria-live="polite">
                {selectedTeamEmployee ? `${selectedTeamEmployee.name} ${selectedTeamEmployee.role} 소개` : ""}
              </p>
            </div>
          </div>

          <div className="landing-section team-resume__application">
            {selectedTeamEmployee?.resume ? (
              <div key={selectedTeamEmployee.id} className="resume-feature motion-reveal">
              <div className="resume-feature__copy">
                <span className="landing-kicker">KOREAN-STYLE APPLICATION</span>
                <h3 className="heading-lines">
                  <span>어떤 일을</span>
                  <span>맡길지,</span>
                  <span>이력서부터</span>
                  <span>읽어보세요.</span>
                </h3>
                <blockquote>“{selectedTeamEmployee.voiceLine}”</blockquote>
                <p>{selectedTeamEmployee.summary}</p>
                <ul>{selectedTeamEmployee.capabilities.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>
                <button className="public-cta" type="button" onClick={() => onShowResume(selectedTeamEmployee)}>
                  {selectedTeamEmployee.name}의 입사지원서 전체 보기 <Icon name="arrow" />
                </button>
                <small>이름과 사진은 역할을 친숙하게 이해하도록 만든 가상의 AI 직원 설정입니다.</small>
              </div>

              <button
                className="resume-preview-paper"
                type="button"
                onClick={() => onShowResume(selectedTeamEmployee)}
                aria-label={`${selectedTeamEmployee.name}의 전체 입사지원서 열기`}
              >
                <header><span>AIMAX AI 직원 채용 서류</span><h3>입 사 지 원 서</h3><i>AI 직원</i></header>
                <div className="resume-preview-paper__identity">
                  <EmployeePortrait employee={selectedTeamEmployee} size="hero" className="resume-preview-photo" decorative={false} />
                  <div><span>성명</span><strong>{selectedTeamEmployee.name}</strong><small>{selectedTeamEmployee.role}</small></div>
                </div>
                <dl>
                  <div><dt>지원분야</dt><dd>{selectedTeamEmployee.role}</dd></div>
                  <div><dt>사번</dt><dd>{selectedTeamEmployee.resume.employeeNo}</dd></div>
                  <div><dt>경력</dt><dd>{selectedTeamEmployee.resume.experience}</dd></div>
                  <div><dt>소속</dt><dd>{selectedTeamEmployee.resume.team}</dd></div>
                </dl>
                <blockquote>“{selectedTeamEmployee.resume.interviewLine}”</blockquote>
                <span className="resume-preview-paper__signature">지원자 {selectedTeamEmployee.name}</span>
              </button>
              </div>
            ) : null}
          </div>
        </section>

        <section id="trust" className="landing-section trust-strip" aria-labelledby="trust-title">
          <header className="motion-reveal">
            <span className="landing-kicker">BEFORE THE FIRST TASK</span>
            <h2 id="trust-title" className="heading-lines">
              <span>친근하게</span>
              <span>보여도,</span>
              <span>실행 기준은</span>
              <span>분명하게.</span>
            </h2>
          </header>
          <div className="trust-strip__items motion-reveal">
            <article><span>환경</span><h3>웹과 로컬을 구분</h3><p>PC 실행기가 필요한 일은 시작 전에 먼저 알려드립니다.</p></article>
            <article><span>비용</span><h3>유료 작업은 확인 후 실행</h3><p>사용할 모델과 예상 비용을 보고 승인한 뒤 시작합니다.</p></article>
            <article><span>복구</span><h3>실패해도 결과를 보존</h3><p>작업 번호와 실패 단계를 남겨 필요한 부분부터 이어갑니다.</p></article>
          </div>
        </section>

        <section className="landing-final-cta motion-reveal">
          <div><span className="landing-kicker">ONE TASK AT A TIME</span><h2>혼자 다 하던 방식에서,<br />하나씩 맡기는 방식으로.</h2></div>
          <div><p>첫 업무를 고르고, 맞는 직원을 확인해보세요. 지금 프리뷰에서는 로그인 없이 운영실까지 둘러볼 수 있습니다.</p><button className="public-cta public-cta--light" type="button" onClick={focusTaskChoices}>첫 업무 고르기 <Icon name="arrow" /></button></div>
        </section>
      </main>

      <footer className="public-footer">
        <div className="public-brand"><span>AX</span><strong>AIMAX</strong></div>
        <p>혼자 하던 일을, 맡길 수 있는 일로.</p>
        <button type="button" onClick={onEnterConsole}>로컬 운영실 체험</button>
      </footer>
    </div>
  );
}
