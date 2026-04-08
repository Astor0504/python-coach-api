// 共用 CORS 與工具
const ALLOWED = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());

function applyCors(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && ALLOWED.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
