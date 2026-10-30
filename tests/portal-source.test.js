import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// Phase 2 deliberately changes presentation and the MORA language preference.
// Check the deployed bundle against the tested shared modules, rather than
// pinning the earlier German-only UI to a whole-source hash.
test('portal contains the complete current MORA integration exactly once',()=>{
 const html=readFileSync('portal.html','utf8');
 const block=html.match(/<!-- MORA INTEGRATION 1.0 START -->[\s\S]*?<!-- MORA INTEGRATION 1.0 END -->/g);
 assert.equal(block.length,1);
 for(const file of ['assets/mora-data.js','assets/mora-safety.js','assets/mora-portal-map.js','scripts/portal-integration/customer-cases.js','scripts/portal-integration/bridge.js','assets/mora-portal-window.js','assets/mora-portal-client.js']){
  const module=readFileSync(file,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
  assert.ok(block[0].includes(module),'bundle matches '+file);
 }
 assert.equal(html.split('<!-- MORADA LANGUAGE CORE START -->').length,2);
 assert.equal(html.split('<!-- MORADA LANGUAGE CONTROLS START -->').length,2);
});
