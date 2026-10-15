"""Summarize saved genuine responses. Signals describe text; they never grade or change product replies."""
import json, pathlib, re, statistics

root=pathlib.Path('docs/evidence')
before_files=['mora-intelligence-before.json','mora-intelligence-before-paced.json','mora-intelligence-before-final-cases.json']
selected={}
for name in before_files:
    if not (root/name).exists():continue
    source=json.loads((root/name).read_text())
    by_case={}
    for row in source['rows']:by_case.setdefault(row['caseId'],[]).append(row)
    for key,rows in by_case.items():selected[key]=rows
before=[row for key in sorted(selected) for row in selected[key]]
after=json.loads((root/'mora-intelligence-after.json').read_text())['rows'] if (root/'mora-intelligence-after.json').exists() else []
intro=re.compile(r'^\s*(?:vielen dank|danke\b|(?:ich|wir)\s+(?:versteh|notier|hab(?:e|en).{0,45}(?:notiert|vermerkt|erfasst|aufgenommen))|verstehe|verstanden|es tut|das (?:tut|bedauer))',re.I)
admin=re.compile(r'\b(?:notiert|notiere|vermerkt|erfasst|aufgenommen|hinterlegt)\b',re.I)
draft=re.compile(r'\b(?:Entwurf|Entwürfe|Entwurfs|vorbereiten|vorbereitet)\b',re.I)
def distribution(values):
    return {'n':len(values),'median':round(statistics.median(values),3),'min':min(values),'max':max(values)} if values else {'n':0}
def summary(rows):
    good=[r for r in rows if r['status']==200 and r.get('responseMode')=='model']
    usages=[r['modelUsage'] for r in good if r.get('modelUsage')]
    total=lambda key:sum(u.get(key)or 0 for u in usages)
    return {'casesAttempted':len(set(r['caseId'] for r in rows)),'turns':len(rows),'modelReplies':len(good),
      'failures':[{'caseId':r['caseId'],'turn':r['turn'],'status':r['status'],'availability':r.get('modelAvailability')} for r in rows if r['status']!=200],
      'safetyReplies':sum(r.get('responseMode')=='safety' for r in rows),
      'serverMs':distribution([r['timingMs']['total'] for r in good if r.get('timingMs')]),
      'clientSeconds':distribution([r['seconds'] for r in good]),
      'modelCalls':sum(r.get('modelCalls')or 0 for r in good),'repairTurns':sum((r.get('modelCalls')or 0)>1 for r in good),
      'tokens':{key:total(key) for key in ['inputTokens','outputTokens','reasoningTokens','cachedInputTokens']},
      'knownUncachedEstimateUsd':round((total('inputTokens')*.04+total('outputTokens')*.15)/1e6,6),
      'costBasis':'2026-10-15 Mercury catalog rates; uncached estimate for returned usage, including returned repair usage, not an invoice; failed generations may be missing',
      'textSignals':{'routineIntroductions':sum(bool(intro.search(r['reply'])) for r in good),
        'administrativeWording':sum(bool(admin.search(r['reply'])) for r in good),
        'draftMentions':sum(bool(draft.search(r['reply'])) for r in good),
        'turnsWithButtons':sum(bool(r.get('actions')) for r in good)},
      'caseCoverage':[{'id':key,'turns':len([r for r in rows if r['caseId']==key]),
        'allHttp200':all(r['status']==200 for r in rows if r['caseId']==key)} for key in sorted(set(r['caseId'] for r in rows))]}
baseline={(r['caseId'],r['turn']):r for r in before}
pairs=[(baseline[(r['caseId'],r['turn'])],r) for r in after if (r['caseId'],r['turn']) in baseline]
# The initial three cases used faster pacing. Keep them for quality evidence,
# but exclude them from the comparable paced performance subset.
performance=[(b,a) for b,a in pairs if b['caseId']>='04-' and all(r['status']==200 and r.get('responseMode')=='model' and r.get('timingMs') for r in [b,a])]
result={'before':summary(before),'after':summary(after),'pairedTurns':len(pairs),
  'pairedPacedPerformance':{'turns':len(performance),
    'beforeServerMs':distribution([b['timingMs']['total'] for b,a in performance]),
    'afterServerMs':distribution([a['timingMs']['total'] for b,a in performance]),
    'beforeClientSeconds':distribution([b['seconds'] for b,a in performance]),
    'afterClientSeconds':distribution([a['seconds'] for b,a in performance])},
  'limitations':['Synthetic fixed conversations, not adaptive customer interviews or an independent blinded benchmark.',
    'Routine-introduction and administrative-wording counts are transparent regex signals, not semantic quality scores.',
    'Safety replies are excluded from model speed and style statistics.',
    'No inference is performed by this summary script.']}
(root/'mora-intelligence-comparison-summary.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
