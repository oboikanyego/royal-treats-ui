// Serves the built site (a single-page app: unknown paths get index.html). Usage: node serve.cjs <dir> <port>
const http = require('http'), fs = require('fs'), path = require('path');
const root = process.argv[2];
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
http
  .createServer((q, r) => {
    let f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
    r.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream');
    r.end(fs.readFileSync(f));
  })
  .listen(Number(process.argv[3]) || 4307);
