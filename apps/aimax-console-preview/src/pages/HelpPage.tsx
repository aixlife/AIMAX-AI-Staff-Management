import { useState, type FormEvent } from "react";

import { Icon } from "../components/Icon";
import { StatusBadge } from "../components/StatusBadge";
import type { FixtureSet } from "../types";

interface HelpPageProps {
  fixture: FixtureSet;
  onPreviewNotice: (message: string) => void;
}

export function HelpPage({ fixture, onPreviewNotice }: HelpPageProps) {
  const [receipt, setReceipt] = useState<string | null>(null);

  const submitPreviewReport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    setReceipt("LOCAL-PREVIEW-" + String(fixture.scenario).toUpperCase());
    form.reset();
  };

  return (
    <div className="page-stack">
      <section className="support-hero">
        <div>
          <p className="eyebrow">SUPPORT &amp; RECOVERY</p>
          <h2>문제가 생겼을 때 원인과 다음 행동을 함께 보여줍니다.</h2>
          <p>
            업데이트, 연결, 오류 보고를 한곳에서 찾되 작업 결과 화면에서도 같은
            도움 경로를 제공합니다.
          </p>
        </div>
        <div className="support-status">
          <StatusBadge label="프리뷰 정상" tone="positive" dot />
          <span>서버 진단은 연결하지 않음</span>
        </div>
      </section>

      <div className="support-grid">
        <section className="surface" aria-labelledby="error-report-heading">
          <div className="section-heading section-heading--compact">
            <div>
              <p className="eyebrow">ERROR REPORT</p>
              <h2 id="error-report-heading">오류 보고 미리보기</h2>
            </div>
          </div>
          <form className="support-form" onSubmit={submitPreviewReport}>
            <div className="field">
              <label htmlFor="support-context">어떤 작업 중이었나요?</label>
              <input
                id="support-context"
                name="context"
                required
                placeholder="예: 송이 경쟁사 조사 결과를 열던 중"
              />
            </div>
            <div className="field">
              <label htmlFor="support-error">보이는 오류 메시지</label>
              <textarea
                id="support-error"
                name="error"
                required
                rows={4}
                placeholder="화면에 표시된 문구를 적어주세요."
              />
            </div>
            <div className="notice notice--info notice--compact">
              <Icon name="check" />
              <div>
                <strong>민감정보 제외</strong>
                <p>실제 제품에서도 비밀번호·API 키·토큰 원문은 수집하지 않습니다.</p>
              </div>
            </div>
            <button className="button button--primary" type="submit">
              로컬 접수 상태 만들기
            </button>
          </form>

          <div className="receipt-region" aria-live="polite">
            {receipt ? (
              <div className="preview-receipt">
                <Icon name="check" />
                <div>
                  <strong>로컬 접수 미리보기가 생성됐습니다</strong>
                  <span>{receipt} · 서버 전송 없음</span>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="support-aside" aria-label="지원 정보">
          <section className="support-card">
            <div className="support-card__icon">
              <Icon name="settings" />
            </div>
            <div>
              <h3>앱과 실행기 업데이트</h3>
              <p>웹·Windows·macOS 상태를 구분하고 필요한 경우에만 설치 안내를 표시합니다.</p>
            </div>
            <button
              className="text-button"
              type="button"
              onClick={() =>
                onPreviewNotice(
                  "업데이트 기준은 Phase 2에서 현재 배포·실행기 규칙과 대조합니다.",
                )
              }
            >
              업데이트 기준
              <Icon name="arrow" />
            </button>
          </section>

          <section className="support-card">
            <div className="support-card__icon">
              <Icon name="connections" />
            </div>
            <div>
              <h3>연결 문제 해결</h3>
              <p>키 원문 없이 연결 상태·환경·요청 ID를 기준으로 복구합니다.</p>
            </div>
            <button
              className="text-button"
              type="button"
              onClick={() =>
                onPreviewNotice(
                  "연결 점검 가이드는 실제 공급자 상태 계약을 보존해 연결할 예정입니다.",
                )
              }
            >
              연결 점검 순서
              <Icon name="arrow" />
            </button>
          </section>

          <section className="support-card">
            <div className="support-card__icon">
              <Icon name="help" />
            </div>
            <div>
              <h3>내 문의와 처리 상태</h3>
              <p>접수·확인 중·사용자 확인 필요·완료 상태와 다음 행동을 함께 보여줍니다.</p>
            </div>
            <button
              className="text-button"
              type="button"
              onClick={() =>
                onPreviewNotice(
                  "문의 이력은 기존 오류 보고 API와 parity 확인 후 연결합니다.",
                )
              }
            >
              처리 상태 보기
              <Icon name="arrow" />
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
