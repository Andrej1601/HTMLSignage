import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const host = process.env.HOST || '0.0.0.0';
const port = Number.parseInt(process.env.PORT || '5173', 10);
const distDir = path.join(__dirname, 'dist');
const indexPath = path.join(distDir, 'index.html');

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Invalid PORT: ${process.env.PORT ?? '<unset>'}`);
  process.exit(1);
}

if (!existsSync(indexPath)) {
  console.error(`Frontend build output missing: ${indexPath}`);
  process.exit(1);
}

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.htm', 'text/html; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

const sendFile = async (res, filePath) => {
  const fileStat = await stat(filePath);
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Length': fileStat.size,
    'Content-Type': contentTypes.get(ext) || 'application/octet-stream',
    'Cache-Control': filePath === indexPath ? 'no-cache' : 'public, max-age=31536000, immutable',
  });

  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('end', resolve);
    stream.pipe(res);
  });
};

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) {
      res.writeHead(400);
      res.end('Bad Request');
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    let requestPath = decodeURIComponent(url.pathname);

    if (requestPath === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('ok');
      return;
    }

    if (requestPath.endsWith('/')) {
      requestPath += 'index.html';
    }

    const normalizedPath = path.posix.normalize(requestPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const candidatePath = path.join(distDir, normalizedPath.replace(/^\/+/, ''));

    if (candidatePath.startsWith(distDir) && existsSync(candidatePath)) {
      await sendFile(res, candidatePath);
      return;
    }

    await sendFile(res, indexPath);
  } catch (error) {
    console.error('Frontend server error:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    res.end('Internal Server Error');
  }
});

server.listen(port, host, () => {
  console.log(`Frontend server listening on http://${host}:${port}`);
});
