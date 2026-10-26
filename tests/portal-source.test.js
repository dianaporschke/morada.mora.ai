import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

test('26 October portal: all supplied design and business logic survives the MORA integration',()=>{
  const html=readFileSync('portal.html','utf8');
  const start='<!-- MORA INTEGRATION 1.0 START -->';
  const end='<!-- MORA INTEGRATION 1.0 END -->';
  assert.equal(html.split(start).length,2,'exactly one MORA client');
  assert.equal(html.split(end).length,2,'complete MORA integration');
  let native=html.replace(/<!-- MORA INTEGRATION 1.0 START -->[\s\S]*?<!-- MORA INTEGRATION 1.0 END -->\n/,'');
  // These four optional arguments are the only changes inside the native code.
  for(const [patched,original] of [
    ['source=state,moraIdentity=null','source=state'],
    ["id:old?.id||(kind==='case'&&moraIdentity?.id)||uid(kind.toUpperCase())","id:old?.id||uid(kind.toUpperCase())"],
    ["record=opsWithEvent(record,'created',moraIdentity?.note||'');","record=opsWithEvent(record,'created');"],
    ["record=opsWithEvent(record,'edited',moraIdentity?.note||'',changes);","record=opsWithEvent(record,'edited','',changes);"],
  ]) {
    assert.equal(native.split(patched).length,2);
    native=native.replace(patched,original);
  }
  assert.equal(createHash('sha256').update(native).digest('hex'),'1d8798759dbdce830c11717fc51f785a6719c3c72b3fe6006b802a5cac9a6614');
});
