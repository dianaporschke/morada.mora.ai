"""Prepare an isolated evaluation copy; never edits the customer app or deploys."""
import argparse,hashlib,json,pathlib,shutil
p=argparse.ArgumentParser();p.add_argument('--output',required=True);args=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[2];out=pathlib.Path(args.output).resolve()
assert root!=out and root not in out.parents, 'Use a separate directory outside the repository'
assert not out.exists() or not any(out.iterdir()), 'Output must be new or empty'
manifest=json.loads((root/'docs/evidence/quality-phase1-source-manifest.json').read_text())
paths=[]
for entry in manifest['unchangedSourceFiles']:
    f=root/entry['path'];raw=f.read_bytes()
    digest=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
    assert digest==entry['sha'], 'Source differs from frozen B: '+entry['path']
    paths.append(entry['path'])
paths += [str(f.relative_to(root)) for f in (root/'icons').rglob('*') if f.is_file()]
paths += ['transparent 1.0.png','transparent 2.0.png','scripts/quality-phase1/server.js','scripts/quality-phase1/cases.json']
for name in sorted(set(paths)):
    dst=out/name;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/name,dst)
(out/'api/quality-phase1.js').write_text("export {default} from '../scripts/quality-phase1/server.js';\n")
config=json.loads((out/'vercel.json').read_text());config['functions']['api/quality-phase1.js']={'maxDuration':60}
(out/'vercel.json').write_text(json.dumps(config,indent=2)+'\n')
print(json.dumps({'prepared':str(out),'sourceCommit':manifest['sourceCommit'],'verifiedCoreFiles':len(manifest['unchangedSourceFiles']),
 'inferenceStarted':False,'deploymentCreated':False,'requiredTarget':'preview, no aliases, same existing project/branch environment'}))
