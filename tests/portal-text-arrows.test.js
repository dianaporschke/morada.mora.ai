import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {installPortalTextArrows} from '../assets/portal-text-arrows.js';

test('portal links remain typographic after dynamic renders on iOS', async () => {
 const dom = new JSDOM('<section id="portalPreview"><main id="main"><a>Aufgaben ↗</a></main></section>');
 const root = dom.window.document.getElementById('portalPreview');
 const dispose = installPortalTextArrows(root);
 try {
  assert.equal(root.querySelector('a').textContent, 'Aufgaben →');
  root.querySelector('#main').innerHTML = '<a>Kalender öffnen ↗️</a><button>Unterhalt ↗</button>';
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual([...root.querySelectorAll('a,button')].map(node => node.textContent), ['Kalender öffnen →','Unterhalt →']);
 } finally {dispose();dom.window.close();}
});
