"""Authorized HTTP source/control check; does not operate a browser or invoke a model."""
import hashlib,http.cookiejar,json,pathlib,sys,urllib.error,urllib.request
if sys.stdin.isatty():
 import termios
 t=termios.tcgetattr(sys.stdin.fileno());t[3]&=~termios.ECHO;termios.tcsetattr(sys.stdin.fileno(),termios.TCSANOW,t)
c=json.loads(sys.stdin.readline());opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
opener.open(c['share'],timeout=35).close()
def get(path):
 with opener.open(urllib.request.Request(c['url']+path,headers={'Accept-Encoding':'identity'}),timeout=35) as r:return r.status,r.read()
status,html=get('/?mora=c');html=html.decode();greeting='Guten Tag! Ich bin MORA, Ihre digitale Assistenz bei MORADA. Wie kann ich Ihnen heute helfen?'
assert status==200 and greeting in html and 'type="module" src="/assets/mora-client.js"' in html
asset_status,asset=get('/assets/mora-client.js');actual_hash=hashlib.sha256(asset).hexdigest();local_hash=hashlib.sha256(pathlib.Path('assets/mora-client.js').read_bytes()).hexdigest();assert actual_hash==local_hash
request=urllib.request.Request(c['url']+'/api/chat-simple',data=b'{"actionId":"new-request"}',headers={'Content-Type':'application/json'},method='POST')
with opener.open(request,timeout=35) as r:control_status=r.status;control=json.load(r)
assert control_status==200 and control['architecture']=='simple_v1' and control['modelCalls']==0 and control['responseMode']=='control'
assert control['capabilities']['alexanderPortalConnected'] is False
try:harness_status,_=get('/api/quality-latency')
except urllib.error.HTTPError as error:harness_status=error.code
assert harness_status==404
proof={'url':c['url']+'/?mora=c','deploymentId':c['deploymentId'],'sourceCommit':c['sourceCommit'],'htmlStatus':status,'greeting':greeting,'clientAssetStatus':asset_status,'clientSha256':actual_hash,'clientMatchesSource':True,
 'controlStatus':control_status,'architecture':control['architecture'],'controlResponseMode':control['responseMode'],'modelCalls':0,'alexanderPortalConnected':False,'diagnosticRouteStatus':harness_status,
 'browserUsed':False,'browserPaintMeasured':False,'scope':'HTTP-delivered source and real non-generative control route. No model conversation, draft persistence or browser rendering success is claimed.'}
pathlib.Path(c['output']).write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n');print(json.dumps(proof,ensure_ascii=False),flush=True)
