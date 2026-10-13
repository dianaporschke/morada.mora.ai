# Preview-only synthetic live tests. Existing free-access/cost authorization must be verified before running.
# JSON config on stdin: share (temporary protected access), url, output, pauseSeconds, cases.
# Never save credentials, share URL or signed sessions in evidence.
import datetime, json, sys, time, urllib.request, urllib.error, http.cookiejar, pathlib

config=json.load(sys.stdin)
assert config['url'].startswith('https://') and config['url'].endswith('.vercel.app'), 'Use the authorized immutable Preview URL'
assert config.get('pauseSeconds',20)>=20, 'Preserve existing free-tier test pacing'
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
opener.open(config['share'],timeout=25).close()
readiness=json.load(opener.open(config['url']+'/api/ai-readiness',timeout=25))
assert readiness.get('inferenceEnabled') and readiness['configuration']['ready'] and readiness['configuration']['model']=='inception/mercury-2.5', 'Preview model not ready'
rows=[]
remaining=sum(len(case["messages"]) for case in config["cases"])
sessions={}
for case in config['cases']:
    session=sessions.get(case.get('continueFrom'))
    for message in case['messages']:
        payload={'message':message}
        if session: payload['session']=session
        startedAt=datetime.datetime.now(datetime.timezone.utc).isoformat()
        start=time.perf_counter()
        req=urllib.request.Request(config['url']+'/api/chat',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'},method='POST')
        try:
            response=opener.open(req,timeout=120)
            status=response.status
            data=json.load(response)
        except urllib.error.HTTPError as e:
            status=e.code
            data=json.load(e)
        except Exception as e:
            status=0
            data={'error':type(e).__name__}
        elapsed=round(time.perf_counter()-start,3)
        if status==200: session=data.get('session',session)
        row={'startedAt':startedAt,'case':case['name'],'message':message,'status':status,'seconds':elapsed,
             'reply':data.get('reply',data.get('error')),'understanding':data.get('understanding'),
             'responseMode':data.get('responseMode'),'activeIssueId':(data.get('issue') or {}).get('id'),'actions':data.get('actions'),
             'issues':[{k:i.get(k) for k in ['id','equipment','category','location','since','extent','details','cause','unknownFields','hazard','urgency','status']} for i in data.get('issues',[])],
             'modelAvailability':data.get('modelAvailability'),'timingMs':data.get('timingMs'),'modelCalls':data.get('modelCalls'),'modelUsage':data.get('modelUsage')}
        rows.append(row)
        path=pathlib.Path(config['output']);path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(json.dumps({'url':config['url'],'rows':rows},ensure_ascii=False,indent=2)+'\n')
        print(json.dumps(row,ensure_ascii=False),flush=True)
        rejected=status==503 and (data.get('modelAvailability') or {}).get('reason')=='invalid_model_output'
        if status!=200 and not (rejected and config.get('continueAfterRejectedOutput',False)):
            print('STOP: failed boundary; remaining tests paused.',flush=True)
            sys.exit(2)
        remaining-=1
        if remaining: time.sleep(config.get('pauseSeconds',20))
    sessions[case['name']]=session
