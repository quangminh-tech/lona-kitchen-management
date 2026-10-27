using System.Text.Json;
using System.Text.Json.Nodes;
using System.Security.Cryptography;
using System.Text;
using Lona.Week;
using Lona.Admin.Storage;
using Lona.Admin.Auth;
namespace Lona.Admin.Operations;
public sealed partial class OperationsStore {
    readonly string path;
    public SemaphoreSlim Gate{
        get;
    }
    =new(1,1);
    public OperationsStore(IConfiguration cfg,IHostEnvironment env){
        path=Path.GetFullPath(cfg["OperationsPath"]??Path.Combine(env.ContentRootPath,"AppData/operations.json"));
        if(!File.Exists(path)){
            var seed=Path.Combine(env.ContentRootPath,"../samples/operations.json");
            if(!File.Exists(seed))seed=Path.Combine(AppContext.BaseDirectory,"Data/operations.json");
            JsonFile.Write(path,JsonNode.Parse(File.ReadAllText(seed))!);
        }
    }
    public JsonObject Read(){
        var s=JsonFile.Read<JsonObject>(path);
        s["stockReceipts"] ??= new JsonArray();s["importKeys"] ??= new JsonObject();
        if(!Rows(s,"templates").Any(t=>T(t,"id")=="RECEIVE")){
            var template=Rows(s,"templates").First().DeepClone().AsObject();template["id"]="RECEIVE";template["name"]="Phiếu nhập kho";template["title"]="PHIẾU NHẬP KHO";template["version"]=1;
            template["info"]="Nguồn: {{warehouse.from}}\nKho nhận: {{warehouse.to}}\nTheo đề nghị: {{document.reference}}";
            template["columns"]=new JsonArray(new JsonObject{["key"]="index",["label"]="STT",["width"]=6},new JsonObject{["key"]="code",["label"]="Mã",["width"]=14},new JsonObject{["key"]="name",["label"]="Tên hàng",["width"]=38},new JsonObject{["key"]="unit",["label"]="ĐVT",["width"]=10},new JsonObject{["key"]="received",["label"]="Thực nhận",["width"]=20});
            s["templates"]!.AsArray().Add(template);
        }
        return s;
    }
    public void Write(JsonObject s)=>JsonFile.Write(path,s);
    static string T(JsonObject n,string k)=>WeekEngine.T(n,k);
    static decimal N(JsonObject n,string k)=>WeekEngine.N(n,k);
    static List<JsonObject> Rows(JsonObject s,string k)=>WeekEngine.Rows(s,k);
    static void Need(bool condition,string msg){
        if(!condition)throw new RuleError(msg);
    }
    public static string[] Scopes(JsonObject s,UserRecord user)=>user.Role is "admin" or "manager"?Rows(s,"warehouses").Select(w=>T(w,"id")).ToArray():s["scopes"]?[user.Username]?.AsArray().Select(v=>v!.GetValue<string>()).ToArray()??["CG"];
    static void Scope(JsonObject s,UserRecord user,string warehouse){
        if(!Scopes(s,user).Contains(warehouse))throw new UnauthorizedAccessException("Không có phạm vi kho/bếp: "+warehouse);
    }
    public static JsonObject Public(JsonObject state,UserRecord user,HashSet<string> permissions){
        var s=state.DeepClone().AsObject();
        var scopes=Scopes(s,user);
        var currentHash=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(s["base"]!.ToJsonString()+s["menus"]!.ToJsonString()+s["balances"]!.ToJsonString()+s["orders"]!.ToJsonString()+s["transfers"]!.ToJsonString())));
        foreach(var job in Rows(s,"jobs"))job["isCurrent"]=T(job,"fingerprint")==currentHash;
        s["allowedWarehouses"]=new JsonArray(scopes.Select(x=>JsonValue.Create(x)).ToArray());
        s.Remove("base");
        s.Remove("requests");
        if(user.Role!="admin")s.Remove("scopes");
        var balances=s["balances"]!.AsObject();
        foreach(var k in balances.Select(x=>x.Key).ToArray())if(!scopes.Contains(k.Split('|')[0]))balances.Remove(k);
        s["menus"]=new JsonArray(Rows(s,"menus").Where(m=>scopes.Contains(T(m,"kitchen"))).Select(m=>m.DeepClone()).ToArray());
        var transfers=Rows(s,"transfers").Where(t=>scopes.Contains(T(t,"from"))||scopes.Contains(T(t,"to"))).ToArray();
        s["transfers"]=new JsonArray(transfers.Select(t=>t.DeepClone()).ToArray());
        var ids=transfers.Select(t=>T(t,"id")).ToHashSet();
        s["ledger"]=new JsonArray(Rows(s,"ledger").Where(l=>scopes.Contains(T(l,"from"))||scopes.Contains(T(l,"to"))).Select(l=>l.DeepClone()).ToArray());
        s["jobs"]=new JsonArray(Rows(s,"jobs").Where(j=>scopes.Contains(T(j,"kitchen"))).Select(j=>j.DeepClone()).ToArray());
        foreach(var job in Rows(s,"jobs"))if(!permissions.Contains("costs.view"))foreach(var snap in Rows(job,"snapshots")){
            foreach(var total in snap["totals"]?.AsArray().OfType<JsonObject>()??[])total["estimatedCost"]=0;
        }
        s["orders"]=new JsonArray(Rows(s,"orders").Where(o=>scopes.Contains(T(o,"warehouseId"))).Select(o=>o.DeepClone()).ToArray());
        s["stockReceipts"]=new JsonArray(Rows(s,"stockReceipts").Where(d=>scopes.Contains(T(d,"to"))).Select(d=>d.DeepClone()).ToArray());
        s["issues"]=new JsonArray(Rows(s,"issues").Where(d=>scopes.Contains(T(d,"from"))).Select(d=>d.DeepClone()).ToArray());
        s["documents"]=new JsonArray(Rows(s,"documents").Where(d=>scopes.Contains(T(d,"warehouseFrom"))||scopes.Contains(T(d,"warehouseTo"))).Select(d=>d.DeepClone()).ToArray());
        if(!permissions.Contains("audit.view"))s["audit"]=new JsonArray();
        return s;
    }
    public JsonObject Apply(JsonObject s,JsonObject cmd,UserRecord user,HashSet<string> permissions,bool persist=true){
        var type=T(cmd,"type");
        var p=cmd["payload"]!.AsObject();
        var request=T(cmd,"requestId");
        Need(Guid.TryParse(request,out _),"Thiếu mã lệnh UUID.");
        var hash=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(type+"|"+p.ToJsonString())));
        var requests=s["requests"]!.AsObject();
        if(requests[request] is not null){
            Need(requests[request]!.GetValue<string>()==hash,"Mã lệnh đã dùng với nội dung khác.");
            return s;
        }
        Need(N(s,"revision")==N(cmd,"expectedRevision"),"Dữ liệu đã đổi. Tải lại trước khi lưu.");
        void Permission(string key){
            if(!permissions.Contains(key))throw new UnauthorizedAccessException("Thiếu quyền "+key);
        }
        JsonObject? transfer=Rows(s,"transfers").FirstOrDefault(t=>T(t,"id")==T(p,"id"));
        var balances=s["balances"]!.AsObject();
        decimal Stock(string w,string i)=>balances[w+"|"+i]?.GetValue<decimal>()??0;
        decimal Held(string w,string i)=>Rows(s,"transfers").Where(t=>T(t,"from")==w&&T(t,"item")==i&&T(t,"status")=="APPROVED").Sum(t=>N(t,"qty"));
        void Move(string from,string to,string item,decimal qty,string doc){
            Need(qty>0&&Stock(from,item)>=qty,"Kho nguồn không đủ hoặc lượng không hợp lệ.");
            balances[from+"|"+item]=Stock(from,item)-qty;
            balances[to+"|"+item]=Stock(to,item)+qty;
            s["ledger"]!.AsArray().Add(new JsonObject{
                ["id"]=Guid.NewGuid().ToString(),["doc"]=doc,["from"]=from,["to"]=to,["item"]=item,["qty"]=qty,["actor"]=user.Username,["at"]=DateTimeOffset.UtcNow.ToString("O")
            }
            );
        }
        if(WorkflowCommands.Contains(type)) Workflow(s,type,p,user,permissions);
        else if(type=="create"){
            Permission("transfer.request");
            Scope(s,user,T(p,"to"));
            Need(Rows(s,"warehouses").Any(w=>T(w,"id")==T(p,"from"))&&Rows(s,"warehouses").Any(w=>T(w,"id")==T(p,"to"))&&T(p,"from")!=T(p,"to")&&T(p,"from")!="TRANSIT"&&T(p,"to")!="TRANSIT"&&T(p,"from")!="PRODUCTION"&&T(p,"to")!="PRODUCTION"&&Rows(s,"items").Any(i=>T(i,"id")==T(p,"item"))&&N(p,"qty")>0&&DateOnly.TryParseExact(T(p,"due"),"yyyy-MM-dd",out _),"Kho, hàng, ngày hoặc lượng không hợp lệ.");
            var t=new JsonObject{
                ["from"]=T(p,"from"),["to"]=T(p,"to"),["item"]=T(p,"item"),["qty"]=N(p,"qty"),["due"]=T(p,"due"),["reason"]=T(p,"reason"),["reference"]=T(p,"reference")
            }
            ;
            t["id"]=Guid.NewGuid().ToString();
            t["number"]="DC-"+(Rows(s,"transfers").Count+1).ToString("D5");
            t["status"]="DRAFT";
            t["received"]=0;
            t["createdBy"]=user.Username;
            t["createdAt"]=DateTimeOffset.UtcNow.ToString("O");
            t["history"]=new JsonArray(new JsonObject{["label"]="Lập yêu cầu",["at"]=DateTimeOffset.UtcNow.ToString("O"),["actor"]=user.Username});
            var sourceItem=Rows(s,"items").Single(i=>T(i,"id")==T(t,"item"));
            t["itemNameSnapshot"]=T(sourceItem,"name");
            t["unitSnapshot"]=T(sourceItem,"unit");
            t["stockSnapshot"]=Stock(T(t,"from"),T(t,"item"));
            s["transfers"]!.AsArray().Add(t);
        }
        else if(type is "approve" or "dispatch" or "receive" or "cancel"){
            Need(transfer is not null,"Không tìm thấy phiếu.");
            var t=transfer!;
            var status=T(t,"status");
            if(type=="approve"){
                Permission("transfer.approve");
                Scope(s,user,T(t,"from"));
                Need(status=="DRAFT","Chỉ duyệt phiếu nháp.");
                Need(Stock(T(t,"from"),T(t,"item"))-Held(T(t,"from"),T(t,"item"))>=N(t,"qty"),"Không đủ khả dụng để giữ hàng.");
                t["status"]="APPROVED";
                t["approvedBy"]=user.Username;
            }
            else if(type=="dispatch"){
                Permission("transfer.dispatch");
                Scope(s,user,T(t,"from"));
                Need(status=="APPROVED","Phiếu chưa duyệt hoặc đã xuất.");
                Need(Stock(T(t,"from"),T(t,"item"))-Held(T(t,"from"),T(t,"item"))>=0,"Lượng giữ vượt tồn.");
                Move(T(t,"from"),"TRANSIT",T(t,"item"),N(t,"qty"),T(t,"id"));
                t["status"]="IN_TRANSIT";
            }
            else if(type=="receive"){
                Permission("transfer.receive");
                Scope(s,user,T(t,"to"));
                Need(status is "IN_TRANSIT" or "PARTIAL","Phiếu chưa xuất hoặc đã nhận đủ.");
                Need(N(p,"qty")>0&&N(p,"qty")<=N(t,"qty")-N(t,"received"),"Nhận vượt lượng còn đang đi của dòng phiếu.");
                Move("TRANSIT",T(t,"to"),T(t,"item"),N(p,"qty"),T(t,"id"));
                t["received"]=N(t,"received")+N(p,"qty");
                t["status"]=N(t,"received")==N(t,"qty")?"RECEIVED":"PARTIAL";
            }
            else{
                Permission("transfer.request");
                Scope(s,user,T(t,"to"));
                Need(status is "DRAFT" or "APPROVED","Hàng đã xuất cần phiếu hoàn, không hủy trực tiếp.");
                t["status"]="CANCELLED";
            }
        }
        else if(type=="repeat"){
            Permission("menus.edit");
            Scope(s,user,T(p,"kitchen"));
            Repeat(s,p);
        }
        else if(type=="menus"){
            Permission("menus.edit");
            Scope(s,user,T(p,"kitchen"));
            var rows=Rows(p,"rows");
            Need(rows.Count<=734,"Quá nhiều bữa trong lần lưu.");
            foreach(var m in rows){
                Need(T(m,"kitchen")==T(p,"kitchen")&&N(m,"normal")>=0&&N(m,"normal")==decimal.Truncate(N(m,"normal"))&&N(m,"vegetarian")>=0&&N(m,"vegetarian")==decimal.Truncate(N(m,"vegetarian"))&&m["rows"] is JsonArray&&DateOnly.TryParseExact(T(m,"date"),"yyyy-MM-dd",out _)&&T(m,"meal") is "SANG" or "CHIEU","Dòng bữa không hợp lệ.");
                if(m["approved"]?.GetValue<bool>()==true)Permission("menus.approve");
            }
            Need(rows.Select(m=>T(m,"date")+T(m,"meal")).Distinct().Count()==rows.Count,"Trùng ngày/bữa.");
            var original=Rows(s,"menus");
            foreach(var m in rows){
                var old=original.FirstOrDefault(x=>T(x,"id")==T(m,"id"));
                Need(old is not null&&T(old,"kitchen")==T(p,"kitchen"),"Không được thêm bữa qua lệnh sửa.");
                var obj=old!;
                obj["normal"]=N(m,"normal");
                obj["vegetarian"]=N(m,"vegetarian");
                obj["approved"]=m["approved"]!.DeepClone();
                obj["replacement"]=N(m,"replacement");
                obj["replacementIncluded"]=m["replacementIncluded"]?.DeepClone()??JsonValue.Create(true);
                var candidate=s["base"]!.DeepClone().AsObject();
                candidate["menus"]=m["rows"]!.DeepClone();
                candidate["plans"]=new JsonArray(new JsonObject{
                    ["id"]=T(m,"id"),["date"]=T(m,"date"),["meal"]=T(m,"meal"),["normal"]=N(m,"normal"),["vegetarian"]=N(m,"vegetarian"),["replacement"]=N(m,"replacement"),["replacementIncluded"]=obj["replacementIncluded"]!.DeepClone(),["approved"]=obj["approved"]!.DeepClone()
                }
                );
                foreach(var row in Rows(m,"rows"))Need(T(row,"date")==T(m,"date")&&T(row,"meal")==T(m,"meal"),"Dòng món không thuộc bữa đang sửa.");
                WeekEngine.Validate(candidate);
                obj["rows"]=m["rows"]!.DeepClone();
                obj["dishes"]=new JsonArray(Rows(m,"rows").Select(r=>JsonValue.Create(T(Rows(candidate,"dishes").Single(d=>T(d,"id")==T(r,"dishId")),"name"))).ToArray());
            }
        }
        else if(type=="run"){
            Permission("planning.run");
            Scope(s,user,T(p,"kitchen"));
            Run(s,T(p,"kitchen"),DateOnly.ParseExact(T(p,"date"),"yyyy-MM-dd"));
        }
        else if(type=="purchase"){
            Permission("purchase.create");
            var kitchen=T(p,"kitchen");
            Scope(s,user,kitchen);
            var job=Rows(s,"jobs").FirstOrDefault(j=>T(j,"id")==T(p,"jobId")&&T(j,"kitchen")==kitchen);
            Need(job is not null,"Không tìm thấy kế hoạch.");
            var currentHash=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(s["base"]!.ToJsonString()+s["menus"]!.ToJsonString()+s["balances"]!.ToJsonString()+s["orders"]!.ToJsonString()+s["transfers"]!.ToJsonString())));
            Need(T(job!,"fingerprint")==currentHash,"Đầu vào đã đổi. Tính lại trước khi lập mua.");
            var snap=Rows(job!,"snapshots").Single(r=>T(r,"key")=="D+1");
            Need(T(snap,"status")=="READY","Kế hoạch chưa đủ dữ liệu.");
            var needs=Rows(snap,"totals").Where(t=>N(t,"buyQuantity")>0).ToArray();
            Need(needs.Length>0,"Không còn thiếu mua.");
            foreach(var n in needs)s["orders"]!.AsArray().Add(new JsonObject{
                ["id"]=Guid.NewGuid().ToString(),["number"]="DM-"+(Rows(s,"orders").Count+1).ToString("D5"),["warehouseId"]=kitchen,["itemId"]=T(n,"itemId"),["quantity"]=N(n,"buyQuantity"),["received"]=0,["packs"]=N(n,"packs"),["packName"]=T(n,"packName"),["dueDate"]=T(snap,"from"),["sourceJob"]=T(job!,"id"),["createdBy"]=user.Username
            }
            );
        }
        else if(type=="purchaseReceive"){
            s["stockReceipts"] ??= new JsonArray();
            Permission("stock.receive");
            var o=Rows(s,"orders").FirstOrDefault(o=>T(o,"id")==T(p,"id"));
            Need(o is not null,"Không tìm thấy đơn.");
            Scope(s,user,T(o!,"warehouseId"));
            var qty=N(p,"qty");
            Need(qty>0&&qty<=N(o!,"quantity")-N(o!,"received"),"Nhận vượt phần còn thiếu.");
            var key=T(o!,"warehouseId")+"|"+T(o!,"itemId");
            balances[key]=(balances[key]?.GetValue<decimal>()??0)+qty;
            o!["received"]=N(o,"received")+qty;
            var receipt=new JsonObject{["id"]=Guid.NewGuid().ToString(),["number"]="PNK-"+(Rows(s,"stockReceipts").Count+1).ToString("D5"),["sourceKind"]="RECEIVE",["from"]="SUPPLIER",["to"]=T(o,"warehouseId"),["due"]=DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7)).ToString("yyyy-MM-dd"),["status"]="POSTED",["reason"]="Nhận hàng theo đề nghị "+T(o,"number"),["reference"]=T(o,"id"),["createdBy"]=user.Username,["createdAt"]=DateTimeOffset.UtcNow.ToString("O"),["lines"]=new JsonArray(new JsonObject{["item"]=T(o,"itemId"),["qty"]=qty,["received"]=qty})};
            s["stockReceipts"]!.AsArray().Add(receipt);

            s["ledger"]!.AsArray().Add(new JsonObject{
                ["id"]=Guid.NewGuid().ToString(),["doc"]=T(receipt,"id"),["source"]=T(o,"id"),["from"]="SUPPLIER",["to"]=T(o,"warehouseId"),["item"]=T(o,"itemId"),["qty"]=qty,["actor"]=user.Username,["at"]=DateTimeOffset.UtcNow.ToString("O")
            }
            );
        }
        else if(type=="productionIssue"){
            Permission("stock.issue");
            var kitchen=T(p,"kitchen");
            Scope(s,user,kitchen);
            var job=Rows(s,"jobs").FirstOrDefault(j=>T(j,"id")==T(p,"jobId")&&T(j,"kitchen")==kitchen);
            Need(job is not null,"Không tìm thấy kế hoạch.");
            var currentHash=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(s["base"]!.ToJsonString()+s["menus"]!.ToJsonString()+s["balances"]!.ToJsonString()+s["orders"]!.ToJsonString()+s["transfers"]!.ToJsonString())));
            Need(T(job!,"fingerprint")==currentHash,"Kế hoạch đã cũ. Chạy tính lại trước khi xuất.");
            var snapshot=Rows(job!,"snapshots").Single(r=>T(r,"key")=="D+1");
            Need(T(snapshot,"status")=="READY","Kế hoạch nấu chưa đủ dữ liệu.");
            var date=T(snapshot,"from");
            Need(!Rows(s,"issues").Any(d=>T(d,"from")==kitchen&&T(d,"due")==date),"Ngày/bếp này đã xuất sản xuất.");
            var totals=Rows(snapshot,"totals");
            foreach(var total in totals)Need(Stock(kitchen,T(total,"itemId"))-Held(kitchen,T(total,"itemId"))>=N(total,"quantity"),"Thiếu "+T(total,"item")+"; chưa ghi bất kỳ dòng nào.");
            var doc=new JsonObject{
                ["id"]=Guid.NewGuid().ToString(),["number"]="PXK-"+(Rows(s,"issues").Count+1).ToString("D5"),["sourceKind"]="ISSUE",["from"]=kitchen,["to"]="PRODUCTION",["due"]=date,["status"]="POSTED",["createdBy"]=user.Username,["approvedBy"]=user.Username,["reference"]=T(job!,"id"),["lines"]=new JsonArray(totals.Select(t=>(JsonNode)new JsonObject{
                    ["item"]=T(t,"itemId"),["qty"]=N(t,"quantity"),["received"]=0
                }
                ).ToArray())
            }
            ;
            foreach(var total in totals)Move(kitchen,"PRODUCTION",T(total,"itemId"),N(total,"quantity"),T(doc,"id"));
            s["issues"]!.AsArray().Add(doc);
        }
        else if(type=="template"){
            Permission("templates.edit");
            var t=p["template"]!.AsObject();
            TemplateRules.Validate(t);
            var prior=Rows(s,"templates").FirstOrDefault(t0=>T(t0,"id")==T(t,"id"));
            Need(prior is not null,"Mẫu không tồn tại.");
            t["version"]=N(prior!,"version")+1;
            s["templates"]!.AsArray().Remove(prior);
            s["templates"]!.AsArray().Add(t.DeepClone());
        }
        else if(type=="company"){
            Permission("templates.edit");
            Need(T(p,"name").Length is >0 and <250,"Tên công ty không hợp lệ.");
            s["company"]=p.DeepClone();
        }
        else if(type=="schedule"){
            Permission("planning.run");
            Need(user.Role is "admin" or "manager","Chỉ quản trị/quản lý cấu hình lịch.");
            Need(N(p,"hour")>=0&&N(p,"hour")<24&&N(p,"minute")>=0&&N(p,"minute")<60,"Giờ chạy không hợp lệ.");
            s["schedule"]=p.DeepClone();
        }
        else if(type=="scopes"){
            Permission("roles.manage");
            Need(T(p,"username")!="admin","Admin có toàn bộ kho.");
            var ids=p["warehouseIds"]!.AsArray().Select(x=>x!.GetValue<string>()).ToArray();
            Need(ids.All(id=>Rows(s,"warehouses").Any(w=>T(w,"id")==id)),"Kho không hợp lệ.");
            s["scopes"]![T(p,"username")]=new JsonArray(ids.Select(x=>JsonValue.Create(x)).ToArray());
        }
        else if(type=="publish"){
            Permission("documents.publish");
            var t=Rows(s,"transfers").Concat(Rows(s,"issues")).Concat(Rows(s,"stockReceipts")).FirstOrDefault(t=>T(t,"id")==T(p,"transferId"));
            Need(t is not null,"Không tìm thấy phiếu nguồn.");
            Scope(s,user,T(t!,"to")=="PRODUCTION"?T(t!,"from"):T(t!,"to"));
            var template=Rows(s,"templates").FirstOrDefault(t=>T(t,"id")==T(p,"templateId"));
            Need(template is not null,"Không tìm thấy mẫu.");
            var required=T(t!,"sourceKind");
            Need(required=="RECEIVE"?T(template!,"id")=="RECEIVE":required=="ISSUE"?T(template!,"id")=="ISSUE":T(template!,"id") is "TRANSFER" or "REQUEST","Loại mẫu không khớp nguồn chứng từ.");
            var context=TemplateRules.Context(s,t!,template!);
            var key=T(t!,"id")+"|"+T(p,"templateId")+"|"+N(template!,"version")+"|"+T(t!,"status")+"|"+N(t!,"received");
            if(!Rows(s,"documents").Any(d=>T(d,"key")==key))s["documents"]!.AsArray().Add(new JsonObject{
                ["id"]=Guid.NewGuid().ToString(),["key"]=key,["number"]=T(t!,"number"),["warehouseFrom"]=T(t!,"from"),["warehouseTo"]=T(t!,"to"),["template"]=template!.DeepClone(),["context"]=context,["publishedBy"]=user.Username,["publishedAt"]=DateTimeOffset.UtcNow.ToString("O")
            }
            );
        }
        else throw new RuleError("Lệnh chưa được hỗ trợ.");
        s["revision"]=N(s,"revision")+1;
        requests[request]=hash;
        s["audit"]!.AsArray().Insert(0,new JsonObject{
            ["actor"]=user.Username,["action"]=type,["at"]=DateTimeOffset.UtcNow.ToString("O")
        }
        );
        if(type is "approve" or "dispatch" or "receive" or "cancel") {
            transfer!["history"] ??= new JsonArray();
            transfer["history"]!.AsArray().Add(new JsonObject{["label"]=type=="approve"?"Duyệt giữ hàng":type=="dispatch"?"Xuất chuyển":type=="receive"?"Nhận hàng":"Hủy phiếu",["at"]=DateTimeOffset.UtcNow.ToString("O"),["actor"]=user.Username,["qty"]=type=="receive"?N(p,"qty"):0});
        }
        if(persist)Write(s);
        return s;
    }
    static void Repeat(JsonObject s,JsonObject p){
        var from=DateOnly.ParseExact(T(p,"from"),"yyyy-MM-dd");
        var to=DateOnly.ParseExact(T(p,"to"),"yyyy-MM-dd");
        Need(to>=from&&to.DayNumber-from.DayNumber<366,"Chọn khoảng tối đa 366 ngày.");
        var basis=s["base"]!.AsObject();
        var menus=s["menus"]!.AsArray();
        for(var date=from;
        date<=to;
        date=date.AddDays(1))foreach(var meal in new[]{
            "SANG","CHIEU"
        }
        ){
            if(Rows(s,"menus").Any(m=>T(m,"date")==date.ToString("yyyy-MM-dd")&&T(m,"meal")==meal&&T(m,"kitchen")==T(p,"kitchen")))continue;
            var weekday=(int)date.DayOfWeek;
            var original=Rows(basis,"menus").Where(m=>(int)DateOnly.Parse(T(m,"date")).DayOfWeek==weekday&&T(m,"meal")==meal).ToArray();
            var rows=new JsonArray(original.Select(m=>{
                var row=m.DeepClone().AsObject();
                row["date"]=date.ToString("yyyy-MM-dd");
                row["id"]=Guid.NewGuid().ToString();
                return (JsonNode)row;
            }
            ).ToArray());
            menus.Add(new JsonObject{
                ["id"]=Guid.NewGuid().ToString(),["date"]=date.ToString("yyyy-MM-dd"),["meal"]=meal,["kitchen"]=T(p,"kitchen"),["normal"]=meal=="SANG"?80:100,["vegetarian"]=meal=="SANG"?0:5,["replacement"]=meal=="SANG"?0:10,["replacementIncluded"]=true,["approved"]=false,["rows"]=rows,["dishes"]=new JsonArray(original.Select(m=>JsonValue.Create(T(Rows(basis,"dishes").Single(d=>T(d,"id")==T(m,"dishId")),"name"))).ToArray())
            }
            );
        }
    }
    public static void Run(JsonObject s,string kitchen,DateOnly date){
        var first=new DateOnly(date.Year,date.Month,1).AddMonths(1);
        var ranges=new[]{
            ("D+1",date.AddDays(1),date.AddDays(1)),("D+2",date.AddDays(2),date.AddDays(2)),("D+3",date.AddDays(3),date.AddDays(3)),("7 ngày",date.AddDays(1),date.AddDays(7)),("Tháng sau",first,first.AddMonths(1).AddDays(-1))
        }
        ;
        var input=s["base"]!.ToJsonString()+s["menus"]!.ToJsonString()+s["balances"]!.ToJsonString()+s["orders"]!.ToJsonString()+s["transfers"]!.ToJsonString();
        var fingerprint=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(input)));
        var key=kitchen+"|"+date;
        var jobs=s["jobs"]!.AsArray();
        if(Rows(s,"jobs").Any(j=>T(j,"key")==key&&T(j,"fingerprint")==fingerprint))return;
        var snapshots=new JsonArray();
        foreach(var (name,from,to) in ranges){
            var matched=Rows(s,"menus").Where(m=>T(m,"kitchen")==kitchen&&DateOnly.Parse(T(m,"date"))>=from&&DateOnly.Parse(T(m,"date"))<=to).ToArray();
            var expected=(to.DayNumber-from.DayNumber+1)*2;
            var approved=matched.Count(m=>m["approved"]!.GetValue<bool>());
            var ready=matched.Length==expected&&approved==expected;
            var baseState=s["base"]!.DeepClone().AsObject();
            baseState["issuedDates"]=new JsonArray();
            baseState["orders"]=new JsonArray(Rows(s,"orders").Where(o=>T(o,"warehouseId")==kitchen).Select(o=>o.DeepClone()).Concat(Rows(s,"transfers").Where(t=>T(t,"to")==kitchen&&T(t,"status") is "IN_TRANSIT" or "PARTIAL").Select(t=>(JsonNode)new JsonObject{
                ["id"]=T(t,"id"),["itemId"]=T(t,"item"),["quantity"]=N(t,"qty"),["received"]=N(t,"received"),["dueDate"]=T(t,"due")
            }
            )).ToArray());
            baseState["plans"]=new JsonArray(matched.Select(m=>(JsonNode)new JsonObject{
                ["id"]=T(m,"id"),["date"]=T(m,"date"),["meal"]=T(m,"meal"),["normal"]=N(m,"normal"),["vegetarian"]=N(m,"vegetarian"),["replacement"]=N(m,"replacement"),["replacementIncluded"]=m["replacementIncluded"]?.DeepClone()??JsonValue.Create(true),["approved"]=m["approved"]!.DeepClone()
            }
            ).ToArray());
            var rows=new JsonArray();
            foreach(var m in matched)foreach(var r in m["rows"]!.AsArray()){
                var c=r!.DeepClone().AsObject();
                c["id"]=Guid.NewGuid().ToString();
                c["date"]=T(m,"date");
                rows.Add(c);
            }
            baseState["menus"]=rows;
            foreach(var item in Rows(baseState,"items")){
                item["stock"]=s["balances"]![kitchen+"|"+T(item,"id")]?.DeepClone()??JsonValue.Create(0);
                item["reserved"]=Rows(s,"transfers").Where(t=>T(t,"from")==kitchen&&T(t,"item")==T(item,"id")&&T(t,"status")=="APPROVED").Sum(t=>N(t,"qty"));
            }
            var result=WeekEngine.Analyse(baseState,from.ToString("yyyy-MM-dd"),to.ToString("yyyy-MM-dd"));
            ready=ready&&result["ready"]!.GetValue<bool>();
            snapshots.Add(new JsonObject{
                ["key"]=name,["from"]=from.ToString("yyyy-MM-dd"),["to"]=to.ToString("yyyy-MM-dd"),["meals"]=matched.Length,["expected"]=expected,["approved"]=approved,["status"]=ready?"READY":"BLOCKED",["totals"]=ready?result["totals"]!.DeepClone():new JsonArray(),["errors"]=result["errors"]!.DeepClone()
            }
            );
        }
        jobs.Insert(0,new JsonObject{
            ["id"]=Guid.NewGuid().ToString(),["key"]=key,["version"]=Rows(s,"jobs").Count(j=>T(j,"key")==key)+1,["fingerprint"]=fingerprint,["kitchen"]=kitchen,["date"]=date.ToString("yyyy-MM-dd"),["at"]=DateTimeOffset.UtcNow.ToString("O"),["snapshots"]=snapshots
        }
        );
    }
}
