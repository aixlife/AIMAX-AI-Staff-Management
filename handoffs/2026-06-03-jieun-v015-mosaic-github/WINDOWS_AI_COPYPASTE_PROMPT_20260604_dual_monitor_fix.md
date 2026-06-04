AIMAX 지은 v0.1.5 듀얼 모니터 캡처 버그 수정 요청입니다.

현재 `v0.1.5` 산출물은 Oracle 배포 보류입니다. 이유는 듀얼 모니터에서 캡처가 메인 모니터 기준으로만 작동하기 때문입니다.

GitHub PR:
https://github.com/aixlife/aimax-viseo/pull/2

확인된 원인:
1. `src/main/windowManager.ts`의 `openOverlayWindow()`가 `screen.getPrimaryDisplay().bounds`만 사용해 캡처 오버레이를 주 모니터에만 띄웁니다.
2. `src/main/captureManager.ts`의 `captureRectImage()`가 `screen.getPrimaryDisplay()`와 `sources[0]`만 사용해 주 모니터 스크린샷만 자릅니다.
3. `get-screen-source()`도 `sources[0]`을 반환하므로 녹화도 같은 문제가 있을 수 있습니다.

수정 요구:
1. `screen.getAllDisplays()`로 전체 가상 데스크톱 bounds를 계산해 캡처 오버레이를 모든 모니터 위에 띄우세요.
2. overlay-local 선택 좌표에 overlay window의 `x/y`를 더해 global screen 좌표로 변환하세요.
3. 선택 영역을 완전히 포함하는 display를 찾고, 해당 display의 `desktopCapturer` source를 사용하세요.
4. 가능하면 `source.display_id === display.id`로 source를 매칭하세요. 불가능하면 안전한 fallback을 두세요.
5. crop 좌표는 primary display가 아니라 선택된 display bounds 기준으로 계산하세요.
6. 선택 영역이 여러 모니터에 걸치면, 잘못된 화면을 조용히 자르지 말고 명확한 오류 메시지를 보여주세요.

재검증:
1. Setup EXE로 설치한 앱에서 테스트하세요. unpacked smoke만으로는 부족합니다.
2. 주 모니터: capture -> mosaic -> save 확인.
3. 보조 모니터: capture -> mosaic -> save 확인.
4. OCR/text capture도 같은 `captureRectImage()`를 쓰므로 보조 모니터에서 확인하세요.
5. 가능하면 녹화 영역 선택도 보조 모니터에서 확인하세요.

반환:
- 수정 PR/commit URL
- 새 Setup EXE/portable 파일명, 크기, SHA256
- 주 모니터/보조 모니터 설치형 앱 검증 증거
- 남은 제한사항

주의:
기존 `AIMAX-Office-Manager-Setup-0.1.5.exe`와 portable은 듀얼 모니터 blocker가 있으므로 그대로 배포하지 마세요.
