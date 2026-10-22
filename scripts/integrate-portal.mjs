/** Patch the user's actual working HTML in place; repo portal.html is the exact
 * reviewed deployment source, not a separately developed portal version. */
import {readFileSync,writeFileSync} from 'node:fs';
const path=process.argv[2];if(!path)throw Error('Supply the authorised HTML path');
let html=readFileSync(path,'utf8');
const start='<!-- MORA INTEGRATION 1.0 START -->',end='<!-- MORA INTEGRATION 1.0 END -->';
if(html.includes(start))html=html.slice(0,html.indexOf(start))+html.slice(html.indexOf(end)+end.length).replace(/^\r?\n/,'');
// Minimal MORA-only identity extension to the existing native save function.
// Every ordinary portal caller retains its original behaviour and validation.
if(!html.includes('source=state,moraIdentity=null')){
 const edits=[
  ["async function opsSaveRecord(kind,data,id='',attachments=[],source=state){","async function opsSaveRecord(kind,data,id='',attachments=[],source=state,moraIdentity=null){"],
  ["id:old?.id||uid(kind.toUpperCase())","id:old?.id||(kind==='case'&&moraIdentity?.id)||uid(kind.toUpperCase())"],
  ["record=opsWithEvent(record,'created');","record=opsWithEvent(record,'created',moraIdentity?.note||'');"],
  ["record=opsWithEvent(record,'edited','',changes);","record=opsWithEvent(record,'edited',moraIdentity?.note||'',changes);"],
 ];
 for(const [from,to]of edits){if(html.split(from).length!==2)throw Error('Native save interface changed: '+from);html=html.replace(from,to);}
}
const modules=['assets/mora-data.js','assets/mora-safety.js','assets/mora-portal-map.js','scripts/portal-integration/bridge.js','assets/mora-portal-client.js'];
const js=modules.map(p=>readFileSync(p,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')).join('\n');
const css=readFileSync('assets/mora-portal.css','utf8');
const block=start+'\n<style>'+css+'</style>\n<script>\n(()=>{\n'+js+'\nconst bridge=createPortalBridge({managedCaseFields,sameCaseFields});\nwindow.MORAPortal=createPortalClient(document,window,bridge);\nshowMora=()=>{if(portalCloseDialog())window.MORAPortal.open();};\ndocument.getElementById("moraFab").setAttribute("aria-controls","moraPortalChat");\ndocument.getElementById("moraFab").setAttribute("aria-expanded","false");\n})();\n</script>\n'+end;
if(!html.includes('function showMora()')||!html.includes("const storageKey='morada-portal-clean-20261011-v1'"))throw Error('Unexpected portal source');
html=html.replace('</body>',block+'\n</body>');writeFileSync(path,html);writeFileSync('portal.html',html);
console.log('Updated the provided HTML and identical Preview source.');
