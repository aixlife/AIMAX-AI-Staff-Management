AIMAX 지은 v0.1.5 Windows 개발 작업입니다.

Primary GitHub issue:
https://github.com/aixlife/aimax-viseo/issues/1

작업 목표:
지은(AI 오피스 지원) 앱에 `캡처한 이미지의 일부 영역을 모자이크 처리하는 기능`을 추가해주세요.

요구사항:
1. `aixlife/aimax-viseo` repo에서 feature 브랜치를 만드세요.
2. 기존 화면 캡처 기능은 그대로 유지하세요.
3. 캡처 후 이미지 미리보기/편집 화면에서 `모자이크` 도구를 사용할 수 있게 하세요.
4. 사용자가 마우스로 사각형 영역을 드래그하면 해당 영역이 픽셀 모자이크 또는 강한 블러로 처리되게 하세요.
5. 여러 영역을 연속 처리할 수 있게 하세요.
6. 원본 이미지는 기본적으로 덮어쓰지 말고 편집본을 별도 저장하세요.
7. 가능하면 모자이크 강도/블록 크기 기본값을 제공하고, 앱 구조상 부담이 적으면 조절 옵션도 넣어주세요.
8. 저장 전 닫기 시 저장 여부를 확인하세요.
9. 오류 발생 시 사용자에게 보이는 메시지를 남기세요.

빌드/반환:
1. 소스 변경은 PR로 남기세요.
2. EXE 파일은 일반 git 커밋에 넣지 마세요.
3. `v0.1.5` Setup EXE와 portable EXE를 GitHub Release asset 또는 Actions artifact로 제공하세요.
4. 반환 보고에는 아래를 포함하세요.
   - PR URL
   - Build/Release URL
   - Setup EXE 파일명, 크기, SHA256
   - portable EXE 파일명, 크기, SHA256
   - Windows 실제 검증 증거: 캡처 -> 모자이크 -> 저장 화면
   - Windows 버전과 실행 환경
   - blocker나 제한사항

주의:
- 비밀번호, 토큰, 쿠키, API 키, 고객 개인정보, 민감한 캡처 원본은 GitHub/Syncthing/로그에 올리지 마세요.
- 테스트 이미지는 공개 가능한 더미 화면만 사용하세요.
- 빌드 산출물이 준비되면 Mac/Oracle 쪽에서 Oracle `/downloads/`에 올리고 AIMAX 직원 카탈로그를 `v0.1.5`로 교체할 예정입니다.
