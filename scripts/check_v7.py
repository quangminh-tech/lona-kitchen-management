import os,json,time,tempfile,subprocess,urllib.request,urllib.error,http.cookiejar,uuid,shutil
from pathlib import Path
root=Path(__file__).resolve().parents[1];url='http://127.0.0.1:5093'
with tempfile.TemporaryDirectory() as td:
 env=os.environ.copy();env.update({'DataPath':td+'/state.json','IdentityPath':td+'/identity.json','OperationsPath':td+'/operations.json','LONA_ADMIN_PASSWORD':'V7-Test-Local-2026!','ASPNETCORE_ENVIRONMENT':'Development'})
 log=open(td+'/log','w');proc=subprocess.Popen([os.getenv('DOTNET','dotnet'),str(root/'backend/bin/Debug/net10.0/Lona.Week.Api.dll'),'--urls',url,'--contentRoot',str(root/'backend')],env=env,stdout=log,stderr=log)
 c=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 def call(path,data=None,expect=200,client=None):
  q=urllib.request.Request(url+path,data=None if data is None else json.dumps(data).encode(),headers={'Content-Type':'application/json','X-Lona-Request':'1'})
  try:
   with (client or c).open(q,timeout=30) as r: status=r.status;body=r.read()
  except urllib.error.HTTPError as e:status=e.code;body=e.read()
  assert status==expect,(path,status,body[:800]);return json.loads(body) if body else {}
 try:
  for _ in range(100):
   try:call('/healthz');break
   except Exception:time.sleep(.1)
  call('/api/auth/login',{'username':'admin','password':env['LONA_ADMIN_PASSWORD']})
  def op(t,p,expect=200,rid=None):
   s=call('/api/operations');return call('/api/operations',{'type':t,'payload':p,'expectedRevision':s['revision'],'requestId':rid or str(uuid.uuid4())},expect)
  s=op('loadDemo',{});print('Loaded',len(s['orders']),'orders',len(s['stockReceipts']),'receipts',len(s['issues']),'issues',len(s['transfers']),'transfers',len(s['documents']),'PDF snapshots')
  if os.getenv('LONA_EXPORT_DEMO')=='1':
   shutil.copyfile(td+'/operations.json',root/'samples/demo_operations.json')
   shutil.copyfile(td+'/operations.json',root/'frontend/src/services/demo-workflow.json')
  assert len(s['orders'])>2 and len(s['stockReceipts'])>1 and len(s['issues'])>0 and len(s['documents'])==3
  assert s['transfers'][-1]['status']=='PARTIAL'; assert len(s['transfers'][-1]['history'])==4
  op('loadDemo',{},409)
  before=call('/api/operations');manual=[x for x in before['orders'] if x.get('supplier')][0]
  op('purchaseReceive',{'id':manual['id'],'qty':61},409)
  after=call('/api/operations');assert before['balances']==after['balances'] and before['revision']==after['revision']
  op('transferBatch',{'from':'TT','to':'PRODUCTION','due':'2026-11-03','lines':[{'itemId':'GAO','quantity':1,'unit':'kg'}]},409)
  bad={'warehouseId':'CG','supplier':'TEST','dueDate':'2026-11-03','lines':[{'itemId':'GAO','quantity':1,'unit':'g'}]};op('purchaseBatch',bad,409)
  bad['lines'][0]['unit']='kg';bad['importKey']='test-v7-import';rid=str(uuid.uuid4());s=op('purchaseBatch',bad,rid=rid);count=len(s['orders']);s=op('purchaseBatch',bad,rid=rid);assert len(s['orders'])==count;op('purchaseBatch',bad,409)
  # A two-row transfer whose second row fails must persist neither row.
  before=call('/api/operations');op('transferBatch',{'from':'TT','to':'CG','due':'2026-11-03','lines':[{'itemId':'GAO','quantity':1,'unit':'kg'},{'itemId':'UNKNOWN','quantity':1,'unit':'kg'}]},409);assert len(call('/api/operations')['transfers'])==len(before['transfers'])
  s=call('/api/operations');basis=json.loads((root/'samples/seed.json').read_text());row=basis['menus'][0].copy();meal={'date':'2026-12-01','meal':'SANG','normal':20,'vegetarian':0,'replacement':0,'replacementIncluded':True,'rows':[row]}
  s=op('menuImport',{'kitchen':'CG','meals':[meal]});assert any(m['date']=='2026-12-01' for m in s['menus'])
  # Output sample only before test records, from the earlier snapshot saved after demo.
  access=call('/api/admin/access');call('/api/admin/users',{'username':'kho_cg','name':'Kho CG','role':'warehouse','active':True,'password':'Warehouse-V7-2026!','revision':access['revision']})
  w=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
  call('/api/auth/login',{'username':'kho_cg','password':'Warehouse-V7-2026!'},client=w)
  scoped=call('/api/operations',client=w);assert all(r['to']=='CG' for r in scoped['stockReceipts']);assert all(x['from']=='CG' for x in scoped['issues'])
  call('/api/operations',{'type':'issueManual','payload':{'from':'B2','due':'2026-12-01','reason':'Wrong scope','lines':[{'itemId':'GAO','quantity':1,'unit':'kg'}]},'expectedRevision':scoped['revision'],'requestId':str(uuid.uuid4())},403,client=w)
  print('V7 API checks passed: linked demo, purchases/receipts/issues, atomic invalid batch, exact units, replay/import dedup, menu import, warehouse scope')
 finally:
  proc.terminate();proc.wait(timeout=10);log.close()
  if proc.returncode not in [0,-15,143]:print(Path(td+'/log').read_text()[-1500:])
