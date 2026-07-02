AIMAX 지은 v0.1.5 듀얼 모니터 fix follow-up입니다.

현재 2026-06-04 재빌드 EXE의 해시는 Mac에서 확인됐지만, 아직 Oracle 배포 보류입니다.

GitHub PR:
https://github.com/aixlife/aimax-viseo/pull/2

Mac 확인 결과:
1. 공유 폴더 EXE 해시는 Windows 보고서와 일치합니다.
2. 보고서에 적힌 `bab7a57 Support multi-display capture targets` 커밋에는 듀얼 모니터 수정이 들어있습니다.
3. 하지만 현재 merged `main` 파일은 아직 `screen.getPrimaryDisplay()` / `sources[0]` 기반 코드입니다.
4. PR #2 merged diff에도 듀얼 모니터 수정이 보이지 않습니다.
5. 즉, 현재 EXE 산출물과 GitHub main 소스가 정렬되어 있지 않습니다.

필수 조치:
1. `bab7a57` 듀얼 모니터 수정 코드를 GitHub `main`에 반영하세요. 기존 PR에 반영이 안 됐다면 follow-up PR을 새로 열고 merge하세요.
2. EXE를 다시 빌드해야 한다면 새 Setup/portable 산출물과 SHA256을 반환하세요.
3. 실제 듀얼 모니터 Windows 환경에서 설치형 앱으로 검증하세요. unpacked 앱 smoke는 부족합니다.

필수 검증:
1. Setup EXE 설치 후 설치된 앱 실행.
2. 주 모니터: capture -> editor -> mosaic -> save.
3. 보조 모니터: capture -> editor -> mosaic -> save.
4. 보조 모니터 text capture.
5. 여러 모니터에 걸친 선택은 명확한 오류가 뜨는지 확인.

반환:
- follow-up PR URL 또는 main commit URL
- 최종 Setup EXE 파일명, 크기, SHA256
- 최종 portable 파일명, 크기, SHA256
- 듀얼 모니터 설치형 앱 검증 결과
- 남은 제한사항

주의:
현재 2026-06-04 EXE는 코드 정렬과 보조 모니터 물리 검증이 완료되기 전까지 Oracle /downloads/에 올리지 않습니다.
