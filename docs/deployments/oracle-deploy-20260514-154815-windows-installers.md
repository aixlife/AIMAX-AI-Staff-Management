# Oracle Deploy 20260514-154815 Windows Installers

- mode: `windows-installers-only`
- host: `oracle-server`
- download_dir: `/home/ubuntu/aimax-downloads`
- remote_tmp: `/tmp/aimax-windows-installers-20260514-154815`
- remote_backup: `/home/ubuntu/aimax-backups/20260514-154815-windows-installers`
- source_outbox: `/Users/aixlife/Documents/Shared-Bridge/20_Deploy-To-Windows/AIMAX-20260514-windows-parity-report-env/outbox-20260514-1443-windows-parity-report-env`

## Files

| label | local | remote | sha256 |
|---|---|---|---|
| Windows bundle | `/Users/aixlife/Projects/NaverBlogAuto-main-mac/dist/upload_installers/aimax-bundle-windows.exe` | `/home/ubuntu/aimax-downloads/aimax-bundle-windows.exe` | `33b4aa501f46738ef1eeea5a2a6ba13839d6464800bf4ce60afcdc27c83b343e` |
| Windows yeri | `/Users/aixlife/Projects/NaverBlogAuto-main-mac/dist/upload_installers/aimax-yeri-windows.exe` | `/home/ubuntu/aimax-downloads/aimax-yeri-windows.exe` | `afddf37046ae9d7b20663543aeca2528ca0664804b024c8326cc9bbc4bb29ec7` |
| Windows hyunju | `/Users/aixlife/Projects/NaverBlogAuto-main-mac/dist/upload_installers/aimax-hyunju-windows.exe` | `/home/ubuntu/aimax-downloads/aimax-hyunju-windows.exe` | `990a4f4aedfd96c055a21cbf41cf74e2a699085a1c9a9cc22bee1d4e7a123fdb` |

## Local Checks

```text
python -m py_compile app.py split_version/app.py split_version/app_find.py split_version/app_engage_write.py diagnostics/error_reporter.py diagnostics/system_info.py
OK

git apply --reverse --check windows-source-delta-20260514-diagnostics-probe.patch
OK

shasum -a 256 dist/upload_installers/aimax-*-windows.exe
33b4aa501f46738ef1eeea5a2a6ba13839d6464800bf4ce60afcdc27c83b343e  dist/upload_installers/aimax-bundle-windows.exe
990a4f4aedfd96c055a21cbf41cf74e2a699085a1c9a9cc22bee1d4e7a123fdb  dist/upload_installers/aimax-hyunju-windows.exe
afddf37046ae9d7b20663543aeca2528ca0664804b024c8326cc9bbc4bb29ec7  dist/upload_installers/aimax-yeri-windows.exe
```

## Remote SHA

```text
33b4aa501f46738ef1eeea5a2a6ba13839d6464800bf4ce60afcdc27c83b343e  /home/ubuntu/aimax-downloads/aimax-bundle-windows.exe
afddf37046ae9d7b20663543aeca2528ca0664804b024c8326cc9bbc4bb29ec7  /home/ubuntu/aimax-downloads/aimax-yeri-windows.exe
990a4f4aedfd96c055a21cbf41cf74e2a699085a1c9a9cc22bee1d4e7a123fdb  /home/ubuntu/aimax-downloads/aimax-hyunju-windows.exe
```

## Service Status

```text
aimax-reports-api.service: active
health: {"ok":true,"service":"aimax-reports-api"}
```

## Result

Deployment completed. Only Windows installer files were replaced; macOS installer files were not uploaded in this pass.
