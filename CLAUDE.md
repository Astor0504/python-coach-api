# python 教學站

## 部署
- **Vercel（主）**: https://python-coach-api.vercel.app
- **Netlify（301→Vercel）**: https://whimsical-panda-485091.netlify.app
- **GitHub**: Astor0504/python-coach-api

## 環境變數（Vercel Production）
- `ANTHROPIC_KEY`、`ANTHROPIC_MODEL`（要改前先查 `vercel env ls`，預設可能是 sonnet）
- `AZURE_KEY`、`AZURE_REGION=eastasia`

## 注意事項
- 共用跟 Excel / ISTQB 同一套 `api/*` 架構（chat / tts / voices / health / _cors）
- **絕對不要把 API key 放前端**
- 前端走 `<meta name="api-base">` → `/api/*`
- TTS epoch guard 保留
- 曾短暫部署在 Render（`python-coach-api.onrender.com`），已遷移到 Vercel；遇到舊連結改成 Vercel 版

## 內容風格
- 目標讀者：程式零基礎、想學 python 做自動化
- 避免一上來就講 class / OOP；先講自動化腳本、檔案處理、資料整理
