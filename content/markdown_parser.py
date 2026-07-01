import re
from utils.logger import get_logger

logger = get_logger(__name__)


def parse_markdown(content):
    """마크다운 텍스트를 파싱하여 (title, content_list) 반환

    content_list 항목 형식:
      ('quote', '인용구 텍스트')
      ('image', '이미지 프롬프트')
      ('text', [('text', '일반텍스트'), ('bold', '볼드텍스트'), ('text', '\\n'), ...])
    """
    lines = content.split('\n')

    # 제목 추출 (첫 번째 # 라인)
    title = ""
    start_idx = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('# ') and not stripped.startswith('## '):
            title = stripped.lstrip('# ').strip()
            start_idx = i + 1
            break

    if not title and lines:
        title = lines[0].strip('# \n')
        start_idx = 1

    content_list = []
    current_section = []

    for line in lines[start_idx:]:
        stripped = line.strip()

        # ## 인용구
        if stripped.startswith('##'):
            if current_section:
                content_list.append(('text', current_section))
                current_section = []
            quote_text = stripped.lstrip('# ').strip()
            content_list.append(('quote', quote_text))
            continue

        # [이미지] 프롬프트
        if stripped.startswith('[이미지]'):
            if current_section:
                content_list.append(('text', current_section))
                current_section = []
            prompt = stripped.replace('[이미지]', '').strip()
            if '프롬프트:' in prompt:
                prompt = prompt.split('프롬프트:')[1].strip().strip('"')
            content_list.append(('image', prompt))
            continue

        # 빈 줄 → 문단 구분 (Enter 2번 = 한 줄 띄기)
        if not stripped:
            if current_section and current_section[-1] != ('text', '\n\n'):
                current_section.append(('text', '\n\n'))
            continue

        # 리스트 마커 제거: - 또는 * 로 시작하는 줄 → 일반 텍스트로 변환
        cleaned = _strip_list_marker(stripped)

        # 일반 텍스트 (볼드 + URL 링크 처리 포함)
        parts = _parse_bold(cleaned)
        parts = _parse_links(parts)
        current_section.extend(parts)
        current_section.append(('text', '\n'))

    if current_section:
        # 마지막 불필요한 줄바꿈 제거
        while current_section and current_section[-1] in [('text', '\n'), ('text', '\n\n')]:
            current_section.pop()
        if current_section:
            content_list.append(('text', current_section))

    logger.info(f"마크다운 파싱 완료: 제목='{title}', {len(content_list)}개 블록")
    return title, content_list


def parse_markdown_file(file_path):
    """마크다운 파일을 읽어서 파싱"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    return parse_markdown(content)


def rebalance_image_blocks(content_list):
    """Move tail-stacked image blocks back between text sections.

    AI models sometimes place all ``[이미지]`` lines at the end. The Smart Editor
    input function preserves list order, so rebalancing here keeps images near
    the related body instead of inserting them as a bottom pile.
    """
    items = list(content_list or [])
    if len(items) < 3:
        return items, 0

    tail_images = []
    while items and items[-1][0] == "image":
        tail_images.insert(0, items.pop())
    if len(tail_images) < 2:
        return content_list, 0

    target_indexes = [
        index for index, item in enumerate(items)
        if item and item[0] in {"text", "quote"}
    ]
    if len(target_indexes) < 2:
        return content_list, 0

    insert_after = target_indexes[: max(1, len(target_indexes) - 1)]
    buckets = {index: [] for index in target_indexes}
    for image_index, image in enumerate(tail_images):
        slot = min(len(insert_after) - 1, int(image_index * len(insert_after) / len(tail_images)))
        buckets.setdefault(insert_after[slot], []).append(image)

    rebalanced = []
    for index, item in enumerate(items):
        rebalanced.append(item)
        rebalanced.extend(buckets.get(index, []))
    return rebalanced, len(tail_images)


def _strip_list_marker(line):
    """줄 앞의 - 또는 * 리스트 마커를 제거하여 일반 텍스트로 변환

    예: '- 기초 문법 익히기' → '기초 문법 익히기'
        '* 중요한 포인트' → '중요한 포인트'
        '  - 들여쓰기된 항목' → '들여쓰기된 항목'
    """
    cleaned = re.sub(r'^[\s]*[-*]\s+', '', line)
    return cleaned


def _parse_links(parts):
    """텍스트 파트에서 URL을 감지하여 ('link', url) 파트로 분리"""
    url_pattern = re.compile(r'(https?://[^\s]+)')
    result = []
    for part_type, part_text in parts:
        if part_type == 'text' and 'http' in part_text:
            segments = url_pattern.split(part_text)
            for seg in segments:
                if url_pattern.match(seg):
                    result.append(('link', seg))
                elif seg:
                    result.append(('text', seg))
        else:
            result.append((part_type, part_text))
    return result


def _parse_bold(line):
    """한 줄에서 **볼드** 마크다운을 파싱하여 [('text'|'bold', text), ...] 리스트 반환"""
    parts = []
    i = 0
    is_bold = False
    current_text = ''

    while i < len(line):
        if i < len(line) - 1 and line[i:i + 2] == '**':
            if current_text:
                parts.append(('bold' if is_bold else 'text', current_text))
                current_text = ''
            is_bold = not is_bold
            i += 2
        else:
            current_text += line[i]
            i += 1

    if current_text:
        parts.append(('bold' if is_bold else 'text', current_text.rstrip()))

    return parts
