"""Real existing Gateway backend; private scoped access config on stdin.
No fixture assistant replies and no automatic replay of a failed turn.
"""
import http.cookiejar,json,pathlib,sys,time,uuid,urllib.request,urllib.error
if sys.stdin.isatty():
 import termios
 t=termios.tcgetattr(sys.stdin.fileno());t[3]&=~termios.ECHO;termios.tcsetattr(sys.stdin.fileno(),termios.TCSANOW,t)
cfg=json.loads(sys.stdin.readline())
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
opener.open(cfg['share'],timeout=30).close()
def request(body=None):
 req=urllib.request.Request(cfg['url']+cfg.get('path','/api/portal-chat'),data=json.dumps(body,ensure_ascii=False).encode() if body else None,headers={'Content-Type':'application/json'},method='POST' if body else 'GET')
 start=time.perf_counter()
 try:
  with opener.open(req,timeout=58) as r:status=r.status;data=json.load(r)
 except urllib.error.HTTPError as e:status=e.code;data=json.load(e)
 return status,data,round((time.perf_counter()-start)*1000,2)
if cfg.get('broker'):
 for line in sys.stdin:
  try:
   status,data,ms=request(json.loads(line));print(json.dumps({'status':status,'data':data,'httpMs':ms},ensure_ascii=False),flush=True)
  except Exception as e:print(json.dumps({'status':599,'data':{'error':'HTTP transport failed: '+type(e).__name__}}),flush=True)
 sys.exit()
cases=json.loads(pathlib.Path('scripts/quality-phase1/cases.json').read_text())
if cfg.get('caseIds'):cases=[c for c in cases if c['id'] in cfg['caseIds']]
status,credit,_=request();assert status==200 and credit['inferenceStarted'] is False
evidence={'scope':'Real portal_v1 backend responses. Browser rendering and local saving are separate checks.','url':cfg['url']+'/portal.html','model':credit['model'],'before':credit,'conversations':[]}
output=pathlib.Path(cfg['output']);output.parent.mkdir(parents=True,exist_ok=True)
for case in cases:
 session=None;turns=[]
 for n,message in enumerate(case['messages'],1):
  if n>1 and cfg.get('delaySeconds'):time.sleep(min(45,cfg['delaySeconds']))
  body={'message':message,'messageId':str(uuid.uuid4()),'navigation':['cases','calendar','documents','properties','units','tasks','team','support','new-task','new-appointment','new-document']}
  if session:body['session']=session
  try:status,data,ms=request(body)
  except Exception as e:status,data,ms=599,{'error':type(e).__name__},None
  session=data.pop('session',session)
  turns.append({'customer':message,'status':status,'httpMs':ms,'response':data})
  print(json.dumps({'case':case['id'],'turn':n,'status':status,'ms':ms,'reply':data.get('reply'),'calls':data.get('modelCalls'),'code':data.get('code')},ensure_ascii=False),flush=True)
  if data.get('code') in ['FREE_CREDIT_BOUNDARY','MODEL_RATE_LIMIT']:evidence['stopped']=data.get('code');break
 evidence['conversations'].append({'id':case['id'],'title':case.get('title'),'turns':turns});output.write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
 if evidence.get('stopped'):break
status,after,_=request();evidence['after']=after;evidence['actualAccountDeltaUsd']=after.get('totalUsedUsd',0)-credit['totalUsedUsd'];output.write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'finished':True,'conversations':len(evidence['conversations']),'turns':sum(len(c['turns'])for c in evidence['conversations']),'accountDeltaUsd':evidence['actualAccountDeltaUsd']},ensure_ascii=False),flush=True)
