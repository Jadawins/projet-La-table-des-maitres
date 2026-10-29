import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { buildCatalogue } from './catalogue.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const base = path.dirname(fileURLToPath(import.meta.url));
const project = path.dirname(base);
const port = Number(process.env.REFONTE_PREVIEW_PORT || 4178);
const routes = {
  '/maintenance.html': [path.join(base, 'accueil/index.html'), 'text/html; charset=utf-8'],
  '/refonte.css': [path.join(base, 'accueil/refonte.css'), 'text/css; charset=utf-8'],
  '/refonte.js': [path.join(base, 'accueil/refonte.js'), 'text/javascript; charset=utf-8'],
  '/': [path.join(base, 'maquette/index.html'), 'text/html; charset=utf-8'],
  '/mobile.html': [path.join(base, 'maquette/mobile.html'), 'text/html; charset=utf-8'],
  '/mobile.css': [path.join(base, 'maquette/mobile.css'), 'text/css; charset=utf-8'],
  '/app.js': [path.join(base, 'maquette/app.js'), 'text/javascript; charset=utf-8'],
  '/character-rules.mjs': [path.join(base, 'maquette/character-rules.mjs'), 'text/javascript; charset=utf-8'],
  '/origin-rules.mjs': [path.join(base, 'maquette/origin-rules.mjs'), 'text/javascript; charset=utf-8'],
  '/sheet-model.mjs': [path.join(base, 'maquette/sheet-model.mjs'), 'text/javascript; charset=utf-8'],
  '/character-version.mjs': [path.join(base, 'maquette/character-version.mjs'), 'text/javascript; charset=utf-8'],
  '/character-storage.mjs': [path.join(base, 'maquette/character-storage.mjs'), 'text/javascript; charset=utf-8'],
  '/progression.mjs': [path.join(base, 'maquette/progression.mjs'), 'text/javascript; charset=utf-8'],
  '/warlock-options.mjs': [path.join(base, 'maquette/warlock-options.mjs'), 'text/javascript; charset=utf-8'],
  '/extra-classes.mjs': [path.join(base, 'maquette/extra-classes.mjs'), 'text/javascript; charset=utf-8'],
  '/class-magic.mjs': [path.join(base, 'maquette/class-magic.mjs'), 'text/javascript; charset=utf-8'],
  '/class-profiles.mjs': [path.join(base, 'maquette/class-profiles.mjs'), 'text/javascript; charset=utf-8'],
  '/wild-shape.mjs': [path.join(base, 'maquette/wild-shape.mjs'), 'text/javascript; charset=utf-8'],
  '/species-rules.mjs': [path.join(base, 'maquette/species-rules.mjs'), 'text/javascript; charset=utf-8'],
  '/beast-companion.mjs': [path.join(base, 'maquette/beast-companion.mjs'), 'text/javascript; charset=utf-8'],
  '/feat-effects.mjs': [path.join(base, 'maquette/feat-effects.mjs'), 'text/javascript; charset=utf-8'],
  '/cleric-progression.mjs': [path.join(base, 'maquette/cleric-progression.mjs'), 'text/javascript; charset=utf-8'],
  '/sheet-view.mjs': [path.join(base, 'maquette/sheet-view.mjs'), 'text/javascript; charset=utf-8'],
  '/style.css': [path.join(base, 'maquette/style.css'), 'text/css; charset=utf-8'],
  '/audit.html': [path.join(base,'maquette/audit.html'),'text/html; charset=utf-8'],
  '/audit.js': [path.join(base,'maquette/audit.js'),'text/javascript; charset=utf-8'],
  '/audit.css': [path.join(base,'maquette/audit.css'),'text/css; charset=utf-8'],
  '/rules-progress.html': [path.join(base,'maquette/rules-progress.html'),'text/html; charset=utf-8'],
  '/rules-progress.js': [path.join(base,'maquette/rules-progress.js'),'text/javascript; charset=utf-8'],
  '/rules-update-status.json': [path.join(base,'audit/rules-2024-status.json'),'application/json; charset=utf-8'],
  '/rules-update-ledger.json': [path.join(base,'audit/rules-2024-ledger.json'),'application/json; charset=utf-8'],
  '/audit-report.json': [path.join(base,'audit/report.json'),'application/json; charset=utf-8'],
  '/assets/fond-bibliotheque-sombre.png': [path.join(project, 'assets/img/fond-bibliotheque-sombre.png'), 'image/png'],
};

const catalogue = JSON.stringify(buildCatalogue(JSON.parse(await readFile(path.join(base,'tests/fixtures/rules-2024.json'),'utf8'))));

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405, {Allow:'GET, HEAD'}).end(); return; }
  const url = new URL(request.url, 'http://127.0.0.1');
  const headers = {'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'"};
  if (url.pathname === '/catalogue.json') { response.writeHead(200, {...headers, 'Content-Type':'application/json; charset=utf-8'}).end(request.method === 'HEAD' ? undefined : catalogue); return; }
  const route = routes[url.pathname];
  if (!route) { response.writeHead(404, headers).end('Page introuvable'); return; }
  try {
    const content = await readFile(route[0]);
    response.writeHead(200, {...headers, 'Content-Type':route[1]}).end(request.method === 'HEAD' ? undefined : content);
  } catch { response.writeHead(500, headers).end('Fichier indisponible'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Maquette locale : http://127.0.0.1:${port}`));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
