import { useMemo, useState } from "react";

import { ConnectionCard } from "../components/ConnectionCard";
import { Icon } from "../components/Icon";
import { Modal } from "../components/Modal";
import {
  connectionStatusLabel,
  connectionStatusTone,
  StatusBadge,
} from "../components/StatusBadge";
import type { Connection, ConnectionCategory, FixtureSet } from "../types";

const categoryCopy: Record<
  ConnectionCategory,
  { title: string; description: string }
> = {
  ai: {
    title: "AI 모델",
    description: "글쓰기·분석·이미지 생성에 사용하는 공급자 연결",
  },
  data: {
    title: "이미지·데이터",
    description: "공개 자료와 무료 이미지 검색에 사용하는 선택 연결",
  },
  runtime: {
    title: "실행 환경",
    description: "브라우저 자동화와 로컬 파일 작업을 위한 실행기",
  },
};

export function ConnectionsPage({ fixture }: { fixture: FixtureSet }) {
  const [selected, setSelected] = useState<Connection | null>(null);
  const connected = fixture.connections.filter(
    (connection) => connection.status === "connected",
  ).length;
  const attention = fixture.connections.filter(
    (connection) => connection.status === "attention",
  ).length;

  const grouped = useMemo(
    () =>
      (["ai", "data", "runtime"] as ConnectionCategory[]).map((category) => ({
        category,
        connections: fixture.connections.filter(
          (connection) => connection.category === category,
        ),
      })),
    [fixture.connections],
  );

  return (
    <div className="page-stack">
      <section className="connection-overview">
        <div>
          <p className="eyebrow">CONNECTION CENTER</p>
          <h2>필요할 때만 연결하고, 원문 키는 다시 보여주지 않습니다.</h2>
          <p>
            Phase 1은 상태 카드만 검토합니다. 키 입력·저장·검증은 실제 AIMAX API
            연동 단계 전까지 포함하지 않습니다.
          </p>
        </div>
        <div className="connection-stats">
          <div>
            <strong>{connected}</strong>
            <span>연결됨</span>
          </div>
          <div>
            <strong>{fixture.connections.length - connected - attention}</strong>
            <span>선택 연결</span>
          </div>
          <div className={attention ? "has-attention" : ""}>
            <strong>{attention}</strong>
            <span>확인 필요</span>
          </div>
        </div>
      </section>

      <div className="notice notice--info">
        <Icon name="settings" />
        <div>
          <strong>프리뷰 안전 경계</strong>
          <p>이 화면에는 API 키 입력란이 없으며, 버튼을 눌러도 외부 네트워크에 연결하지 않습니다.</p>
        </div>
      </div>

      {grouped.map(({ category, connections }) => (
        <section key={category} aria-labelledby={"connection-" + category}>
          <div className="section-heading">
            <div>
              <h2 id={"connection-" + category}>{categoryCopy[category].title}</h2>
              <p>{categoryCopy[category].description}</p>
            </div>
          </div>
          <div className="connection-grid">
            {connections.map((connection) => (
              <ConnectionCard
                key={connection.id}
                connection={connection}
                onInspect={setSelected}
              />
            ))}
          </div>
        </section>
      ))}

      {selected ? (
        <Modal
          title={selected.name}
          description="연결 화면의 정보 구조만 확인하는 로컬 프리뷰입니다."
          onClose={() => setSelected(null)}
          labelId="connection-dialog-title"
          footer={
            <button
              className="button button--secondary"
              type="button"
              onClick={() => setSelected(null)}
            >
              닫기
            </button>
          }
        >
          <div className="connection-dialog">
            <div className="connection-dialog__status">
              <span>현재 상태</span>
              <StatusBadge
                label={connectionStatusLabel(selected.status)}
                tone={connectionStatusTone(selected.status)}
                dot
              />
            </div>
            <div className="connection-dialog__row">
              <span>사용 범위</span>
              <strong>{selected.summary}</strong>
            </div>
            <div className="connection-dialog__row">
              <span>안전 안내</span>
              <strong>{selected.usage}</strong>
            </div>
            <div className="notice notice--warning">
              <Icon name="alert" />
              <div>
                <strong>실제 키 입력은 잠겨 있습니다</strong>
                <p>사용자 승인 뒤 기존 암호화 API와 status-only 응답을 연결합니다.</p>
              </div>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
