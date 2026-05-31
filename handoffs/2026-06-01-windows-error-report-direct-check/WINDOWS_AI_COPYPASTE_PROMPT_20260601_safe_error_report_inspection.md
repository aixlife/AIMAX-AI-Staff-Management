당신은 AIMAX Windows 쪽 개발자입니다.

목표:

Windows 관련 오류가 올라왔을 때 Mac/Oracle 담당자를 기다리지 않고, 운영 admin UI/API에서 오류 보고의 개별 상세 내용을 직접 확인해 원인 파악과 Windows 수정 작업을 진행합니다.

중요한 원칙:

- 안전한 방식으로만 확인합니다.
- Oracle SSH, 서버 파일 직접 접근, DB 파일 직접 열람은 하지 않습니다.
- admin UI/API가 제공하는 redacted 상세 JSON만 확인합니다.
- admin 비밀번호, 쿠키, 세션 토큰, API 키, Naver 비밀번호, 인증 헤더, signed URL, passphrase를 Syncthing, 소스, 로그, 스크린샷, 결과 보고서에 남기지 않습니다.
- admin 로그인이 필요하면 Minsoo가 Windows PC에서 직접 입력하게 하거나, 이미 승인된 admin 브라우저 세션만 사용합니다.
- 오류 보고 상태 변경은 Minsoo가 특정 report_id와 목표 status를 명시적으로 요청한 경우에만 합니다.
- 유료 AI/API 생성, Apify 실행, Naver 발행/예약은 하지 않습니다.

먼저 읽을 문서:

```text
20_Deploy-To-Windows/2026-06-01-windows-error-report-direct-check/WINDOWS_HANDOFF_20260601_error_report_direct_check.md
```

접속:

```text
https://api.aimax.ai.kr/admin#reports
```

관리자 UI 확인 절차:

1. 승인된 admin 세션으로 접속합니다.
2. `오류 보고` 탭을 엽니다.
3. 미완료 보고와 Windows 관련 보고를 확인합니다.
4. 각 보고의 상세 drawer를 열어 다음을 봅니다.
   - report_id
   - status / status_label / status_updated_at
   - product
   - app_version
   - OS/platform
   - work_context
   - visible_error
   - public_message / next_update_message
   - redacted diagnostics
   - runner version / connection / diagnostics
   - recent jobs가 있으면 job id, kind, status, failed stage, error
5. 복사 버튼을 사용할 수 있지만, Syncthing에 저장하기 전 민감정보처럼 보이는 값은 `[redacted]`로 바꿉니다.

브라우저 콘솔로 개별 보고 상세 확인:

admin 페이지에 로그인된 상태에서만 실행하세요. 쿠키나 세션 값을 출력하지 마세요.

```js
const reportId = "PASTE_REPORT_ID_HERE";
const detail = await fetch(`/api/admin/reports/${encodeURIComponent(reportId)}`, {
  credentials: "include",
}).then((r) => r.json());
console.log({
  summary: detail.summary,
  redacted_detail: detail.report,
});
```

브라우저 콘솔로 Windows 미완료 보고 일괄 확인:

```js
const data = await fetch("/api/admin/reports", { credentials: "include" }).then((r) => r.json());
const reports = data.reports || [];
const targets = reports.filter((report) => {
  const status = String(report.status || "");
  const haystack = [
    report.os,
    report.platform,
    report.app_version,
    report.product,
    report.work_context,
    report.visible_error,
    report.public_message,
    report.next_update_message,
  ].join(" ").toLowerCase();
  return status !== "done" && haystack.includes("windows");
});
const details = await Promise.all(targets.map(async (report) => {
  const detail = await fetch(`/api/admin/reports/${encodeURIComponent(report.report_id)}`, {
    credentials: "include",
  }).then((r) => r.json());
  const raw = detail.report || {};
  const agent = raw.system?.agent || raw.agent || {};
  const jobs = raw.system?.jobs_recent || raw.jobs_recent || [];
  return {
    report_id: report.report_id,
    status: report.status,
    status_label: report.status_label,
    status_updated_at: report.status_updated_at,
    stored_at: report.stored_at,
    product: report.product,
    app_version: report.app_version,
    os: report.os,
    work_context: report.work_context,
    visible_error: report.visible_error,
    public_message: report.public_message,
    next_update_message: report.next_update_message,
    user_response: report.user_response,
    runner: {
      connected: agent.connected,
      version: agent.version,
      platform: agent.platform,
      device_label: agent.device_label,
      status: agent.status,
      diagnostics: agent.diagnostics,
    },
    recent_jobs: jobs.map((job) => ({
      id: job.id || job.job_id,
      kind: job.kind,
      status: job.status,
      stage: job.stage || job.failed_stage,
      failed_keyword: job.failed_keyword,
      error: job.error || job.visible_error || job.last_error,
      updated_at: job.updated_at || job.finished_at || job.created_at,
    })).slice(0, 5),
  };
}));
console.log(`windows_non_done_reports=${details.length}`);
console.log(JSON.stringify(details, null, 2));
```

현재 기대 상태:

```text
total=72
done=22
waiting_user=50
new=0
reviewing=0
working=0
```

결과 보고 파일:

```text
WINDOWS_AI_RESULT_20260601_safe_error_report_inspection.md
```

결과 보고에 포함할 것:

- Windows 버전과 사용 브라우저
- admin UI/API 접근 가능 여부
- 개별 report 상세 JSON 확인 가능 여부
- 확인한 report_id 목록
- 상태별 카운트
- Windows 수정이 필요한 항목과 이유
- Windows 수정이 필요 없는 항목과 이유
- 추가로 Mac/Oracle 쪽 조치가 필요한 항목
- 비밀값을 저장/복사하지 않았다는 확인

결과 보고에 포함하지 말 것:

- admin 비밀번호
- 쿠키 / 세션 토큰
- API 키
- Naver ID/PW
- auth header
- signed URL
- 고객 원문 비밀값
- 긴 opaque token처럼 보이는 값

admin UI/API만으로 원인 파악이 부족하면, 임의로 SSH 접근을 시도하지 말고 “특정 report_id에 대한 read-only Oracle inspector가 필요함”이라고 blocker로 보고하세요.
