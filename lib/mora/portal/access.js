import {createHash} from 'node:crypto';
import {z} from 'zod';
import {portalNavigation} from '../../../assets/mora-portal-map.js';

// SERVER ONLY. This is a consumer contract, not authentication or a new role
// database. The supplied HTML currently has no authenticated account adapter.
const id=z.string().trim().min(1).max(180);
const query=z.enum(['case-status','repair-counts']);
export const portalAccessContract=z.object({
  version:z.literal(1),subjectId:id,organisationId:id,authorizationVersion:id,
  role:z.enum(['tenant','owner','manager','admin']),expiresAt:z.number().int(),
  navigation:z.array(z.enum(Object.keys(portalNavigation))).max(100),
  scopes:z.array(z.object({
    propertyId:id,propertyLabel:z.string().trim().min(1).max(180),
    // null explicitly grants all *public status* records at this property.
    // A tenant must instead have an explicit per-record grant.
    caseIds:z.array(id).max(2000).nullable(),
    queries:z.array(query).max(2),reporterNames:z.boolean(),
  }).strict()).max(100),
}).strict().superRefine((v,ctx)=>{
  if(new Set(v.scopes.map(s=>s.propertyId)).size!==v.scopes.length)ctx.addIssue({code:'custom',message:'Duplicate scope'});
  if(v.role==='tenant'&&v.scopes.some(s=>s.caseIds===null||s.queries.includes('repair-counts')))ctx.addIssue({code:'custom',message:'Tenant needs explicit case grants, no property comparison'});
});
const recordContract=z.object({
  id,propertyId:id,publicStatus:z.literal(true),kind:z.enum(['repair','other']),
  equipment:z.enum(['light','socket','heater','water','door','window','appliance','other']),
  status:z.enum(['received','in_progress','contractor_contacted','appointment_agreed','completed','cancelled']),
  updatedAt:z.iso.datetime(),appointmentAt:z.iso.datetime().nullable().optional(),
  reporterLabel:z.string().trim().min(1).max(180).optional(),
});
const resultContract=z.object({complete:z.literal(true),asOf:z.iso.datetime(),records:z.array(recordContract).max(2000)});
const registered=new WeakSet();
const fingerprint=grant=>createHash('sha256').update(JSON.stringify({subject:grant.subjectId,organisation:grant.organisationId,revision:grant.authorizationVersion,role:grant.role,navigation:[...grant.navigation].sort(),scopes:[...grant.scopes].sort((a,b)=>a.propertyId.localeCompare(b.propertyId)).map(s=>({...s,caseIds:s.caseIds?.slice().sort()??null,queries:[...s.queries].sort()}))})).digest('hex');
const empty=()=>({status:'unavailable',binding:'unverified-preview',navigation:null,personalQueries:[]});
const denied=()=>({status:'unavailable',message:'Diese Portalauskunft ist aktuell nicht freigegeben oder nicht verfügbar. Bitte prüfen Sie den Stand in Ihrem Portalbereich.'});
const timed=async fn=>{
  const controller=new AbortController();let timer;
  try{return await Promise.race([Promise.resolve().then(()=>fn(controller.signal)),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Portal timeout'));},5000);})]);}
  finally{clearTimeout(timer);}
};

/** adapter.loadAccess authenticates the REAL request using the portal session.
 * Never implement it using body.role, body.navigation, chat or localStorage.
 * adapter.readCases applies SQL/API scope filters before returning rows. */
export async function readPortalAccess(request,adapter=undefined){
  if(!adapter)return empty();
  const unavailable=()=>({...empty(),binding:'portal-access-unavailable',navigation:[]});
  if(!adapter.loadAccess)return unavailable();
  const load=async()=>{
    const parsed=portalAccessContract.safeParse(await timed(signal=>adapter.loadAccess(request,{signal})));
    return parsed.success&&parsed.data.expiresAt>Date.now()?parsed.data:null;
  };
  let grant;try{grant=await load();}catch{return unavailable();}
  if(!grant)return unavailable();
  const access={status:'verified',role:grant.role,binding:fingerprint(grant),navigation:grant.navigation,
    personalQueries:adapter.readCases?[...new Set(grant.scopes.flatMap(s=>s.queries))]:[],
    async read(kind){
      if(!query.safeParse(kind).success||!access.personalQueries.includes(kind)||grant.expiresAt<=Date.now())return denied();
      const scopes=grant.scopes.filter(s=>s.queries.includes(kind));
      try{
        // Pass a copy; an adapter cannot mutate the authority checked below.
        const raw=await timed(signal=>adapter.readCases(request,{subjectId:grant.subjectId,organisationId:grant.organisationId,authorizationVersion:grant.authorizationVersion,scopes:structuredClone(scopes),query:kind,signal}));
        const parsed=resultContract.safeParse(raw);
        if(!parsed.success)return denied();
        // Re-check membership after I/O. A revoked grant cannot finish a query.
        const fresh=await load();
        if(!fresh||fingerprint(fresh)!==access.binding)return denied();
        const seen=new Set(),scopeById=new Map(scopes.map(s=>[s.propertyId,s]));
        for(const r of parsed.data.records){
          const s=scopeById.get(r.propertyId);
          if(!s||s.caseIds!==null&&!s.caseIds.includes(r.id)||seen.has(r.id))return denied();
          if(r.appointmentAt&&r.status!=='appointment_agreed')return denied();
          seen.add(r.id);
        }
        // No document, financial, message, attachment or internal-note fields
        // survive the allowlist. Results never enter an LLM or conversation token.
        const {records,asOf}=parsed.data;
        if(kind==='repair-counts')return {status:'verified',kind,asOf,title:'Offene Reparaturanliegen Ihrer freigegebenen Liegenschaften',rows:scopes.map(s=>({property:s.propertyLabel,count:records.filter(r=>r.propertyId===s.propertyId&&r.kind==='repair'&&!['completed','cancelled'].includes(r.status)).length})).sort((a,b)=>b.count-a.count||a.property.localeCompare(b.property))};
        return {status:'verified',kind,asOf,title:'Freigegebene Anliegen und Bearbeitungsstände',rows:records.map(r=>({property:scopeById.get(r.propertyId).propertyLabel,equipment:r.equipment,status:r.status,updatedAt:r.updatedAt,...(r.appointmentAt?{appointmentAt:r.appointmentAt}:{}),...(scopeById.get(r.propertyId).reporterNames&&r.reporterLabel?{reporter:r.reporterLabel}:{})}))};
      }catch{return denied();}
    },
  };
  registered.add(access);return access;
}

// A plain object from a request or signed conversation is not an authority.
export function accessCapabilities(access){return registered.has(access)?{status:'verified',role:access.role,personalQueries:[...access.personalQueries]}:{status:'unavailable',personalQueries:[]};}
export function allowedPortalNavigation(clientTargets,access){
  const known=[...new Set(clientTargets)].filter(t=>Object.hasOwn(portalNavigation,t));
  return registered.has(access)?known.filter(t=>access.navigation.includes(t)):access?.navigation===null?known:[];
}
export async function readAuthorizedCases(access,kind){return registered.has(access)?access.read(kind):denied();}

/** Alexander connects his existing server here. Deliberately no guessed URL,
 * credentials, local portal records or fallback to an administrator account. */
export const portalServerAdapter=undefined;
