# NaverBlogAuto — Windows 설치/실행 안내

## 다운로드
[Releases](../../releases/latest) 페이지에서 `NaverBlogAuto-windows.zip` 다운로드 후 압축 해제.

- `NaverBlogAuto.exe`만 단독 복사하면 실행에 필요한 `_internal` 폴더가 없어 정상 동작하지 않습니다.
- 반드시 압축을 풀어서 생성된 `NaverBlogAuto` 폴더 전체를 그대로 보관하세요.

## 실행
1. 압축 해제한 `NaverBlogAuto\NaverBlogAuto.exe` 더블클릭.
2. Windows Defender SmartScreen 경고가 뜨면 **자세히 → 실행** 클릭.
3. 프로그램이 열리면 네이버 ID/PW, Gemini API 키 입력 후 시작.

## 데이터 저장 위치
설정, 세션 쿠키, 로그는 자동으로 아래 폴더에 저장됩니다.

- Windows: `%APPDATA%\NaverBlogAuto\`
- macOS: `~/Library/Application Support/NaverBlogAuto/`

이 폴더에 아래 데이터가 자동 저장됩니다.

- 로그인 세션 쿠키
- 브라우저 프로필
- 사용자 설정
- 디버그 HTML / 로그

## 문제 해결
- **SmartScreen 차단**: "추가 정보 → 실행"으로 통과.
- **바이러스 오탐**: 일부 보안 프로그램이 Nuitka 실행파일을 오탐할 수 있음 → 예외 등록.
- **회사/학교 관리 PC에서 실행 자체가 차단됨**: AppLocker, WDAC, Smart App Control 정책에서 서명되지 않은 exe를 막을 수 있습니다. 이런 환경은 코드 수정만으로 해결되지 않고 코드 서명 또는 정책 예외 등록이 필요합니다.
- **브라우저 자동 실행 실패**: 최신 Chrome, Chromium, Brave 중 하나를 설치하세요.
- **사내 PC처럼 브라우저 경로가 특이한 환경**: `%APPDATA%\NaverBlogAuto\config.yaml`의 `browser.executable_path`에 브라우저 exe 경로를 입력하면 됩니다.
- **설정 초기화가 필요할 때**: `%APPDATA%\NaverBlogAuto\` 폴더 안의 `sessions`, `browser_profiles`, `debug`를 정리한 뒤 다시 실행하세요.
