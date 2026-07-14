#!/usr/bin/env bash
# 2026-07-10 보고 628(AIMAX-RPT-20260628085501-2f299749) 운영자 교정 (CEO 승인 후 실행)
# - 증상: 지은 권한(이벤트 부여) 맥 사용자 — 접수 당시(6/28) 지은 맥 버전 미출시라 채용 목록에 미표시
# - 문제: 잘못 붙은 mac_gatekeeper 안내가 7/2 메일로 발송됨 (옛 자유텍스트 분류 오귀속)
# - 조치: 안내 문구 교정 + user_notified 마커 초기화 + status_updated_at 갱신
#   → 서버 waiting_user 메일 스윕(user_notified_at 비어 있고 status_updated_at 7일 이내 선별)이
#     교정 안내 메일을 1회 자동 재발송
# 백업: reports-index.jsonl.bak-20260710-628-fix 생성 후 갱신. 재실행해도 같은 결과(멱등).
set -euo pipefail

REMOTE_HOST="${AIMAX_DEPLOY_HOST:-oracle-server}"

ssh -o BatchMode=yes "$REMOTE_HOST" "
set -e
cd /home/ubuntu/aimax-reports/data
cp reports-index.jsonl reports-index.jsonl.bak-20260710-628-fix
python3 <<'EOF'
import json, datetime
now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3]+'Z'
rows = [json.loads(l) for l in open('reports-index.jsonl') if l.strip()]
changed = 0
for r in rows:
    if r.get('report_id') == 'AIMAX-RPT-20260628085501-2f299749':
        r['status'] = 'waiting_user'
        r['status_label'] = '사용자 확인 필요'
        r['status_updated_at'] = now
        r['public_message'] = '접수 당시에는 지은(사무지원) 직원의 Mac 버전이 출시 전이라, 계정에 채용 권한이 있어도 직원 목록에 지은이 표시되지 않았습니다. 이전에 발송된 macOS 보안 설정 안내는 이 접수와 맞지 않는 안내였습니다. 혼선을 드려 죄송합니다. 7월 4일 지은 Mac 앱이 출시되어 지금은 채용과 설치가 가능합니다.'
        r['next_update_message'] = '웹앱에 로그인해 직원 목록에서 지은을 선택하고 Mac 앱 다운로드로 설치해주세요. 설치 후에도 지은이 보이지 않으면 이 접수 ID와 함께 알려주세요.'
        # 7/2에 잘못된 안내로 발송된 마커를 지워 교정 메일이 스윕에서 1회 재발송되게 한다
        r['user_notified_at'] = ''
        r['user_notified_channel'] = ''
        r['user_notified_id'] = ''
        r['user_notify_attempts'] = 0
        r['user_notify_last_error_at'] = ''
        changed += 1
open('reports-index.jsonl','w').write('\n'.join(json.dumps(r, ensure_ascii=False) for r in rows)+'\n')
print('changed:', changed)
EOF
grep -c 'AIMAX-RPT-20260628085501-2f299749' reports-index.jsonl
"
echo "완료 — 다음 스윕(5분 주기)에서 교정 메일 발송 예정. 발송 확인: users.json email_events 또는 reports-index user_notified_at"
