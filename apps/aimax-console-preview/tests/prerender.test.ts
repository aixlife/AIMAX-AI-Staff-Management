import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath: string): string {
  return readFileSync(path.join(appRoot, relativePath), "utf8");
}

test("landing is prerendered into the build without extra dependencies", () => {
  const packageJson = JSON.parse(read("package.json")) as {
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
  };

  // 프리렌더는 vite 의 SSR 빌드만 씁니다 — 런타임 의존성은 그대로입니다.
  assert.deepEqual(Object.keys(packageJson.dependencies).sort(), ["react", "react-dom"]);
  assert.match(packageJson.scripts.build, /build:client/);
  assert.match(packageJson.scripts.build, /build:ssr/);
  assert.match(packageJson.scripts.build, /prerender/);
  assert.match(packageJson.scripts["build:ssr"], /src\/entry-server\.tsx/);

  const entryServer = read("src/entry-server.tsx");
  assert.match(entryServer, /renderToString/);
  assert.match(entryServer, /initialView="landing"/);

  const prerender = read("scripts/prerender.mjs");
  assert.match(prerender, /<div id="root"><\/div>/);
  assert.match(prerender, /dist-ssr/);
});

test("the client hydrates the prerendered landing instead of redrawing it", () => {
  const main = read("src/main.tsx");
  assert.match(main, /hydrateRoot/);
  assert.match(main, /container\.hasChildNodes\(\)/);
  assert.match(main, /initialView === "landing"/);

  // 해시로 바로 들어온 운영실 화면은 프리렌더 HTML과 다르므로 새로 그립니다.
  assert.match(main, /createRoot/);

  const app = read("src/App.tsx");
  assert.match(app, /initialView\?: AppView/);
  assert.match(app, /useState<AppView>\(initialView\)/);
  assert.doesNotMatch(app, /useState\(\(\) => viewFromHash/);
});

test("the public shell carries the search and share metadata", () => {
  const html = read("index.html");

  assert.match(html, /<html lang="ko">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/aimax\.ai\.kr\/">/);
  assert.match(html, /<meta name="robots" content="index,follow/);
  assert.doesNotMatch(html, /noindex/);
  assert.match(html, /<meta name="description" content="[^"]{40,}"/);

  for (const property of [
    "og:type",
    "og:url",
    "og:title",
    "og:description",
    "og:image",
    "og:image:width",
    "og:image:height",
    "og:locale",
  ]) {
    assert.match(html, new RegExp(`property="${property}"`), `빠진 공유 태그: ${property}`);
  }
  assert.match(html, /content="https:\/\/aimax\.ai\.kr\/assets\/og-cover\.png"/);
  assert.match(html, /content="1200"/);
  assert.match(html, /content="630"/);

  // 소유 확인 태그는 값 발급 전까지 주석으로만 둡니다.
  assert.match(html, /naver-site-verification/);
  assert.match(html, /google-site-verification/);

  const robots = read("public/robots.txt");
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Sitemap: https:\/\/aimax\.ai\.kr\/sitemap\.xml/);

  const sitemap = read("public/sitemap.xml");
  assert.match(sitemap, /<loc>https:\/\/aimax\.ai\.kr\/<\/loc>/);
});
