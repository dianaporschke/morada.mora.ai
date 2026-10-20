"""Synthetic, explicitly authorized Preview comparisons; never store signed sessions or access links.

Config on stdin: url, share, output, cases (optional path), intervalSeconds (default 25).
Conversations run sequentially, with at least intervalSeconds between request starts.
No inference retries. A rate/access/billing failure pauses the run for operator review.
Invalid generated output is recorded and stops that conversation, not the other independent cases.
"""
import concurrent.futures, datetime, http.cookiejar, json, pathlib, sys, threading, time, urllib.error, urllib.request

config=json.load(sys.stdin)
url=config['url'].rstrip('/')
assert url.startswith('https://') and url.endswith('.vercel.app')
cases=json.loads(pathlib.Path(config.get('cases','scripts/conversation-cases.json')).read_text())
if config.get('caseIds'):cases=[case for case in cases if case['id'] in config['caseIds']]
lock=threading.Lock(); gate=threading.Lock(); next_start=0.; stopped=threading.Event(); rows=[]
interval=max(20.,float(config.get('intervalSeconds',25)))
output=pathlib.Path(config['output']); output.parent.mkdir(parents=True,exist_ok=True)
def opener():
    op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    op.open(config['share'],timeout=30).close()
    return op
probe=opener()
ready=json.load(probe.open(url+'/api/ai-readiness',timeout=30))
assert ready.get('inferenceEnabled') and ready['configuration']['ready'] and ready['configuration']['model']=='inception/mercury-2.5'
def persist():
    output.write_text(json.dumps({'url':url,'model':config.get('evaluationModel','inception/mercury-2.5'),'sourceCommit':config.get('sourceCommit'),
      'reasoning':config.get('reasoning'),'intervalSeconds':interval,
      'cases':len(cases),'rows':sorted(rows,key=lambda r:(r['caseId'],r['turn']))},ensure_ascii=False,indent=2)+'\n')
def run(case):
    global next_start
    op=opener(); session=None
    for turn,message in enumerate(case['messages'],1):
        if stopped.is_set(): return
        with gate:
            delay=max(0,next_start-time.monotonic())
            while delay>0:
                time.sleep(min(5,delay));delay=max(0,next_start-time.monotonic())
            if stopped.is_set():return
            next_start=time.monotonic()+interval
        payload={'model':config['evaluationModel'],'caseId':case['id'],'turn':turn} if config.get('evaluationModel') else {'message':message}
        if config.get('evaluationMode'):payload['mode']=config['evaluationMode']
        if session:payload['session']=session
        stamp=datetime.datetime.now(datetime.timezone.utc).isoformat();start=time.perf_counter()
        endpoint='/api/ai-evaluation' if config.get('evaluationModel') else '/api/chat'
        req=urllib.request.Request(url+endpoint,data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'},method='POST')
        try:
            with op.open(req,timeout=85) as response:status=response.status;data=json.load(response)
        except urllib.error.HTTPError as e:
            status=e.code
            try:data=json.load(e)
            except Exception:data={'error':'non_json_http_error'}
        except Exception as e:status=0;data={'error':type(e).__name__}
        if status==200:session=data.get('session',session)
        row={'caseId':case['id'],'case':case['name'],'turn':turn,'startedAt':stamp,'message':message,
          'status':status,'seconds':round(time.perf_counter()-start,3),'reply':data.get('reply',data.get('error')),
          'responseMode':data.get('responseMode'),'understanding':data.get('understanding'),'actions':data.get('actions'),
          'activeIssueId':(data.get('issue') or {}).get('id'),
          'issues':[{k:i.get(k) for k in ['id','equipment','category','description','defect','count','location','since','extent','details','cause','unknownFields','hazard','urgency','status']} for i in data.get('issues',[])],
          'timingMs':data.get('timingMs'),'modelCalls':data.get('modelCalls'),'modelUsage':data.get('modelUsage'),
          'modelAvailability':data.get('modelAvailability'),'evaluation':data.get('evaluation'),'checks':case['checks']}
        with lock:
            rows.append(row);persist()
            print(json.dumps({'completedTurns':len(rows),'caseId':case['id'],'turn':turn,'status':status,'seconds':row['seconds'],'reply':row['reply']},ensure_ascii=False),flush=True)
        if status!=200:
            availability=data.get('modelAvailability') or {}
            case_failure=status==503 and (availability.get('reason')=='invalid_model_output' or availability.get('status')==400)
            if not case_failure:
                stopped.set();print('STOP: access, billing, rate or transport boundary; inspect before resuming.',flush=True)
            return
with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
    futures=[pool.submit(run,case) for case in cases]
    for future in concurrent.futures.as_completed(futures):future.result()
print(json.dumps({'finished':not stopped.is_set(),'turns':len(rows),'casesAttempted':len(set(r['caseId'] for r in rows))}),flush=True)
sys.exit(2 if stopped.is_set() else 0)
