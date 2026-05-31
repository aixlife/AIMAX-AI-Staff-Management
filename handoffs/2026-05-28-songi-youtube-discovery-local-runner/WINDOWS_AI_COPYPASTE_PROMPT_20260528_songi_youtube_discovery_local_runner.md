Windows AI 작업 요청입니다.

먼저 아래 handoff 문서를 읽어주세요:
/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/2026-05-28-songi-youtube-discovery-local-runner/WINDOWS_HANDOFF_20260528_songi_youtube_discovery_local_runner.md

작업 요약:
- Songi 키워드 후보 찾기를 YouTube Data API 기본값에서 로컬 실행기 yt-dlp no-download 방식으로 바꾼 소스가 들어 있습니다.
- 이번 업데이트에는 키워드로 찾기/링크로 분석 탭 페이지 분리, 8개 이상 후보용 카드 보드 UI, 최신 실행기 상태 선택 버그 수정, headless local_agent/runtime.py 명령 처리 추가가 포함됩니다.
- 특히 송이 화면은 이제 프로젝트/프로필/주제 공통 입력 뒤에 탭이 나오는 구조가 아닙니다. 송이 제목 바로 아래에 탭이 먼저 나오고, 키워드로 찾기는 별도 작업 페이지, 링크로 분석은 기존 링크 분석 워크플로우로 분리되어야 합니다.
- Syncthing shared folder 안에서 빌드하지 말고, source-files를 Windows 로컬 작업 폴더로 복사한 뒤 적용/검증하세요.
- secrets, passphrases, cookies, customer data는 Syncthing에 넣지 마세요.
- paid Apify/Gemini/YouTube API 호출 금지. yt-dlp는 --skip-download 메타데이터 확인만 허용.

필수 검증:
1. python -m py_compile app.py split_version/app.py local_agent/runtime.py scripts/dev_songi_discovery_runner.py
2. node --check oracle/aimax-reports-api/server.js
3. node --check scripts/smoke_songi_discovery.mjs
4. node scripts/smoke_songi_discovery.mjs -> SONGI_DISCOVERY_SMOKE_OK
5. 가능하면 yt-dlp --skip-download --flat-playlist --no-warnings --dump-json --playlist-end 3 "ytsearch3:AI 직원"
6. 실제 웹 UI에서 작업 > 송이 확인:
   - 기본 탭은 키워드로 찾기
   - 송이 제목 바로 아래에 탭이 먼저 보이고, 프로젝트/프로필/카테고리/주제 입력이 탭보다 위에 있지 않음
   - 키워드로 찾기와 링크로 분석이 서로 다른 작업 페이지처럼 분리되어 보임
   - 키워드로 찾기에는 저장 프로젝트/키워드/최근성/후보 수/결과 카드가 보이고, 프로필/카테고리/주제 입력은 보이지 않음
   - 링크로 분석에는 기존 프로젝트/프로필/카테고리/주제/링크/송이에게 지시 흐름이 보임
   - 로컬/yt-dlp ready 상태가 보임
   - 8개 이상 후보 카드가 그리드로 보이고 텍스트 넘침이 없음
   - 후보 가져오기 후 link_fetch_status youtube_discovery 확인

결과는 같은 shared folder에 WINDOWS_RESULT_20260528_songi_youtube_discovery_local_runner.md로 돌려주세요. 명령 출력, yt-dlp 버전, UI 증거, no-paid/no-API 확인, blocker를 포함해주세요.
