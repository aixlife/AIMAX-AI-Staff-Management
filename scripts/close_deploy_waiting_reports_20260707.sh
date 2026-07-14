#!/usr/bin/env bash
# 2026-07-07 배포 완료된 수정 2건의 오류 보고 상태 갱신 (CEO 승인)
# - AIMAX-RPT-20260702061037-0fd5cf1c: 예리 숫자 머리말 중복 — 서버 수정 라이브 반영 안내
# - AIMAX-RPT-20260703064210-b0dd93ae: worker_running 오분류 — v1.0.57 업데이트 안내
# 백업: reports-index.jsonl.bak-20260707-deploy-close 생성 후 갱신. 재실행해도 같은 결과(멱등).
set -euo pipefail

REMOTE_HOST="${AIMAX_DEPLOY_HOST:-oracle-server}"

ssh -o BatchMode=yes "$REMOTE_HOST" "
set -e
cd /home/ubuntu/aimax-reports/data
cp reports-index.jsonl reports-index.jsonl.bak-20260707-deploy-close
python3 <<'EOF'
import json, datetime
now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3]+'Z'
rows = [json.loads(l) for l in open('reports-index.jsonl') if l.strip()]
changed = 0
for r in rows:
    rid = r.get('report_id')
    if rid == 'AIMAX-RPT-20260702061037-0fd5cf1c':
        r['status'] = 'waiting_user'
        r['status_label'] = '사용자 확인 필요'
        r['status_updated_at'] = now
        r['public_message'] = '숫자 머리말이 반복될 수 있던 서버 생성 후처리 보강이 운영에 배포되었습니다. 이후 새로 생성되는 글부터 적용됩니다.'
        r['next_update_message'] = '새 글 1건을 생성해 같은 표현이 사라졌는지 확인해주세요. 같은 증상이 다시 보이면 이 접수 ID와 함께 알려주세요.'
        changed += 1
    elif rid == 'AIMAX-RPT-20260703064210-b0dd93ae':
        r['status'] = 'waiting_user'
        r['status_label'] = '사용자 확인 필요'
        r['status_updated_at'] = now
        r['public_message'] = 'worker_running 단계 오류가 모호하게 표시되던 문제의 수정이 Windows 실행기 v1.0.57에 포함되어 배포되었습니다. 현재 v1.0.55를 사용 중이므로 업데이트가 필요합니다.'
        r['next_update_message'] = '웹앱 업데이트 탭에서 v1.0.57 설치 파일을 받아 AIMAX와 열린 브라우저를 모두 닫고 설치한 뒤, 새 작업 1건만 다시 시도해주세요. 이미지 자동 생성을 쓰신다면 로컬 이미지 모델 API 키 설정도 함께 확인해주세요.'
        changed += 1
with open('reports-index.jsonl','w') as f:
    for r in rows:
        f.write(json.dumps(r, ensure_ascii=False)+'\n')
print('changed:', changed, 'at', now)
EOF
echo '--- 검증 ---'
python3 -c \"
import json
rows=[json.loads(l) for l in open('reports-index.jsonl') if l.strip()]
print('total:', len(rows))
for r in rows:
    if r.get('report_id') in ('AIMAX-RPT-20260702061037-0fd5cf1c','AIMAX-RPT-20260703064210-b0dd93ae'):
        print(r['report_id'], '->', r['status'])
\"
"
echo "완료. 두 사용자는 앱 오류보고 탭에서 새 안내를 보게 됩니다 (피드백 리포트라 이메일 스윕 대상은 아님)."
