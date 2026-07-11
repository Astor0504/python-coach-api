// 共用 rate limit（每 IP，記憶體版；多實例／Serverless 冷啟動下各自獨立，多實例請改 Redis）
const RATE_LIMIT_RPM = parseInt(process.env.RATE_LIMIT_RPM || '60', 10);
const WINDOW_MS = 60_000;

const rateBuckets = new Map();

function getIP(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

function rateLimitCheck(ip) {
  const now = Date.now();
  let b = rateBuckets.get(ip);
  if (!b) { b = { count: 0, reset: now + WINDOW_MS }; rateBuckets.set(ip, b); }
  if (now > b.reset) { b.count = 0; b.reset = now + WINDOW_MS; }
  b.count++;
  return b.count <= RATE_LIMIT_RPM;
}

// 每 5 分鐘清掉過期 bucket
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateBuckets) if (now > v.reset + WINDOW_MS) rateBuckets.delete(k);
}, 5 * 60_000);

// 套用在 handler 開頭（CORS 之後）。超限時已寫入 429 JSON 回應並回傳 true，
// 呼叫端應立即 return。
function applyRateLimit(req, res) {
  const ip = getIP(req);
  if (!rateLimitCheck(ip)) {
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'rate_limited' }));
    return true;
  }
  return false;
}

module.exports = { applyRateLimit, rateLimitCheck, getIP, RATE_LIMIT_RPM };
