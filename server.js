// 🐍 Python 教學網站 — 本地 / 雲端皆可用的後端
// ───────────────────────────────────────
// 功能：
//   1. 靜態檔案伺服
//   2. /tts   → Azure Speech 代理（key 只在後端）
//   3. /chat  → Anthropic Claude 代理（key 只在後端）
//   4. 每 IP rate limit
//   5. CORS allowlist（環境變數控制）
//
// 啟動：
//   本機：
//     AZURE_KEY=xxx AZURE_REGION=eastasia ANTHROPIC_KEY=sk-ant-... node server.js
//   建議用 .env + dotenv 或雲端平台的環境變數介面
//
// 環境變數：
//   AZURE_KEY         Azure Speech subscription key       （TTS 必須）
//   AZURE_REGION      Azure region，例如 eastasia          （預設 eastasia）
//   ANTHROPIC_KEY     Claude API key                      （/chat 必須）
//   ANTHROPIC_MODEL   模型名稱                             （預設 claude-haiku-4-5）
//   PORT              埠號                                 （預設 5173）
//   ALLOWED_ORIGINS   CORS 白名單，逗號分隔；* 代表全開     （預設 *，正式環境請設具體網域）
//   RATE_LIMIT_RPM    每 IP 每分鐘最大請求數                （預設 60）

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 5174;
const AZURE_KEY = process.env.AZURE_KEY || '';
const AZURE_REGION = process.env.AZURE_REGION || 'eastasia';
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
const RATE_LIMIT_RPM = parseInt(process.env.RATE_LIMIT_RPM || '60', 10);
const ROOT = __dirname;

const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml',
  '.png':'image/png', '.jpg':'image/jpeg', '.mp3':'audio/mpeg', '.ico':'image/x-icon',
  '.woff':'font/woff', '.woff2':'font/woff2', '.ttf':'font/ttf'
};

// ───────── Rate limit（簡易記憶體版；多實例請改 Redis）─────────
const rateBuckets = new Map();
function rateLimitCheck(ip){
  const now = Date.now();
  const win = 60_000;
  let b = rateBuckets.get(ip);
  if (!b){ b = { count:0, reset:now+win }; rateBuckets.set(ip, b); }
  if (now > b.reset){ b.count = 0; b.reset = now + win; }
  b.count++;
  return b.count <= RATE_LIMIT_RPM;
}
// 每 5 分鐘清掉過期 bucket
setInterval(() => {
  const now = Date.now();
  for (const [k,v] of rateBuckets) if (now > v.reset + 60_000) rateBuckets.delete(k);
}, 5 * 60_000);

function getIP(req){
  return (req.headers['x-forwarded-for']||'').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

// ───────── CORS ─────────
function applyCors(req, res){
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes('*')){
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && ALLOWED_ORIGINS.includes(origin)){
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

// ───────── JSON body ─────────
function readJson(req, max=200_000){
  return new Promise((resolve, reject) => {
    let data = '', size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > max){ reject(new Error('payload too large')); req.destroy(); return; }
      data += c;
    });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch(e){ reject(e); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, code, obj){
  res.writeHead(code, {'Content-Type':'application/json; charset=utf-8'});
  res.end(JSON.stringify(obj));
}

// ───────── Azure TTS ─────────
function escapeXml(s){
  return s.replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));
}
function azureTTS(text, voice, rate, res){
  if (!AZURE_KEY) return sendJson(res, 500, {error:'AZURE_KEY 未設定'});
  const v = voice || 'zh-TW-HsiaoChenNeural';
  // 白名單：只允許 zh-TW/zh-CN/zh-HK 語音，避免被當作任意語音代理
  if (!/^zh-(TW|CN|HK)-[A-Za-z]+Neural$/.test(v))
    return sendJson(res, 400, {error:'invalid voice'});
  const r = /^[+-]?\d{1,3}%$/.test(rate||'') ? rate : '+0%';
  const lang = v.slice(0,5);
  const ssml = `<speak version='1.0' xml:lang='${lang}'><voice xml:lang='${lang}' name='${v}'><prosody rate='${r}'>${escapeXml(text)}</prosody></voice></speak>`;

  const req = https.request({
    hostname: `${AZURE_REGION}.tts.speech.microsoft.com`,
    path: '/cognitiveservices/v1',
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': AZURE_KEY,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'study-site',
      'Content-Length': Buffer.byteLength(ssml)
    }
  }, (azRes) => {
    if (azRes.statusCode !== 200){
      let body=''; azRes.on('data',d=>body+=d);
      azRes.on('end', () => sendJson(res, azRes.statusCode, {error:'azure', status:azRes.statusCode}));
      return;
    }
    res.writeHead(200, {'Content-Type':'audio/mpeg','Cache-Control':'public, max-age=86400'});
    azRes.pipe(res);
  });
  req.on('error', e => sendJson(res, 500, {error:e.message}));
  req.write(ssml); req.end();
}

function listVoices(res){
  if (!AZURE_KEY) return sendJson(res, 200, []);
  const req = https.request({
    hostname: `${AZURE_REGION}.tts.speech.microsoft.com`,
    path: '/cognitiveservices/voices/list',
    method: 'GET',
    headers: {'Ocp-Apim-Subscription-Key': AZURE_KEY}
  }, (azRes) => {
    let body=''; azRes.on('data',d=>body+=d);
    azRes.on('end', () => {
      try {
        const all = JSON.parse(body);
        const zh = all.filter(v => /^zh-/.test(v.Locale))
          .map(v => ({name:v.ShortName, locale:v.Locale, gender:v.Gender, display:v.LocalName||v.DisplayName}));
        sendJson(res, 200, zh);
      } catch(e){ sendJson(res, 500, {error:'parse'}); }
    });
  });
  req.on('error', e => sendJson(res, 500, {error:e.message}));
  req.end();
}

// ───────── Anthropic Chat ─────────
function anthropicChat(body, res){
  if (!ANTHROPIC_KEY) return sendJson(res, 500, {error:'ANTHROPIC_KEY 未設定'});
  const { system, messages, max_tokens, model } = body || {};
  if (!Array.isArray(messages) || !messages.length)
    return sendJson(res, 400, {error:'messages required'});
  // 長度限制
  if (JSON.stringify(messages).length > 120_000)
    return sendJson(res, 413, {error:'messages too long'});

  const payload = JSON.stringify({
    model: (typeof model === 'string' && /^claude-/.test(model)) ? model : ANTHROPIC_MODEL,
    max_tokens: Math.min(parseInt(max_tokens||1024,10), 2048),
    system: typeof system === 'string' ? system.slice(0, 20_000) : undefined,
    messages
  });

  const req = https.request({
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type':'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version':'2023-06-01',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (apiRes) => {
    let data=''; apiRes.on('data',c=>data+=c);
    apiRes.on('end', () => {
      res.writeHead(apiRes.statusCode, {'Content-Type':'application/json; charset=utf-8'});
      res.end(data);
    });
  });
  req.on('error', e => sendJson(res, 502, {error:e.message}));
  req.write(payload); req.end();
}

// ───────── Static ─────────
function serveStatic(req, res){
  let p = decodeURIComponent(url.parse(req.url).pathname);
  if (p === '/') p = '/index.html';
  const full = path.normalize(path.join(ROOT, p));
  if (!full.startsWith(ROOT)){ res.writeHead(403); return res.end('forbidden'); }
  fs.stat(full, (err, st) => {
    if (err || !st.isFile()){ res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, {'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream'});
    fs.createReadStream(full).pipe(res);
  });
}

// ───────── Main ─────────
http.createServer(async (req, res) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS'){ res.writeHead(204); return res.end(); }

  const p = url.parse(req.url).pathname;
  const ip = getIP(req);

  // 僅對 API 套 rate limit
  if (p === '/tts' || p === '/chat' || p === '/voices'){
    if (!rateLimitCheck(ip)) return sendJson(res, 429, {error:'rate limit exceeded'});
  }

  try {
    if (p === '/health'){
      return sendJson(res, 200, {ok:true, azure:!!AZURE_KEY, chat:!!ANTHROPIC_KEY, region:AZURE_REGION});
    }
    if (p === '/voices') return listVoices(res);

    if (p === '/tts' && req.method === 'POST'){
      const body = await readJson(req, 20_000);
      const text = String(body.text||'').slice(0, 4000);
      if (!text) return sendJson(res, 400, {error:'missing text'});
      return azureTTS(text, body.voice, body.rate, res);
    }

    if (p === '/chat' && req.method === 'POST'){
      const body = await readJson(req, 200_000);
      return anthropicChat(body, res);
    }

    return serveStatic(req, res);
  } catch(e){
    sendJson(res, 400, {error:e.message});
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`\n  🐍 Python 教學網站`);
  console.log(`  ▶ http://0.0.0.0:${PORT}`);
  console.log(`  Azure TTS：${AZURE_KEY ? '✅ '+AZURE_REGION : '❌ 未設定'}`);
  console.log(`  Chat 代理：${ANTHROPIC_KEY ? '✅ '+ANTHROPIC_MODEL : '❌ 未設定'}`);
  console.log(`  CORS：${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`  Rate limit：${RATE_LIMIT_RPM} req/min/IP\n`);
});
