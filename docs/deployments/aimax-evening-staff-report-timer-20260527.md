# AIMAX Evening Staff Report Timer - 2026-05-27

## Status

Enabled on Oracle user systemd.

## Units

- `aimax-evening-staff-report.service`
- `aimax-evening-staff-report.timer`

## Schedule

- Daily 18:00 KST
- `Persistent=true`

## Command

```bash
/usr/bin/python3 /home/ubuntu/.openclaw/workspace-makefamily/scripts/aimax_evening_staff_report.py --status-file /home/ubuntu/syncthing-creator-os-vault/reports/aimax/current-status.json --send --json
```

## Verification

- Timer active: yes
- Next trigger after installation: 2026-05-27 18:00:00 KST
- Prior live Telegram send test: pass
- Report wording: team-friendly format without developer-only keywords

