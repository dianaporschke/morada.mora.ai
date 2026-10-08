import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { initializePortalNavigation } from '../assets/portal-navigation.js';

function fixture() {
  const dom = new JSDOM(readFileSync('index.html', 'utf8'), { url:'https://portal.test/' });
  initializePortalNavigation(dom.window.document);
  return dom;
}

test('Portal navigation and quick access work with keyboard activation and preserve exclusive tabs', async () => {
  const dom=fixture(); const { document, KeyboardEvent }=dom.window;
  document.getElementById('enter').checked=true;
  for (const id of ['portfolio','docs','service','profile','home']) {
    const control=document.querySelector(`.portal-nav label[for="${id}"]`);
    control.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true, cancelable:true }));
    await Promise.resolve();
    assert.equal(document.getElementById(id).checked, true);
    assert.equal(document.querySelectorAll('input[name="tab"]:checked').length, 1);
    assert.equal(control.getAttribute('aria-current'), 'page');
  }
  document.querySelector('.portal-quick label[for="docs"]').dispatchEvent(new KeyboardEvent('keydown', { key:' ', bubbles:true, cancelable:true }));
  await Promise.resolve();
  assert.equal(document.getElementById('docs').checked, true);
  assert.equal(document.querySelector('.portal-nav label[for="docs"]').getAttribute('aria-current'), 'page');
  dom.window.close();
});

test('Navigation accessibility follows asynchronous programmatic handover without modifying MORA state', async () => {
  const dom=fixture(); const document=dom.window.document;
  document.getElementById('mora').checked=true;
  await Promise.resolve();
  document.getElementById('service').checked=true;
  document.getElementById('mora').checked=false;
  // Existing MORA handover renders the service draft after setting the tab.
  document.getElementById('moraDraftPhotos').appendChild(document.createElement('span'));
  await Promise.resolve();
  assert.equal(document.querySelector('.portal-nav label[for="service"]').getAttribute('aria-current'), 'page');
  assert.equal(document.querySelector('.portal-nav label[for="home"]').hasAttribute('aria-current'), false);
  assert.equal(document.getElementById('mora').checked, false);
  dom.window.close();
});
