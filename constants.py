# URLs
NAVER_LOGIN_URL = "https://nid.naver.com/nidlogin.login?mode=form"
BLOG_WRITE_URL = "https://blog.naver.com/GoBlogWrite.naver"
MOBILE_BLOG_URL = "https://m.blog.naver.com/FeedList.naver"

# Login selectors
LOGIN_ID = "#id"
LOGIN_PW = "#pw"
LOGIN_BUTTON = "#log\\.login"

# Editor - iframe & popups
EDITOR_IFRAME = "mainFrame"
POPUP_CANCEL = ".se-popup-button-cancel"
HELP_CLOSE = ".se-help-panel-close-button"

# Editor - content
TITLE_AREA = ".se-section-documentTitle"
QUOTATION_OPEN = ".se-toolbar-item-insert-quotation .se-document-toolbar-select-option-button"
QUOTATION_STYLE = ".se-toolbar-option-insert-quotation-quotation_underline-button"
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
        SAVE_BUTTON    = _ov("save_button",    SAVE_BUTTON)
        PUBLISH_BUTTON = _ov("publish_button", PUBLISH_BUTTON)
        CONFIRM_BUTTON = _ov("confirm_button", CONFIRM_BUTTON)
        SCHEDULE_RADIO = _ov("schedule_radio", SCHEDULE_RADIO)
        DATE_INPUT     = _ov("date_input",     DATE_INPUT)
        HOUR_SELECT    = _ov("hour_select",    HOUR_SELECT)
        MINUTE_SELECT  = _ov("minute_select",  MINUTE_SELECT)
except Exception:
    pass
