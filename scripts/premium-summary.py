"""Summarize actual Preview evidence. No inference, quality grades or fabricated replies.

Provide ordered source files; a later file explicitly replaces the whole case,
never a favourable individual answer. Keep all original requests for audit/costs.
"""
import argparse, json, pathlib, re, statistics

def load(paths):
    selected={};attempts=[]
    for path in paths:
        document=json.loads(pathlib.Path(path).read_text())
        grouped={}
        for row in document['rows']:
            attempts.append(row);grouped.setdefault(row['caseId'],[]).append(row)
        selected.update(grouped)
    return [row for key in sorted(selected) for row in selected[key]],attempts

def genuine(row):return row['status']==200 and row['responseMode']=='model'
def cost(row,cached=False):
    usage=row.get('modelUsage') or {}
    if not all(isinstance(usage.get(k),int) for k in ['inputTokens','outputTokens']):return None
    cache=usage.get('cachedInputTokens') or 0 if cached else 0
    return ((usage['inputTokens']-cache)*.04+cache*.004+usage['outputTokens']*.15)/1_000_000

def median(values):return round(statistics.median(values),4) if values else None
def summarize(rows):
    ai=[r for r in rows if genuine(r)];normal=[r for r in rows if not r['caseId'].startswith('S')]
    safety=[r for r in rows if r.get('responseMode')=='safety']
    starts=re.compile(r'^(?:Vielen Dank|Danke|Ich verstehe|Verstehe|Verstanden|Guten Tag|Es tut mir leid|Das habe ich notiert|Ich habe (?:not|Ihre|vermerkt)|Ich nehme)',re.I)
    return {'attemptedCases':len({r['caseId'] for r in rows}),'normalCases':len({r['caseId'] for r in normal}),
      'normalTurns':len(normal),'genuineReplies':len(ai),'localSafetyReplies':len(safety),
      'normalFailedCases':sorted({r['caseId'] for r in normal if r['status']!=200}),
      'normalFailures':[{'caseId':r['caseId'],'turn':r['turn'],'availability':r.get('modelAvailability')} for r in normal if r['status']!=200],
      'formulaicStartSignals':sum(bool(starts.search(r['reply'])) for r in ai),
      'draftMentionSignals':sum(bool(re.search(r'entwurf|bericht',r['reply'],re.I)) for r in ai),
      'repliesWithActions':sum(bool(r.get('actions')) for r in ai),
      'medianServerSeconds':median([r['timingMs']['total']/1000 for r in ai if r.get('timingMs')]),
      'medianTestClientSeconds':median([r['seconds'] for r in ai]),
      'medianInputTokens':median([(r.get('modelUsage') or {})['inputTokens'] for r in ai if isinstance((r.get('modelUsage') or {}).get('inputTokens'),int)]),
      'medianOutputTokens':median([(r.get('modelUsage') or {})['outputTokens'] for r in ai if isinstance((r.get('modelUsage') or {}).get('outputTokens'),int)]),
      'twoCallReplies':sum(r.get('modelCalls')==2 for r in ai)}

parser=argparse.ArgumentParser();parser.add_argument('--before',nargs='+',required=True);parser.add_argument('--after',nargs='+',required=True);parser.add_argument('--out',required=True)
args=parser.parse_args();before,before_attempts=load(args.before);after,after_attempts=load(args.after)
index={(r['caseId'],r['turn'],r['message']):r for r in before if genuine(r)}
pairs=[(index[key],r) for r in after if genuine(r) and (key:=(r['caseId'],r['turn'],r['message'])) in index]
paired={}
for label,offset in [('before',0),('after',1)]:
    rows=[pair[offset] for pair in pairs]
    paired[label]={'count':len(rows),'medianServerSeconds':median([r['timingMs']['total']/1000 for r in rows if r.get('timingMs')]),
      'medianTestClientSeconds':median([r['seconds'] for r in rows]),'knownUncachedUsd':sum(cost(r) or 0 for r in rows),
      'knownCacheAdjustedUsd':sum(cost(r,True) or 0 for r in rows)}
attempts=before_attempts+after_attempts
result={'beforeSources':args.before,'afterSources':args.after,'before':summarize(before),'after':summarize(after),'pairedSuccessfulModelTurns':paired,
 'allComparisonRequests':len(attempts),'requestsWithKnownUsage':sum(cost(r) is not None for r in attempts),
 'knownUncachedComparisonUsd':sum(cost(r) or 0 for r in attempts),'knownCacheAdjustedComparisonUsd':sum(cost(r,True) or 0 for r in attempts),
 'limitations':['One stochastic run per version, not a controlled benchmark or SLA.',
   'Local safety responses and errors excluded from model speech/paired speed.',
   'Signals count phrases, not semantic quality; read transcripts and manual review.',
   'Costs use 2026-10-20 public promotional rates, omit unknown failed usage and hosting, not an invoice.',
   'Client timing includes the test transport/proxy, not browser display time.']}
pathlib.Path(args.out).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False,indent=2))
