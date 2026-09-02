/**
 * 정적 프리렌더용 서버 진입점입니다.
 *
 * 랜딩은 검색엔진과 공유 미리보기가 자바스크립트 없이도 읽을 수 있어야 하므로,
 * 빌드 뒤 이 모듈을 노드에서 실행해 첫 화면 HTML을 만들어 dist/index.html 에 심습니다.
 * 브라우저 전용 API는 전부 이펙트 안에 있어 서버 렌더에서는 실행되지 않습니다.
 */
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";

import { App } from "./App";

/** 첫 화면(랜딩)을 문자열 HTML로 만듭니다. */
export function renderLanding(): string {
  return renderToString(
    <StrictMode>
      <App initialView="landing" />
    </StrictMode>,
  );
}
