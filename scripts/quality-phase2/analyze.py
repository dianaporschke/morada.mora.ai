"""Offline evidence integrity, actual costs, C metrics and readable transcripts."""
import collections,json,math,pathlib,re,statistics,sys

root=pathlib.Path(__file__).resolve().parents[2];evidence=root/'docs/evidence'
path=evidence/'quality-phase2-live.json'
main_started=path.exists()
if main_started:
 data=json.loads(path.read_text())
else:
 assert '--partial' in sys.argv,'Main conversations have not been run; use --partial for the honest pilot-only status'
 pilot=json.loads((evidence/'quality-phase2-pilot.json').read_text())
 data={**pilot,'suite':'main','rows':[],'costs':[],'complete':False}
cases=json.loads((root/'scripts/quality-phase1/cases.json').read_text())
baseline=json.loads((evidence/'quality-phase1-measurements.json').read_text())
costs=[];sources=[]
for name in ['quality-phase2-live.json','quality-phase2-pilot.json','quality-phase2-verification.json',
 'quality-phase2-pilot-sdk-failure.json','quality-phase2-pilot-timeout.json',
 'quality-phase2-pilot-reference-failure.json','quality-phase2-connectivity-probe.json']:
 p=evidence/name
 if p.exists():
  d=json.loads(p.read_text());costs+=d.get('costs',[]);sources.append(d)
for p in evidence.glob('quality-phase2-*cost-audit.json'):costs+=json.loads(p.read_text()).get('costs',[])
by_id={c['id']:c['info'] for c in costs if 'info' in c}
ids={t['generationId'] for d in sources for r in d['rows'] for t in r['trace'] if t.get('generationId')}
assert all(v['model']=='inception/mercury-2.5' for v in by_id.values())

def stat(values):
 v=sorted(values)
 def quantile(p):
  if not v:return None
  n=(len(v)-1)*p;a=math.floor(n);b=math.ceil(n);return v[a]+(v[b]-v[a])*(n-a)
 return {'n':len(v),'median':statistics.median(v) if v else None,'mean':statistics.mean(v) if v else None,'p95':quantile(.95)}
def cost(row):
 ids=[t.get('generationId') for t in row['trace']]
 return sum(by_id[i]['totalCost'] for i in ids) if all(i in by_id for i in ids) else None
def reply(row):return row['result'].get('reply') or row['result'].get('error') or '[Keine Antwort]'
def stage(trace):
 if not trace.get('text') and trace.get('httpStatus')!=200:return 'transport_without_received_output'
 try:
  d=json.loads(trace.get('text',''))
  return 'verification' if 'violations' in d else 'decision' if 'reply' in d else 'invalid_output'
 except Exception:return 'invalid_output'
def summary(rows):
 texts=[reply(r) for r in rows];row_costs=[cost(r) for r in rows]
 return {'turns':len(rows),'applicationErrors':sum(r['applicationStatus']!=200 for r in rows),'repairedTurns':sum(bool(r['result'].get('repaired')) for r in rows),
 'generations':sum(len(r['trace']) for r in rows),'generationCountPerTurn':dict(collections.Counter(len(r['trace']) for r in rows)),
 'stages':dict(collections.Counter(stage(t) for r in rows for t in r['trace'])),
 'replyOrigins':dict(collections.Counter(r['replyOrigin']['type'] for r in rows)),
 'totalGatewayCostUsd':sum(row_costs) if all(c is not None for c in row_costs) else None,'unpricedTurns':sum(c is None for c in row_costs),
 'latencyWallMs':stat([r['wallMs'] for r in rows]),'latencyServerMs':stat([r['elapsedMs'] for r in rows]),
 'latencyServerExcludingCreditGuardMs':stat([max(0,r['elapsedMs']-sum(t.get('guardMs',0) for t in r['trace'])) for r in rows]),
 'replyCharacters':stat([len(t) for t in texts]),'questionMarks':sum(t.count('?') for t in texts),
 'formalThanksTurns':sum(bool(re.search(r'vielen dank|danke für|besten dank',t,re.I)) for t in texts),
 'apologyTurns':sum(bool(re.search(r'tut mir leid|entschuldig|bedauere',t,re.I)) for t in texts),
 'administrativeConfirmationTurns':sum(bool(re.search(r'\b(notiert|erfasst|aufgenommen|festgehalten|vermerkt)\b',t,re.I)) for t in texts),
 'primaryHandoverProposals':sum(sum(a['type']=='handover' for a in r['result'].get('actions',[])) for r in rows),
 'inputTokens':sum(by_id[t['generationId']]['promptTokens'] for r in rows for t in r['trace'] if t.get('generationId') in by_id),
 'visibleOutputTokens':sum(by_id[t['generationId']]['completionTokens'] for r in rows for t in r['trace'] if t.get('generationId') in by_id),
 'reasoningTokens':sum(by_id[t['generationId']]['reasoningTokens'] for r in rows for t in r['trace'] if t.get('generationId') in by_id)}

rows=data['rows'];expected=[{'caseId':c['id'],'turn':n+1,'variant':'C','message':message} for c in cases for n,message in enumerate(c['messages'])]
for row,exp in zip(rows,expected):assert all(row[k]==v for k,v in exp.items()),'Case/customer order changed'
measurements={'complete':data['complete'],'mainStarted':main_started,'sourceCommit':data['sourceCommit'],'model':data['model'],'rows':len(rows),'expectedRows':52,
 'manifestHash':data['manifestHash'],'promptHash':data['promptHash'],'verificationPromptHash':data['verificationPromptHash'],
 'baselineA':baseline['variants']['A'],'baselineB':baseline['variants']['B'],'C':summary(rows),
 'costCoverage':{'observedUniqueGenerationIds':len(ids),'resolvedUniqueGenerationIds':len(ids & by_id.keys()),'unresolvedGenerationIds':sorted(ids-by_id.keys()),
 'transportAttemptsWithoutReceivedGenerationId':sum(not t.get('generationId') for d in sources for r in d['rows'] for t in r['trace'])},
 'knownTaskGenerationCostUsd':sum(by_id[i]['totalCost'] for i in ids if i in by_id),'cases':[]}
for c in cases:
 r=[x for x in rows if x['caseId']==c['id']];last=r[-1]['result'] if r else {}
 measurements['cases'].append({'id':c['id'],'topic':c['topic'],'C':summary(r),'finalIssues':last.get('issues',[]),'finalActions':last.get('actions',[])})
v=next((s for s in sources if s.get('suite')=='verification'),None)
if v:measurements['verification']={'complete':v['complete'],'checks':len(v['rows']),'correct':sum(r['applicationStatus']==200 and bool(r['result']['verification']['violations'])==r['result']['expectedViolation'] for r in v['rows']),
 'details':[{'id':r['caseId'],'expectedViolation':r['result'].get('expectedViolation'),'applicationStatus':r['applicationStatus'],'violations':r['result'].get('verification',{}).get('violations')} for r in v['rows']]}
if '--partial' in sys.argv:
 (evidence/'quality-phase2-partial-measurements.json').write_text(json.dumps(measurements,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({k:v for k,v in measurements.items() if k!='cases'},ensure_ascii=False,indent=2));raise SystemExit
assert data['complete'] and len(rows)==52 and not measurements['costCoverage']['unresolvedGenerationIds'],'Incomplete conversation or cost evidence'
assert all(r['replyOrigin']['type']=='model_verbatim_field' for r in rows if r['applicationStatus']==200 and r['result'].get('responseMode')=='model')
assert v and v['complete'] and len(v['rows'])==8,'Verification probes incomplete'
(evidence/'quality-phase2-measurements.json').write_text(json.dumps(measurements,ensure_ascii=False,indent=2)+'\n')
lines=['# MORA C – vollständige echte Gesprächsprotokolle','',f"Quellcommit: `{data['sourceCommit']}`; Modell: `{data['model']}`. 20 vorab festgelegte Gespräche mit 52 Kundennachrichten. Kein Aktionsklick im Vergleich; lokale Speicherung wird separat geprüft. Alle erzeugten Kandidaten und Prüferantworten einschliesslich verworfener Ausgaben stehen in `evidence/quality-phase2-live.json`. Keine Mock-Antworten in diesem Korpus. Frühere A/B-Gespräche stehen in `MORA_PHASE1_TRANSCRIPTS.md`.",'']
for c in cases:
 lines += [f"## {c['id']}: {c['topic']}",''];notices=set()
 for r in [x for x in rows if x['caseId']==c['id']]:
  lines += [f"**Kunde:** {r['message']}",'']
  hazard=r['result'].get('safety',{}).get('hazard') if r['result'].get('safety') else None
  if r['result'].get('safetyNotice') and hazard not in notices:
   notices.add(hazard);lines += [f"**Sicherheitshinweis der Anwendung:** {r['result']['safetyNotice']}",'']
  lines += [f"**MORA:** {reply(r)}",'',f"Herkunft `{r['replyOrigin']['type']}`; Anwendungsstatus {r['applicationStatus']}; echte Generierungen {len(r['trace'])}; Serverzeit ohne zusätzliche Guthabenabfrage {max(0,r['elapsedMs']-sum(t.get('guardMs',0) for t in r['trace']))/1000:.3f} s; tatsächliche Gateway-Kosten {cost(r)} USD.",'']
  if r['result'].get('actions'):lines += ['Angebotene Aktionen: '+', '.join(a['label'] for a in r['result']['actions'])+'.','']
(root/'docs/MORA_PHASE2_TRANSCRIPTS.md').write_text('\n'.join(lines))
print(json.dumps({'complete':True,'C':measurements['C'],'verification':measurements.get('verification'),'costCoverage':measurements['costCoverage']},ensure_ascii=False,indent=2))
