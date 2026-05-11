import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultClientDistDir = fileURLToPath(new URL('../client', import.meta.url));

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(payload));
}

function sendStaticFile(response: ServerResponse, filePath: string) {
  const extension = extname(filePath);

  response.writeHead(200, {
    'content-type': contentTypes[extension] ?? 'application/octet-stream'
  });
  createReadStream(filePath).pipe(response);
}

function resolveStaticPath(publicDir: string, pathname: string): string | null {
  const normalizedPublicDir = resolve(publicDir);
  const rawPath = pathname === '/' ? '/index.html' : pathname;
  const normalizedPath = normalize(decodeURIComponent(rawPath)).replace(/^(\.\.[/\\])+/, '');
  const relativePath = normalizedPath.replace(/^[/\\]/, '');
  const filePath = resolve(join(normalizedPublicDir, relativePath));

  if (!filePath.startsWith(normalizedPublicDir)) {
    return null;
  }

  return filePath;
}

export function createHttpServer(publicDir = defaultClientDistDir): Server {
  return createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost');

    if (requestUrl.pathname === '/health') {
      sendJson(response, 200, {
        status: 'ok',
        service: 'quoridor'
      });
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendJson(response, 405, {
        status: 'error',
        message: 'method not allowed'
      });
      return;
    }

    const staticPath = resolveStaticPath(publicDir, requestUrl.pathname);

    if (staticPath && existsSync(staticPath) && statSync(staticPath).isFile()) {
      sendStaticFile(response, staticPath);
      return;
    }

    const indexPath = join(publicDir, 'index.html');

    if (existsSync(indexPath)) {
      sendStaticFile(response, indexPath);
      return;
    }

    sendJson(response, 404, {
      status: 'error',
      message: 'client build not found'
    });
  });
}
