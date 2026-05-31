# AIMAX R3-O Mac Yeri 800 Actual User Flow

작성: 2026-05-27

## 결론

Mac 실제 사용자 흐름 테스트 통과.

실제 Chrome 웹페이지에서 사용자가 보는 AIMAX 운영 UI를 열고, `demo@aimax.ai.kr` 계정으로 예리 작업을 생성했다. 설치된 Mac 실행기 `/Applications/AIMAX.app` `v1.0.17`이 해당 job을 받아 네이버 자동 로그인, 글 생성, 이미지 생성/삽입, 임시저장을 완료했다.

## 범위

- 계정: `demo@aimax.ai.kr`
- 웹 UI: `https://api.aimax.ai.kr/app`
- 플랫폼: Mac
- 설치 실행기: `/Applications/AIMAX.app`
- 실행기 버전: `v1.0.17`
- 직원: 예리
- AI 모델: `gemini-2.5-flash`
- 분량: `800자`
- 이미지: `1장`
- 발행 방식: `임시 저장`
- 발행/예약: 하지 않음
- 고객 계정/고객 자격증명: 사용 안 함
- Apify: 사용 안 함

## 실제 웹 UI 확인

실제 Chrome 화면에서 아래 상태를 확인했다.

- 로그인 계정: `demo@aimax.ai.kr`
- 실행기 상태: `연결됨`
- 실행기 버전: `v1.0.17`
- 작업 폼:
  - 발행 방식: `임시 저장`
  - AI 모델: `Gemini 2.5 Flash`
  - 분량: `800자`
  - 이미지: `1장`
  - 예상 원가: 약 `62원`

최종 화면 스크린샷:

- `/private/tmp/aimax_r3o_yeri_800_visible_final.png`

## Job

- Job id: `9452a936-9444-4b9a-b8f0-4a85e4128b26`
- Target platform: `macos`
- Target device: `AIXLIFEui-MacBookPro.local (Darwin)`
- Status: `done`
- Created: `2026-05-26T17:49:35.509Z`
- Assigned: `2026-05-26T17:50:50.066Z`
- Finished: `2026-05-26T17:54:45.647Z`

## 결과

```text
mode: save
success: 1 / 1
char_count: 805
target_char_count: 800
images.attempted: 1
images.generated: 1
images.inserted: 1
image_provider_counts.gemini: 1
image_provider_counts.openai: 0
cost.total_won: 126
cost.text_won: 68
cost.image_won: 58
failed_stage: none
```

## 실행 로그 요약

```text
브라우저 실행 파일 감지: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
브라우저 버전 감지: Google Chrome 148.0.7778.179
세션 복원 성공: likimartin
PC 블로그 동기화 실패 — 재로그인 진행...
네이버 로그인 시작 (JS 주입 방식)...
네이버 로그인 완료
Gemini 글 생성 완료 [gemini-2.5-flash]
글자 수 확인: 805자 (목표 800자, 통과=True)
글쓰기 화면 준비 완료
제목 입력 완료
이미지 생성 완료
이미지 업로드 성공
이미지 삽입 완료
임시 저장 중...
임시 저장 완료
```

로컬 agent 로그:

- `/private/tmp/aimax_r3o_installed_agent_once.log`

## 참고

초기에는 `300자` 실제 테스트를 목표로 했지만 운영 웹 UI가 아직 `300자` 옵션을 노출하지 않아 중지했다. 이번 테스트는 사용자의 승인에 따라 운영 UI에 이미 노출되어 있는 `800자` 옵션으로 진행했다.

이번 테스트는 Mac lane 통과 증거다. Windows lane은 별도 Windows 결과와 실제 사용자 흐름 증거가 필요하다.
