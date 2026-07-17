import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(testsDir, "..");

function read(relativePath: string): string {
  return readFileSync(path.join(appRoot, relativePath), "utf8");
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = path.join(directory, entry);
    if (statSync(fullPath).isDirectory()) return sourceFiles(fullPath);
    return /\.(css|ts|tsx)$/.test(entry) ? [fullPath] : [];
  });
}

test("preview boundary is always visible and explicitly login-free", () => {
  const shell = read("src/components/AppShell.tsx");
  assert.match(shell, /LOCAL PREVIEW/);
  assert.match(shell, /로그인·서버·API 연결 없음/);
  assert.match(shell, /aria-label="로컬 프리뷰 안내"/);
});

test("preview source contains no runtime network primitive or remote URL", () => {
  const source = sourceFiles(path.join(appRoot, "src"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");

  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\bXMLHttpRequest\b/);
  assert.doesNotMatch(source, /\bWebSocket\b/);
  assert.doesNotMatch(source, /\bEventSource\b/);
  assert.doesNotMatch(source, /https?:\/\//);
});

test("core routes remain present in the shared shell contract", () => {
  const routes = read("src/lib/routes.ts");
  for (const route of ["home", "employees", "work", "connections", "help"]) {
    assert.match(routes, new RegExp(`id: "${route}"`));
  }
});

test("foundations, focus, and reduced-motion rules stay centralized", () => {
  const tokens = read("src/styles/tokens.css");
  const globalStyles = read("src/styles/global.css");

  for (const token of [
    "--color-brand",
    "--color-positive",
    "--color-warning",
    "--color-critical",
    "--space-4",
    "--radius-md",
    "--shadow-modal",
  ]) {
    assert.match(tokens, new RegExp(token));
  }

  assert.match(globalStyles, /:focus-visible/);
  assert.match(globalStyles, /prefers-reduced-motion: reduce/);
});

test("shell exposes skip navigation and current-page semantics", () => {
  const shell = read("src/components/AppShell.tsx");
  assert.match(shell, /className="skip-link"/);
  assert.match(shell, /href="#main-content"/);
  assert.match(shell, /aria-current=/);
  assert.match(shell, /<main id="main-content"/);
});
