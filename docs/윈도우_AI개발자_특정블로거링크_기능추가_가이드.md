# 윈도우 버전 기능 추가 가이드: 특정 블로거 링크 기반 서이추

## 목적

맥 버전에 추가된 **특정 블로거 링크** 기능을 윈도우 버전에도 동일하게 이식한다.

사용자가 원하는 네이버 블로거 링크 또는 블로그 ID를 입력하면:

1. 블로거 ID를 추출한다.
2. 해당 블로거의 공개 이웃 목록에 접속한다.
3. 이웃 목록에서 블로그 ID 후보를 수집한다.
4. 기존 서로이웃 신청 로직을 재사용해 후보들에게 서이추를 보낸다.

## 사용자가 입력할 수 있어야 하는 값

아래 형식 모두 허용한다.

```text
https://blog.naver.com/example123
https://m.blog.naver.com/example123
https://m.blog.naver.com/PostView.naver?blogId=example123&logNo=...
example123
```

## 핵심 URL

특정 블로거의 모바일 이웃 목록은 아래 URL을 사용한다.

```text
https://m.blog.naver.com/BuddyList.naver?blogId={blog_id}
```

단, 블로거가 이웃 목록을 비공개로 했거나 네이버가 접근을 제한하면 수집 결과가 없을 수 있다. 이 경우 오류로 죽지 말고 사용자에게 “이웃 목록이 비공개이거나 접근 제한됨”이라고 안내한다.

## 수정 대상 파일

맥 버전 기준 변경 파일은 3개다.

```text
app.py
scraper/follower_scraper.py
engagement/auto_neighbor.py
```

윈도우 버전의 파일 구조가 같다면 같은 위치에 반영하면 된다.

## 1. scraper/follower_scraper.py 구현

기존 스텁이 있다면 `NotImplementedError`를 제거하고 실제 수집 로직으로 교체한다.

필수 공개 함수:

```python
def extract_blogger_id_from_url(url: str) -> str | None:
    """블로그 URL 또는 ID에서 blog_id 추출"""
```

```python
def scrape_follower_ids(
    driver,
    blogger_url: str,
    max_count: int = 30,
    include_neighbors: bool = True,
    include_mutual: bool = True,
    stop_event=None,
) -> list[str]:
    """특정 블로거의 공개 이웃 목록에서 blog_id 후보 수집"""
```

구현 요건:

- `blogId=` query 파라미터가 있으면 그 값을 우선 사용한다.
- `blog.naver.com/{id}`, `m.blog.naver.com/{id}`, ID 단독 입력을 모두 처리한다.
- 내부 네이버 경로명은 후보에서 제외한다.
  - 예: `PostView`, `PostList`, `BuddyList`, `BuddyAddFormBridge`, `login`, `search` 등
- 후보 ID는 중복 제거하고 등장 순서를 유지한다.
- 수집 대상 블로거 본인 ID는 후보에서 제외한다.
- 페이지에서 “더보기”, “더 보기”, “다음” 버튼이 있으면 클릭한다.
- 버튼이 없으면 스크롤로 추가 로딩을 유도한다.
- `stop_event`가 set되면 즉시 중단한다.

수집 방식:

- Selenium driver로 `https://m.blog.naver.com/BuddyList.naver?blogId={blog_id}` 접속
- `driver.page_source`에서 아래 패턴들을 추출
  - `?blogId=some_id`
  - `"blogId": "some_id"`
  - `https://m.blog.naver.com/some_id`
  - `https://blog.naver.com/some_id`

## 2. engagement/auto_neighbor.py에 후보 ID 직접 신청 함수 추가

기존 키워드 기반 함수 `auto_neighbor()`는 그대로 둔다.

새 함수만 추가한다.

```python
def auto_neighbor_to_blog_ids(
    driver,
    blog_ids,
    max_requests=10,
    message=None,
    naver_id=None,
    naver_pw=None,
    stop_event=None,
    messages=None,
    speed_mode="normal",
    cooldown_every=10,
    daily_limit=80,
    source_label="특정 블로거",
):
    """이미 수집된 blog_id 목록에 서로이웃 신청"""
```

구현 요건:

- 기존 `send_neighbor_request()`를 그대로 재사용한다.
- 기존 멘트 랜덤 선택 로직을 그대로 재사용한다.
  - `messages` 리스트 중 랜덤 선택
  - `{닉네임}` 또는 `{nickname}`은 대상 blog_id로 치환
- 기존 속도 모드, Cool-down, 일일 상한 로직을 동일하게 적용한다.
- `max_requests`는 “성공 신청 수” 기준이다.
  - 이미 이웃, 신청 불가, 비공개 등 실패 건은 성공 수에 포함하지 않는다.
- `neighbor_quota.increment(naver_id)`는 성공했을 때만 호출한다.

## 3. app.py UI 연결

기존 `find_link` 탭이 “곧 만나요” 플레이스홀더라면 실제 실행 UI로 바꾼다.

필수 UI 필드:

- 블로거 링크/ID 입력칸
- 신청 수 Spinbox
- 신청 멘트 Text 박스
- 속도 모드
- Cool-down
- 일일 상한
- 실행/중지 버튼

맥 버전 변수명:

```python
self.link_blogger_url_var = ttk.StringVar()
self.link_neighbor_count_var = ttk.IntVar(value=10)
self.link_neighbor_msg_text = tk.Text(...)
self.link_neighbor_status = tk.Label(...)
```

실행 버튼은 아래 메서드에 연결한다.

```python
self._add_run_buttons(content, self._run_link_neighbor)
```

## 4. app.py 실행 메서드 추가

아래 두 메서드를 추가한다.

```python
def _run_link_neighbor(self):
    """UI 입력 검증 후 백그라운드 워커 시작"""
```

요건:

- 블로거 링크/ID가 비어 있으면 중단
- `extract_blogger_id_from_url()`로 형식 검증
- 네이버 ID/PW 검증
- 멘트는 기존 키워드 탭과 동일하게 줄 단위로 읽고 400자 초과 검사
- `self._start_worker(self._worker_link_neighbor, ...)` 호출

```python
def _worker_link_neighbor(
    self,
    blogger_url,
    max_requests,
    messages=None,
    speed_mode="normal",
    cooldown_every=10,
    daily_limit=80,
):
    """브라우저 실행 → 로그인 → 이웃 후보 수집 → 서이추 신청"""
```

워커 흐름:

1. `create_stealth_driver()`
2. `login(driver, naver_id, naver_pw)`
3. `scrape_follower_ids(driver, blogger_url, max_count=scrape_limit)`
4. `auto_neighbor_to_blog_ids(driver, blog_ids, max_requests=max_requests, ...)`
5. 완료 로그 및 팝업
6. finally에서 driver 종료 및 `done` queue 발행

권장 후보 수집량:

```python
scrape_limit = max(max_requests * 3, max_requests + 10)
```

이렇게 해야 이미 이웃/신청 불가 후보가 섞여도 신청 수를 채울 가능성이 높아진다.

## 5. 기존 멘트 저장 로직 재사용

키워드 탭과 링크 탭이 같은 멘트 저장소를 쓰게 한다.

맥 버전은 기존 함수를 재사용했다.

```python
save_neighbor_messages(self.naver_id_var.get(), messages)
load_neighbor_messages(self.naver_id_var.get())
```

가능하면 공통 검증 함수로 분리한다.

```python
def _collect_neighbor_messages(self, text_widget, status_label=None):
    """Text 위젯에서 멘트를 읽고 400자 제한을 검사한 뒤 저장"""
```

## 6. 완료 팝업 흐름

기존 완료 팝업이 단계별 다음 화면 이동을 지원한다면 `find_link`도 `engage`로 이어지게 한다.

예:

```python
STAGE_NEXT = {
    "find_keyword": ("engage", "고객과 친해질게요"),
    "find_link": ("engage", "고객과 친해질게요"),
    "engage": ("write", "고객을 설득할게요"),
    "write": (None, None),
}
```

## 7. 테스트 체크리스트

문법 검사:

```bash
python -m py_compile app.py scraper/follower_scraper.py engagement/auto_neighbor.py
```

파싱 단위 테스트:

```python
from scraper.follower_scraper import extract_blogger_id_from_url

assert extract_blogger_id_from_url("https://blog.naver.com/example123") == "example123"
assert extract_blogger_id_from_url("blog.naver.com/example123/posts") == "example123"
assert extract_blogger_id_from_url("https://m.blog.naver.com/PostView.naver?blogId=abc_def&logNo=1") == "abc_def"
assert extract_blogger_id_from_url("abc_def") == "abc_def"
```

실사용 테스트:

1. 앱 실행
2. `고객을 찾아올게요` → `특정 블로거 링크` 탭 이동
3. 공개 이웃 목록이 있는 블로그 링크 입력
4. 신청 수를 1~2명으로 낮춰 테스트
5. 안전 모드로 실행
6. 로그에서 아래 흐름 확인
   - 블로거 ID 추출
   - 이웃 목록 수집
   - 후보 수 표시
   - 서로이웃 신청 폼 이동
   - 신청 성공/실패 로그

## 8. 주의 사항

- 이 기능은 “공개 이웃 목록” 기준이다. 비공개 목록을 우회하지 않는다.
- 네이버 페이지 구조가 바뀌면 `BuddyList.naver` HTML 패턴이 달라질 수 있다.
- 실제 신청은 기존 `send_neighbor_request()` 품질에 의존한다.
- 윈도우 배포 빌드에 `scraper.follower_scraper`가 hidden import로 들어가 있는지 확인한다.
  - PyInstaller/Nuitka 설정에서 누락되면 배포본에서만 import 오류가 날 수 있다.

## 9. 맥 버전에서 실제 추가된 동작 요약

- `특정 블로거 링크` 탭이 활성화됨
- 사용자가 원하는 블로거 링크/ID 직접 입력 가능
- 공개 이웃 목록에서 후보 수집
- 기존 서이추 엔진으로 신청
- 기존 멘트, 속도 모드, Cool-down, 일일 상한 그대로 적용
- 완료 후 `고객과 친해질게요` 단계로 이동 제안
