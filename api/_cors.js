// 共用 CORS 與工具
const RAW_ALLOWED = process.env.ALLOWED_ORIGINS || '';
const ALLOWED = RAW_ALLOWED.split(',').map(s => s.trim()).filter(Boolean);
// 白名單「有效設定」＝有值且不是萬用字元；未設定／空字串／'*' 都視為未設定白名單
const HAS_WHITELIST = ALLOWED.length > 0 && !ALLOWED.includes('*');

function setCorsHeaders(res, allowOrigin) {
  if (allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

function isSameOrigin(originHeader, hostHeader) {
  if (!originHeader) return true; // 無 Origin header（非瀏覽器 CORS 請求，例如同源導覽或伺服器對伺服器）
  if (!hostHeader) return false;
  try {
    return new URL(originHeader).host === hostHeader;
  } catch (e) {
    return false;
  }
}

// applyCors 回傳 true 代表已經送出 403 拒絕回應，呼叫端應直接 return。
// 回傳 false／undefined 代表已放行（CORS header 已設好），呼叫端照常繼續處理。
function applyCors(req, res) {
  const origin = req.headers.origin || '';
  const host = req.headers.host || '';

  // 白名單環境變數沒設或為空（含預設 '*'）：維持舊行為＝全部放行（萬用字元），
  // 避免 ALLOWED_ORIGINS 沒設好時把自己的站鎖死。
  if (!HAS_WHITELIST) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    return false;
  }

  // (a) 無 Origin header，或 Origin 與請求 Host 同源 → 一律放行不擋
  if (isSameOrigin(origin, host)) {
    setCorsHeaders(res, origin || undefined);
    return false;
  }

  // (b) Origin 在白名單內 → 放行
  if (ALLOWED.includes(origin)) {
    setCorsHeaders(res, origin);
    return false;
  }

  // (c) 有 Origin、非同源、不在白名單 → 拒絕
  res.statusCode = 403;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: 'origin_not_allowed' }));
  return true;
}

function preflight(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

module.exports = { applyCors, preflight };
