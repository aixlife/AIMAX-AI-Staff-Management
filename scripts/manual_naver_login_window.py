"""테스트 PC에서 사람이 네이버에 직접 로그인할 창을 띄우고, 로그인되면 실행기와 같은 방식으로 세션을 저장한다.

실행기 기본 대기(3분)보다 길게 기다린다. 비밀번호를 다루지 않는다 — 사람이 창에 직접 입력한다.
실행: uv run python scripts/manual_naver_login_window.py --minutes 15
"""
import argparse
import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--minutes", type=int, default=15)
    args = parser.parse_args()
    from app import load_settings
    from browser.stealth_driver import create_stealth_driver
    from browser.session_manager import save_session, sync_pc_blog_login
    from auth.naver_login import _blog_session_ready

    naver_id, *_rest = load_settings()
    driver = create_stealth_driver()
    try:
        driver.get("https://nid.naver.com/nidlogin.login?url=https%3A%2F%2Fblog.naver.com%2F")
        print("WAITING_FOR_MANUAL_LOGIN", flush=True)
        deadline = time.time() + args.minutes * 60
        while time.time() < deadline:
            time.sleep(5)
            try:
                names = {c.get("name") for c in driver.get_cookies()}
            except Exception:
                names = set()
            if "NID_AUT" in names and "NID_SES" in names:
                time.sleep(3)
                try:
                    sync_pc_blog_login(driver)
                except Exception as exc:
                    print(f"SYNC_WARN {exc}", flush=True)
                ready = _blog_session_ready(driver, naver_id)
                save_session(driver, naver_id)
                print(f"LOGIN_OK blog_ready={ready}", flush=True)
                return 0
        print("LOGIN_TIMEOUT", flush=True)
        return 1
    finally:
        try:
            driver.quit()
        except Exception:
            pass


if __name__ == "__main__":
    sys.exit(main())
