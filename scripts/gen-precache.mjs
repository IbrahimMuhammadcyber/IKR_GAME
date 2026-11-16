// Runs after `vite build`: lists every file in dist/ for the service worker and stamps a build id.
import { readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else {
      const rel = relative(dist, p).split('\\').join('/');
      if (rel !== 'sw.js' && rel !== 'precache.json') files.push('./' + rel);
    }
  }
})(dist);
files.push('./');
const build = Date.now().toString(36);
writeFileSync(join(dist, 'precache.json'), JSON.stringify({ build, files }, null, 1));
const swPath = join(dist, 'sw.js');
writeFileSync(swPath, readFileSync(swPath, 'utf8').replace('__BUILD__', build));
console.log(`precache: ${files.length} files, build ${build}`);
