const https = require('https');
const { applyCors, preflight } = require('./_cors');

function escapeXml(s) {
  return s.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

function readJson(req, max = 20_000) {
  return new Promise((resolve, reject) => {
    // Vercel 會預先 parse body，若已經是物件直接回傳
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

  const AZURE_KEY = process.env.AZURE_KEY || '';
  const AZURE_REGION = process.env.AZURE_REGION || 'eastasia';
  if (!AZURE_KEY) { res.statusCode = 500; return res.end(JSON.stringify({ error: 'AZURE_KEY 未設定' })); }

  let body;
  try { body = await readJson(req); }
  catch (e) { res.statusCode = 400; return res.end(JSON.stringify({ error: e.message })); }

  const text = String(body.text || '').slice(0, 4000);
  if (!text) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'missing text' })); }

  const voice = body.voice || 'zh-TW-HsiaoChenNeural';
  if (!/^zh-(TW|CN|HK)-[A-Za-z]+Neural$/.test(voice)) {
    res.statusCode = 400; return res.end(JSON.stringify({ error: 'invalid voice' }));
  }
  const rate = /^[+-]?\d{1,3}%$/.test(body.rate || '') ? body.rate : '+0%';
  const lang = voice.slice(0, 5);
  const ssml = `<speak version='1.0' xml:lang='${lang}'><voice xml:lang='${lang}' name='${voice}'><prosody rate='${rate}'>${escapeXml(text)}</prosody></voice></speak>`;

  const azReq = https.request({
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
    if (azRes.statusCode !== 200) {
      let b = ''; azRes.on('data', d => b += d);
      azRes.on('end', () => { res.statusCode = azRes.statusCode; res.end(JSON.stringify({ error: 'azure', status: azRes.statusCode })); });
      return;
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    azRes.pipe(res);
  });
  azReq.on('error', e => { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); });
  azReq.write(ssml);
  azReq.end();
};
