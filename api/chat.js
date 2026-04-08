const https = require('https');
const { applyCors, preflight } = require('./_cors');

function readJson(req, max = 200_000) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let data = '', size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > max) { reject(new Error('payload too large')); req.destroy(); return; }
      data += c;
    });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  applyCors(req, res);
  if (preflight(req, res)) return;
  if (req.method !== 'POST') { res.statusCode = 405; return res.end('method not allowed'); }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY || '';
  const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
  if (!ANTHROPIC_KEY) { res.statusCode = 500; return res.end(JSON.stringify({ error: 'ANTHROPIC_KEY 未設定' })); }

  let body;
  try { body = await readJson(req); }
  catch (e) { res.statusCode = 400; return res.end(JSON.stringify({ error: e.message })); }

  const { system, messages, max_tokens, model } = body || {};
  if (!Array.isArray(messages) || !messages.length) {
    res.statusCode = 400; return res.end(JSON.stringify({ error: 'messages required' }));
  }
  if (JSON.stringify(messages).length > 120_000) {
    res.statusCode = 413; return res.end(JSON.stringify({ error: 'messages too long' }));
  }

  const payload = JSON.stringify({
    model: (typeof model === 'string' && /^claude-/.test(model)) ? model : ANTHROPIC_MODEL,
    max_tokens: Math.min(parseInt(max_tokens || 1024, 10), 2048),
    system: typeof system === 'string' ? system.slice(0, 20_000) : undefined,
    messages
  });

  const apiReq = https.request({
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (apiRes) => {
    let data = ''; apiRes.on('data', c => data += c);
    apiRes.on('end', () => {
      res.statusCode = apiRes.statusCode;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(data);
    });
  });
  apiReq.on('error', e => { res.statusCode = 502; res.end(JSON.stringify({ error: e.message })); });
  apiReq.write(payload);
  apiReq.end();
};
