"""Real isolated SSE probes. Private stdin config; no browser or model mocks."""
import datetime,http.cookiejar,json,pathlib,sys,time,urllib.request
if sys.stdin.isatty():
 import termios
 t=termios.tcgetattr(sys.stdin.fileno());t[3]&=~termios.ECHO;termios.tcsetattr(sys.stdin.fileno(),termios.TCSANOW,t)
cfg=json.loads(sys.stdin.readline());assert cfg['execute'] is True
out=pathlib.Path(cfg['output']);private=pathlib.Path(cfg['checkpoint'])
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
opener.open(cfg['share'],timeout=35).close()
def request(body):
 return urllib.request.Request(cfg['url']+'/api/quality-latency',data=json.dumps(body).encode(),headers={'Content-Type':'application/json'},method='POST')
if cfg.get('auditOnly'):
 d=json.loads(out.read_text());token=json.loads(private.read_text())['runToken']
 with opener.open(request({'op':'audit','runToken':token}),timeout=60) as r:a=json.load(r)
 d.setdefault('audits',[]).append(a);out.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');print('Read-only cost audit complete; no inference.');sys.exit()
with opener.open(request({'op':'start'}),timeout=35) as r:start=json.load(r)
token=start.pop('runToken');assert start['model']=='inception/mercury-2.5' and start['maxCostUsd']<=0.50
d={**start,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rows':[],'complete':False,'url':cfg['url'],
 'method':{'scope':'HTTP/SDK diagnostic, not browser paint','reasoning':'high','maxOutputTokens':6400,'sdkRetries':0,'streamingBeforeSemanticVerification':False,'customerPreviewChanged':False}}
def persist():
 out.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');private.write_text(json.dumps({'runToken':token}));private.chmod(0o600)
persist()
last=0;recent=[datetime.datetime.fromisoformat(t.replace('Z','+00:00')).timestamp() for t in cfg.get('initialGenerationStarts',[])]
for index,step in enumerate(start['schedule']):
 while True:
  now=time.time();recent=[t for t in recent if now-t<63];delay=max(0,last+35-now)
  if len(recent)>=5:delay=max(delay,min(recent)+63-now)
  if delay<=0:break
  time.sleep(min(10,delay))
 last=time.time();sent_at=datetime.datetime.now(datetime.timezone.utc).isoformat();clock=time.perf_counter();events=[];result=None
 with opener.open(request({'op':'turn','runToken':token,'index':index}),timeout=75) as r:
  headers_ms=1000*(time.perf_counter()-clock);prefix=r.read(1);first_byte_ms=1000*(time.perf_counter()-clock);block=[];first_text=None;chunk_times=[]
  raw=prefix+r.readline() if prefix else b''
  while raw:
   if raw.strip():block.append(raw.decode())
   else:
    fields=dict(line.strip().split(': ',1) for line in block if ': ' in line);block=[]
    if fields.get('data'):
     value=json.loads(fields['data']);kind=fields.get('event');at=1000*(time.perf_counter()-clock)
     if kind=='text':
      if first_text is None:first_text=at
      chunk_times.append({'atMs':at,'characters':len(value['text'])})
     elif kind in ['end','error']:result=value;token=result.pop('runToken');result['event']=kind
   raw=r.readline()
 if result is None:raise RuntimeError('Stream ended without truthful final status; no automatic reissue')
 recent.append(time.time()) # conservative completion timestamp, later than generation start
 row={**result,'sentAt':sent_at,'receivedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'clientHttpHeadersMs':headers_ms,'clientFirstBodyByteMs':first_byte_ms,'clientFirstAnswerTextMs':first_text,'clientCompleteMs':1000*(time.perf_counter()-clock),'receivedChunks':chunk_times}
 d['rows'].append(row);persist();print(json.dumps({'index':index,**step,'event':result['event'],'firstAnswerTextMs':first_text,'completeMs':row['clientCompleteMs'],'chunks':len(chunk_times),'reply':result.get('reply')},ensure_ascii=False),flush=True)
d['complete']=True;d['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();persist()
with opener.open(request({'op':'audit','runToken':token}),timeout=60) as r:d['audits']=[json.load(r)]
persist();print('Four fixed latency probes complete; cost lookup retained.',flush=True)
