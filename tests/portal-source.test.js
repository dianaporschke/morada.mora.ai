import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');

// The user authorised changes to the shared portal UI on 30 October. The old
// whole-HTML hash froze that UI too. These hashes still freeze every native
// business statement and the entire existing MORA integration from 1284594.
test('visual refinement preserves native business logic and the complete MORA integration',()=>{
 const html=readFileSync('portal.html','utf8');
 const block=html.match(/<!-- MORA INTEGRATION 1.0 START -->[\s\S]*?<!-- MORA INTEGRATION 1.0 END -->/g);
 assert.equal(block.length,1,'exactly one unchanged MORA implementation');
 assert.equal(hash(block[0]),'bc8b2f9b0e7144f2462dfc0fc90af1c27a71b2260876606afb090d445b42ce77');
 const native=html.match(/<script>\s*'use strict';([\s\S]*?)<\/script>/)[1]
  .replace(/^const paths=.*\n/m,'') // Existing icon vocabulary, visual only.
  .replace(/function syncIdentity\(\)\{[\s\S]*?\n(?=function chooseRole)/,'') // Visible identity / button labels.
  .replace(/function rolePicker\(\)\{[\s\S]*?\n\}/,'') // Preview wording, same choices and handler.
  .replace(/^function hero[^\n]*\n/m,'') // Remove the decorative sketch.
  .replace(/document\.getElementById\('breadcrumb'\)\.textContent=[^;]*;/,'');
 assert.equal(hash(native),'abda08d5a53e7f0bb44bfa904f1d7ae0af61ea20f00663c9454a33294cc747f9');
});
