# Windows 핸드오프 — Phase C: split_version 포크 통합 + Tcl 픽스 검증

- 날짜: 2026-06-05
- 브랜치: refactor/c-split-fork-merge (커밋 4c99aa1)
- macOS: 통합·3모드·Tcl 픽스 모두 PASS. Windows만 실기기 검증 필요.

## 무엇이 바뀌었나

1. split_version/app.py(루트 복사본+APP_MODE)를 루트 app.py로 통합. 단일 app.py 가
   APP_MODE 로 통합앱(all)/기능별 앱(find·engage_write)으로 동작. "all" 문구는 기존
   메인앱 그대로 보존(동작 불변).
2. 런처 4개 + build_split.py 를 split_version/ → 루트로 이동. split_version/ 삭제.
3. `_ensure_tcl_tk_library()` 추가(app.py 상단): uv/venv 로 실행 시 Tk() 가 base Python
   의 tcl/tk(init.tcl)를 못 찾아 크래시하던 문제 보정. macOS/Linux(`base/lib/tcl8.*`) +
   Windows(`base/tcl/tcl8.*`) 양쪽 탐색. PyInstaller 프리즌은 가드로 제외.

## 가장 중요한 검증 포인트 (Windows Tcl 픽스)

Phase B(uv 전환) 의 uv 경로에서, 맥에선 venv 의 tkinter Tk() 가 init.tcl 을 못 찾아
크래시했다(맥 검증으로 발견). Windows uv venv 도 같은 문제가 있을 수 있어 #3 픽스를 넣었다.
**Windows uv 경로에서 앱 GUI 가 실제로 뜨는지**가 핵심.

1. 클린: 프로젝트의 `venv\`, `.venv\` 삭제.
2. `setup.bat` 실행(= Phase B uv 경로). 관리형 Python 다운로드 후 `uv run python app.py`.
3. 기대: **GUI 창이 정상으로 뜬다**(= Tk 정상 = Tcl 픽스 동작). 크래시 시 콘솔에
   `Can't find a usable init.tcl` 가 보이면 픽스의 Windows 경로 탐색 실패 → 회신 요망.
4. 점검:
   ```
   uv run python -c "import app, os; import tkinter; r=tkinter.Tk(); print('TK OK', os.environ.get('TCL_LIBRARY')); r.destroy()"
   ```
   `TK OK` + TCL_LIBRARY 경로 출력되어야 함.

## split 기능별 앱 검증 (선택, 권장)

루트에서:
```
uv run python app_find.py          # 현주씨 영업사원, find 패널만
uv run python app_engage_write.py  # 예리씨 글쓰기, engage+write 패널만
python build_split.py --help       # 루트 build.py 연결 확인
```
- find 앱: 제목 "AIMAX-현주씨-영업사원", 사이드바 "현주씨", nav 1개.
- engage_write 앱: 제목 "AIMAX-예리씨-블로그글쓰기", engage/write 만.
- 메인앱(`uv run python app.py`): 사이드바 "블로거 예리님", nav 3개, 전체 패널(기존 그대로).

## 회신 양식
- 메인앱 GUI 기동(Tcl 픽스): PASS / FAIL(`init.tcl` 에러?)
- TCL_LIBRARY 경로: ____
- find 앱 / engage_write 앱: PASS / FAIL
- 네이버 발행 1회 회귀: PASS / FAIL
