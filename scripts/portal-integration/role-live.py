"""Eight genuine role turns behind the existing approved Preview cost guard.
Input config on hidden stdin; never store share links, cookies or session tokens.
An additional conservative run ceiling only reduces the existing authorisation.
"""
import http.cookiejar,json,pathlib,sys,time,uuid,urllib.request,urllib.error
if sys.stdin.isatty():
 import termios
 t=termios.tcgetattr(sys.stdin.fileno());t[3]&=~termios.ECHO;termios.tcsetattr(sys.stdin.fileno(),termios.TCSANOW,t)
print('Ready for private role-test config on stdin.',flush=True)
cfg=json.loads(sys.stdin.readline())
assert cfg['url'].startswith('https://morada-mora-') and cfg['url'].endswith('.vercel.app')
ceiling=min(float(cfg.get('maxAdditionalUsd',0.25)),0.25)
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
opener.open(cfg['share'],timeout=30).close()
def request(body=None):
 req=urllib.request.Request(cfg['url']+'/api/portal-agent',data=json.dumps(body,ensure_ascii=False).encode() if body else None,headers={'Content-Type':'application/json'},method='POST' if body else 'GET')
 start=time.perf_counter()
 try:
  with opener.open(req,timeout=58) as r: status=r.status;data=json.load(r)
 except urllib.error.HTTPError as e:status=e.code;data=json.load(e)
 return status,data,round((time.perf_counter()-start)*1000,1)
status,before,_=request()
assert status==200 and before.get('inferenceStarted') is False and before.get('budgetMode')=='bounded_paid_preview'
assert before.get('model')=='anthropic/claude-haiku-5.5'
evidence={'url':cfg['url']+'/portal.html','source':'Real deployed /api/portal-agent responses; no mock wording','model':before['model'],'runCeilingUsd':ceiling,'before':before,'conversations':[]}
path=pathlib.Path(cfg['output'])
def save():path.write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
try:
 for case in cfg['cases']:
  session=None;row={'role':case['role'],'turns':[]};evidence['conversations'].append(row)
  for message in ['hey','Wobei können Sie mir in diesem Portalbereich helfen?']:
   status,current,_=request()
   if status!=200:raise RuntimeError('EXISTING_PREVIEW_BUDGET_BOUNDARY')
   # Conservatively reserve 60k input bytes plus 1,800 output tokens before
   # each call. The server additionally reserves the actual request boundary.
   reserve=(60000*current['pricing']['input']+1800*current['pricing']['output'])*1.2+0.0001
   if current['totalUsedUsd']-before['totalUsedUsd']+reserve>ceiling:raise RuntimeError('RUN_COST_BOUNDARY')
   if current['totalUsedUsd']+reserve>current['maxUsedUsd']:raise RuntimeError('EXISTING_PREVIEW_BUDGET_BOUNDARY')
   body={'message':message,'messageId':str(uuid.uuid4()),'viewRole':case['role'],'navigation':case['navigation']}
   if session:body['session']=session
   status,data,elapsed=request(body);session=data.pop('session',None)
   row['turns'].append({'customer':message,'status':status,'httpMs':elapsed,'reply':data.get('reply'),'navigation':(data.get('controls') or {}).get('navigation'), 'modelCalls':data.get('modelCalls'),'usage':data.get('usage'),'timingMs':data.get('timingMs'),'code':data.get('code')})
   save();print(json.dumps({'role':case['role'],'status':status,'ms':elapsed,'reply':data.get('reply'),'code':data.get('code')},ensure_ascii=False),flush=True)
   if status!=200:raise RuntimeError('HTTP_'+str(status))
except Exception as error:
 evidence['stopped']=str(error) if isinstance(error,RuntimeError) else type(error).__name__
finally:
 try:
  status,after,_=request();evidence['after']=after
  if status==200:evidence['observedAccountDeltaUsd']=after['totalUsedUsd']-before['totalUsedUsd']
 except Exception:pass
 save();print(json.dumps({'completedTurns':sum(len(c['turns'])for c in evidence['conversations']),'stopped':evidence.get('stopped'),'observedAccountDeltaUsd':evidence.get('observedAccountDeltaUsd')},ensure_ascii=False),flush=True)
