"""Fixed synthetic A/B conversations; real HTTP only, no fabricated model turns.
stdin JSON: {url,share,output,checkpoint,execute:true,minIntervalSeconds:35}
Secrets and signed sessions are held only in memory/private scratch checkpoint.
"""
import datetime, hashlib, http.cookiejar, json, pathlib, sys, time, urllib.error, urllib.request
if sys.stdin.isatty():
    import termios
    terminal=termios.tcgetattr(sys.stdin.fileno());terminal[3]&=~termios.ECHO
    termios.tcsetattr(sys.stdin.fileno(),termios.TCSANOW,terminal)

cfg=json.loads(sys.stdin.readline())
assert cfg.get('execute') is True
assert cfg['url'].startswith('https://') and cfg['url'].endswith('.vercel.app')
cases=json.loads((pathlib.Path(__file__).parent.parent/'quality-phase1/cases.json').read_text())
output=pathlib.Path(cfg['output']);output.parent.mkdir(parents=True,exist_ok=True)
checkpoint=pathlib.Path(cfg['checkpoint'])
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
opener.open(cfg['share'],timeout=35).close()

def request(body):
    req=urllib.request.Request(cfg['url']+'/api/quality-phase2',data=json.dumps(body).encode(),headers={'Content-Type':'application/json'},method='POST')
    try:
        with opener.open(req,timeout=80) as response:return response.status,json.load(response)
    except urllib.error.HTTPError as error:
        try:data=json.load(error)
        except Exception:data={'error':'non_json_http_error'}
        return error.code,data

if cfg.get('resume'):
    evidence=json.loads(output.read_text());private=json.loads(checkpoint.read_text())
    assert not evidence['complete']
    if evidence['url']!=cfg['url']:
        status,probe=request({'op':'start'})
        assert status==200 and all(probe[k]==evidence[k] for k in ['sourceCommit','model','promptHash','verificationPromptHash','manifestHash','price','maxCostUsd'])
        evidence.setdefault('deploymentTransitions',[]).append({'from':evidence['url'],'to':cfg['url'],'receivedRows':len(evidence['rows']),
          'reason':'Read-only credit guard retries; MORA modules, prompts, fixtures and model parameters unchanged'})
        evidence['url']=cfg['url']
    stop=evidence.pop('stop',None);evidence.pop('pausedForCheckpoint',None)
    evidence.setdefault('resumptions',[]).append({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'receivedRows':len(evidence['rows']),
      'previousStop':stop,'successfulRepliesReplayed':0,'unreceivedRequestOutcome':'unknown' if stop and stop.get('reason')=='transport_error' else 'none'})
    if stop and stop.get('reason')=='transport_error':
        evidence['method']['externalTransportReissues']=evidence['method'].get('externalTransportReissues',0)+1
    start=evidence;run_token=private['runToken'];sessions=private['sessions']
else:
    status,start=request({'op':'start','suite':cfg.get('suite','main')})
    if status!=200:raise RuntimeError('Preflight stopped: '+json.dumps(start))
    evidence={k:v for k,v in start.items() if k not in ['runToken']}
    evidence.update({'url':cfg['url'],'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rows':[],'costs':[],'complete':False,
     'method':{'order':'fixed suite order; C main compared with saved Phase 1 A/B','fixedCustomerMessages':True,'sdkNetworkRetries':0,'contractRepairLimit':1,'externalGenerationRetries':0,
     'pacingOutsideMeasuredRequests':True,'minimumRequestIntervalSeconds':cfg.get('minIntervalSeconds',35),'maximumReservedGenerationsPerMinute':5,
     'continueAfterRecordedProviderTimeout':bool(cfg.get('continueProviderTimeouts')),
     'continueAfterRecordedUnobservedStage500':bool(cfg.get('continueUnobservedResponseErrors')),
     'C':'one conversational decision; read-only semantic verification; at most one bounded repair; separate local storage receipts'}})
    run_token=start['runToken'];sessions={}
assert start['sourceCommit']==cfg['sourceCommit'] and start['caseCount']>=20
assert start['model']=='inception/mercury-2.5' and start['maxCostUsd']<=0.50
recent=[datetime.datetime.fromisoformat(t['startedAt'].replace('Z','+00:00')).timestamp() for row in evidence['rows'][-6:] for t in row['trace']]
recent+=list({datetime.datetime.fromisoformat(t.replace('Z','+00:00')).timestamp() for t in cfg.get('initialGenerationStarts',[])})
last_start=datetime.datetime.fromisoformat(evidence['rows'][-1]['sentAt']).timestamp() if evidence['rows'] else 0

def persist():
    output.write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
    checkpoint.write_text(json.dumps({'runToken':run_token,'sessions':sessions}))
    checkpoint.chmod(0o600)

persist()
print(json.dumps({'event':'preflight','suite':start['suite'],'cases':start['conversationCount'],'requests':start['turnCount'],'price':start['price'],'maxCostUsd':start['maxCostUsd']}),flush=True)
processed=0
for step in start['schedule'][len(evidence['rows']):]:
    # Reserve the C decision/verification path with at most one contract repair, preserving
    # the application's own timeout and retry behavior inside each request.
    reservation=1 if step['variant']=='V' else 4
    while True:
        now=time.time();recent=[t for t in recent if now-t<63]
        delay=max(0,last_start+cfg.get('minIntervalSeconds',35)-now)
        if len(recent)+reservation>5:delay=max(delay,sorted(recent)[len(recent)+reservation-6]+63-now)
        if delay<=0:break
        time.sleep(min(delay,20))
    key=step['caseId']+step['variant']
    body={'op':'turn','runToken':run_token,**step}
    if key in sessions:body['session']=sessions[key]
    sent=datetime.datetime.now(datetime.timezone.utc).isoformat();last_start=time.time();clock=time.perf_counter()
    try:status,data=request(body)
    except Exception as error:
        evidence['stop']={'reason':'transport_error','type':type(error).__name__,'step':step};persist();raise
    wall_ms=round((time.perf_counter()-clock)*1000)
    if status!=200:
        evidence['stop']={'reason':'evaluation_boundary','status':status,'response':data,'step':step};persist();break
    run_token=data.pop('runToken');sessions[key]=data.pop('session')
    for trace in data['trace']:
        t=datetime.datetime.fromisoformat(trace['startedAt'].replace('Z','+00:00')).timestamp();recent.append(t)
    data.update({'sentAt':sent,'wallMs':wall_ms})
    if data['result'].get('responseMode')=='model' and not data['trace']:
        data['fatal']=True;data['measurementError']='Model generation missing transport observation'
    if any(t.get('httpStatus')==200 and not t.get('generationId') for t in data['trace']):
        data['fatal']=True;data['measurementError']='Generation ID missing; real cost lookup impossible'
    evidence['rows'].append(data);persist()
    processed+=1
    print(json.dumps({'event':'turn','completed':data['completedRequests'],'total':data['totalRequests'],**step,
      'applicationStatus':data['applicationStatus'],'responseMode':data['result'].get('responseMode'),'reply':data['result'].get('reply'),
      'generations':len(data['trace']),'wallMs':wall_ms,'reservedUsd':data['reservedUsd'],'fatal':data['fatal']},ensure_ascii=False),flush=True)
    if data['fatal']:
        # A received timeout is a failed fixed customer round, never replayed.
        # With explicit evaluation authorization, continue to the NEXT scheduled
        # message after normal pacing and the server's fresh balance guard.
        # Billing, rate-limit, authentication and missing-ID measurement failures
        # remain hard stops. This changes the driver, not MORA's behavior.
        timeout=(data['result'].get('modelAvailability') or {}).get('reason')=='model_timeout'
        if cfg.get('continueProviderTimeouts') and timeout and not data.get('budgetStop') and not data.get('measurementError') and all(t.get('httpStatus') in [None,200] for t in data['trace']):
            evidence.setdefault('recordedTimeoutContinuations',[]).append({'caseId':step['caseId'],'turn':step['turn'],'successfulRepliesReplayed':0})
            persist()
            continue
        availability=data['result'].get('modelAvailability') or {}
        unobserved_stage_error=availability.get('reason')=='response_error' and (availability.get('status') or 0)>=500 and data['trace'] and all(t.get('httpStatus')==200 for t in data['trace']) and data['result'].get('modelCalls',0)>len(data['trace'])
        if cfg.get('continueUnobservedResponseErrors') and unobserved_stage_error and not data.get('budgetStop') and not data.get('measurementError'):
            evidence.setdefault('recordedUnobservedStage500Continuations',[]).append({'caseId':step['caseId'],'turn':step['turn'],'successfulRepliesReplayed':0,'attribution':'No failing model transport observed; extra metadata/guard request may have failed. Not attributed conclusively to model quality.'})
            persist();continue
        evidence['stop']={'reason':'provider_or_budget_boundary','step':step};persist();break
    if cfg.get('maxRequests') and processed>=cfg['maxRequests'] and data['completedRequests']<data['totalRequests']:
        evidence['pausedForCheckpoint']=True;persist();break
else:
    evidence['complete']=True

if not evidence['complete']:
    print(json.dumps({'event':'paused','rows':len(evidence['rows']),'plannedCheckpoint':evidence.get('pausedForCheckpoint',False),'stop':evidence.get('stop')}),flush=True)
    sys.exit(0)

# Cost lookups use the ordinary per-generation endpoint, never paid Custom Reporting.
ids=list(dict.fromkeys(t.get('generationId') for row in evidence['rows'] for t in row['trace'] if t.get('generationId')))
for offset in range(0,len(ids),12):
    status,audit=request({'op':'audit','runToken':run_token,'generationIds':ids[offset:offset+12]})
    if status!=200:evidence['costLookupError']={'status':status};break
    evidence['costs'].extend(audit['costs']);evidence['finalCredits']=audit['credits'];persist()
evidence['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();persist()
if evidence['complete']:checkpoint.unlink(missing_ok=True)
print(json.dumps({'event':'finished','complete':evidence['complete'],'rows':len(evidence['rows']),'generationIds':len(ids),'costRecords':len(evidence['costs'])}),flush=True)
