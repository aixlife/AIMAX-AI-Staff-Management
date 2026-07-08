#!/usr/bin/env bash
# 2026-07-08 맥스(MaxAlert) 신규 직원 오픈 — 기존 회원 전원 무료 권한 부여 (CEO 지시)
# 기준: 이 시점까지 존재하는 모든 계정의 entitlements.products에 "maxalert" 추가.
# 이후 신규 가입자는 maxalert 미보유 → "기존 회원만 무료"가 자연 성립.
# (참고: bundle 보유자는 productAllowed의 bundle 포함 규칙으로 이미 접근 가능 — 명시 부여로 통일)
# 백업 생성 후 갱신, 멱등(재실행해도 중복 추가 없음).
set -euo pipefail

REMOTE_HOST="${AIMAX_DEPLOY_HOST:-oracle-server}"

ssh -o BatchMode=yes "$REMOTE_HOST" "
set -e
cd /home/ubuntu/aimax-reports/data
cp users.json users.json.bak-20260708-maxalert-grant
python3 <<'EOF'
import json, datetime
now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3]+'Z'
raw = json.load(open('users.json'))
users = raw if isinstance(raw, list) else raw.get('users', [])
granted = skipped = 0
for u in users:
    ent = u.get('entitlements')
    if not isinstance(ent, dict):
        ent = {'product': 'maxalert', 'products': [], 'status': 'active',
               'source': 'maxalert_launch_grant', 'granted_at': now,
               'expires_at': None, 'updated_at': now}
        u['entitlements'] = ent
    products = ent.get('products')
    if not isinstance(products, list):
        products = []
        ent['products'] = products
    if 'maxalert' in products:
        skipped += 1
        continue
    products.append('maxalert')
    ent['updated_at'] = now
    u['updated_at'] = now
    granted += 1
with open('users.json', 'w') as f:
    json.dump(raw, f, ensure_ascii=False, indent=2)
print('granted:', granted, '/ already had:', skipped, '/ total:', len(users))
EOF
echo '--- 검증 ---'
python3 -c \"
import json
raw=json.load(open('users.json'))
users=raw if isinstance(raw,list) else raw.get('users',[])
have=sum(1 for u in users if 'maxalert' in (u.get('entitlements') or {}).get('products',[]))
print('maxalert 보유 계정:', have, '/', len(users))
\"
"
echo "완료. 서버 프로세스는 요청 시 파일을 읽으므로 재시작 불필요 여부는 배포 검증에서 확인합니다."
