# URLs
NAVER_LOGIN_URL = "https://nid.naver.com/nidlogin.login?mode=form"
BLOG_WRITE_URL = "https://blog.naver.com/GoBlogWrite.naver"
MOBILE_BLOG_URL = "https://m.blog.naver.com/FeedList.naver"

# Login selectors
LOGIN_ID = "#id"
LOGIN_PW = "#pw"
LOGIN_BUTTON = "#log\\.login"
LOGIN_FORM = "#frmNIDLogin"
# 2026-08 네이버 NID 로그인 화면 개편(V3_DESKTOP_DEFAULT) 대응.
# 새 화면은 같은 문서에 레이아웃별 버튼(column/row)을 함께 두고 하나만 보여주므로 둘 다 후보로 둔다.
# 구 구조(#log.login, .btn_login)는 네이버 A/B 롤백 대비로 뒤에 남긴다.
# 주의: 바로 옆 패스키 버튼(#passkeyBtn_*)은 다른 인증 흐름이라 절대 후보에 넣지 않는다.
LOGIN_BUTTON_SELECTORS = [
    "#loginBtn_column",
    "#loginBtn_row",
    LOGIN_BUTTON,
    "button.btn_login",
    "input.btn_login",
]

# Editor - iframe & popups
EDITOR_IFRAME = "mainFrame"
POPUP_CANCEL = ".se-popup-button-cancel"
HELP_CLOSE = ".se-help-panel-close-button"

# Editor - content
TITLE_AREA = ".se-section-documentTitle"
QUOTATION_OPEN = ".se-toolbar-item-insert-quotation .se-document-toolbar-select-option-button"
QUOTATION_STYLE = ".se-toolbar-option-insert-quotation-quotation_underline-button"
# 문단 서식(본문/소제목/인용구) — 2026-08-25 실측. 스마트에디터 ONE 은 이 드롭다운에서만
# 소제목을 줄 수 있다. 그전까지 파서가 `## 소제목` 을 인용구로 바꿔 넣어서
# 모든 글이 "인용구-문단-이미지" 반복으로 나왔다.
TEXT_FORMAT_DROPDOWN = ".se-text-format-toolbar-button"
TEXT_FORMAT_SECTION_TITLE = ".se-toolbar-option-text-format-sectionTitle-button"
TEXT_FORMAT_BODY = ".se-toolbar-option-text-format-text-button"

# 목록·표 — 2026-08-25 실측.
# 목록은 드롭다운을 열어 기호/숫자를 고르고, 다시 열어 "목록해제"로 빠져나온다.
# 표는 버튼 한 번에 3행 3열이 바로 삽입된다(별도 입력창 없음).
LIST_DROPDOWN = "[class*='se-list-bullet-toolbar']"
LIST_BULLET = "[class*='se-toolbar-option-list-bullet']"
LIST_DECIMAL = "[class*='se-toolbar-option-list-decimal']"
LIST_RESET = "[class*='se-toolbar-option-list-reset']"
TABLE_BUTTON = ".se-table-toolbar-button"

IMAGE_BUTTON = ".se-toolbar-item-image"
BOLD_BUTTON = ".se-bold-toolbar-button"
MAP_BUTTON = ".se-toolbar-item-map"

# Editor - font
FONT_DROPDOWN = ".se-toolbar-item-font-family .se-document-toolbar-select-option-button"
FONT_OPTIONS = {
    "나눔고딕": "nanumgothic",
    "나눔명조": "nanummyeongjo",
    "나눔스퀘어": "nanumsquare",
    "나눔바른고딕": "nanumbarungothic",
    "마루부리": "maruburi",
}

# Editor - map
MAP_SEARCH_RESULT = ".se-place-map-search-result-item"
MAP_ADD_BUTTON = ".se-place-add-button"
MAP_CONFIRM = ".se-popup-button-confirm"

# Publishing
SAVE_BUTTON = ".save_btn__bzc5B"
PUBLISH_BUTTON = ".publish_btn__m9KHH"
CONFIRM_BUTTON = ".confirm_btn__WEaBq"

# Scheduled publishing
SCHEDULE_RADIO = "label[for='radio_time2']"
DATE_INPUT = ".input_date__QmA0s"
PUBLISH_LAYER = ".layer_publish__vA9PX"
DATEPICKER_YEAR = ".ui-datepicker-year"
DATEPICKER_MONTH = ".ui-datepicker-month"
DATEPICKER_NEXT = ".ui-datepicker-next"
DATEPICKER_DAYS = "button.ui-state-default[style*='pointer-events: initial']"
HOUR_SELECT = ".hour_option__J_heO"
MINUTE_SELECT = ".minute_option__Vb3xB"

# Engagement - likes
MOBILE_POST_LINKS = ".link__Awlz5"
LIKE_BUTTON = "body > div.floating_menu > div > div.btn_like_w > div > div > a"

# Engagement - comments
COMMENT_BUTTON = "#body > div.floating_menu > div > div.btn_r > a.btn_reply"
COMMENT_INPUT = ".u_cbox_write_wrap .u_cbox_inbox"
COMMENT_UPLOAD = ".u_cbox_btn_upload"
POST_BODY = ".se-main-container"

# Engagement - neighbor (서로이웃)
NAVER_SEARCH_BLOG_URL = "https://search.naver.com/search.naver?ssc=tab.blog.all&sm=tab_jum&query="
SEARCH_BLOG_LINKS = ".title_area a"
SEARCH_BLOG_USER = ".user_info a"
BLOG_HOME_URL = "https://blog.naver.com/"
# 이웃추가 버튼 - 여러 셀렉터 시도 (네이버 블로그 리뉴얼 대응)
NEIGHBOR_ADD_BTN_SELECTORS = [
    ".btn_addbuddy",                       # 현재 네이버 블로그
    "a[href*='BuddyAddForm']",             # URL 기반
    ".btn_buddy",                          # 구버전
]
NEIGHBOR_MUTUAL_RADIO = "#each_buddy_add, input[name='relation'][value='1']"
NEIGHBOR_MSG_TEXTAREA = "#message, textarea[name='message']"
NEIGHBOR_SUBMIT_BTN = "._buddyAddNext, .btn_next, button[type='submit']"
NEIGHBOR_CONFIRM_BTN = "._buddyAddConfirm, ._buddyAddNext, .btn_confirm, button[type='submit']"

# Publishing - category (발행 팝업 내 카테고리 선택)
CATEGORY_BUTTON = "[class*='category'] button, .btn_category"
CATEGORY_LIST_ITEM = "[class*='category'] li, .category_item"

# config.yaml selectors 오버라이드 (네이버 에디터 업데이트 시 코드 수정 없이 대응)
try:
    from config import SELECTORS as _cfg_sel
    if isinstance(_cfg_sel, dict):
        def _ov(key, default):
            v = _cfg_sel.get(key, "")
            return v if v else default
        TITLE_AREA     = _ov("title_area",     TITLE_AREA)
        BOLD_BUTTON    = _ov("bold_button",    BOLD_BUTTON)
        TEXT_FORMAT_DROPDOWN = _ov("text_format_dropdown", TEXT_FORMAT_DROPDOWN)
        TEXT_FORMAT_SECTION_TITLE = _ov("text_format_section_title", TEXT_FORMAT_SECTION_TITLE)
        TEXT_FORMAT_BODY = _ov("text_format_body", TEXT_FORMAT_BODY)
        LIST_DROPDOWN  = _ov("list_dropdown",  LIST_DROPDOWN)
        LIST_BULLET    = _ov("list_bullet",    LIST_BULLET)
        LIST_DECIMAL   = _ov("list_decimal",   LIST_DECIMAL)
        LIST_RESET     = _ov("list_reset",     LIST_RESET)
        TABLE_BUTTON   = _ov("table_button",   TABLE_BUTTON)
        SAVE_BUTTON    = _ov("save_button",    SAVE_BUTTON)
        PUBLISH_BUTTON = _ov("publish_button", PUBLISH_BUTTON)
        CONFIRM_BUTTON = _ov("confirm_button", CONFIRM_BUTTON)
        SCHEDULE_RADIO = _ov("schedule_radio", SCHEDULE_RADIO)
        DATE_INPUT     = _ov("date_input",     DATE_INPUT)
        HOUR_SELECT    = _ov("hour_select",    HOUR_SELECT)
        MINUTE_SELECT  = _ov("minute_select",  MINUTE_SELECT)
except Exception:
    pass
