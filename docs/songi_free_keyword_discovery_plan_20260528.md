# 송이 키워드 벤치마킹 후보 찾기 무료/비API 전환안

작성일: 2026-05-28

## 결론

초기 송이 `키워드로 찾기` 탭은 UI와 저장 구조는 준비됐지만 실제 후보 검색은 YouTube Data API 키가 있어야 동작했다. 사용자 요구가 "API/유료 기본값 제외"이므로 기본 경로를 아래처럼 바꾸는 것이 맞다.

- 기본: 로컬 러너에서 `yt-dlp`로 YouTube 공개 검색 메타데이터만 수집
- 보조: TikTok Creative Center를 브라우저 보조/수동 선별 경로로 연결
- 선택 옵션: YouTube Data API는 사용자가 직접 키를 넣고 켜는 고급 커넥터로 격하
- 유료: Apify/Gemini 등은 기존처럼 명시 승인 후만 실행

이 변경은 송이 키워드 발견 기능을 `web-first` 단독이 아니라 `hybrid/local-runner-assisted` 기능으로 만든다. Oracle 서버에서 중앙 scraping으로 돌리지 않는 것이 안전하다.

2026-05-28 구현 반영:

- 기본 YouTube 후보 검색을 `local_ytdlp` 실행기 명령 방식으로 전환했다.
- 웹 서버는 `/api/research/discovery/search`에서 discovery run을 만들고 `songi_youtube_discovery` 로컬 명령을 큐에 넣는다.
- 로컬 실행기는 `yt-dlp`를 `--skip-download`로 실행해 카드에 필요한 공개 메타데이터만 반환한다.
- 서버는 실행기 결과를 기존 `discovery_runs`, `discovery_candidates`에 저장하고, 후보 가져오기는 기존 송이 링크 분석 아이템 흐름으로 이어진다.
- YouTube Data API 키는 기본 경로에서 필요하지 않으며, 현재 기본 UI 문구도 API quota 0원/0 units로 갱신했다.

## 기존 구현 방식

초기 서버 구현은 `/api/research/discovery/search` 요청을 받으면 다음 순서로 처리했다.

1. 프로젝트와 키워드를 확인한다.
2. 플랫폼이 YouTube인지 확인한다.
3. 사용자 또는 서버에 저장된 `YOUTUBE_API_KEY`를 찾는다.
4. 키가 없으면 `youtube_api_key_missing`으로 중단한다.
5. 키가 있으면 YouTube Data API `search.list`로 후보 ID를 찾고 `videos.list`로 상세 통계를 가져온다.
6. 조회 속도, 참여율, 최근성으로 후보 점수를 계산해 카드로 저장한다.

따라서 초기 상태에서는 API 키 없이 실제 사용자 입력만으로 카드를 띄우는 것이 불가능했다.

## AI Council 교차검토 결과

Claude와 Gemini 모두 같은 방향을 권장했다.

- YouTube 기본 경로는 `yt-dlp` 로컬 러너가 가장 현실적이다.
- `yt-dlp`는 공식 API가 아니므로 "비공식 공개 검색 기반"으로 명확히 표시해야 한다.
- 공개 서버에서 다수 사용자 대상으로 자동 scraping처럼 돌리는 것은 피해야 한다.
- TikTok은 Creative Center가 무료/공식 트렌드 리서치 도구이지만 안정적인 백엔드 API가 아니므로 브라우저 보조/수동 선별 경로가 맞다.
- RSS/관심 채널 방식은 안정적 보조 수단이지만 임의 키워드 발견에는 부족하다.

## 실제 no-cost 확인

이 Mac에는 `yt-dlp`가 설치되어 있다.

```bash
/Users/aixlife/.hermes-venv/bin/yt-dlp
```

다운로드 없이 검색 메타데이터만 확인했다.

```bash
yt-dlp --skip-download --flat-playlist --playlist-end 5 \
  --print "%(id)s\t%(title)s\t%(channel)s\t%(view_count)s\t%(duration_string)s\t%(webpage_url)s" \
  "ytsearch5:AI productivity tools"
```

결과는 5개 후보를 반환했다. 카드용으로 쓸 수 있는 필드는 영상 ID, 제목, 채널명, 조회수, 길이, URL이다.

상세 후보 1건은 안전한 필드 출력 방식으로 아래 값까지 확인했다.

```bash
yt-dlp --skip-download --no-warnings \
  --print "%(id)s\t%(upload_date)s\t%(view_count)s\t%(like_count)s\t%(comment_count)s\t%(channel_follower_count)s" \
  "https://www.youtube.com/watch?v=htZRCE2GgIs"
```

확인된 필드: `upload_date`, `view_count`, `like_count`, `comment_count`, `channel_follower_count`.

주의: 상세 `--dump-json`은 서명된 미디어 URL 등 불필요하고 민감한 임시 URL을 많이 포함할 수 있다. 구현 시 원본 JSON을 저장하거나 노출하지 말고, `--print` 또는 화이트리스트 파싱으로 필요한 필드만 남겨야 한다.

## 권장 키워드-카드 흐름

1. 사용자가 송이 `키워드로 찾기` 탭에 키워드를 입력한다.
2. 웹 앱은 현재 서버에서 바로 YouTube API를 호출하지 않고 로컬 러너 상태를 확인한다.
3. 로컬 러너가 `yt-dlp` 검색을 실행한다.
4. 검색 결과에서 후보 ID, 제목, 채널, URL, 조회수, 길이, 설명 일부, 썸네일 후보를 파싱한다.
5. 상위 후보 일부만 상세 조회해 업로드일, 좋아요, 댓글, 채널 팔로워 수를 보강한다.
6. 원본 JSON은 버리고 카드 스키마에 필요한 필드만 저장한다.
7. 카드는 `비공식 공개 검색 기반` 배지를 표시한다.
8. 사용자가 후보 카드를 선택하면 기존 송이 링크 분석 아이템으로 가져온다.

## 카드 필드 현실성

무료/비API로 안정적으로 기대 가능한 값:

- 제목
- 영상 URL
- 영상 ID
- 채널명
- 채널 URL
- 조회수
- 길이
- 설명 일부
- 썸네일 URL 후보

상세 조회에서 가능하지만 항상 보장하면 안 되는 값:

- 업로드일
- 좋아요 수
- 댓글 수
- 채널 팔로워 수
- 인증 채널 여부

기대하면 안 되는 값:

- 공식 바이럴 순위
- 정확한 실시간 조회 속도
- 공유 수
- 노출 수
- 플랫폼이 보장하는 트렌드 판정
- 모든 키워드에 대한 완전한 최신순 결과

## 최근 바이럴 판정 방식

`ytsearchdate5:`는 현재 설치된 `yt-dlp`에서 지원되지 않았다. 그래서 최신순 별칭에 의존하지 않는다.

권장 점수:

- 키워드 관련성: 제목/설명/채널명 매칭
- 공개 인기도: 조회수
- 최근성: 상세 조회의 `upload_date`
- 속도 추정: 조회수 / 업로드 후 경과 시간
- 보조 신호: 좋아요, 댓글, 채널 팔로워 수가 있으면 사용

UI 문구는 `바이럴 영상`보다 `벤치마크 후보`, `인기 후보 지수`, `공개 지표 기반`이 안전하다.

## 구현 단계

1. 서버의 YouTube API 기본 경로를 고급 옵션으로 내린다.
2. 송이 키워드 검색 기본값은 로컬 러너 연결 필요 상태로 바꾼다.
3. 로컬 러너에 `songi_discovery_ytdlp` 같은 no-download 작업을 추가한다.
4. 웹 서버는 로컬 러너 결과를 받아 기존 `discovery_runs`, `discovery_candidates`에 저장한다.
5. 후보 카드 가져오기는 기존 링크 분석 흐름으로 연결한다.
6. 실패 시 오류 보고에는 키워드, 단계, yt-dlp 버전, sanitized stderr만 포함하고 원본 URL 서명/토큰은 제외한다.

## 참고 출처

- YouTube Data API quota: https://developers.google.com/youtube/v3/getting-started
- YouTube Terms automated access restriction: https://yt-terms.static.usercontent.goog/pdf/terms/20231215/en_us_20231215.pdf
- YouTube search filters help: https://support.google.com/youtube/answer/111997
- yt-dlp README: https://github.com/yt-dlp/yt-dlp/blob/master/README.md
- TikTok Creative Center: https://ads.us.tiktok.com/help/article/creative-center
- TikTok Trends: https://ads.tiktok.com/help/article/how-to-use-trends
