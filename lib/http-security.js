/** HTTP boundary for the existing JSON APIs. Not authentication or a rate limit. */
export function guardApiRequest(req,res){
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 // Direct in-process handler invocations have no HTTP headers (tests/relays).
 // Vercel supplies headers for every network request, including empty ones.
 if(!req.headers)return true;
 const header=name=>{const value=req.headers[name];return typeof value==='string'?value:'';};
 if(header('sec-fetch-site')==='cross-site'){
  res.status(403).json({code:'CROSS_ORIGIN_REQUEST',error:'Diese Anfrage ist nicht zulässig.'});return false;
 }
 const origin=header('origin');
 if(origin){
  try{const url=new URL(origin);if(!['https:','http:'].includes(url.protocol)||url.host!==header('host'))throw Error('Origin mismatch');}
  catch{res.status(403).json({code:'CROSS_ORIGIN_REQUEST',error:'Diese Anfrage ist nicht zulässig.'});return false;}
 }
 if(req.method==='POST'&&!/^application\/json(?:\s*;|$)/i.test(header('content-type'))){
  res.status(415).json({code:'JSON_REQUIRED',error:'Bitte senden Sie die Anfrage als JSON.'});return false;
 }
 return true;
}
