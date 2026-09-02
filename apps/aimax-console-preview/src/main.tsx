import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";

import { App } from "./App";
import { viewFromHash } from "./lib/routes";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/components.css";
import "./styles/pages.css";
import "./styles/landing.css";

const container = document.getElementById("root")!;
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
