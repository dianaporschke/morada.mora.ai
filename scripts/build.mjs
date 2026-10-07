import './check.mjs';
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
rmSync('dist', { recursive:true, force:true });
mkdirSync('dist', { recursive:true });
for (const path of ['index.html','icons','assets', ...readdirSync('.').filter(name => /\.png$/i.test(name))]) {
  cpSync(path, `dist/${path}`, { recursive:true });
}
console.log('Public portal built in dist/. Server routes remain in api/.');
