# Copy/Paste Prompt for Windows AI Developer - 2026-05-15

너는 Windows 환경에서 작업하는 AIMAX AI 개발자다. 이번 요청은 즉시 빌드 작업이 아니라, Mac 쪽 프로젝트명 변경과 신규 AI 직원 배포 일정에 따른 Windows 쪽 영향 확인/정리 작업이다.

Syncthing 공유 폴더에서 아래 문서를 먼저 읽어라.

1. `WINDOWS_AI_COLLABORATION_RULES_20260507.md`
2. `WINDOWS_AI_DEVELOPER_MESSAGE_20260515_PROJECT_RENAME_STAFF_ROLLOUT.md`

핵심 변경:

- Mac 쪽 canonical project folder가 `NaverBlogAuto-main-mac`에서 `AIMAX-AI-Staff-Management`로 변경됐다.
- 기존 Mac 경로는 호환용 symlink로 남아 있지만, 새 문서/보고서에서는 `AIMAX-AI-Staff-Management`를 기준으로 써라.
- 신규 AI 직원 5명은 이미 사용자 화면에 카드로 보이고, 앞으로 기능을 순차 배포한다.
- 일정 표현은 일반인이 이해하기 쉽게 `회사에서 사용해보기`, `기존 사용자들에게 배포`, `외부 판매 준비`를 사용한다.

이번에 해줘야 할 일:

1. Windows 쪽 현재 작업 문서/메모/스크립트에 Mac 경로 `NaverBlogAuto-main-mac`을 전제로 한 부분이 있는지 확인해라.
2. 실제로 현재 작업에 영향을 주는 참조만 새 canonical 이름인 `AIMAX-AI-Staff-Management`로 정리해라.
3. 과거 배포 기록, 과거 Syncthing 폴더명, 과거 빌드 산출물 이름은 역사 기록이므로 억지로 바꾸지 마라.
4. 이 이름 변경만으로 Windows installer를 다시 빌드하지 마라.
5. Windows installer product name, install directory, app ID, update behavior는 별도 rebranding task가 나오기 전까지 건드리지 마라.
6. 신규 직원 기능이나 Local Agent protocol은 아직 Windows에서 독자 구현하지 마라. Mac/server 쪽 source delta가 오면 그때 parity 작업으로 처리한다.

주의:

- Syncthing 공유 폴더 안에서 직접 빌드하지 마라.
- source ZIP이 필요한 작업이 생기면 반드시 로컬 Windows 작업 폴더로 복사한 뒤 작업해라.
- `.env`, API key, 비밀번호, 쿠키, passphrase, 복호화된 secret은 Syncthing에 올리지 마라.

완료 후 같은 공유 폴더에 아래 파일명으로 보고서를 남겨라.

`WINDOWS_AI_STATUS_20260515_project_rename_staff_rollout.md`

보고서에는 다음을 포함해라.

- 확인한 경로/문서
- 수정한 파일이 있다면 목록
- 남겨둔 구 경로 참조가 있다면 이유
- Windows 빌드/재빌드 여부
- blocker 또는 Mac 쪽에 물어볼 질문

