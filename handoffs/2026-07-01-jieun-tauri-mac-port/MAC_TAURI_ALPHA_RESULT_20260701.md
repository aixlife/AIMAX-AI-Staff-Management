# 지은 Tauri macOS 알파 작업 결과 - 2026-07-01

## Summary

- 사용자가 Electron이 아닌 Tauri 기반 macOS 버전 진행을 승인했다.
- `aimax-viseo` Windows v0.1.6 종료 버튼 브랜치 기준으로 Tauri macOS 알파 브랜치를 로컬에 구성했다.
- macOS Apple Silicon에서 `.app` 빌드와 첫 실행 렌더링까지 확인했다.
- 원격 GitHub push, AIMAX 카탈로그 변경, 프로덕션 배포/릴리스는 아직 하지 않았다.

## Decisions

- 앱 런타임: Tauri v2
- 1차 대상: macOS Apple Silicon
- 첫 알파 버전: `0.2.0`
- paid AI 기능: 알파 빌드에서 비활성화
- 화면 녹화: 알파 빌드에서 비활성화
- Windows 종료 버튼: macOS에서는 비활성화 메시지 처리

## Source State

- 작업 클론: `/private/tmp/aimax-viseo-tauri`
- 작업 브랜치: `feature/jieun-tauri-macos-v017`
- 기준 브랜치: `origin/feature/windows-shutdown-button`
- 기준 커밋: `7707a04 Add Windows shutdown button`

## Implemented

- Tauri 프로젝트 스캐폴드 추가: `src-tauri/`
- React renderer를 Tauri에서 빌드하는 `vite.tauri.config.ts` 추가
- Electron preload API와 호환되는 공유 타입 `src/shared/viseobarApi.ts` 추가
- Tauri 런타임 브리지 `src/renderer/runtime/viseobarApi.ts` 추가
- macOS 기본 캡처 기능을 Rust 명령으로 연결
- 메모 저장/불러오기, 캐릭터 선택 저장, 창 이동/확장/축소, 외부 URL 열기 연결
- macOS에서 Windows 전용 종료 기능은 안전하게 비활성화
- Tauri 알파 문서 `docs/tauri-macos-alpha.md` 추가

## Verification

- `npm install` 성공
- `npm run build:tauri-renderer` 성공
- `npx tsc --noEmit` 성공
- `cargo check` 성공
- `npm run tauri:build` 성공
- `.app` 첫 실행 성공
- 스크린샷으로 플로팅 캐릭터 창 렌더링 확인

## Artifacts

- 소스 스냅샷: `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/handoffs/2026-07-01-jieun-tauri-mac-port/aimax-viseo-tauri-macos-v017-source-20260701.tgz`
- 소스 스냅샷 SHA256: `4114cfcde1bee1ec83c995a97f38daca33fe708a7f060dc7d098fad34420d521`
- 실행 확인 스크린샷: `/Users/aixlife/Projects/AIMAX-AI-Staff-Management/handoffs/2026-07-01-jieun-tauri-mac-port/jieun-tauri-alpha-launch-20260701.png`
- 로컬 `.app`: `/private/tmp/aimax-viseo-tauri/src-tauri/target/release/bundle/macos/AIMAX Office Manager.app`
- 수동 테스트 DMG: `/private/tmp/aimax-viseo-tauri/src-tauri/target/release/bundle/AIMAX-Office-Manager-tauri-0.2.0-aarch64.dmg`
- 수동 테스트 DMG SHA256: `4628304aaff8251c31064ddb5edb4e26d37ad86653074ff482489e0a5988e55b`

## Known Limits

- DMG는 수동 테스트용이며 Apple 서명/공증/notarization이 없다.
- Tauri 기본 DMG bundler는 현재 환경에서 실패해, 알파 빌드는 `.app` 타깃으로 고정했다.
- macOS 접근성 권한이 없어 자동 클릭 기반 메뉴 테스트는 진행하지 못했다.
- 화면 녹화, Claude/OpenAI paid AI 호출, 전체 UI 회귀는 다음 단계에서 별도 승인 후 검증해야 한다.
- Naver/paid provider live smoke test는 실행하지 않았다.

## Next Actions

1. `aimax-viseo` 원격 GitHub에 `feature/jieun-tauri-macos-v017` 브랜치를 push한다.
2. macOS 권한 플로우를 실제 사용자 관점에서 점검한다: Screen Recording, Accessibility, Downloads/Desktop 접근.
3. 캡처/메모/캐릭터 메뉴를 수동 또는 Playwright 보조 방식으로 더 깊게 검증한다.
4. Apple Developer ID 서명/공증 전략을 정한다.
5. AIMAX 카탈로그에 macOS 다운로드를 추가할지 별도 승인받은 뒤 반영한다.
