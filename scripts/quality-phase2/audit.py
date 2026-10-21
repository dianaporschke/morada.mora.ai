"""Read-only generation cost audit. Never performs inference."""
import http.cookiejar,json,pathlib,sys,urllib.request,urllib.error
if sys.stdin.isatty():
    import termios
    t=termios.tcgetattr(sys.stdin.fileno());t[3]&=~termios.ECHO;termios.tcsetattr(sys.stdin.fileno(),termios.TCSANOW,t)
cfg=json.loads(sys.stdin.readline())
data=json.loads(pathlib.Path(cfg['evidence']).read_text())
state=json.loads(pathlib.Path(cfg['checkpoint']).read_text())
ids=list(dict.fromkeys(t['generationId'] for r in data['rows'] for t in r['trace'] if t.get('generationId')))
if cfg.get('pendingOnly'):
    resolved={c['id'] for c in data.get('costs',[]) if 'info' in c}
    ids=[gid for gid in ids if gid not in resolved]
if cfg.get('limit'):ids=ids[:cfg['limit']]
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
opener.open(cfg['share'],timeout=35).close();result={'inferenceStarted':False,'costs':[]}
for at in range(0,len(ids),12):
    body={'op':'audit','runToken':state['runToken'],'generationIds':ids[at:at+12]}
    req=urllib.request.Request(cfg['url']+'/api/quality-phase2',data=json.dumps(body).encode(),headers={'Content-Type':'application/json'},method='POST')
    with opener.open(req,timeout=60) as response:audit=json.load(response)
    result['costs'].extend(audit['costs']);result['credits']=audit['credits']
pathlib.Path(cfg['output']).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'requested':len(ids),'resolved':sum('info' in c for c in result['costs']),'pending':sum('info' not in c for c in result['costs']),
 'totalCostUsd':sum(c['info']['totalCost'] for c in result['costs'] if 'info' in c),'inferenceStarted':False}),flush=True)
