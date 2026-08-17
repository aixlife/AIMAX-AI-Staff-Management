#!/usr/bin/env bash
# 맥스 v0.2.4 릴리스 게시 후 실행 — 피드백 2건에 완료 안내를 붙인다.
#
# - AIMAX-RPT-20260808174147-ff695d7a: 노션 날짜에 시간 옵션을 켜면 오늘 일정에서 사라짐
# - AIMAX-RPT-20260810170034-d8046cd8: 계란(레벨 캐릭터) 끄는 버튼 요청
#
# 두 건 다 8/13 수정(maxalert 3be8b65)이 브랜치에 머물러 미배포였고, 8/18 v0.2.4 로 릴리스했다.
#
# 전제: maxalert-releases 의 v0.2.4 드래프트 릴리스가 **Publish 된 뒤에** 실행할 것.
#       게시 전에 실행하면 사용자에게 "업데이트하세요"라고 해놓고 받을 게 없다.
# 멱등: 재실행해도 같은 결과. 인덱스와 상세 JSON, 자동화 티켓 상태를 함께 갱신한다.
set -euo pipefail

REMOTE_HOST="${AIMAX_DEPLOY_HOST:-oracle-server}"

ssh -o BatchMode=yes "$REMOTE_HOST" "
set -e
cd /home/ubuntu/aimax-reports/data
cp reports-index.jsonl reports-index.jsonl.bak-20260818-maxalert-v024-close
python3 <<'PYEOF'
import json, datetime, pathlib

now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'

NEXT_STEP = (
    '맥스를 완전히 종료한 뒤 다시 실행하면 v0.2.4 로 자동 업데이트됩니다. '
    '업데이트 후에도 같은 증상이 보이면 이 접수 ID와 함께 알려주세요.'
)

TARGETS = {
    'AIMAX-RPT-20260808174147-ff695d7a': {
        'public_message': (
            '노션 날짜에 시간 옵션을 켜면 오늘 일정 목록에서 사라지던 문제를 수정해 맥스 v0.2.4 로 배포했습니다. '
            '노션이 시간을 못 읽은 게 아니라 맥스의 오늘 일정 판정이 시간 있는 날짜를 걸러내고 있었던 것이 맞습니다. '
            '새벽 시간대 일정이 통째로 빠지던 원인과, 시간대 표기가 없는 일정에서 시간과 사이렌이 사라지던 원인을 함께 고쳤습니다.'
        ),
        'next_update_message': NEXT_STEP,
    },
    'AIMAX-RPT-20260810170034-d8046cd8': {
        'public_message': (
            '레벨 캐릭터를 끄는 설정을 넣어 맥스 v0.2.4 로 배포했습니다. '
            '대시보드 설정에 \"레벨 캐릭터 표시 (포스트잇 아래)\" 체크박스가 생겼고, 끄면 포스트잇만 남습니다. '
            '캐릭터를 옮길 때 포스트잇까지 따라 움직여 불편했던 부분도 이걸로 함께 해소됩니다.'
        ),
        'next_update_message': NEXT_STEP,
    },
}

rows = [json.loads(line) for line in open('reports-index.jsonl', encoding='utf-8') if line.strip()]
changed = []
for row in rows:
    target = TARGETS.get(row.get('report_id'))
    if not target:
        continue
    row['status'] = 'done'
    row['status_label'] = '완료'
    row['status_updated_at'] = now
    row['public_message'] = target['public_message']
    row['next_update_message'] = target['next_update_message']
    changed.append(row)

with open('reports-index.jsonl', 'w', encoding='utf-8') as f:
    for row in rows:
        f.write(json.dumps(row, ensure_ascii=False) + '\n')

# 상세 JSON 의 support 블록도 같이 맞춘다 — 인덱스만 고치면 상세 화면이 옛 안내를 계속 보여준다.
for row in changed:
    date = row.get('date') or (row.get('stored_at') or '')[:10]
    path = pathlib.Path('reports') / date / f\"{row['report_id']}.json\"
    if not path.exists():
        print('detail missing:', path)
        continue
    detail = json.loads(path.read_text(encoding='utf-8'))
    support = dict(detail.get('support') or {})
    support.update({
        'status': 'done',
        'status_label': '완료',
        'public_message': row['public_message'],
        'next_update_message': row['next_update_message'],
        'updated_at': now,
        'auto_guidance_source': 'close_maxalert_feedback_reports_20260818',
    })
    detail['support'] = support
    path.write_text(json.dumps(detail, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('detail updated:', path)

# 자동화 티켓도 닫아 운영 큐에서 내린다.
with open('automation-tickets.jsonl', 'a', encoding='utf-8') as f:
    for row in changed:
        ticket = row.get('automation_ticket_id')
        if not ticket:
            continue
        f.write(json.dumps({
            'ticket_id': ticket,
            'report_id': row['report_id'],
            'status': 'done',
            'updated_at': now,
            'source': 'close_maxalert_feedback_reports_20260818',
        }, ensure_ascii=False) + '\n')

print('changed:', len(changed), 'at', now)
PYEOF
echo '--- 검증 ---'
python3 - <<'PYEOF'
import json
for line in open('/home/ubuntu/aimax-reports/data/reports-index.jsonl', encoding='utf-8'):
    if not line.strip():
        continue
    row = json.loads(line)
    if row.get('report_id') in {'AIMAX-RPT-20260808174147-ff695d7a', 'AIMAX-RPT-20260810170034-d8046cd8'}:
        print(row['report_id'], row.get('status'), row.get('status_label'), '|', (row.get('public_message') or '')[:60])
PYEOF
"
