import {createPortalTranslator,normalizeLanguage} from './portal-i18n-core.js';
/** Browser preference and presentation lifecycle; no account or record writes. */
function installPortalLanguage(messages){
 const key='morada.portal.language.v1';let persistence={load:()=>localStorage.getItem(key),save:value=>localStorage.setItem(key,value)};
 let initial='de',storageAvailable=true;try{initial=persistence.load()||'de';}catch{storageAvailable=false;}
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
 api.setLanguage=value=>{
  const next=normalizeLanguage(value);if(next===api.language)return;
  const previous=api.language;
  setCoreLanguage(next);
  try{persistence.save(next);storageAvailable=true;}catch{storageAvailable=false;}
  setDocumentLanguage();
  for(const b of bindings){if(!b.node.isConnected)continue;const value=b.name?b.node.getAttribute(b.name):b.node.nodeValue;if(value!==b.last)continue;
   b.last=api.t(b.source);if(b.name)b.node.setAttribute(b.name,b.last);else b.node.nodeValue=b.last;
  }
  window.dispatchEvent(new CustomEvent('morada:languagechange',{detail:{language:next,previous,storageAvailable}}));
 };
 // The adapter is the only seam a later signed-in account preference needs.
 api.setPersistenceAdapter=adapter=>{if(typeof adapter?.save!=='function'||typeof adapter?.load!=='function')throw new TypeError('Language adapter requires load and save');persistence=adapter;};
 Object.defineProperty(api,'storageAvailable',{get:()=>storageAvailable});
 window.MoradaI18n=api;return api;
}
