import time
import random
from config import TYPING_AVG, TYPING_STD, ACTION_AVG, ACTION_STD


def is_stop_requested(stop_event=None):
    return bool(stop_event and stop_event.is_set())


def sleep_interruptible(delay, stop_event=None, check_interval=0.2):
    """중지 이벤트를 확인하며 대기한다."""
    if delay <= 0:
        return not is_stop_requested(stop_event)

    if stop_event is None:
        time.sleep(delay)
        return True

    end_time = time.monotonic() + delay
    while True:
        if stop_event.is_set():
            return False
        remaining = end_time - time.monotonic()
        if remaining <= 0:
            return True
        time.sleep(min(check_interval, remaining))


def random_delay(avg=None, std=None, min_val=0.5, max_val=5.0):
    """가우시안 분포 기반 랜덤 딜레이 (초 단위 반환)"""
    if avg is None:
        avg = ACTION_AVG
    if std is None:
        std = ACTION_STD
    delay = max(min_val, min(max_val, random.gauss(avg, std)))
    return delay


def wait(avg=None, std=None, min_val=0.5, max_val=5.0, stop_event=None):
    """가우시안 분포 기반 랜덤 대기"""
    delay = random_delay(avg, std, min_val, max_val)
    return sleep_interruptible(delay, stop_event=stop_event)


def typing_delay():
    """타이핑용 짧은 랜덤 딜레이 (초 단위 반환)"""
    return max(0.01, random.gauss(TYPING_AVG, TYPING_STD))


def wait_short(stop_event=None):
    """짧은 대기 (0.5~1.5초)"""
    return wait(1.0, 0.3, 0.5, 1.5, stop_event=stop_event)


def wait_medium(stop_event=None):
    """중간 대기 (1~3초)"""
    return wait(1.5, 0.5, 1.0, 3.0, stop_event=stop_event)


def wait_long(stop_event=None):
    """긴 대기 (2~5초)"""
    return wait(3.0, 1.0, 2.0, 5.0, stop_event=stop_event)
