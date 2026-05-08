const HOP_BY_HOP = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'te',
  'trailer',
  'upgrade',
  'proxy-authorization',
  'proxy-connection',
  'content-length',
  'x-savage-frontend-origin',
]);

function frontendOrigin(req) {
  var proto = req.headers['x-forwarded-proto'] || 'https';
  var host = req.headers.host;
  if (Array.isArray(proto)) proto = proto[0];
  if (Array.isArray(host)) host = host[0];
  proto = String(proto).split(',')[0].trim();
  host = String(host || '').split(',')[0].trim();
  return host ? proto + '://' + host : '';
}

module.exports = async function handler(req, res) {
  var backendUrl =
    process.env.BACKEND_URL ||
    process.env.FRONTEND_API_URL ||
    process.env.VITE_API_URL;

  if (!backendUrl) {
    return res.status(500).json({
      error: 'No backend URL configured.',
      detail:
        'Set the BACKEND_URL environment variable in Vercel project settings to your FastAPI backend URL (e.g. https://savage-backend.up.railway.app). Then redeploy.',
    });
  }

  var base = backendUrl.replace(/\/+$/, '');
  var target = base + req.url;

  var headers = {};
  for (var key in req.headers) {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers[key] = req.headers[key];
    }
  }

  var origin = frontendOrigin(req);
  if (origin) {
    headers['x-savage-frontend-origin'] = origin;
  }

  var body;
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body != null) {
    if (Buffer.isBuffer(req.body)) {
      body = req.body;
    } else if (typeof req.body === 'string') {
      body = req.body;
    } else {
      body = JSON.stringify(req.body);
    }
  }

  try {
    var upstream = await fetch(target, {
      method: req.method,
      headers: headers,
      body: body,
      redirect: 'manual',
    });

    res.status(upstream.status);

    var setCookies =
      typeof upstream.headers.getSetCookie === 'function'
        ? upstream.headers.getSetCookie()
        : [];

    upstream.headers.forEach(function (value, key) {
      var lower = key.toLowerCase();
      if (lower === 'transfer-encoding') return;
      if (lower === 'set-cookie') return;
      res.setHeader(key, value);
    });

    if (setCookies.length > 0) {
      res.setHeader('set-cookie', setCookies);
    }

    var buf = Buffer.from(await upstream.arrayBuffer());
    return res.send(buf);
  } catch (err) {
    return res.status(502).json({
      error: 'Bad Gateway',
      message: err.message,
    });
  }
};
