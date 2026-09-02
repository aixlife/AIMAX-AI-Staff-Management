/**
 * 빌드된 dist/index.html 의 빈 <div id="root"></div> 자리에
 * 랜딩 첫 화면 HTML을 심습니다.
 *
 * 새 의존성 없이 vite 의 SSR 빌드(dist-ssr/entry-server.js)만 써서 렌더합니다.
 * 브라우저 없이 도는 순수 문자열 렌더라 빌드가 느려지지 않고, 결과 HTML은
 * 자바스크립트를 실행하지 않는 크롤러·공유 미리보기 봇도 그대로 읽습니다.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = path.join(appRoot, "dist", "index.html");
const serverEntry = path.join(appRoot, "dist-ssr", "entry-server.js");

for (const [label, target] of [
  ["클라이언트 빌드", htmlPath],
  ["서버 빌드", serverEntry],
]) {
  if (!existsSync(target)) {
    throw new Error(`${label} 결과가 없습니다: ${target}`);
  }
}

const { renderLanding } = await import(pathToFileURL(serverEntry).href);
const markup = renderLanding();

if (!markup || markup.length < 2000) {
  throw new Error(`랜딩 정적 HTML이 비어 있습니다 (길이 ${markup?.length ?? 0}).`);
}

const html = readFileSync(htmlPath, "utf8");
const rootTag = '<div id="root"></div>';
if (!html.includes(rootTag)) {
  throw new Error("dist/index.html 에서 root 자리를 찾지 못했습니다.");
}

writeFileSync(
  htmlPath,
  html.replace(rootTag, `<div id="root">${markup}</div>`),
  "utf8",
);

const sizeKb = (Buffer.byteLength(markup, "utf8") / 1024).toFixed(1);
console.log(`prerender: 랜딩 첫 화면 ${sizeKb}KB 를 dist/index.html 에 심었습니다.`);
