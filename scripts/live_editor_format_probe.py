"""네이버 스마트에디터 서식 실측 탐침 (임시저장 전용, 공개 발행 안 함).

예리가 만드는 서식(소제목·굵게·인용구·목록·표·이미지+설명)이 실제 에디터에 어떻게
들어가는지 확인한다. 실제 워커와 같은 함수(parse_markdown → input_content → save_draft)를 쓴다.

실행(Windows 소스 체크아웃):
  uv run python scripts/live_editor_format_probe.py --image C:\\path\\to\\image.png --out C:\\path\\out
옵션:
  --bold        AIMAX_EDITOR_ENABLE_BOLD=1 로 굵게 입력을 켠다
  --markdown F  탐침 본문 대신 파일의 마크다운을 쓴다
결과: <out>/probe_result.json, probe_editor.png, probe_editor.html
"""
import argparse
import json
import os
import sys
import time
import traceback

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

DEFAULT_MD = """# AIMAX 서식 점검 임시저장 글

와인을 고를 때 **가장 먼저** 볼 것은 산지입니다.

산지만 알아도 맛의 방향이 보여요.

> 처음이라면 산지 하나만 기억해도 충분합니다.

## 산지별로 무엇이 다른가

같은 품종도 **기후**에 따라 맛이 달라집니다.

- 서늘한 곳은 산미가 살아 있어요
- 따뜻한 곳은 과일 향이 진해요
- 바다 가까운 곳은 짭짤한 느낌이 있어요

[이미지] 나무 테이블 위 레드 와인 한 잔 || 잔을 기울여 색을 먼저 보세요

## 고르는 순서

1. 산지를 정한다
2. 품종을 고른다
3. 가격대를 맞춘다

| 기준 | 서늘한 산지 | 따뜻한 산지 |
| --- | --- | --- |
| 맛 | 산미 | 과일 향 |

> 마지막으로, 내 입에 맞는 한 병이 정답입니다.

오늘은 **산지 하나**만 정해서 골라보세요.
"""


def _editor_metrics(driver):
    script = r"""
    const root = document.querySelector('.se-content') || document;
    const q = (sel) => Array.from(root.querySelectorAll(sel));
    const paragraphs = q('.se-text-paragraph').map(p => (p.innerText || '').trim()).filter(Boolean);
    const boldNodes = q('.se-text-paragraph b, .se-text-paragraph strong, .se-text-paragraph .se-fs-, .se-text-paragraph span[style*="font-weight"]');
    const boldBySpan = q('.se-text-paragraph span').filter(s => (getComputedStyle(s).fontWeight|0) >= 600 && (s.innerText||'').trim());
    const quotes = q('.se-component.se-quotation').map(c => ({
      cls: (c.className || '').split(/\s+/).filter(x => x.startsWith('se-l-') || x.includes('quotation')).join(' '),
      text: (c.innerText || '').trim().slice(0, 80),
    }));
    return {
      url: location.href,
      title: ((document.querySelector('.se-documentTitle') || {}).innerText || '').trim(),
      components: q('.se-component').map(c => (c.className || '').split(/\s+/).find(x => x.startsWith('se-') && x !== 'se-component' && !x.startsWith('se-l-')) || ''),
      paragraph_count: paragraphs.length,
      paragraphs: paragraphs.slice(0, 80),
      bold_tag_count: boldNodes.length,
      bold_span_count: boldBySpan.length,
      bold_texts: boldBySpan.map(s => (s.innerText || '').trim()).slice(0, 30),
      quotes,
      lists: q('.se-text-paragraph-list, ol, ul').length,
      tables: q('.se-component.se-table').length,
      images: q('.se-component.se-image').length,
      image_captions: q('.se-component.se-image .se-caption').map(c => (c.innerText || '').trim()),
      hr: q('.se-component.se-horizontalLine').length,
    };
    """
    try:
        return driver.execute_script(script)
    except Exception as exc:
        return {"error": str(exc)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", default="")
    parser.add_argument("--out", default=os.path.join(os.getcwd(), "probe_out"))
    parser.add_argument("--bold", action="store_true")
    parser.add_argument("--markdown", default="")
    parser.add_argument("--no-save", action="store_true")
    parser.add_argument("--style", default="info", help="review | consult | info (글 유형 서식)")
    parser.add_argument("--profile-session", action="store_true", help="저장 세션 파일이 만료돼도 브라우저 프로필 로그인만 확인해 진행")
    args = parser.parse_args()
    if args.bold:
        os.environ["AIMAX_EDITOR_ENABLE_BOLD"] = "1"
    os.makedirs(args.out, exist_ok=True)
    result = {"style": None, "started_at": time.strftime("%Y-%m-%d %H:%M:%S"), "bold_enabled": bool(args.bold), "stages": []}

    from app import load_settings
    from browser.stealth_driver import create_stealth_driver
    from auth.naver_login import login
    from content.markdown_parser import parse_markdown
    from posting.editor import navigate_to_editor, input_title, input_content, format_profile_for_style
    from posting.publisher import save_draft

    md = DEFAULT_MD
    if args.markdown:
        with open(args.markdown, encoding="utf-8") as handle:
            md = handle.read()
    parsed = parse_markdown(md)
    title = parsed.get("title") if isinstance(parsed, dict) else None
    content_list = parsed.get("content") if isinstance(parsed, dict) else parsed
    if isinstance(parsed, tuple):
        title, content_list = parsed[0], parsed[1]
    result["parsed_types"] = [item[0] for item in content_list]
    prepared = {}
    if args.image and os.path.isfile(args.image):
        image_total = sum(1 for item in content_list if item[0] == "image")
        for index in range(1, image_total + 1):
            prepared[index] = {"path": args.image, "provider": "gemini", "model": "gemini-3.1-flash-image"}

    naver_id, naver_pw, *_rest = load_settings()
    if not naver_id:
        result["error"] = "no_saved_naver_id"
        print(json.dumps(result, ensure_ascii=False))
        return 2
    result["naver_id_masked"] = f"{naver_id[:2]}...{naver_id[-2:]}"

    driver = None
    code = 1
    try:
        result["stages"].append("browser_start")
        driver = create_stealth_driver()
        result["stages"].append("naver_login")
        if args.profile_session:
            from auth.naver_login import _blog_session_ready
            result["profile_session_ready"] = bool(_blog_session_ready(driver, naver_id))
            if not result["profile_session_ready"]:
                raise RuntimeError("profile_session_not_logged_in")
        else:
            login(driver, naver_id, naver_pw)
        result["stages"].append("editor_open")
        navigate_to_editor(driver, naver_id, naver_pw)
        result["stages"].append("title")
        input_title(driver, title or "AIMAX 서식 점검 임시저장 글")
        result["stages"].append("content")
        stats = input_content(driver, content_list, api_key="", image_provider="gemini", fallback_api_key="", prepared_images=prepared, format_profile=format_profile_for_style(args.style)) or {}
        result["input_stats"] = {k: v for k, v in stats.items() if k in ("format_profile", "align_applied", "image_attempted", "image_generated", "image_inserted", "image_failures")}
        time.sleep(2)
        result["metrics_before_save"] = _editor_metrics(driver)
        try:
            driver.save_screenshot(os.path.join(args.out, "probe_editor.png"))
            with open(os.path.join(args.out, "probe_editor.html"), "w", encoding="utf-8") as handle:
                handle.write(driver.page_source)
        except Exception as exc:
            result["capture_error"] = str(exc)
        if not args.no_save:
            result["stages"].append("save_draft")
            result["draft_saved"] = bool(save_draft(driver))
        code = 0 if result.get("draft_saved", True) else 1
    except Exception as exc:
        result["error"] = f"{type(exc).__name__}: {exc}"
        result["traceback"] = traceback.format_exc()[-3000:]
        try:
            if driver is not None:
                driver.save_screenshot(os.path.join(args.out, "probe_error.png"))
        except Exception:
            pass
    finally:
        result["finished_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
        with open(os.path.join(args.out, "probe_result.json"), "w", encoding="utf-8") as handle:
            json.dump(result, handle, ensure_ascii=False, indent=2)
        if driver is not None:
            try:
                driver.quit()
            except Exception:
                pass
    print(json.dumps({k: result.get(k) for k in ("stages", "draft_saved", "error")}, ensure_ascii=False))
    return code


if __name__ == "__main__":
    sys.exit(main())
