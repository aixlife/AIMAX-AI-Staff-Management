"""수신→워커 기동 사각지대(2차 좀비보호) 판정 로직.

서버는 하트비트가 살아 있는 한 좀비로 보지 않는다(1차 좀비보호). 그러나 러너가
잡을 받아 수신 확인까지 보낸 뒤 내부 실행 워커 스레드가 끝내 기동하지 못하는
경우(하트비트는 계속 살아 있음)에는 서버 좀비보호에 걸리지 않는 사각지대가 생긴다.

이 모듈은 그 사각지대를 러너 스스로 판정하기 위한 순수 함수만 담는다. app.py 를
import 하지 않고도 단위 검증할 수 있도록, UI/스레드 상태는 인자로만 받고 I/O·
프로세스 재시작 같은 부수효과는 호출측(app.py)이 담당한다.
"""
from __future__ import annotations

# 워커 스레드가 기동하지 않았다고 판정하기까지의 기본 유예 시간(초).
DEFAULT_WATCHDOG_SECONDS = 30

# 실행 워커 스레드가 실제로 기동했다고 볼 수 있는 단계들.
WORKER_ALIVE_STAGES = frozenset({
    "worker_thread_started",
    "worker_running",
    "login",
    "naver_login",
    "writing",
    "content_generation",
    "publishing",
})

# 아직 UI 큐 처리 전 단계들(코어가 잡을 받아 UI 스레드로 넘기는 도중).
UI_QUEUE_STAGES = frozenset({
    "",
    "claimed",
    "queued_to_ui",
})

# 하트비트 progress_stage 로 서버에 보낼 한국어 진행 단계 라벨.
# (서버측 대응은 맥 쪽에서 이어받으므로 러너는 값만 정확히 채워 보낸다.)
_PROGRESS_STAGE_LABELS = {
    "claimed": "수신됨",
    "queued_to_ui": "수신됨",
    "ui_received": "수신됨",
    "worker_start_requested": "수신됨",
    "ui_dispatch_error": "수신됨",
    "worker_thread_started": "워커기동",
    "worker_running": "워커기동",
    "login": "로그인",
    "naver_login": "로그인",
    "writing": "작성중",
    "content_generation": "작성중",
    "publishing": "발행중",
}


def progress_stage_label(stage) -> str:
    """내부 단계 코드를 하트비트 progress_stage 한국어 값으로 변환한다.

    알 수 없는 단계는 보수적으로 '수신됨'으로 본다(활성 잡이 있는데 아직 워커가
    올라오지 않은 초기 단계일 가능성이 높기 때문).
    """
    return _PROGRESS_STAGE_LABELS.get(str(stage or ""), "수신됨")


def evaluate_worker_watchdog(
    *,
    has_active_job,
    claimed_at,
    now,
    worker_started_at,
    worker_thread_alive,
    stage,
    timeout_seconds=DEFAULT_WATCHDOG_SECONDS,
):
    """수신 후 실행 워커 스레드가 제때 기동했는지 판정한다.

    인자(모두 순수 값):
      has_active_job: 서버 잡을 하나 물고 있는지(원격 잡일 때만 True).
      claimed_at: 잡 수신(claim) 시각(time.monotonic 기준). 0 이면 판정 보류.
      now: 현재 time.monotonic 값.
      worker_started_at: 실행 워커 스레드가 실제로 첫 줄을 실행한 시각. 0 이면 미기동.
      worker_thread_alive: 워커 스레드 객체가 살아있는지.
      stage: 마지막으로 관측된 내부 단계 코드.
      timeout_seconds: 이 시간(초) 안에 워커가 안 올라오면 사각지대로 판정.

    반환: None(정상/판정 보류) 또는 dict(사각지대 상세):
      reason: 내부 사유 코드
      error: 서버 result.error 코드
      message: 사용자 노출 한국어 메시지(이모지 없음)
      stage: 마지막 관측 단계
      elapsed: 경과 초(int)
    """
    if not has_active_job:
        return None
    try:
        claimed_at = float(claimed_at or 0.0)
    except (TypeError, ValueError):
        claimed_at = 0.0
    if not claimed_at:
        return None
    # 워커가 이미 올라왔으면(기동 시각 기록 또는 기동 이후 단계 도달 또는 스레드 생존)
    # 감시 대상이 아니다. 로그인/작성/발행이 30초를 넘겨도 오탐하지 않게 한다.
    if worker_started_at:
        return None
    if str(stage or "") in WORKER_ALIVE_STAGES:
        return None
    if worker_thread_alive:
        return None
    elapsed = now - claimed_at
    if elapsed < timeout_seconds:
        return None
    stage_code = str(stage or "")
    if stage_code in UI_QUEUE_STAGES:
        error = "local_ui_queue_not_processed_after_claim"
        message = (
            "로컬 실행기가 작업을 받았지만 내부 UI 큐가 작업 시작을 처리하지 못했습니다. "
            "실행기를 자동으로 재시작합니다."
        )
    else:
        error = "local_worker_not_started_after_claim"
        message = (
            "로컬 실행기가 작업을 받았지만 내부 실행 워커가 시작되지 않았습니다. "
            "실행기를 자동으로 재시작합니다."
        )
    return {
        "reason": "worker_watchdog_timeout",
        "error": error,
        "message": message,
        "stage": stage_code or "claimed",
        "elapsed": int(elapsed),
    }
