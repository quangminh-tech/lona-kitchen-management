import json,os,tempfile,subprocess,time,urllib.request,urllib.error,http.cookiejar,uuid
from pathlib import Path
root=Path(__file__).resolve().parents[1];dotnet=os.getenv('DOTNET','dotnet');url='http://127.0.0.1:5091'
with tempfile.TemporaryDirectory() as td:
 env=os.environ.copy();env.update({'DataPath':td+'/state.json','IdentityPath':td+'/identity.json','OperationsPath':td+'/operations.json','PlanningPollSeconds':'1','LONA_ADMIN_PASSWORD':'V6-Integration-Test!2026'})
 proc=subprocess.Popen([dotnet,'run','--project',str(root/'backend/Lona.Week.Api.csproj'),'--no-build','--no-launch-profile','--urls',url],cwd=root,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 def client():return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 def call(c,path,data=None,expect=200):
  q=urllib.request.Request(url+path,data=json.dumps(data).encode() if data is not None else None,headers={'Content-Type':'application/json','X-Lona-Request':'1'})
  try:
   with c.open(q,timeout=15) as r:status=r.status;body=r.read()
  except urllib.error.HTTPError as e:status=e.code;body=e.read()
  assert status==expect,(path,status,expect,body[:350]);return json.loads(body) if body else {}
 try:
  a=client()
  for _ in range(150):
   try:call(a,'/api/operations',expect=401);break
   except (OSError,urllib.error.URLError):time.sleep(.1)
  call(a,'/api/auth/login',{'username':'admin','password':env['LONA_ADMIN_PASSWORD']});s=call(a,'/api/operations');assert len(s['items'])==20 and len(s['templates'])==4
  def op(t,p,expect=200,client=None):
   global s
   c=client or a;current=call(c,'/api/operations');cmd={'type':t,'payload':p,'requestId':str(uuid.uuid4()),'expectedRevision':current['revision']};result=call(c,'/api/operations',cmd,expect)
   if expect==200 and c==a:s=result
   return result
  op('create',{'from':'TT','to':'CG','item':'GAO','qty':100,'due':'2026-10-28'});t=s['transfers'][0];op('approve',{'id':t['id']});op('dispatch',{'id':t['id']});assert s['balances']['TRANSIT|GAO']==100;op('receive',{'id':t['id'],'qty':60});assert s['balances']['TRANSIT|GAO']==40
  op('receive',{'id':t['id'],'qty':41},409);op('dispatch',{'id':t['id']},409)
  op('publish',{'transferId':t['id'],'templateId':'TRANSFER'});doc=s['documents'][0];frozen=json.dumps(doc,sort_keys=True)
  template=next(t for t in s['templates'] if t['id']=='TRANSFER');template['title']='PHIẾU CHUYỂN - {{company.name}}';op('template',{'template':template});assert next(t for t in s['templates'] if t['id']=='TRANSFER')['version']==2;assert json.dumps(s['documents'][0],sort_keys=True)==frozen
  bad={**template,'info':'{{unknown.function}}'};op('template',{'template':bad},409)
  op('publish',{'transferId':t['id'],'templateId':'ISSUE'},409)
  access=call(a,'/api/admin/access');call(a,'/api/admin/users',{'username':'kho_cg','name':'Thủ kho CG','role':'warehouse','active':True,'password':'Warehouse-Test-2026!','revision':access['revision']});w=client();call(w,'/api/auth/login',{'username':'kho_cg','password':'Warehouse-Test-2026!'});ws=call(w,'/api/operations');assert 'TT|GAO' not in ws['balances'];op('dispatch',{'id':t['id']},403,w);op('template',{'template':template},403,w)
  op('receive',{'id':t['id'],'qty':40},200,w);s=call(a,'/api/operations');assert s['balances']['TRANSIT|GAO']==0
  # New draft meals and full BOM snapshots, no orders or stock change from planning.
  op('repeat',{'kitchen':'CG','from':'2026-10-28','to':'2026-11-30'});op('run',{'kitchen':'CG','date':'2026-10-27'});assert s['jobs'][0]['snapshots'][0]['status']=='BLOCKED'
  op('menus',{'kitchen':'CG','rows':[{**m,'approved':True} for m in s['menus'] if m['kitchen']=='CG']});op('run',{'kitchen':'CG','date':'2026-10-27'});j=s['jobs'][0];r=j['snapshots'][0];assert r['status']=='READY',(r.get('errors'),r);assert len(r['totals'])>10
  count=len(s['jobs']);op('run',{'kitchen':'CG','date':'2026-10-27'});assert len(s['jobs'])==count
  op('purchase',{'kitchen':'CG','jobId':j['id']});assert len(s['orders'])>0
  op('purchase',{'kitchen':'CG','jobId':j['id']},409)
  first=s['orders'][0];op('purchaseReceive',{'id':first['id'],'qty':first['quantity']/2});assert s['orders'][0]['received']==first['quantity']/2
  op('purchaseReceive',{'id':first['id'],'qty':first['quantity']},409)
  for o in list(s['orders']):
   if o['quantity']>o['received']:op('purchaseReceive',{'id':o['id'],'qty':o['quantity']-o['received']})
  op('productionIssue',{'kitchen':'CG','jobId':j['id']},409) # stale after stock changes
  op('run',{'kitchen':'CG','date':'2026-10-27'});op('productionIssue',{'kitchen':'CG','jobId':s['jobs'][0]['id']});issue=s['issues'][0];assert len(issue['lines'])>10
  op('run',{'kitchen':'CG','date':'2026-10-27'});op('productionIssue',{'kitchen':'CG','jobId':s['jobs'][0]['id']},409)
  op('publish',{'transferId':issue['id'],'templateId':'ISSUE'});assert s['documents'][-1]['context']['lines'][0]['dispatched']>0
  op('schedule',{'enabled':True,'hour':0,'minute':0,'timeZone':'Asia/Ho_Chi_Minh'})
  for _ in range(8):
   time.sleep(.4);latest=call(a,'/api/operations')
   if any(j['kitchen']=='B2' for j in latest['jobs']):break
  assert any(j['kitchen']=='B2' for j in latest['jobs']),'worker did not run'
  print('PASS V6: authenticated persistence, transit/partial receipt, scope redaction, API permissions, full BOM/approval gate, job dedup, stale issue rejection, atomic production issue, duplicate day guard, template version, variable validation, immutable published snapshots, source/template type binding')
 finally:proc.terminate();proc.wait(timeout=10)
