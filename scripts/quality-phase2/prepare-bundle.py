"""Copy frozen committed source to an isolated evaluation bundle; never deploys."""
import argparse,hashlib,json,pathlib,shutil,subprocess
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--credit-proof',required=True);args=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[2];out=pathlib.Path(args.output).resolve()
assert root!=out and root not in out.parents and (not out.exists() or not any(out.iterdir()))
commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
assert subprocess.check_output(['git','branch','--show-current'],cwd=root,text=True).strip()=='codex/mora-ai-2.0'
proof=json.loads(pathlib.Path(args.credit_proof).read_text())
assert abs(proof['credits']['balanceUsd']+proof['credits']['totalUsedUsd']-5)<0.00001
tracked=subprocess.check_output(['git','ls-files'],cwd=root,text=True).splitlines()
paths=[name for name in tracked if name.startswith(('api/','lib/','assets/','icons/','scripts/quality-phase2/')) or name in ['index.html','package.json','package-lock.json','vercel.json','scripts/build.mjs','scripts/check.mjs','scripts/quality-phase1/cases.json','scripts/premium-cases.json'] or name in ['transparent 1.0.png','transparent 2.0.png']]
manifest=[]
for name in paths:
    if name.endswith('.py') or name.endswith('.md'):continue
    raw=(root/name).read_bytes();gitraw=subprocess.check_output(['git','show',commit+':'+name],cwd=root)
    assert raw==gitraw,'Uncommitted bundle source: '+name
    manifest.append({'path':name,'sha256':hashlib.sha256(raw).hexdigest()})
    dst=out/name;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/name,dst)
info={'commit':commit,'baselineUsedUsd':proof['credits']['totalUsedUsd'],'files':manifest,'maxAdditionalCostUsd':0.50,'creditProof':proof}
(out/'scripts/quality-phase2/source-info.json').write_text(json.dumps(info,indent=2)+'\n')
(out/'api/quality-phase2.js').write_text("export {default} from '../scripts/quality-phase2/server.js';\n")
config=json.loads((out/'vercel.json').read_text());config['functions']['api/quality-phase2.js']={'maxDuration':60};(out/'vercel.json').write_text(json.dumps(config,indent=2)+'\n')
print(json.dumps({'bundle':str(out),'sourceCommit':commit,'sourceFiles':len(manifest),'inferenceStarted':False,'deploymentCreated':False}))
