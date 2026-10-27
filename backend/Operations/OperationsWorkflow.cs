using System.Text.Json.Nodes;
using Lona.Admin.Auth;
using Lona.Week;
namespace Lona.Admin.Operations;
public sealed partial class OperationsStore {
    static readonly HashSet<string> WorkflowCommands=["purchaseBatch","transferBatch","issueManual","menuImport","loadDemo"];
    void Workflow(JsonObject s,string type,JsonObject p,UserRecord user,HashSet<string> permissions){
        void Permission(string key){if(!permissions.Contains(key))throw new UnauthorizedAccessException("Thiếu quyền "+key);}
        bool Physical(string w)=>Rows(s,"warehouses").Any(x=>T(x,"id")==w)&&w is not "TRANSIT" and not "PRODUCTION";
        var now=DateTimeOffset.UtcNow.ToString("O");
        void Inner(string t,JsonObject payload)=>Apply(s,new JsonObject{["type"]=t,["payload"]=payload,["requestId"]=Guid.NewGuid().ToString(),["expectedRevision"]=N(s,"revision")},user,permissions,false);
        if(type=="loadDemo"){
            Need(user.Role=="admin","Chỉ admin nạp mẫu.");
            Need(s["demoLoaded"] is null,"Bộ mẫu đã được nạp. Không tạo trùng.");
            // Append isolated sample records; do not delete or reset existing records/balances.
            var from="2026-11-02"; var to="2026-11-04";
            Need(!Rows(s,"menus").Any(m=>T(m,"kitchen")=="B2"&&string.CompareOrdinal(T(m,"date"),from)>=0&&string.CompareOrdinal(T(m,"date"),to)<=0),"Bếp B2 đã có thực đơn 02–04/11. Dùng bản demo HTML riêng để tránh trộn dữ liệu.");
            Inner("repeat",new JsonObject{["kitchen"]="B2",["from"]=from,["to"]=to});
            var menus=Rows(s,"menus").Where(m=>T(m,"kitchen")=="B2"&&string.CompareOrdinal(T(m,"date"),from)>=0&&string.CompareOrdinal(T(m,"date"),to)<=0).ToArray();
            foreach(var m in menus){m["approved"]=true;m["demo"]=true;}
            Inner("run",new JsonObject{["kitchen"]="B2",["date"]="2026-11-01"});
            var job=Rows(s,"jobs").First(j=>T(j,"kitchen")=="B2");job["demo"]=true;
            var before=Rows(s,"orders").Count;
            if(Rows(Rows(job,"snapshots").First(),"totals").Any(t=>N(t,"buyQuantity")>0))Inner("purchase",new JsonObject{["kitchen"]="B2",["jobId"]=T(job,"id")});
            foreach(var o in Rows(s,"orders").Skip(before).ToArray()){o["demo"]=true;Inner("purchaseReceive",new JsonObject{["id"]=T(o,"id"),["qty"]=N(o,"quantity")-N(o,"received")});}
            Inner("run",new JsonObject{["kitchen"]="B2",["date"]="2026-11-01"});
            var ready=Rows(s,"jobs").First(j=>T(j,"kitchen")=="B2");ready["demo"]=true;
            Inner("productionIssue",new JsonObject{["kitchen"]="B2",["jobId"]=T(ready,"id")});
            var issue=Rows(s,"issues").Last();issue["demo"]=true;
            Inner("publish",new JsonObject{["transferId"]=T(issue,"id"),["templateId"]="ISSUE"});
            Inner("purchaseBatch",new JsonObject{["warehouseId"]="TT",["dueDate"]="2026-11-03",["supplier"]="NCC thực phẩm mẫu",["reference"]="DEMO-V7",["lines"]=new JsonArray(new JsonObject{["itemId"]="GAO",["quantity"]=100,["unit"]="kg"})});
            var manual=Rows(s,"orders").Last();manual["demo"]=true;Inner("purchaseReceive",new JsonObject{["id"]=T(manual,"id"),["qty"]=40});
            var receipt=Rows(s,"stockReceipts").Last();receipt["demo"]=true;Inner("publish",new JsonObject{["transferId"]=T(receipt,"id"),["templateId"]="RECEIVE"});
            Inner("transferBatch",new JsonObject{["from"]="TT",["to"]="B2",["due"]="2026-11-03",["reason"]="Cấp bổ sung bếp mẫu",["reference"]=T(receipt,"id"),["lines"]=new JsonArray(new JsonObject{["itemId"]="GAO",["quantity"]=20,["unit"]="kg"})});
            var transfer=Rows(s,"transfers").Last();transfer["demo"]=true;
            Inner("approve",new JsonObject{["id"]=T(transfer,"id")});Inner("dispatch",new JsonObject{["id"]=T(transfer,"id")});Inner("receive",new JsonObject{["id"]=T(transfer,"id"),["qty"]=8});
            Inner("publish",new JsonObject{["transferId"]=T(transfer,"id"),["templateId"]="TRANSFER"});
            s["demoLoaded"]=now;
            return;
        }
        if(type=="menuImport"){
            Permission("menus.edit"); var kitchen=T(p,"kitchen");Scope(s,user,kitchen);Need(Physical(kitchen),"Bếp không hợp lệ.");
            var groups=Rows(p,"meals");Need(groups.Count is >0 and <=62,"Import tối đa 62 bữa/lần.");
            Need(groups.Select(m=>T(m,"date")+T(m,"meal")).Distinct().Count()==groups.Count,"Trùng ngày/bữa.");
            foreach(var m in groups){
                Need(DateOnly.TryParseExact(T(m,"date"),"yyyy-MM-dd",out _)&&T(m,"meal") is "SANG" or "CHIEU","Ngày hoặc ca không hợp lệ.");
                var existing=Rows(s,"menus").FirstOrDefault(x=>T(x,"kitchen")==kitchen&&T(x,"date")==T(m,"date")&&T(x,"meal")==T(m,"meal"));
                Need(existing is null||existing["approved"]?.GetValue<bool>()!=true,"Bữa đã chốt; mở sửa và kiểm tra trước khi import thay thế.");
                var meal=m.DeepClone().AsObject();meal["kitchen"]=kitchen;meal["approved"]=false;meal["id"]=existing is null?Guid.NewGuid().ToString():T(existing,"id");
                foreach(var row in Rows(meal,"rows")){row["id"]=Guid.NewGuid().ToString();row["date"]=T(meal,"date");row["meal"]=T(meal,"meal");}
                var candidate=s["base"]!.DeepClone().AsObject();candidate["plans"]=new JsonArray(meal.DeepClone());candidate["menus"]=meal["rows"]!.DeepClone();WeekEngine.Validate(candidate);
                meal["dishes"]=new JsonArray(Rows(meal,"rows").Select(r=>JsonValue.Create(T(Rows(candidate,"dishes").Single(d=>T(d,"id")==T(r,"dishId")),"name"))).ToArray());
                if(existing is not null)s["menus"]!.AsArray().Remove(existing);s["menus"]!.AsArray().Add(meal);
            }
            return;
        }
        var lines=Rows(p,"lines");Need(lines.Count is >0 and <=100,"Phiếu cần 1–100 dòng.");
        Need(lines.Select(l=>T(l,"itemId")).Distinct().Count()==lines.Count,"Mã hàng bị lặp; gộp lượng trước khi lập phiếu.");
        foreach(var l in lines){var item=Rows(s,"items").FirstOrDefault(i=>T(i,"id")==T(l,"itemId"));Need(item is not null&&N(l,"quantity")>0,"Mã hàng hoặc lượng không hợp lệ.");Need(T(l,"unit")==T(item!,"unit"),"Sai đơn vị gốc của "+T(l,"itemId")+". Không tự quy đổi khi import.");}
        var imported=T(p,"importKey");if(imported!=""){s["importKeys"] ??= new JsonObject();Need(s["importKeys"]![imported] is null,"File/nội dung này đã được nhập; không tạo lại.");}
        if(type=="purchaseBatch"){
            Permission("purchase.create");var wh=T(p,"warehouseId");Scope(s,user,wh);Need(Physical(wh)&&DateOnly.TryParseExact(T(p,"dueDate"),"yyyy-MM-dd",out _),"Kho/ngày nhận không hợp lệ.");Need(T(p,"supplier").Length is >0 and <=250,"Nhập nhà cung cấp.");
            var batch=Guid.NewGuid().ToString();var number="DM-"+(Rows(s,"orders").Count+1).ToString("D5");
            foreach(var l in lines)s["orders"]!.AsArray().Add(new JsonObject{["id"]=Guid.NewGuid().ToString(),["number"]=number,["batchId"]=batch,["warehouseId"]=wh,["itemId"]=T(l,"itemId"),["quantity"]=N(l,"quantity"),["received"]=0,["dueDate"]=T(p,"dueDate"),["supplier"]=T(p,"supplier"),["reference"]=T(p,"reference"),["createdBy"]=user.Username,["createdAt"]=now,["sourceKind"]="MANUAL"});
        }else if(type=="transferBatch"){
            Permission("transfer.request");Need(Physical(T(p,"from"))&&Physical(T(p,"to")),"Chỉ điều chuyển giữa các kho vật lý.");
            var batch=Guid.NewGuid().ToString();foreach(var l in lines){var cmd=p.DeepClone().AsObject();cmd.Remove("lines");cmd["item"]=T(l,"itemId");cmd["qty"]=N(l,"quantity");Inner("create",cmd);Rows(s,"transfers").Last()["batchId"]=batch;}
        }else if(type=="issueManual"){
            Permission("stock.issue");var wh=T(p,"from");Scope(s,user,wh);Need(Physical(wh)&&DateOnly.TryParseExact(T(p,"due"),"yyyy-MM-dd",out _)&&T(p,"reason").Length>0,"Nhập kho, ngày và lý do xuất.");
            decimal Stock(string i)=>s["balances"]![wh+"|"+i]?.GetValue<decimal>()??0;
            foreach(var l in lines){var held=Rows(s,"transfers").Where(t=>T(t,"from")==wh&&T(t,"item")==T(l,"itemId")&&T(t,"status")=="APPROVED").Sum(t=>N(t,"qty"));Need(Stock(T(l,"itemId"))-held>=N(l,"quantity"),"Không đủ khả dụng: "+T(l,"itemId")+". Chưa ghi phiếu.");}
            var doc=new JsonObject{["id"]=Guid.NewGuid().ToString(),["number"]="PXK-"+(Rows(s,"issues").Count+1).ToString("D5"),["sourceKind"]="ISSUE",["from"]=wh,["to"]="PRODUCTION",["due"]=T(p,"due"),["status"]="POSTED",["reason"]=T(p,"reason"),["reference"]=T(p,"reference"),["createdBy"]=user.Username,["createdAt"]=now,["lines"]=new JsonArray(lines.Select(l=>(JsonNode)new JsonObject{["item"]=T(l,"itemId"),["qty"]=N(l,"quantity")}).ToArray())};
            foreach(var l in lines){var i=T(l,"itemId");var q=N(l,"quantity");s["balances"]![wh+"|"+i]=Stock(i)-q;s["balances"]!["PRODUCTION|"+i]=(s["balances"]!["PRODUCTION|"+i]?.GetValue<decimal>()??0)+q;s["ledger"]!.AsArray().Add(new JsonObject{["id"]=Guid.NewGuid().ToString(),["doc"]=T(doc,"id"),["from"]=wh,["to"]="PRODUCTION",["item"]=i,["qty"]=q,["actor"]=user.Username,["at"]=now});}
            s["issues"]!.AsArray().Add(doc);
        }
        if(imported!="")s["importKeys"]![imported]=now;
    }
}
