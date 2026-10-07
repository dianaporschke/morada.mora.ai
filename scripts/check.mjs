import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function files(dir) {
  return readdirSync(dir, { withFileTypes:true }).flatMap(entry => entry.isDirectory() ? files(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]);
}
const sourceFiles = ['api', 'lib', 'assets', 'scripts', 'tests'].flatMap(dir => existsSync(dir) ? files(dir) : []);
for (const path of sourceFiles.filter(path => /\.m?js$/.test(path))) {
  const result = spawnSync(process.execPath, ['--check', path], { stdio:'inherit' });
  if (result.status !== 0) process.exit(1);
}
const html = readFileSync('index.html', 'utf8');
if (!html.includes('<meta charset="utf-8">') || !html.includes('type="module" src="/assets/mora-client.js"')) throw new Error('Invalid portal entrypoint');
for (const match of html.matchAll(/(?:src|href)="(\/[^"?]+)"/g)) {
  if (!existsSync(`.${match[1]}`)) throw new Error(`Missing portal asset: ${match[1]}`);
}
for (const path of ['api/chat.js', 'assets/mora-client.js']) {
  if (readFileSync(path, 'utf8').includes('kostenlosen Testversion')) throw new Error('Legacy fallback still present');
}
JSON.parse(readFileSync('vercel.json', 'utf8'));
console.log(`Syntax and portal assets OK (${sourceFiles.length} files checked). Static portal requires no bundling.`);
