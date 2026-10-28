/** Local, clearly labelled UI fixtures. Never calls a model or changes portal
 * source. Rebuild removes these generated QA pages from dist before deployment. */
import {readFileSync,writeFileSync} from 'node:fs';
const fixtures=readFileSync(new URL('./fixtures.js',import.meta.url),'utf8');
const portal=readFileSync('portal.html','utf8').replace('<head>','<head><script>'+fixtures+'</script>');
writeFileSync('dist/__mora-ui-portal.html',portal);
writeFileSync('dist/__mora-ui.html',`<!doctype html><html lang="de"><meta charset="utf-8"><title>MORA · lokale UI-Abnahme</title><style>
body{margin:0;background:#e8e1d8;color:#2b241d;font:13px system-ui;width:max-content}.tools{width:1440px;box-sizing:border-box;display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px;background:#f8f5ef;border-bottom:1px solid #c9b9a7}button,select{padding:7px 10px;border:1px solid #b6a18a;border-radius:6px;background:#fffaf2;color:#33281f;font:inherit}iframe{display:block;width:1440px;height:900px;border:0}strong{margin-right:10px}
</style><div class="tools"><strong>Lokale UI-Testdaten · keine KI-Anfragen</strong><button data-size="1440,900">Desktop 1440</button><button data-size="1180,720">Laptop 1180</button><button data-size="390,844">Smartphone 390</button><button data-size="360,740">Klein 360</button><button data-size="390,460">Tastaturhöhe simulieren</button><select aria-label="UI-Testansicht"><option value="actions">Anliegen & Aktionen</option><option value="welcome">Begrüssung</option><option value="short">Kurzer Verlauf</option><option value="long">Langer Verlauf</option><option value="error">Fehler</option><option value="loading">Ladezustand</option><option value="saved">Speicherbestätigung</option><option value="fallback">Ohne Hintergrundunschärfe</option></select><button id="release">Testantwort freigeben</button></div><iframe title="MORA UI-Prüfung" src="/__mora-ui-portal.html?case=actions"></iframe><script>
const frame=document.querySelector('iframe'),bar=document.querySelector('.tools');
document.querySelectorAll('[data-size]').forEach(b=>b.onclick=()=>{const [w,h]=b.dataset.size.split(',');frame.style.width=w+'px';frame.style.height=h+'px';bar.style.width=w+'px';});
document.querySelector('select').onchange=e=>frame.src='/__mora-ui-portal.html?case='+e.target.value;
document.getElementById('release').onclick=()=>frame.contentWindow.__moraUiRelease?.();
</script></html>`);
console.log('Generated local UI fixtures; all /api requests are stubbed and labelled.');
