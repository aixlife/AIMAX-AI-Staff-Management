#!/bin/bash
# NaverBlogAuto — Mac 더블클릭 실행 파일
# 이 파일을 더블클릭하면 터미널이 열리며 자동으로 실행됩니다.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/setup.sh"
