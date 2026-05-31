"""분리 버전 전체 빌드 호환 진입점.

기존 습관대로 `python build.py`를 실행하면 배포 대상 2개 앱을 모두 빌드한다.
개별 빌드는 `python build_split.py find|engage_write`를 사용한다.
"""
from build_split import main


if __name__ == "__main__":
    raise SystemExit(main(["all"]))
