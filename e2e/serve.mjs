// 빌드 산출물을 vercel.json의 rewrite와 같은 규칙으로 서빙한다.
// 의존성을 하나도 더 늘리지 않으려고 직접 띄운다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', 'build');
const PORT = Number(process.env.E2E_PORT || 5179);

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json',
};

http
  .createServer((req, res) => {
    const pathname = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(ROOT, pathname);
    // 정적 파일이 없으면 index.html로 떨어뜨린다 (SPA 폴백).
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(ROOT, 'index.html');
    }
    const type = TYPES[path.extname(file)] || 'application/octet-stream';

    // Vercel은 텍스트 자원을 압축해서 보낸다. 압축하지 않고 재면 CSS·JS가
    // 실제보다 7배 크게 잡혀서 측정이 프로덕션과 달라진다.
    const compressible = /^(text/|application/(javascript|json|manifest))/.test(type);
    const acceptsGzip = (req.headers['accept-encoding'] || '').includes('gzip');

    if (compressible && acceptsGzip) {
      res.writeHead(200, { 'Content-Type': type, 'Content-Encoding': 'gzip' });
      fs.createReadStream(file).pipe(zlib.createGzip()).pipe(res);
      return;
    }

    res.writeHead(200, { 'Content-Type': type });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => console.log(`e2e static server on http://localhost:${PORT}`));
