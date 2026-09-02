import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";

import { App } from "./App";
import { LiveRoot } from "./LiveRoot";
import { viewFromHash } from "./lib/routes";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/components.css";
import "./styles/pages.css";
import "./styles/landing.css";
import "./styles/live.css";

const container = document.getElementById("root")!;

/**
 * 빌드 모드 분기.
 * - 기본(프리뷰): 공개 랜딩 + 로컬 픽스처 운영실. 네트워크 호출 없음.
 * - live: 실 API에 연결된 운영실 베타 (`npm run build:live`, /app2 배포용).
 */
if (import.meta.env.VITE_CONSOLE_MODE === "live") {
  container.innerHTML = "";
  createRoot(container).render(
    <StrictMode>
      <LiveRoot />
    </StrictMode>,
  );
} else {
  const initialView = viewFromHash(window.location.hash);
  /** 빌드 때 심어 둔 랜딩 정적 HTML이 그대로 있으면 새로 그리지 않고 이어받습니다. */
  const canHydrate = initialView === "landing" && container.hasChildNodes();

  const tree = (
    <StrictMode>
      <App initialView={initialView} />
    </StrictMode>
  );

  if (canHydrate) {
    hydrateRoot(container, tree);
  } else {
    container.innerHTML = "";
    createRoot(container).render(tree);
  }
}
