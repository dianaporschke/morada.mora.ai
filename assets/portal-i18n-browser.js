import {createPortalTranslator,normalizeLanguage} from './portal-i18n-core.js';
/** Browser preference and presentation lifecycle; no account or record writes. */
function installPortalLanguage(messages){
 const key='morada.portal.language.v1';
 const browserPersistence={load:()=>localStorage.getItem(key),save:value=>localStorage.setItem(key,value)};
 let persistence=browserPersistence,initial='de',storageAvailable=true,pendingPreference=false;
 try{
  const saved=persistence.load();
  initial=normalizeLanguage(saved);
  if(saved&&saved!==initial)persistence.save(initial);
 }catch{storageAvailable=false;}
 const api=/** @type {import('./portal-i18n-types.js').PortalI18n} */ (createPortalTranslator(messages,initial)),setCoreLanguage=api.setLanguage,bindings=[];
 const setDocumentLanguage=()=>{document.documentElement.lang=api.locale;};setDocumentLanguage();
 api.localizeStatic=(root,localized=false)=>{
  const sourceKey=value=>Object.hasOwn(messages,value)?value:localized?Object.keys(messages).find(k=>messages[k][api.language]===value):undefined;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode())){
   if(node.parentElement?.closest('script,style,textarea,[translate="no"],[data-user-content]')||!node.nodeValue.trim())continue;
   const value=node.nodeValue,key=sourceKey(value.trim().replace(/\s+/g,' '));if(!key)continue;const source=key;
   node.nodeValue=api.t(source);bindings.push({node,source,last:node.nodeValue});
  }
  for(const el of [root,...root.querySelectorAll?.('*')||[]])for(const name of ['placeholder','title','aria-label','alt','data-label'])if(el.hasAttribute?.(name)){
   const value=el.getAttribute(name),source=sourceKey(value)||value;el.setAttribute(name,api.t(source));bindings.push({node:el,name,source,last:el.getAttribute(name)});
  }
 };
 function applyLanguage(next,source){
  const previous=api.language;
  setCoreLanguage(next);
  setDocumentLanguage();
  for(const b of bindings){if(!b.node.isConnected)continue;const value=b.name?b.node.getAttribute(b.name):b.node.nodeValue;if(value!==b.last)continue;
   b.last=api.t(b.source);if(b.name)b.node.setAttribute(b.name,b.last);else b.node.nodeValue=b.last;
  }
  window.dispatchEvent(new CustomEvent('morada:languagechange',{detail:{language:next,previous,storageAvailable,source}}));
 }
 api.setLanguage=value=>{
  const next=normalizeLanguage(value);
  // An already selected session-only choice must remain a working retry target.
  if(next===api.language&&storageAvailable){try{if(persistence.load()===next)return;}catch{}}
  try{
   persistence.save(next);
   if(persistence.load()!==next)throw new Error('Language preference was not retained');
   storageAvailable=true;pendingPreference=false;
  }catch{storageAvailable=false;pendingPreference=true;}
  applyLanguage(next,'user');
 };
 // Only browser preferences are shared between tabs. Re-read the latest value
 // rather than applying an old event; never overwrite an unsaved local choice.
 window.addEventListener('storage',event=>{
  if(persistence!==browserPersistence||pendingPreference||event.key!==key)return;
  try{
   const saved=persistence.load();
   if(!api.languages.some(([code])=>code===saved)||saved===api.language)return;
   storageAvailable=true;applyLanguage(saved,'storage');
  }catch{ /* Keep the current language and all form entries on a failed read. */ }
 });
 // The adapter is the only seam a later signed-in account preference needs.
 api.setPersistenceAdapter=adapter=>{if(typeof adapter?.save!=='function'||typeof adapter?.load!=='function')throw new TypeError('Language adapter requires load and save');persistence=adapter;};
 Object.defineProperty(api,'storageAvailable',{get:()=>storageAvailable});
 window.MoradaI18n=api;return api;
}
