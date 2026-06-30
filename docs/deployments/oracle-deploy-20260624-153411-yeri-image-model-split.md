# Oracle Deploy 20260624-153411-yeri-image-model-split

- mode: `web-local`
- backup: `/home/ubuntu/aimax-backups/20260624-153411-yeri-image-model-split`
- service: `aimax-reports-api.service`
- note: local install used because SSH alias oracle-server did not resolve and direct SSH key was unavailable

## Files

| label | local | target | sha256 |
|---|---|---|---|
| api server | `oracle/aimax-reports-api/server.js` | `/home/ubuntu/aimax-reports-api/server.js` | `2e313f386e33422afec35f3e018b8e9e975c7cb2fa77fe1b29cea7341e5d3a0d` |
| web app | `oracle/aimax-reports-api/static/app.html` | `/home/ubuntu/aimax-reports-api/static/app.html` | `d12a0c8ea240d40766678e050139b3245de1b90e751091b1f63d1b641c2216e9` |
| admin app | `oracle/aimax-reports-api/static/admin.html` | `/home/ubuntu/aimax-reports-api/static/admin.html` | `fe61a187c123f5415e14bbfacb69105e231a2b7189a81acbb45b48cfb70a3b60` |
| setup app | `oracle/aimax-reports-api/static/setup.html` | `/home/ubuntu/aimax-reports-api/static/setup.html` | `5b2d37070d72b86cd93aaf06825e2bb0f3d89febc89fb726f8e8f47867aa057d` |
| eunseo web app | `oracle/aimax-reports-api/static/eunseo/index.html` | `/home/ubuntu/aimax-reports-api/static/eunseo/index.html` | `770d90b331c2234ebb91cd0529333b4626be6558d4c817d364e7c9dad53ef7d6` |
| eunseo manifest | `oracle/aimax-reports-api/static/eunseo/manifest.webmanifest` | `/home/ubuntu/aimax-reports-api/static/eunseo/manifest.webmanifest` | `568661b1451d8e2c19fc90e2c9e3d41ba67b73e0ea4abadf33b3b1930ad56016` |
| eunseo service worker | `oracle/aimax-reports-api/static/eunseo/sw.js` | `/home/ubuntu/aimax-reports-api/static/eunseo/sw.js` | `971dd4328bd2aa963c917586bce87f6b62f5ac8c4878e5fa2d55ad650c11a986` |
| avatar eunseo | `oracle/aimax-reports-api/static/assets/avatar_eunseo.jpg` | `/home/ubuntu/aimax-reports-api/static/assets/avatar_eunseo.jpg` | `4a54fef2a6022c6f4ddf241b9656d496185e0577fe6bb3562f27b45a1b4c3acd` |
| avatar nakyung | `oracle/aimax-reports-api/static/assets/avatar_nakyung.jpg` | `/home/ubuntu/aimax-reports-api/static/assets/avatar_nakyung.jpg` | `3554efc81e0351e90f2f9ae4a5e24ade6fd3748868285e02d71cc87fcfbdf669` |
| avatar hyunseong | `oracle/aimax-reports-api/static/assets/avatar_hyunseong.jpg` | `/home/ubuntu/aimax-reports-api/static/assets/avatar_hyunseong.jpg` | `1fec9150ab9ceeee4c46212591af1b8a51dba3a081b919fd439b74c038b02d0a` |
| avatar sangsu | `oracle/aimax-reports-api/static/assets/avatar_sangsu.jpg` | `/home/ubuntu/aimax-reports-api/static/assets/avatar_sangsu.jpg` | `1fec9150ab9ceeee4c46212591af1b8a51dba3a081b919fd439b74c038b02d0a` |
| avatar yunmi | `oracle/aimax-reports-api/static/assets/avatar_yunmi.jpg` | `/home/ubuntu/aimax-reports-api/static/assets/avatar_yunmi.jpg` | `0fd2d7cd99f04f26ce0bb0d6f81fca363d12b6d4136d34d90e0bda9fc3ef662b` |
| avatar songi | `oracle/aimax-reports-api/static/assets/avatar_songi.jpg` | `/home/ubuntu/aimax-reports-api/static/assets/avatar_songi.jpg` | `0db033e9431fd89419d59af8bfb208c45f60008913f8cb5641827a8357f3d171` |
| avatar jieun | `oracle/aimax-reports-api/static/assets/avatar_jieun.jpg` | `/home/ubuntu/aimax-reports-api/static/assets/avatar_jieun.jpg` | `6c5f7aff4ae20d8a9fd9213978588ac18266d56797d6e8f12f4c54ced95f3eb3` |
| aimax brain preview mp4 | `oracle/aimax-reports-api/static/assets/aimax-brain-preview.mp4` | `/home/ubuntu/aimax-reports-api/static/assets/aimax-brain-preview.mp4` | `7c983ee48442d3706064f14131dadf38c00c28c25af5b2d5ba27e4d3eccac8a9` |
| aimax brain preview webm | `oracle/aimax-reports-api/static/assets/aimax-brain-preview.webm` | `/home/ubuntu/aimax-reports-api/static/assets/aimax-brain-preview.webm` | `51f650f7dedead93b2a8c8cc57f5e8d62f195c034df3e341ef71a6ca4f9bac6b` |
| avatar placeholder | `oracle/aimax-reports-api/static/assets/avatar_placeholder.svg` | `/home/ubuntu/aimax-reports-api/static/assets/avatar_placeholder.svg` | `7ebfa98a659eefc0b0ea1d029cf0410a48e840d79369304e13ee20aa3cf6c2dd` |

## Remote SHA

```text
2e313f386e33422afec35f3e018b8e9e975c7cb2fa77fe1b29cea7341e5d3a0d  /home/ubuntu/aimax-reports-api/server.js
d12a0c8ea240d40766678e050139b3245de1b90e751091b1f63d1b641c2216e9  /home/ubuntu/aimax-reports-api/static/app.html
fe61a187c123f5415e14bbfacb69105e231a2b7189a81acbb45b48cfb70a3b60  /home/ubuntu/aimax-reports-api/static/admin.html
5b2d37070d72b86cd93aaf06825e2bb0f3d89febc89fb726f8e8f47867aa057d  /home/ubuntu/aimax-reports-api/static/setup.html
```

## Service Status

```text
● aimax-reports-api.service - AIMAX Reports API
     Loaded: loaded (/home/ubuntu/.config/systemd/user/aimax-reports-api.service; enabled; preset: enabled)
     Active: active (running) since Wed 2026-06-24 15:34:11 KST; 2s ago
   Main PID: 1464021 (MainThread)
      Tasks: 7 (limit: 28659)
     Memory: 68.6M (peak: 68.6M)
        CPU: 250ms
     CGroup: /user.slice/user-1001.slice/user@1001.service/app.slice/aimax-reports-api.service
             └─1464021 /usr/bin/node /home/ubuntu/aimax-reports-api/server.js

Jun 24 15:34:11 openclaw systemd[1040]: Started aimax-reports-api.service - AIMAX Reports API.
Jun 24 15:34:11 openclaw node[1464021]: aimax-reports-api listening on http://127.0.0.1:18988
```

## Result

Deployment completed via local install because oracle-server SSH alias was unavailable.

## Post Deploy Verification

- `curl -fsSL https://api.aimax.ai.kr/health` returned `ok:true`.
- `aimax-reports-api.service` is active after restart.
- Live `/app` includes deployed markers:
  - `글쓰기 모델`
  - `이미지 모델`
  - `yeriImageModel`
  - `gpt-image-2`
  - `gemini-3-pro-image`
  - `Gemini Nano Banana Pro`
- Local/production SHA matched for `server.js` and `static/app.html`.

## Follow-up

Windows local agent rebuild is required for deployed Windows users to honor the new `image_model` payload during actual image generation.

Shared-bridge handoff:

- `/home/ubuntu/project/shared-bridge/20_Deploy-To-Windows/2026-06-24-yeri-image-model-split/WINDOWS_HANDOFF_20260624_yeri_image_model_split.md`
- `/home/ubuntu/project/shared-bridge/20_Deploy-To-Windows/2026-06-24-yeri-image-model-split/yeri_image_model_split.patch`
