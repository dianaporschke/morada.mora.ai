"""Offline timing attribution. Never treats HTTP driver duration as browser paint."""
import collections,json,math,pathlib,statistics
root=pathlib.Path(__file__).resolve().parents[2];folder=root/'docs/evidence'
data=json.loads((folder/'quality-phase2-live.json').read_text())
records=[]
for name in ['quality-phase2-live.json','quality-phase2-main-interim-cost-audit.json','quality-phase2-main-cost-audit.json']:
 p=folder/name
 if p.exists():records+=json.loads(p.read_text()).get('costs',[])
lookup={r['id']:r['info'] for r in records if 'info' in r}
def stat(v):
 v=sorted(x for x in v if x is not None)
 if not v:return {'n':0,'median':None,'p95':None}
 i=(len(v)-1)*.95
 return {'n':len(v),'median':statistics.median(v),'p95':v[math.floor(i)]+(v[math.ceil(i)]-v[math.floor(i)])*(i-math.floor(i))}
rows=[]
for row in data['rows']:
 stages=[log['args'][1] for log in row.get('logs',[]) if log.get('args',[None])[0]=='MORA model usage']
 complete_stages=len(stages)==row['result'].get('modelCalls') and all(t.get('httpStatus')==200 for t in row['trace'])
 sdk=sum(s['durationMs'] for s in stages);guard=sum(t.get('guardMs',0) for t in row['trace'])
 received=[lookup[t['generationId']] for t in row['trace'] if t.get('generationId') in lookup]
 record={'caseId':row['caseId'],'turn':row['turn'],'message':row['message'],'applicationStatus':row['applicationStatus'],
  'testDriverCompleteMs':row['wallMs'],'serverCompleteMs':row['elapsedMs'],'extraCreditObservationMs':guard,
  'serverExcludingCreditObservationMs':max(0,row['elapsedMs']-guard),
  'observedGatewayHttpToHeadersMs':sum(t.get('durationMs',0) for t in row['trace']),
  'reportedGatewayGenerationTimesMs':[r['generationTime'] for r in received],
  'reportedGatewayLatencyMs':[r['latency'] for r in received],
  'recordedSdkStageMs':sdk,'allSdkStagesTimed':complete_stages,
  'backendOutsideRecordedSdkMs':max(0,row['elapsedMs']-sdk) if complete_stages else None,
  'unattributedDriverOutsideServerMs':max(0,row['wallMs']-row['elapsedMs']),
  'pureGatewayProcessingMs':None,'pureProviderComputeMs':None,
  'realBrowserFrontendProcessingMs':None,'realBrowserFirstVisibleAnswerMs':None,'realBrowserCompleteVisibleAnswerMs':None,
  'observedGenerations':len(row['trace']),'knownReasoningTokens':sum(r['reasoningTokens'] for r in received),
  'knownTextOutputTokens':sum(r['completionTokens'] for r in received)}
 rows.append(record)
keys=['testDriverCompleteMs','serverCompleteMs','extraCreditObservationMs','serverExcludingCreditObservationMs','observedGatewayHttpToHeadersMs','recordedSdkStageMs','backendOutsideRecordedSdkMs','unattributedDriverOutsideServerMs']
probe=json.loads((folder/'quality-phase2-streaming-probe.json').read_text())
stream=[]
for r in probe['rows']:
 t=r.get('timings',{})
 stream.append({'mode':r['step']['mode'],'customerMessage':r['step']['message'],'generationId':r.get('generationId'),
  'serverFirstTextAfterModelStartMs':t.get('firstTextMs'),'serverModelCompleteMs':t.get('modelCompleteMs'),
  'serverTextTailMs':t['modelCompleteMs']-t['firstTextMs'] if t.get('firstTextMs') is not None else None,
  'serverTextChunks':t.get('chunks'),'serverCompleteMs':t.get('serverCompleteMs'),
  'clientCompleteMs':r['clientCompleteMs'],'clientFirstTextMs':None,'clientTextEventMeasurementValid':False,'browserPaintMeasured':False})
output={'mainComplete':data['complete'],'sourceCommit':data['sourceCommit'],'rows':rows,'aggregateMs':{k:stat([r[k] for r in rows]) for k in keys},
 'perGenerationGatewayReportedMs':{'latency':stat([r['latency'] for r in lookup.values()]),'generationTime':stat([r['generationTime'] for r in lookup.values()])},
 'modelCallCountPerTurn':dict(collections.Counter(r['observedGenerations'] for r in rows)),'streamingProbes':stream,
 'limits':['Gateway HTTP duration includes provider/model and network; pure Gateway overhead is not separately observable.',
 'Gateway generation lookup is reported service timing, not a direct GPU-compute measurement.',
 'SDK stages include extra credit reads; these reads are separately timed in the evaluation observer.',
 'The existing C API labels the whole model-backed turn as timingMs.model. That field is not used here as pure model latency.',
 'Backend residual is elapsed time outside all recorded SDK stages, not CPU profiling.',
 'Cloud HTTP driver overhead is not frontend processing or browser paint.',
 'Browser observation was blocked by automatic approval review on the Vercel account origin.',
 'The first SSE client parser missed text events. Its first-text and received-chunk values are invalid; independent server timings remain valid.',
 'Four illustrative streaming probes do not establish a general performance distribution or a causal quality comparison.']}
(folder/'quality-phase2-latency-analysis.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'mainComplete':data['complete'],'customerRounds':len(rows),'aggregateMs':output['aggregateMs'],'streamingProbes':stream},indent=2))
