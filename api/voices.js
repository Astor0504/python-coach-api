const https = require('https');
const { applyCors, preflight } = require('./_cors');
const { applyRateLimit } = require('./_rateLimit');

module.exports = (req, res) => {
  if (applyCors(req, res)) return;
  if (preflight(req, res)) return;
  if (applyRateLimit(req, res)) return;

  const AZURE_KEY = process.env.AZURE_KEY || '';
  const AZURE_REGION = process.env.AZURE_REGION || 'eastasia';
  if (!AZURE_KEY) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end('[]');
  }

  const r = https.request({
    hostname: `${AZURE_REGION}.tts.speech.microsoft.com`,
    path: '/cognitiveservices/voices/list',
    method: 'GET',
    timeout: 20000,
    headers: { 'Ocp-Apim-Subscription-Key': AZURE_KEY }
  }, (azRes) => {
    let body = '';
    azRes.on('data', d => body += d);
    azRes.on('end', () => {
      if (azRes.statusCode !== 200) {
        res.statusCode = azRes.statusCode;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ error: 'azure', status: azRes.statusCode }));
      }
      try {
        const all = JSON.parse(body);
        const zh = all.filter(v => /^zh-/.test(v.Locale))
          .map(v => ({ name: v.ShortName, locale: v.Locale, gender: v.Gender, display: v.LocalName || v.DisplayName }));
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(zh));
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'parse' }));
      }
    });
  });
  r.on('timeout', () => r.destroy(new Error('upstream timeout')));
  r.on('error', e => {
    res.statusCode = e.message === 'upstream timeout' ? 502 : 500;
    res.end(JSON.stringify({ error: e.message }));
  });
  r.end();
};
