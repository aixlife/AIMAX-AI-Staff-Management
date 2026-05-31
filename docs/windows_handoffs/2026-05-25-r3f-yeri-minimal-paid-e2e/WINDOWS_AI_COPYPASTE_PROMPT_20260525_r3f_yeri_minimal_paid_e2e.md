너는 AIMAX Windows 환경의 Codex 개발자다. 이번 작업은 R3-F 예리 최소 유료 E2E의 Windows 실행기 처리 확인이다.

중요:
- 새 job을 만들지 마라.
- 서버 글 생성을 다시 트리거하지 마라.
- 이미 생성된 job id `d0abdaa5-0e13-41cf-a6b8-69ef613158dc`만 처리한다.
- Apify 금지.
- 고객 계정/고객 credentials 금지.
- Naver 발행/예약 금지.
- 허용된 Naver mutation은 테스트 계정에서 임시저장 1회뿐이다.
- 비밀번호/API 키/토큰/쿠키/브라우저 프로필/로컬 raw path를 보고서에 쓰지 마라.

먼저 읽어라:

```text
WINDOWS_HANDOFF_20260525_r3f_yeri_minimal_paid_e2e.md
```

작업:

1. Windows에서 설치된 AIMAX runner `v1.0.19`를 실행한다.
2. 웹앱이 Demo 테스트 계정으로 로그인되어 있는지 확인한다.
3. runner가 job polling을 하게 둔다.
4. 기존 job `d0abdaa5-0e13-41cf-a6b8-69ef613158dc`를 claim하는지 확인한다.
5. 네이버 에디터에서 제목/본문/이미지 1장이 들어가는지 확인한다.
6. 발행하지 말고 임시저장까지만 완료한다.
7. 공유 폴더에 `WINDOWS_RESULT_20260525_r3f_yeri_minimal_paid_e2e.md`를 남긴다.

반환 형식:

```md
# WINDOWS RESULT — R3-F Yeri Minimal Paid E2E

verdict: pass | blocked | failed
tested_at: 2026-05-25T...+09:00
job_id: d0abdaa5-0e13-41cf-a6b8-69ef613158dc

environment:
- runner_version:
- platform:
- aimax_account: demo test account, password redacted
- naver_account: test account, redacted

observations:
- job_claimed: yes/no
- title_inserted: yes/no
- body_inserted: yes/no
- image_attempted:
- image_generated:
- image_inserted:
- image_position_ok: yes/no/unknown
- draft_saved: yes/no
- final_job_status:

safety:
- no_second_paid_text_generation: yes/no
- no_apify: yes/no
- no_publish_or_schedule: yes/no
- no_customer_credentials: yes/no

blocker_or_failure:
- none 또는 가장 좁은 원인
```

runner가 job을 가져가지 못하면 새 job을 만들지 말고, claim 실패 원인만 좁혀서 보고해라.
