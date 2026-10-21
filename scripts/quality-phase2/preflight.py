"""Read-only original Phase 1 endpoint preflight; no inference. Private config stdin."""
import http.cookiejar,json,pathlib,sys,urllib.request,termios
if sys.stdin.isatty():
    terminal=termios.tcgetattr(sys.stdin.fileno());terminal[3]&=~termios.ECHO;termios.tcsetattr(sys.stdin.fileno(),termios.TCSANOW,terminal)
cfg=json.loads(sys.stdin.readline())
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
opener.open(cfg['share'],timeout=35).close()
req=urllib.request.Request(cfg['url']+'/api/quality-phase1',data=b'{"op":"start"}',headers={'Content-Type':'application/json'},method='POST')
with opener.open(req,timeout=35) as response:data=json.load(response)
proof={k:data[k] for k in ['credits','model','price','sourceCommit','inferenceStarted']}
assert proof['inferenceStarted'] is False and abs(sum(proof['credits'][k] for k in ['balanceUsd','totalUsedUsd'])-5)<0.00001
pathlib.Path(cfg['output']).write_text(json.dumps(proof,indent=2)+'\n')
print(json.dumps(proof),flush=True)
