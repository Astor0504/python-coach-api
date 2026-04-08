# 🐍 Python 入門學習教練

互動式 Python 教學 + Azure 自然語音朗讀 + Claude AI 教練。

## 功能

- 📖 完整 Python 入門章節
- 🔊 Azure Speech TTS 朗讀 AI 回覆（台灣腔自然語音）
- 🧠 Claude Sonnet AI 教練（後端代理，金鑰不外洩）
- 💻 內建程式碼區塊高亮 + 一鍵複製

## 本機啟動

```bash
cp .env.example .env
# 編輯 .env 填入 AZURE_KEY / ANTHROPIC_KEY

node server.js
```

開啟 http://localhost:5174

## 環境變數

| 變數 | 必填 | 說明 |
|---|---|---|
| `AZURE_KEY` | TTS 必填 | Azure Speech key |
| `AZURE_REGION` | | 預設 `eastasia` |
| `ANTHROPIC_KEY` | AI 必填 | Claude API key |
| `ANTHROPIC_MODEL` | | 預設 `claude-sonnet-4-6` |
| `PORT` | | 預設 `5174`（避免和 ISTQB 專案 `5173` 衝突）|
| `ALLOWED_ORIGINS` | ⚠️ 正式環境必設 | CORS 白名單 |
| `RATE_LIMIT_RPM` | | 每 IP 每分鐘請求數，預設 60 |

## 資訊安全

✅ 金鑰全部在後端，前端只呼叫 `/tts` 和 `/chat`
✅ 每 IP 速率限制
✅ TTS 語音白名單
⚠️ 部署前請把 `.env` 加入 `.gitignore`（已加）
⚠️ 正式環境把 `ALLOWED_ORIGINS` 改為具體網域

## 部署

和 ISTQB 專案一樣，需要 Node 後端：Render / Railway / Fly.io / 自己的 VPS 都可。

## 與 ISTQB 專案的關係

兩個專案**完全獨立**：
- 各自有 server.js、各自的 `.env`、各自的 port
- 各自可獨立部署到不同網域
- 若要共用 Azure 帳號，填一樣的 `AZURE_KEY` 即可（同帳號的額度共用）
- 若要共用 Claude 帳號，填一樣的 `ANTHROPIC_KEY` 即可
