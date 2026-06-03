import time
import random
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from utils.delays import typing_delay, random_delay


def human_type(driver, text, avg_delay=None, chunk_size=50):
    """사람처럼 글자별 가변 속도로 타이핑

    긴 텍스트는 chunk_size 단위로 분할하여 ActionChain을 나눠 실행합니다.
    (Selenium ActionChain이 너무 길면 잘리는 현상 방지)
    """
    for start in range(0, len(text), chunk_size):
        chunk = text[start:start + chunk_size]
        actions = ActionChains(driver)
        for char in chunk:
            actions.send_keys(char)
            delay = typing_delay() if avg_delay is None else max(0.01, random.gauss(avg_delay, avg_delay * 0.4))
            actions.pause(delay)
        actions.perform()
        # 청크 사이 짧은 휴식 (자연스러운 타이핑 리듬)
        if start + chunk_size < len(text):
            time.sleep(random.uniform(0.05, 0.15))


def human_type_with_enter(driver, text, avg_delay=None):
    """텍스트 입력 후 엔터"""
    human_type(driver, text, avg_delay)
    time.sleep(random_delay(0.3, 0.1, 0.1, 0.5))
    actions = ActionChains(driver)
    actions.send_keys(Keys.ENTER)
    actions.perform()


def human_click(driver, element):
    """요소에 마우스를 이동한 후 클릭 (hover → 짧은 대기 → 클릭)"""
    actions = ActionChains(driver)
    actions.move_to_element(element)
    actions.pause(random.uniform(0.1, 0.3))
    actions.click()
    actions.perform()


def human_scroll(driver, pixels=None):
    """랜덤 간격으로 부드러운 스크롤"""
    if pixels is None:
        pixels = random.randint(300, 700)
    driver.execute_script(f"window.scrollBy(0, {pixels});")
    time.sleep(random.uniform(0.5, 1.5))


def send_keys_action(driver, *keys):
    """ActionChains로 키 입력"""
    actions = ActionChains(driver)
    for key in keys:
        actions.send_keys(key)
        actions.pause(random.uniform(0.3, 0.7))
    actions.perform()
