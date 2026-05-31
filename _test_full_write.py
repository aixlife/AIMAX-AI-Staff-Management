"""Gemini 글 생성 + Gemini 이미지 + 에디터 입력 + 임시저장 전체 통합 테스트"""
import sys, os, time, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import certifi
os.environ.setdefault("SSL_CERT_FILE", certifi.where())
os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())

import keyring

GEMINI_KEY = subprocess.run(['security','find-generic-password','-l','GEMINI_API_KEY','-w'],
                            capture_output=True, text=True).stdout.strip()
NAVER_ID   = "likimartin"
NAVER_PW   = keyring.get_password("NaverBlogAuto", "naver_pw")
KEYWORD    = "성수동 카페 추천"

print(f"계정  : {NAVER_ID}")
print(f"Gemini: {GEMINI_KEY[:12]}...")
print(f"키워드: {KEYWORD}")
print()

# ── 1. Gemini로 글 생성 ──────────────────────────────────────
print("="*55)
print("[1/4] Gemini 글 생성")
print("="*55)
t0 = time.time()
from content.ai_text import generate_blog_content
content, usage = generate_blog_content(KEYWORD, GEMINI_KEY, model="gemini", return_usage=True)

if not content:
    print("✗ 글 생성 실패")
    sys.exit(1)

elapsed = time.time() - t0
lines = content.strip().split("\n")
in_tok  = usage.get("input_tokens", 0)
out_tok = usage.get("output_tokens", 0)
cost_krw = (in_tok * 0.15 + out_tok * 0.60) / 1_000_000 * 1380
print(f"✓ 생성 완료 ({elapsed:.1f}초)")
print(f"  제목: {lines[0][:60]}")
print(f"  길이: {len(content)}자")
print(f"  토큰: 입력 {in_tok:,} / 출력 {out_tok:,}")
print(f"  비용: {cost_krw:.1f}원")

# ── 2. 마크다운 파싱 ──────────────────────────────────────────
print()
print("="*55)
print("[2/4] 마크다운 파싱")
print("="*55)
from content.markdown_parser import parse_markdown
title, sections = parse_markdown(content)
image_count = sum(1 for t, _ in sections if t == "image")
print(f"✓ 제목: {title[:50]}")
print(f"  섹션: {len(sections)}개 (이미지 {image_count}개)")

# ── 3. 브라우저 + 로그인 ──────────────────────────────────────
print()
print("="*55)
print("[3/4] 브라우저 시작 + 로그인 + 에디터 진입")
print("="*55)
from browser.stealth_driver import create_stealth_driver
from auth.naver_login import login
from posting.editor import navigate_to_editor, input_title, input_content, set_font

driver = create_stealth_driver()
login(driver, NAVER_ID, NAVER_PW)
navigate_to_editor(driver, NAVER_ID, NAVER_PW)
print("✓ 에디터 진입 완료")

# ── 4. 제목 + 본문 + 이미지 입력 ────────────────────────────
print()
print("="*55)
print("[4/4] 에디터 입력 (본문 + 이미지)")
print("="*55)

input_title(driver, title)
print(f"  제목 입력 완료")

t1 = time.time()
input_content(driver, sections, GEMINI_KEY)
elapsed2 = time.time() - t1
print(f"  본문 입력 완료 ({elapsed2:.0f}초)")

# 임시저장
from posting.publisher import save_draft
save_draft(driver)
print()
print("="*55)
print("  ✓ 임시저장 완료!")
print(f"  URL: {driver.current_url[:80]}")
print("  → 네이버 블로그 임시저장함에서 이미지 포함 여부 확인하세요")
print("="*55)

time.sleep(3)
driver.quit()
