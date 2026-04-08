const { applyCors, preflight } = require('./_cors');

module.exports = (req, res) => {
  applyCors(req, res);
  if (preflight(req, res)) return;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({
    ok: true,
    azure: !!process.env.AZURE_KEY,
    chat: !!process.env.ANTHROPIC_KEY,
    region: process.env.AZURE_REGION || 'eastasia'
  }));
};
