# python 教學站

## 部署
- **Vercel（主）**: https://python-coach-api.vercel.app
- **Netlify（301→Vercel）**: https://whimsical-panda-485091.netlify.app
- **GitHub**: Astor0504/python-coach-api

## 環境變數（Vercel Production）
- `ANTHROPIC_KEY`、`ANTHROPIC_MODEL`（要改前先查 `vercel env ls`，預設可能是 sonnet）
- `AZURE_KEY`、`AZURE_REGION=eastasia`

## 注意事項
- 共用跟 Excel / ISTQB 同一套 `api/*` 架構（chat / tts / voices / health / _cors / _rateLimit）
- **絕對不要把 API key 放前端**
- 前端走 `<meta name="api-base">` → `/api/*`
- TTS epoch guard 保留
- 曾短暫部署在 Render（`python-coach-api.onrender.com`），已遷移到 Vercel；遇到舊連結改成 Vercel 版

## 2026-07-12 之後的架構事實
- `api/_rateLimit.js`：每 IP 60 RPM（`RATE_LIMIT_RPM` env 可調），套用 chat/tts/voices
- CORS（`api/_cors.js`）：同源永遠放行；白名單外 Origin 回 403；`ALLOWED_ORIGINS` 空/未設時不擋
- SYSTEM_PROMPT 的章節條列由 `CHAPTERS` 陣列動態生成——**加章節只改 CHAPTERS 一處**
- TTS 有前端 Cache API 快取（`tts-v1`，上限 80 條）；formatMessage 整段先 escape 再套 markdown，改渲染邏輯時保持這個順序
- `og-image.png`（1200×630）與 `robots.txt` 在根目錄；OG meta 已含 og:image/og:url/canonical

## 內容風格
- 目標讀者：程式零基礎、想學 python 做自動化
- 避免一上來就講 class / OOP；先講自動化腳本、檔案處理、資料整理
