/// <reference path="./portal-i18n-types.d.ts" />
/* Shared by the header and personal settings. Preview role remains independent. */
(()=>{
 const L=window.MoradaI18n;L.localizeStatic(document.getElementById('moradaEntry'),true);
 const host=document.createElement('div');host.className='portal-language';
 host.innerHTML='<button type="button" class="portal-language-toggle" id="portalLanguageButton" aria-haspopup="menu" aria-controls="portalLanguageMenu" aria-expanded="false"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-4 5-4 13 0 18 4-5 4-13 0-18Z"/></svg></button><div class="portal-language-menu" id="portalLanguageMenu" role="menu" hidden></div>';
 document.getElementById('bellIcon').before(host);
 const toggle=host.querySelector('button'),menu=/** @type {HTMLElement} */ (host.querySelector('[role=menu]')),languages=[['de','Deutsch (Schweiz)'],['en','English'],['fr','Français']];
 function sync(){
  document.querySelector('#moradaEntry .entry-art').setAttribute('data-tagline',L.t('PERSÖNLICH NAH. ALLES VERBUNDEN.'));
  toggle.setAttribute('aria-label',L.t('Sprache wählen')+' · '+languages.find(l=>l[0]===L.language)[1]);toggle.title=L.t('Portalsprache');
  menu.setAttribute('aria-label',L.t('Portalsprache'));
  menu.innerHTML=languages.map(([code,name])=>'<button type="button" role="menuitemradio" data-language="'+code+'" aria-checked="'+(L.language===code)+'"><span class="language-code" aria-hidden="true">'+code.toUpperCase()+'</span><span lang="'+code+'">'+name+'</span><span class="language-check" aria-hidden="true">'+(L.language===code?'✓':'')+'</span></button>').join('');
 }
 function close(focus=false){menu.hidden=true;toggle.setAttribute('aria-expanded','false');if(focus)toggle.focus();}
 function positionMenu(){
  menu.style.transform='';const rect=menu.getBoundingClientRect();
  const shift=Math.max(12-rect.left,Math.min(0,window.innerWidth-12-rect.right));
  if(shift)menu.style.transform='translateX('+shift+'px)';
 }
 function open(){menu.hidden=false;positionMenu();toggle.setAttribute('aria-expanded','true');/** @type {HTMLButtonElement} */ (menu.querySelector('button[aria-checked=true]')).focus();}
 window.addEventListener('resize',()=>{if(!menu.hidden)positionMenu();});
 toggle.addEventListener('click',()=>menu.hidden?open():close(true));
 toggle.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();open();}});
 menu.addEventListener('click',e=>{const b=e.target instanceof Element?e.target.closest('button[data-language]'):null;if(!(b instanceof HTMLButtonElement))return;L.setLanguage(b.dataset.language);close(true);});
 host.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.stopPropagation();e.preventDefault();close(true);return;}
  if(!(e.target instanceof Node)||!menu.contains(e.target)||!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;
  e.preventDefault();const items=[...menu.querySelectorAll('button')],index=items.findIndex(item=>item===document.activeElement),next=e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowDown'?1:items.length-1))%items.length;items[next].focus();
 });
 document.addEventListener('click',e=>{if(e.target instanceof Node&&!host.contains(e.target))close();});
 document.addEventListener('focusin',e=>{if(e.target instanceof Node&&!host.contains(e.target))close();});
 window.addEventListener('morada:languagechange',()=>{
  sync();document.querySelector('.ux-nav-close')?.setAttribute('aria-label',L.t('Navigation schliessen'));if(!previewOpen)return;
  const focus=document.activeElement,view=portalViewSnapshot();portalNavigation.restore=view;render();
  // All persisted records and active table filters retain their original values.
  if(focus instanceof HTMLElement&&focus.isConnected)focus.focus({preventScroll:true});
 });
 sync();
})();
