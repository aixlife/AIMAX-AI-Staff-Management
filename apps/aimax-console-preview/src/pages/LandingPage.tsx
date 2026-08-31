import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { DeliverableDialog } from "../components/DeliverableDialog";
import { EmployeePortrait } from "../components/EmployeePortrait";
import { Icon } from "../components/Icon";
import {
  CONSOLE_LOGIN_URL,
  COMPANY_URL,
  HOOMCHA_URL,
  LOUNGE_URL,
  STORE_URL,
  formatPrice,
  getPurchaseLink,
} from "../data/purchaseLinks";
import { getSampleDeliverable } from "../data/sampleDeliverables";
import type { Employee } from "../types";

interface LandingPageProps {
  employees: Employee[];
  onShowResume: (employee: Employee) => void;
}

/** AIMAX 직원 이름은 유지하면서 업무 시작만 외부 서비스로 잇는 경로 */
interface ExternalTaskDestination {
  url: string;
  ctaLabel: string;
  note: string;
}

interface TaskChoice {
  id: "research" | "blog" | "quote" | "leads" | "office";
  label: string;
  employeeId: string;
  request: string;
  resultTitle: string;
  resultItems: [string, string, string];
  ownerDecision: string;
  /** 외부 서비스에서 실행되는 직원일 때만 채웁니다. */
  externalDestination?: ExternalTaskDestination;
}

interface TaskChoiceWithEmployee extends TaskChoice {
  employee: Employee;
}

const HYUNJU_ID = "hyunju";

const HYUNJU_EXTERNAL_DESTINATION: ExternalTaskDestination = {
  url: HOOMCHA_URL,
  ctaLabel: "현주에게 맡기기",
  note: "현주 업무는 연결된 외부 서비스에서 이어집니다.",
};

const taskChoices: TaskChoice[] = [
  {
    id: "research",
    label: "경쟁사 조사",
    employeeId: "songi",
    request: "경쟁사 자료를 조사해서 비교해줘",
    resultTitle: "송이 경쟁사 조사 브리프",
    resultItems: [
      "공개 자료와 출처 링크 정리",
      "경쟁사별 강점과 빈틈 비교",
      "다음 제작 직원에게 넘길 조사 브리프",
    ],
    ownerDecision: "어느 빈틈부터 공략할지만 정하시면 됩니다.",
  },
  {
    id: "blog",
    label: "블로그 글쓰기",
    employeeId: "yeri",
    request: "이번 주 블로그 글을 준비해줘",
    resultTitle: "발행 전 블로그 초안",
    resultItems: ["읽는 사람에 맞춘 글의 흐름", "제목과 마무리 문구 후보", "올리기 전 확인할 부분"],
    ownerDecision: "우리 가게 말투에 맞는지만 확인하시면 됩니다.",
  },
  {
    id: "quote",
    label: "견적서 만들기",
    employeeId: "sangsu",
    request: "보내기 좋은 견적서로 정리해줘",
    resultTitle: "바로 보낼 수 있는 견적서",
    resultItems: ["항목과 금액 정리", "거래처가 볼 안내 문구", "보내기 전 확인 사항"],
    ownerDecision: "금액과 보낼지 여부만 정하시면 됩니다.",
  },
  {
    id: "leads",
    label: "레퍼런스 모으기",
    employeeId: "hyunju",
    request: "요즘 잘 되는 콘텐츠를 모아줘",
    resultTitle: "현주가 모아주는 레퍼런스",
    resultItems: [
      "유튜브·인스타·틱톡·스레드·X에서 자동 수집",
      "AI가 요약하고 주제별로 정리",
      "마음에 든 자료만 골라서 보관",
    ],
    ownerDecision: "어떤 자료를 따라 해볼지만 고르시면 됩니다.",
    externalDestination: HYUNJU_EXTERNAL_DESTINATION,
  },
  {
    id: "office",
    label: "사무 정리",
    employeeId: "jieun",
    request: "신청서 캡처를 정리해줘",
    resultTitle: "정리가 끝난 서류 묶음",
    resultItems: ["가릴 곳을 가린 캡처", "글자만 뽑아 정리한 목록", "원본은 그대로 보관"],
    ownerDecision: "정리된 파일을 어디에 쓸지만 정하시면 됩니다.",
  },
];

export function LandingPage({
  employees,
  onShowResume,
}: LandingPageProps) {
  const landingRef = useRef<HTMLDivElement>(null);
  const taskProofRef = useRef<HTMLElement>(null);
  const taskSelectorRef = useRef<HTMLDivElement>(null);
  const teamStoryRef = useRef<HTMLDivElement>(null);
  const teamApplicationRef = useRef<HTMLDivElement>(null);
  const manualTeamSelectionRef = useRef<string | null>(null);
  const manualTeamSelectionTimerRef = useRef<number | undefined>(undefined);
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
  const [detailOpen, setDetailOpen] = useState(false);

  const activeTask =
    availableTasks.find((task) => task.id === selectedTaskId) || availableTasks[0];
  // 외부에서 실행되는 일은 우리 산출물 샘플 대신 실제 이동 링크를 보여줍니다.
  const activeDeliverable = activeTask?.externalDestination
    ? undefined
    : getSampleDeliverable(activeTask?.employeeId);
  const activePurchase = activeTask?.externalDestination
    ? undefined
    : getPurchaseLink(activeTask?.employeeId);
  /** 가격 안내에 쓰는 줄: 카페24 상품을 먼저, 외부 실행 직원을 마지막에 둡니다. */
  const hireRows = useMemo(
    () => [
      ...availableTasks.filter((task) => !task.externalDestination),
      ...availableTasks.filter((task) => task.externalDestination),
    ],
    [availableTasks],
  );
  const selectedTeamEmployee =
    publicEmployees.find((employee) => employee.id === selectedTeamEmployeeId) ||
    publicEmployees.find((employee) => employee.id === "yeri") ||
    publicEmployees[0];
  const selectedTeamDestination =
    selectedTeamEmployee?.id === HYUNJU_ID
      ? HYUNJU_EXTERNAL_DESTINATION
      : undefined;

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
      detailOpen ||
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
    detailOpen,
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
      if (manualTeamSelectionRef.current) return;
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

  useEffect(
    () => () => {
      if (manualTeamSelectionTimerRef.current) {
        window.clearTimeout(manualTeamSelectionTimerRef.current);
      }
    },
    [],
  );

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

  const selectTeamEmployee = (employeeId: string) => {
    manualTeamSelectionRef.current = employeeId;
    if (manualTeamSelectionTimerRef.current) {
      window.clearTimeout(manualTeamSelectionTimerRef.current);
    }
    setSelectedTeamEmployeeId(employeeId);
    window.requestAnimationFrame(() => {
      teamApplicationRef.current?.scrollIntoView({
        behavior: prefersReducedMotion || motionPaused ? "auto" : "smooth",
        block: "start",
      });
      manualTeamSelectionTimerRef.current = window.setTimeout(() => {
        manualTeamSelectionRef.current = null;
        manualTeamSelectionTimerRef.current = undefined;
      }, prefersReducedMotion || motionPaused ? 250 : 900);
    });
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

      <header className="public-header public-header--focus">
        <a className="public-brand" href="#/" aria-label="AIMAX 홈">
          <span>AX</span>
          <strong>AIMAX</strong>
        </a>
        <nav aria-label="랜딩페이지 메뉴">
          <button type="button" onClick={() => scrollToSection("work-proof")}>일하는 방식</button>
          <button type="button" onClick={() => scrollToSection("team-resume")}>AI 직원</button>
          <button type="button" onClick={() => scrollToSection("trust")}>일하는 기준</button>
          <button type="button" onClick={() => scrollToSection("hire")}>가격</button>
        </nav>
        <div className="public-header__actions">
          <button
            className="landing-motion-toggle"
            type="button"
            aria-pressed={motionPaused}
            onClick={() => setMotionPaused((current) => !current)}
          >
            <span aria-hidden="true">{motionPaused ? "▸" : "Ⅱ"}</span>
            {motionPaused ? "모션 켜기" : "모션 끄기"}
          </button>
          <a className="landing-login-link" href={CONSOLE_LOGIN_URL}>
            이미 회원이라면 로그인
          </a>
          <button className="public-cta public-cta--small" type="button" onClick={() => scrollToSection("hire")}>
            직원 데려오기
          </button>
        </div>
      </header>

      <main id="landing-main">
        <section className="landing-hero landing-hero--proof" aria-labelledby="landing-hero-title">
          <div className="landing-hero__glow" aria-hidden="true"><i /><i /><i /></div>
          <div className="landing-hero__copy hero-entrance">
            <span className="landing-kicker">AI 직원 인력사무소</span>
            <h1 id="landing-hero-title">
              <span>설명보다,</span>
              <em>일 하나</em>
              <span>맡겨보세요.</span>
            </h1>
            {/* "AI 직원" 사이는 줄바꿈되지 않게 붙임 공백(U+00A0)을 씁니다. */}
            <p>
              AIMAX는 사장님 손이 계속 가는 일을 대신하는 AI 직원입니다.
              블로그 글쓰기, 견적서, 고객 찾기, 사무 정리까지
              필요한 직원만 한 명씩 데려오시면 됩니다.
            </p>
            <div className="landing-hero__actions">
              <button className="public-cta" type="button" onClick={() => scrollToSection("hire")}>
                직원 데려오기 · 한 명 30,000원 <Icon name="arrow" />
              </button>
              <button className="landing-hero__text-link" type="button" onClick={focusTaskChoices}>
                무슨 일을 맡길 수 있는지 먼저 보기 <Icon name="arrow" />
              </button>
            </div>
            <p className="landing-hero__honesty">
              직원마다 필요한 준비물과 드는 비용은 일을 시작하기 전에 먼저 알려드립니다.
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
                  <span>사장님이 맡긴 일</span>
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
                    {activeTask.externalDestination ? (
                      <a
                        className="landing-detail-open"
                        href={activeTask.externalDestination.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {activeTask.externalDestination.ctaLabel} <Icon name="arrow" />
                      </a>
                    ) : null}
                    {activeDeliverable ? (
                      <button
                        className="landing-detail-open"
                        type="button"
                        onClick={() => setDetailOpen(true)}
                      >
                        결과 상세 열기 <Icon name="arrow" />
                      </button>
                    ) : null}
                  </div>
                </article>
                {activeTask.externalDestination ? (
                  <p className="task-proof-motion__foot">{activeTask.externalDestination.note}</p>
                ) : activePurchase ? (
                  <p className="task-proof-motion__foot">
                    <a href={activePurchase.url} target="_blank" rel="noopener noreferrer">
                      {activePurchase.verified
                        ? `${activeTask.employee.name} 데려오기 · ${formatPrice(activePurchase.priceWon)}`
                        : `스토어에서 ${activeTask.employee.name} 확인하기`}
                    </a>
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="task-proof-card__empty">공개 준비가 끝난 직원을 연결하고 있습니다.</p>
            )}
            <p className="sr-only" aria-live="polite">
              {activeTask
                ? `${activeTask.label} 업무를 맡는 직원은 ${activeTask.employee.name} ${activeTask.employee.role}입니다. 준비할 결과는 ${activeTask.resultTitle}입니다.`
                : ""}
            </p>
          </aside>
        </section>

        {activeTask ? (
          <section id="work-proof" className="landing-section work-proof work-proof--focused" aria-labelledby="work-proof-title">
            <header className="landing-section__heading landing-section__heading--light motion-reveal">
              <div>
                <span className="landing-kicker">맡기고 받기까지</span>
                <h2 id="work-proof-title" className="heading-lines">
                  <span>맡기면,</span>
                  <span>다음 확인할 일만</span>
                  <span>남습니다.</span>
                </h2>
              </div>
              <p>요청을 남긴 뒤에는 담당 직원이 필요한 단계를 이어갑니다. 사장님에게는 진행 상황과 결정할 것만 돌아옵니다.</p>
            </header>

            <div className="work-journey motion-reveal" aria-label={`${activeTask.label} 업무 진행 예시`}>
              <div className="work-journey__topline">
                <span><i /> {activeTask.employee.name}가 일을 이어가는 중</span>
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
                  <small>{activeTask.externalDestination?.note || "필요한 자료를 모아서 바로 쓸 수 있는 형태로 정리합니다."}</small>
                </article>
                <div className="work-journey__connector" aria-hidden="true"><i /></div>
                <article className="work-journey__scene work-journey__scene--result">
                  <span>03 · 사장님이 결정</span>
                  <strong>{activeTask.resultTitle}</strong>
                  <small>{activeTask.ownerDecision}</small>
                  {activeTask.externalDestination ? (
                    <a
                      className="landing-detail-open landing-detail-open--dark"
                      href={activeTask.externalDestination.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {activeTask.externalDestination.ctaLabel} <Icon name="arrow" />
                    </a>
                  ) : null}
                  {activeDeliverable ? (
                    <button
                      className="landing-detail-open landing-detail-open--dark"
                      type="button"
                      onClick={() => setDetailOpen(true)}
                    >
                      결과물 자세히 보기 <Icon name="arrow" />
                    </button>
                  ) : null}
                </article>
              </div>
              <div className="work-journey__decision"><span>사장님에게 돌아오는 것</span><strong>{activeTask.ownerDecision}</strong></div>
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
                  <span className="landing-kicker">이름이 있는 직원들</span>
                  <h2 id="team-resume-title" className="heading-lines">
                    <span>일이 생길 때마다,</span>
                    <span>맡을 사람이</span>
                    <span>떠오릅니다.</span>
                  </h2>
                </div>
                <p>자료조사는 송이, 레퍼런스 수집은 현주, 글은 예리처럼 이름과 역할을 함께 기억합니다. 우리 가게에 맞는 직원인지 소개서를 읽어보고 확인해 보세요.</p>
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
                    onClick={() => selectTeamEmployee(employee.id)}
                  >
                    <EmployeePortrait employee={employee} size="large" decorative={false} />
                    <span>
                      <strong>{employee.name}</strong>
                      <small>{employee.role}</small>
                    </span>
                  </button>
                ))}
              </div>
              <p className="sr-only" aria-live="polite">
                {selectedTeamEmployee
                  ? `${selectedTeamEmployee.name} ${selectedTeamEmployee.role} 소개`
                  : ""}
              </p>
            </div>
          </div>

          <div
            ref={teamApplicationRef}
            className="landing-section team-resume__application"
          >
            {selectedTeamEmployee?.resume ? (
              <div key={selectedTeamEmployee.id} className="resume-feature motion-reveal">
                <div className="resume-feature__copy">
                  <span className="landing-kicker">입사지원서</span>
                  <h3 className="heading-lines">
                    <span>어떤 일을</span>
                    <span>맡길지,</span>
                    <span>이력서부터</span>
                    <span>읽어보세요.</span>
                  </h3>
                  <blockquote>“{selectedTeamEmployee.voiceLine}”</blockquote>
                  <p>{selectedTeamEmployee.summary}</p>
                  <ul>{selectedTeamEmployee.capabilities.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>
                  {selectedTeamDestination ? (
                    <a
                      className="public-cta"
                      href={selectedTeamDestination.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {selectedTeamDestination.ctaLabel} <Icon name="arrow" />
                    </a>
                  ) : (
                    <button className="public-cta" type="button" onClick={() => onShowResume(selectedTeamEmployee)}>
                      {selectedTeamEmployee.name}의 입사지원서 전체 보기 <Icon name="arrow" />
                    </button>
                  )}
                  <small>
                    {selectedTeamDestination
                      ? "현주의 업무 시작은 연결된 외부 서비스에서 이어집니다."
                      : "이름과 사진은 역할을 친숙하게 이해하도록 만든 가상의 AI 직원 설정입니다."}
                  </small>
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
            <span className="landing-kicker">일 맡기기 전에</span>
            <h2 id="trust-title" className="heading-lines">
              <span>친근하게</span>
              <span>보여도,</span>
              <span>일하는 기준은</span>
              <span>분명하게.</span>
            </h2>
          </header>
          <div className="trust-strip__items motion-reveal">
            <article><span>준비물</span><h3>필요한 것은 미리 알려드립니다</h3><p>PC에 프로그램을 설치해야 하는 일은 시작 전에 먼저 말씀드립니다.</p></article>
            <article><span>비용</span><h3>돈이 드는 일은 확인 후에</h3><p>얼마가 드는지 보여드리고, 사장님이 좋다고 하신 다음에 시작합니다.</p></article>
            <article><span>실수</span><h3>중간에 멈춰도 다시 이어갑니다</h3><p>어디까지 했는지 기록으로 남겨서, 처음부터 다시 하지 않아도 됩니다.</p></article>
          </div>
          <aside className="trust-strip__learning motion-reveal" aria-label="수강생 라운지 안내">
            <div>
              <strong>AI 직원이 아직 낯설다면</strong>
              <p>메이크패밀리 라운지에서 강의와 바로 쓰는 가이드를 먼저 살펴보세요.</p>
            </div>
            <a href={LOUNGE_URL} target="_blank" rel="noopener noreferrer">
              수강생 라운지 보기 <Icon name="arrow" />
            </a>
          </aside>
        </section>

        <section id="hire" className="landing-section hire-section" aria-labelledby="hire-title">
          <header className="landing-section__heading motion-reveal">
            <div>
              <span className="landing-kicker">직원 데려오기</span>
              <h2 id="hire-title" className="heading-lines">
                <span>직원 한 명,</span>
                <span>30,000원부터.</span>
              </h2>
            </div>
            <p>
              필요한 직원만 한 명씩 데려오시면 됩니다. 결제하시면 계정과 설치 안내를
              메일로 보내드립니다. 판매와 결제는 주식회사 메이크패밀리 스토어에서 진행됩니다.
            </p>
          </header>

          <ul className="hire-list motion-reveal">
            {hireRows.map((task) => {
              const purchase = task.externalDestination
                ? undefined
                : getPurchaseLink(task.employeeId);
              return (
                <li key={task.id} className={task.externalDestination ? "is-partner" : ""}>
                  <div className="hire-list__who">
                    <strong>{task.employee.name}</strong>
                    <small>{task.employee.role}</small>
                  </div>
                  <p className="hire-list__job">{task.label}</p>
                  <p className="hire-list__price">
                    {task.externalDestination
                      ? "외부 서비스에서 안내"
                      : formatPrice(purchase?.priceWon ?? null)}
                  </p>
                  <a
                    className="hire-list__cta"
                    href={task.externalDestination?.url || purchase?.url || STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {task.externalDestination?.ctaLabel || (purchase?.verified ? "스토어에서 데려오기" : "스토어에서 확인하기")}
                    <Icon name="arrow" />
                  </a>
                </li>
              );
            })}
          </ul>

          <div className="hire-note motion-reveal">
            <p>
              숏폼작가 윤미, 판서 나경, 알람앱 맥스도 같은 스토어에 있습니다.
              {" "}
              <a href={STORE_URL} target="_blank" rel="noopener noreferrer">스토어에서 전체 보기</a>
            </p>
            <p>
              AIMAX는 <strong>주식회사 메이크패밀리</strong>가 만들고 운영합니다.
              가격은 2026년 8월 스토어 기준이며, 최신 가격은 상품 페이지에서 확인하실 수 있습니다.
            </p>
          </div>
        </section>

        <section className="landing-final-cta motion-reveal">
          <div><span className="landing-kicker">한 번에 하나씩</span><h2>혼자 다 하던 방식에서,<br />하나씩 맡기는 방식으로.</h2></div>
          <div>
            <p>가장 손이 많이 가는 일 하나만 골라서, 그 일을 맡을 직원부터 데려와 보세요.</p>
            <a className="public-cta public-cta--light" href={STORE_URL} target="_blank" rel="noopener noreferrer">
              스토어에서 직원 데려오기 <Icon name="arrow" />
            </a>
            <a className="landing-final-cta__link" href={CONSOLE_LOGIN_URL}>
              이미 회원이라면 로그인 <Icon name="arrow" />
            </a>
          </div>
        </section>
      </main>

      {detailOpen && activeTask && activeDeliverable ? (
        <DeliverableDialog
          deliverable={activeDeliverable}
          employee={activeTask.employee}
          onClose={() => setDetailOpen(false)}
        />
      ) : null}

      <footer className="public-footer">
        <div className="public-brand"><span>AX</span><strong>AIMAX</strong></div>
        <div className="public-footer__company">
          <p>혼자 하던 일을, 맡길 수 있는 일로.</p>
          <p>
            주식회사 메이크패밀리 · 대표 윤동규 · 사업자등록번호 537-87-01496
          </p>
          <p>
            통신판매업신고 제2020-서울금천-0389호 · 고객센터 02-6672-7788
          </p>
        </div>
        <div className="public-footer__links">
          <a href={COMPANY_URL} target="_blank" rel="noopener noreferrer">메이크패밀리 홈</a>
          <a href={CONSOLE_LOGIN_URL}>이미 회원이라면 로그인</a>
        </div>
      </footer>
    </div>
  );
}
