import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(projectRoot, 'public');
const host = '127.0.0.1';
const port = Number(process.env.PORT || 4173);

const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.otf': 'font/otf',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ttf': 'font/ttf',
    '.txt': 'text/plain; charset=utf-8',
    '.webp': 'image/webp'
};

function safePathname(urlPathname = '/') {
    const decodedPath = decodeURIComponent(urlPathname.split('?')[0]);
    return decodedPath === '/' ? '/index.html' : decodedPath;
}

function resolveRequestPath(urlPathname) {
    const requestPath = safePathname(urlPathname);
    const candidatePaths = [];

    if (path.extname(requestPath)) {
        candidatePaths.push(requestPath);
    } else {
        candidatePaths.push(`${requestPath}.html`);
        candidatePaths.push(path.join(requestPath, 'index.html'));
    }

    for (const candidate of candidatePaths) {
        const normalized = path.normalize(candidate).replace(/^(\.\.[/\\])+/, '');
        const absolutePath = path.join(publicRoot, normalized);
        if (!absolutePath.startsWith(publicRoot)) continue;
        if (existsSync(absolutePath) && statSync(absolutePath).isFile()) {
            return absolutePath;
        }
    }

    return path.join(publicRoot, 'index.html');
}

function sendError(response, statusCode, message) {
    response.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(message);
}

const server = http.createServer((request, response) => {
    try {
        const filePath = resolveRequestPath(request.url || '/');
        const extension = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[extension] || 'application/octet-stream';

        response.writeHead(200, {
            'Cache-Control': 'no-store',
            'Content-Type': contentType
        });

        createReadStream(filePath).on('error', () => {
            sendError(response, 500, 'Could not read requested file.');
        }).pipe(response);
    } catch (error) {
        console.error(error);
        sendError(response, 500, 'Local viewer failed to serve the request.');
    }
});

server.listen(port, host, () => {
    console.log(`ADseum local viewer running at http://${host}:${port}`);
});
