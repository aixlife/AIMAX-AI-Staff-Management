# Oracle Deploy 20260701 v1.0.55 SEO Cancel Rollout

- Deployed at: 2026-07-01 18:08 KST
- Source GitHub main: `c6314fd8b1969420233be64b0e1dbf5f5dc2d5c9`
- Scope: server/web dashboard plus unified Windows/macOS Local Agent bundles
- Backup: `/home/ubuntu/aimax-backups/20260701-180830-v1055-seo-cancel-rollout/`
- Env backup: `/home/ubuntu/aimax-reports-api/.env.bak-20260701-180830-v1055`

## Artifacts

```text
3298c8f72f603a89c940efed7164046613fd453565c3116a829fd8d3dfd3b4de  /home/ubuntu/aimax-downloads/aimax-bundle-windows.exe
eaed35891966ef714e60a7678eefdd9746fe57bdb2f811162698f317bf180c51  /home/ubuntu/aimax-downloads/aimax-bundle-macos.dmg
```

## Version Policy

- Windows latest: `v1.0.55`
- Windows min: `v1.0.44` unchanged
- macOS latest: `v1.0.55`
- macOS min: `v1.0.36` unchanged

## Verification

```text
health True storage True []
windows current v1.0.54 -> latest v1.0.55 update_available=true update_required=false
macos current v1.0.54 -> latest v1.0.55 update_available=true update_required=false
windows current v1.0.55 -> update_available=false update_required=false
macos current v1.0.55 -> update_available=false update_required=false
server.js matches source main
static/app.html matches source main
```

## Notes

- Dashboard/web changes are included through `server.js` and `static/app.html` deployment.
- A GitHub connector push initially produced an intermediate bad `app.py` commit (`d568778`), then immediately repaired it in `c6314fd`. Final `main` is correct: compared with `c9c192f`, `app.py` only adds `GENERATED_DIR = _GENERATED_DIR`.
