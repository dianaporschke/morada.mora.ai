/** Source-keyed UI messages. Never pass customer content to t(). */
export const portalLocales={de:'de-CH',en:'en-GB',fr:'fr-CH'};
export const normalizeLanguage=value=>Object.hasOwn(portalLocales,value)?value:'de';
export function createPortalTranslator(messages={},initial='de'){
 let language=normalizeLanguage(initial);const missing=new Set(),patterns=[],labelSources=new WeakMap(),objectSources=new WeakMap();
 const normalize=value=>String(value??'').trim().replace(/\s+/g,' ');
 const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 for(const key of Object.keys(messages))if(/\{\d+\}/.test(key)&&key.replace(/\{\d+\}/g,'').trim().length>3){
  const indices=[];let at=0,pattern='^';
  for(const m of key.matchAll(/\{(\d+)\}/g)){pattern+=escape(key.slice(at,m.index))+'([\\s\\S]*?)';indices.push(m[1]);at=m.index+m[0].length;}
  patterns.push({key,indices,re:new RegExp(pattern+escape(key.slice(at))+'$')});
 }
 function t(source,args,selected=language){
  const raw=String(source??''),key=normalize(raw),lang=normalizeLanguage(selected);let entry=messages[key],params=args;
  if(!entry&&args===undefined){
   for(const p of patterns){const match=key.match(p.re);if(match){entry=messages[p.key];params=Object.fromEntries(p.indices.map((n,i)=>[n,match[i+1]]));break;}}
  }
  // German copy can be refined without changing stable source keys or saved values.
  let value=entry?.[lang]||key;
  if(lang!=='de'&&!entry&&/[A-Za-zÄÖÜäöü]{2}/.test(key))missing.add(key);
  if(params)value=value.replace(/\{(\d+)\}/g,(whole,id)=>Object.hasOwn(params,id)?String(params[id]):whole);
  const lead=raw.match(/^\s*/)[0],tail=raw.match(/\s*$/)[0];return lead+value+tail;
 }
 // Translate only literal text/accessible attributes in a source template.
 // Interpolations remain opaque; saved values, URLs and form values stay intact.
 function fragment(source,values=[]){
  source=source.replace(/<option(\s[^>]*?)?>([^<>]*)<\/option>/gi,(all,attrs='',label)=>/\bvalue\s*=/.test(attrs)?all:'<option'+attrs+' value="'+label.replace(/"/g,'&quot;')+'">'+label+'</option>');
  const chunks=source.split(/(<(?:[^>"']|"[^"]*"|'[^']*')*>)/g);
  const convert=part=>{if(!/[A-Za-zÄÖÜäöü]/.test(part.replace(/\uE000\d+\uE001/g,'')))return part;
   return t(part.replace(/\uE000(\d+)\uE001/g,'{$1}')).replace(/\{(\d+)\}/g,'\uE000$1\uE001');};
  const html=chunks.map(part=>part.startsWith('<')?part.replace(/\b(placeholder|title|aria-label|alt|data-label)=("([^"]*)"|'([^']*)')/g,(all,name,quoted,a,b)=>name+'='+quoted[0]+convert(a??b).replace(/"/g,'&quot;').replace(/'/g,'&#39;')+quoted[0]):convert(part)).join('');
  return html.replace(/\uE000(\d+)\uE001/g,(_,i)=>String(values[i]??''));
 }
 return {t,fragment,missing,
  registerObject:(object,keys)=>{objectSources.set(object,new Set(keys));return object;},
  entries:object=>Object.entries(object).map(pair=>{if(objectSources.get(object)?.has(pair[0]))labelSources.set(pair,new Set([1]));return pair;}),
  values:object=>{const keys=Object.keys(object),array=Object.values(object);labelSources.set(array,new Set(keys.map((k,i)=>objectSources.get(object)?.has(k)?i:-1).filter(i=>i>=0)));return array;},registerLabels:(array,indices=array.map((_,i)=>i))=>{labelSources.set(array,new Set(indices));return array;},label:(array,index)=>labelSources.get(array)?.has(index)&&typeof array[index]==='string'?t(array[index]):array[index], get language(){return language;},setLanguage(value){language=normalizeLanguage(value);},get locale(){return portalLocales[language];},
  attributes(source){return String(source).replace(/\b(placeholder|title|aria-label|alt|data-label)=("([^"]*)"|'([^']*)')/g,(all,name,quoted,a,b)=>name+'='+quoted[0]+t(a??b).replace(/"/g,'&quot;').replace(/'/g,'&#39;')+quoted[0]);},
  html(strings,...values){return fragment(strings.map((s,i)=>s+(i<values.length?'\uE000'+i+'\uE001':'')).join(''),values);},
  number(value,options={}){return new Intl.NumberFormat(portalLocales[language],options).format(value);},
  date(value,options={}){return new Intl.DateTimeFormat(portalLocales[language],options).format(value instanceof Date?value:new Date(value));}
 };
}
