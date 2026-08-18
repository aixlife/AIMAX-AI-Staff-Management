#!/usr/bin/env node
// 스모크: 이미지 모델 선택 화면이 "그림 안 한글이 깨지는 모델"을 고르는 순간 알려주는지 검증한다.
//
// 배경 (2026-08-18): 이미지 안의 한글을 제대로 그리는 모델은 gpt-image-2 뿐이다.
// 나머지로 글자 있는 그림을 만들면 "디져트 에약", "앤딩머세오 라담젼뎍가" 처럼 깨진 채
// 블로그에 그대로 발행된다. 서버에서 사후 경고를 남기는 것만으로는 늦어서,
// 고르는 화면에서 바로 보이게 했다.
//
// 실행: node scripts/smoke_image_model_korean_hint.mjs

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(repoRoot, "oracle/aimax-reports-api/static/app.html"), "utf8");

let passed = 0;
let failed = 0;
function check(name, actual, expected) {
  if (actual === expected) {
    passed += 1;
    console.log(`  PASS  ${name}  (=${actual})`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}  expected=${expected} actual=${actual}`);
  }
}

console.log("[1] 선택지 라벨과 안내 함수가 앱에 들어 있다");
check("한글 가능 모델 집합 존재", html.includes("IMAGE_MODELS_WITH_KOREAN_TEXT"), true);
check("라벨에 안내 붙임", html.includes("imageModelKoreanTextNote(id)"), true);
check("셀렉트 아래 힌트 렌더", html.includes("renderImageModelKoreanHint"), true);
check("gpt-image-2 가 한글 가능 목록에", html.includes('new Set(["gpt-image-2"])'), true);

console.log("[2] 안내 로직을 실제로 실행해 본다");
// 앱 스크립트에서 필요한 조각만 떼어 실행한다(브라우저 DOM 없이 순수 로직 확인).
const snippet = html.match(/const IMAGE_MODELS_WITH_KOREAN_TEXT[\s\S]*?\n    }\n/);
check("안내 로직 추출", Boolean(snippet), true);
const ctx = { result: {} };
vm.createContext(ctx);
vm.runInContext(`${snippet[0]}\nresult.note = imageModelKoreanTextNote;`, ctx);
check("gpt-image-2 → 한글 가능", ctx.result.note("gpt-image-2"), "그림 안 한글 가능");
check("gpt-image-1 → 한글 깨짐", ctx.result.note("gpt-image-1"), "그림 안 한글 깨짐");
check("gemini nano banana 2 → 한글 깨짐", ctx.result.note("gemini-3.1-flash-image"), "그림 안 한글 깨짐");
check("gemini pro → 한글 깨짐", ctx.result.note("gemini-3-pro-image"), "그림 안 한글 깨짐");

console.log("[3] 깨지는 모델에는 대안까지 알려준다");
check("gpt-image-2 로 바꾸라는 안내 포함", html.includes("그림에 한글이 꼭 필요하면 gpt-image-2를 골라주세요"), true);
check("왜 글자 그림을 안 만드는지 설명", html.includes("글자가 들어가는 그림(주문서 화면, 안내판 등)은 만들지 않고"), true);

console.log(`\n결과: PASS ${passed} / FAIL ${failed}`);
process.exit(failed === 0 ? 0 : 1);
