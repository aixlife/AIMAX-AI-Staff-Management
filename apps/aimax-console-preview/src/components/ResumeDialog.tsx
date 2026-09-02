import type { Employee } from "../types";
import { EmployeePortrait } from "./EmployeePortrait";
import { Modal } from "./Modal";

interface ResumeDialogProps {
  employee: Employee;
  onClose: () => void;
  onHire: (employee: Employee) => void;
}

export function ResumeDialog({ employee, onClose, onHire }: ResumeDialogProps) {
  const resume = employee.resume;

  if (!resume) {
    return (
      <Modal
        title={employee.name + " 직원 프로필"}
        description="정식 이력서가 아직 준비되지 않았습니다."
        labelId="employee-resume-title"
        onClose={onClose}
        footer={
          <button className="button button--secondary" type="button" onClick={onClose}>
            닫기
          </button>
        }
      >
        <div className="resume-pending">
          <EmployeePortrait employee={employee} size="large" />
          <div>
            <strong>{employee.role}</strong>
            <p>{employee.summary}</p>
            <span>이름·사진·경력 확정 전에는 공개 채용관에 노출하지 않습니다.</span>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={employee.name + " 입사 지원서"}
      description={resume.team + " · " + employee.role}
      labelId="employee-resume-title"
      className="modal-panel--resume"
      onClose={onClose}
      footer={
        <div className="resume-dialog__actions">
          <span>LOCAL PREVIEW · 실제 실행 없음</span>
          <div className="button-row">
            <button className="button button--secondary" type="button" onClick={onClose}>
              닫기
            </button>
            <button className="button button--primary" type="button" onClick={() => onHire(employee)}>
              {employee.name}에게 업무 맡기기
            </button>
          </div>
        </div>
      }
    >
      <article className="resume-sheet">
        <header className="resume-sheet__document-head">
          <div><span>AIMAX AI 직원 채용 서류</span><h3>입 사 지 원 서</h3></div>
          <strong>AI 직원</strong>
        </header>

        <section className="resume-sheet__identity" aria-labelledby="resume-personal-title">
          <EmployeePortrait employee={employee} size="hero" className="resume-id-photo" decorative={false} />
          <div className="resume-sheet__identity-main">
            <h4 id="resume-personal-title">인적사항</h4>
            <dl className="resume-sheet__facts">
              <div className="resume-fact--name"><dt>성명</dt><dd>{employee.name} <small>AI 직원</small></dd></div>
              <div><dt>지원분야</dt><dd>{employee.role}</dd></div>
              <div><dt>사번</dt><dd>{resume.employeeNo}</dd></div>
              <div><dt>경력</dt><dd>{resume.experience}</dd></div>
              <div><dt>소속</dt><dd>{resume.team}</dd></div>
              <div><dt>출신</dt><dd>{resume.hometown}</dd></div>
              <div className="resume-fact--wide"><dt>전 직장</dt><dd>{resume.formerRole}</dd></div>
            </dl>
            <blockquote className="resume-sheet__statement">“{resume.statement}”</blockquote>
          </div>
        </section>

        <section className="resume-section resume-section--intro">
          <div className="resume-section__title"><span>자기소개</span><small>업무 성향 및 지원 동기</small></div>
          <p className="resume-intro">{resume.intro}</p>
        </section>

        <div className="resume-sheet__columns">
          <section className="resume-section">
            <div className="resume-section__title"><span>경력사항</span><small>주요 업무 이력</small></div>
            <div className="resume-career">
              {resume.career.map((career) => (
                <div key={career.period + career.org} className="resume-career__item">
                  <span>{career.period}</span>
                  <div><strong>{career.org}</strong><p>{career.note}</p></div>
                </div>
              ))}
            </div>
          </section>
          <section className="resume-section">
            <div className="resume-section__title"><span>보유기술</span><small>업무 숙련도 · 5점 기준</small></div>
            <div className="resume-skills">
              {resume.skills.map((skill) => (
                <div key={skill.label} className="resume-skill">
                  <strong>{skill.label}</strong>
                  <span className="resume-skill__dots" aria-label={skill.score + "점 / 5점"}>
                    {[1, 2, 3, 4, 5].map((score) => (
                      <i key={score} className={score <= skill.score ? "is-filled" : ""} />
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="resume-sheet__closing">
          <section>
            <span>추천사</span>
            <blockquote>“{resume.reference.quote}”</blockquote>
            <small>— {resume.reference.from}</small>
          </section>
          <section>
            <span>면접 메모</span>
            <blockquote>“{resume.interviewLine}”</blockquote>
            <small>— {employee.name}, {employee.role}</small>
          </section>
        </div>

        <div className="resume-sheet__certification">
          <p>위 내용은 AIMAX 직원 역할과 업무 성향을 설명하기 위해 작성되었습니다.</p>
          <span>지원자&nbsp;&nbsp; {employee.name} <small>(AI 직원)</small></span>
        </div>

        <p className="resume-sheet__disclosure">
          ※ 실제 사람이 아닌, 역할 이해를 돕기 위해 만든 가상의 AI 직원 입사지원서입니다.
        </p>
      </article>
    </Modal>
  );
}
