import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, request as proxyRequest } from 'node:http';
import { request as proxyHttpsRequest } from 'node:https';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const distDir = resolve(__dirname, 'dist');
const indexFile = join(distDir, 'index.html');
const port = Number(process.env.PORT || 3000);
const targetValue = process.env.OZWELL_API_TARGET || process.env.OZWELL_BACKEND_URL;

if (!targetValue) {
  console.error('Missing required OZWELL_API_TARGET or OZWELL_BACKEND_URL.');
  console.error('Set it to the real Ozwell backend URL before starting the production server.');
  process.exit(1);
}

if (!existsSync(indexFile)) {
  console.error('Missing dist/index.html. Run npm run build before starting the production server.');
  process.exit(1);
}

const target = new URL(targetValue);
const proxyTransport = target.protocol === 'https:' ? proxyHttpsRequest : proxyRequest;

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
]);

const hopByHopHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function getProxyHeaders(incomingHeaders) {
  const headers = {};
  for (const [name, value] of Object.entries(incomingHeaders)) {
    if (!hopByHopHeaders.has(name.toLowerCase())) {
      headers[name] = value;
    }
  }
  headers.host = target.host;
  return headers;
}

function sendFile(response, filePath) {
  const extension = extname(filePath).toLowerCase();
  response.writeHead(200, {
    'Content-Type': contentTypes.get(extension) || 'application/octet-stream',
  });
  createReadStream(filePath).pipe(response);
}

function serveStatic(request, response) {
  const requestUrl = new URL(request.url || '/', 'http://localhost');
  const decodedPath = decodeURIComponent(requestUrl.pathname);
  const normalizedPath = normalize(decodedPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = resolve(distDir, `.${normalizedPath}`);

  if (filePath.startsWith(distDir) && existsSync(filePath) && statSync(filePath).isFile()) {
    sendFile(response, filePath);
    return;
  }

  sendFile(response, indexFile);
}

function proxyApi(request, response) {
  const incomingUrl = new URL(request.url || '/', 'http://localhost');
  const upstreamUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, target);

  const upstreamRequest = proxyTransport(
    upstreamUrl,
    {
      method: request.method,
      headers: getProxyHeaders(request.headers),
    },
    (upstreamResponse) => {
      const headers = {};
      for (const [name, value] of Object.entries(upstreamResponse.headers)) {
        if (!hopByHopHeaders.has(name.toLowerCase())) {
          headers[name] = value;
        }
      }
      response.writeHead(upstreamResponse.statusCode || 502, headers);
      upstreamResponse.pipe(response);
    },
  );

  upstreamRequest.on('error', (error) => {
    console.error(`Proxy request failed: ${error.message}`);
    if (!response.headersSent) {
      response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    }
    response.end(JSON.stringify({ error: { message: 'Ozwell backend proxy request failed' } }));
  });

  request.pipe(upstreamRequest);
}

const server = createServer((request, response) => {
  if (request.url?.startsWith('/v1/')) {
    proxyApi(request, response);
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  serveStatic(request, response);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Ozwell Manager serving on http://0.0.0.0:${port}`);
  console.log(`Proxying /v1/* to ${target.origin}`);
});
