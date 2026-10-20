"""Reproduce measurements from saved real responses. Does not call a model."""
import collections, json, math, pathlib, re, statistics, sys

root=pathlib.Path(__file__).resolve().parents[2]
evidence=root/'docs/evidence'
data=json.loads((evidence/'quality-phase1-live.json').read_text())
fixtures=json.loads((pathlib.Path(__file__).parent/'cases.json').read_text())
initial_rows=data['rows'];rows=list(initial_rows)
replacement_path=evidence/'quality-phase1-retest-09.json'
replacement=json.loads(replacement_path.read_text()) if replacement_path.exists() else None
if replacement and replacement.get('complete'):
    assert all(replacement[k]==data[k] for k in ['sourceCommit','model','promptAHash','manifestHash','price','maxCostUsd'])
    assert len(replacement['rows'])==6 and all(r['caseId']=='09' and not r.get('measurementError') and not r.get('fatal') for r in replacement['rows'])
    order={(s['caseId'],s['turn'],s['variant']):i for i,s in enumerate(data['schedule'])}
    rows=sorted([r for r in initial_rows if r['caseId']!='09']+replacement['rows'],key=lambda r:order[(r['caseId'],r['turn'],r['variant'])])
cost_records=list(data.get('costs',[]))+(replacement.get('costs',[]) if replacement else [])
audit_path=evidence/'quality-phase1-cost-audit.json'
if audit_path.exists():cost_records+=json.loads(audit_path.read_text()).get('costs',[])
cost_by_id={c['id']:c['info'] for c in cost_records if 'info' in c}
observed_ids={t['generationId'] for r in initial_rows+(replacement.get('rows',[]) if replacement else []) for t in r['trace'] if t.get('generationId')}
assert all(info['id']==gid and info['model']=='inception/mercury-2.5' for gid,info in cost_by_id.items())
def percentile(values,p):
    values=sorted(values)
    if not values:return None
    index=(len(values)-1)*p;lo=math.floor(index);hi=math.ceil(index)
    return values[lo]+(values[hi]-values[lo])*(index-lo)
def stats(values):
    return {'n':len(values),'median':statistics.median(values) if values else None,'mean':statistics.mean(values) if values else None,'p95':percentile(values,.95)}
def display(row):return row['result'].get('reply') or row['result'].get('error') or '[Keine Kundenantwort]'
def generation_cost(row):
    ids=[t.get('generationId') for t in row['trace']]
    return sum(cost_by_id[i]['totalCost'] for i in ids) if all(i in cost_by_id for i in ids) else None
def summary(selected):
    texts=[display(r) for r in selected]
    costs=[generation_cost(r) for r in selected]
    return {
      'turns':len(selected),'applicationErrors':sum(r['applicationStatus']!=200 for r in selected),
      'degradedTurns':sum(bool(r['result'].get('degraded')) for r in selected),
      'replyOrigins':dict(collections.Counter(r['replyOrigin']['type'] for r in selected)),
      'responseModes':dict(collections.Counter(r['result'].get('responseMode') for r in selected)),
      'generations':sum(len(r['trace']) for r in selected),
      'generationCountPerTurn':dict(collections.Counter(len(r['trace']) for r in selected)),
      'latencyWallMs':stats([r['wallMs'] for r in selected]),
      'latencyServerMs':stats([r['elapsedMs'] for r in selected]),
      'latencyServerExcludingCreditGuardMs':stats([max(0,r['elapsedMs']-sum(t.get('guardMs',0) for t in r['trace'])) for r in selected]),
      'latencyModelResponsesOnlyWallMs':stats([r['wallMs'] for r in selected if r['result'].get('responseMode')=='model']),
      'modelHttpDurationMs':stats([t['durationMs'] for r in selected for t in r['trace']]),
      'totalGatewayCostUsd':sum(costs) if all(c is not None for c in costs) else None,
      'unpricedTurns':sum(c is None for c in costs),
      'replyCharacters':stats([len(s) for s in texts]),
      'questionMarks':sum(s.count('?') for s in texts),
      'formalThanksTurns':sum(bool(re.search(r'vielen dank|danke für|besten dank',s,re.I)) for s in texts),
      'apologyTurns':sum(bool(re.search(r'tut mir leid|entschuldig|bedauere',s,re.I)) for s in texts),
      'administrativeConfirmationTurns':sum(bool(re.search(r'\b(notiert|erfasst|aufgenommen|festgehalten|vermerkt)\b',s,re.I)) for s in texts),
      'contractRepairGenerations':sum('The previous JSON was rejected and was NOT shown or executed.' in json.dumps(t['request'],ensure_ascii=False) for r in selected for t in r['trace']),
      'inputTokens':sum(cost_by_id[t['generationId']]['promptTokens'] for r in selected for t in r['trace'] if t.get('generationId') in cost_by_id),
      'outputTokens':sum(cost_by_id[t['generationId']]['completionTokens'] for r in selected for t in r['trace'] if t.get('generationId') in cost_by_id),
      'reasoningTokens':sum(cost_by_id[t['generationId']]['reasoningTokens'] for r in selected for t in r['trace'] if t.get('generationId') in cost_by_id),
      'billableOutputIncludingReasoningTokens':sum(cost_by_id[t['generationId']]['completionTokens']+cost_by_id[t['generationId']]['reasoningTokens'] for r in selected for t in r['trace'] if t.get('generationId') in cost_by_id),
    }

measurement={'complete':bool(data.get('complete') and replacement and replacement.get('complete')),'rows':len(rows),'expectedRows':len(data['schedule']),
 'cohortRule':'Initial cases except 09; first instrument-valid complete replacement of case 09, declared before replacement. All original responses retained.',
 'receivedOriginalTurns':len(initial_rows),'receivedReplacementTurns':len(replacement['rows']) if replacement else 0,
 'observedTaskGenerations':sum(len(r['trace']) for r in initial_rows)+(sum(len(r['trace']) for r in replacement['rows']) if replacement else 0),
 'costCoverage':{'observedUniqueGenerationIds':len(observed_ids),'resolvedUniqueGenerationIds':len(observed_ids & cost_by_id.keys()),'unresolvedGenerationIds':sorted(observed_ids-cost_by_id.keys())},
 'knownTaskGenerationCostUsd':sum(info['totalCost'] for info in cost_by_id.values()),
 'transportResumptions':data.get('resumptions',[]),'variants':{},'cases':[]}
for variant in ['A','B']:measurement['variants'][variant]=summary([r for r in rows if r['variant']==variant])
for fixture in fixtures:
    item={'id':fixture['id'],'topic':fixture['topic'],'variants':{}}
    for variant in ['A','B']:
        selected=[r for r in rows if r['caseId']==fixture['id'] and r['variant']==variant]
        item['variants'][variant]=summary(selected)
    measurement['cases'].append(item)

if '--partial' in sys.argv:
    print(json.dumps(measurement,ensure_ascii=False,indent=2));sys.exit()
assert measurement['complete'] and len(rows)==len(data['schedule']), 'Incomplete comparison or documented replacement; no final report generated'
assert not measurement['costCoverage']['unresolvedGenerationIds'], 'Actual generation costs still pending'
for row,expected in zip(rows,data['schedule']):
    assert all(row[k]==expected[k] for k in ['caseId','turn','variant']), 'Unexpected case/order'
    fixture=next(f for f in fixtures if f['id']==row['caseId'])
    assert row['message']==fixture['messages'][row['turn']-1], 'Customer input changed'
for fixture in fixtures:
    for variant in ['A','B']:
        assert len([r for r in rows if r['caseId']==fixture['id'] and r['variant']==variant])==len(fixture['messages']), 'Incomplete conversation'
assert all(not r.get('measurementError') for r in rows)
assert all(r['applicationStatus']!=200 or r['result'].get('responseMode')!='model' or r['trace'] for r in rows)
(evidence/'quality-phase1-measurements.json').write_text(json.dumps(measurement,ensure_ascii=False,indent=2)+'\n')
transcript=['# MORA Phase 1: echte Gesprächsprotokolle','',f"Basiscommit: `{data['sourceCommit']}`. Modell: `{data['model']}`. Primärkohorte: 20 Gesprächspaare mit 104 Antworten. Fall 09 verwendet die vorab erklärte vollständige Messwiederholung; der ursprüngliche Durchlauf steht unverändert im Anhang. Ausfälle und herabgestufte Antworten bleiben enthalten.",'',
 'Vollständige generierte Textfelder, verworfene Kandidaten, Prompts, Parameter, Validatorprotokolle und tatsächliche Kostenbelege stehen in `evidence/quality-phase1-live.json` und für den primären Fall 09 in `evidence/quality-phase1-retest-09.json`. Frühere Pending-Kostenbelege bleiben neben später bestätigten Lookup-Belegen erhalten; die Auswertung verwendet die bestätigten eindeutigen Generierungs-IDs. Reasoning-Inhalte und Zugangsdaten sind ausgeschlossen.','']
for fixture in fixtures:
    transcript += [f"## {fixture['id']}: {fixture['topic']}"+(' – dokumentierte Messwiederholung' if fixture['id']=='09' else ''),'']
    for variant in ['A','B']:
        transcript += [f'### Variante {variant}','']
        for row in [r for r in rows if r['caseId']==fixture['id'] and r['variant']==variant]:
            transcript += [f"**Kunde:** {row['message']}",'',f"**MORA:** {display(row)}",'',
              f"Herkunft: `{row['replyOrigin']['type']}`; Generierungen: {len(row['trace'])}; Anwendungsstatus: {row['applicationStatus']}; Dauer: {row['wallMs']/1000:.3f} s; Gateway-Kosten: {generation_cost(row)} USD.",'']
            if row['result'].get('actions'):transcript += ['Anwendungsaktionen: '+', '.join(a.get('label',a.get('type','?')) for a in row['result']['actions'])+'.','']
transcript += ['## Anhang: ursprünglicher Fall 09 mit Messstörung','',
 'Beim dritten B-Turn scheiterte nach einer korrekt abgewiesenen echten Modellantwort der zusätzliche lesende Guthabenschutz vor dem normalen Korrekturaufruf. Dies ist kein nachgewiesener nativer Modell-/Produkt-Ausfall. Die folgenden ursprünglichen Antworten wurden nicht gelöscht; sie werden wegen der Messstörung durch den vorab festgelegten ersten vollständigen Wiederholungsdurchlauf ersetzt.','']
for row in [r for r in initial_rows if r['caseId']=='09']:
    transcript += [f"**{row['variant']}, Runde {row['turn']} – Kunde:** {row['message']}",'',f"**MORA:** {display(row)}",'',f"Anwendungsstatus {row['applicationStatus']}; Herkunft `{row['replyOrigin']['type']}`.",'']
(root/'docs/MORA_PHASE1_TRANSCRIPTS.md').write_text('\n'.join(transcript))
print(json.dumps({'complete':measurement['complete'],'variants':measurement['variants']},ensure_ascii=False,indent=2))
