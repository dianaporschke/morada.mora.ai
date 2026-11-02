import {readFileSync,writeFileSync} from 'node:fs';
const start='<!-- MORADA FEEDBACK START -->',end='<!-- MORADA FEEDBACK END -->';
const source=readFileSync('assets/portal-feedback.js','utf8').replaceAll('</script','<\\/script');
const block=start+'\n<script id="morada-feedback">\n'+source+'\n</script>\n'+end;
let html=readFileSync('portal.html','utf8');
if(html.includes(start))html=html.slice(0,html.indexOf(start))+block+html.slice(html.indexOf(end)+end.length);
else html=html.replace('<script src="assets/portal-feedback.js"></script>',block);
writeFileSync('portal.html',html);
