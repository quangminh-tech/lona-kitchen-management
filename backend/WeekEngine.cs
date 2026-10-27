using System.Text.Json.Nodes;
using System.Globalization;
namespace Lona.Week;
public sealed class RuleError(string message):Exception(message);
public static class WeekEngine {
    public static List<JsonObject> Rows(JsonObject s,string key)=>s[key]?.AsArray().Select(n=>n?.AsObject()??throw new RuleError("Dòng dữ liệu trống.")).ToList()??throw new RuleError("Thiếu "+key);
    public static string T(JsonObject x,string k)=>x[k]?.GetValue<string>()??"";
    public static decimal N(JsonObject x,string k)=>x[k] is null ? 0 : decimal.Parse(x[k]!.ToJsonString(),System.Globalization.NumberStyles.Float,System.Globalization.CultureInfo.InvariantCulture);
    public static bool B(JsonObject x,string k)=>x[k]?.GetValue<bool>()??false;
    public static JsonObject? Find(JsonObject s,string key,string id)=>Rows(s,key).FirstOrDefault(x=>T(x,"id")==id);
    static decimal R(decimal x)=>decimal.Round(x,6,MidpointRounding.AwayFromZero);
    static void Need(bool ok,string msg){
        if(!ok)throw new RuleError(msg);
    }
    public static decimal Servings(JsonObject p,string scope,decimal fixedCount){
        var pool=N(p,"normal")+(B(p,"replacementIncluded")?0:N(p,"replacement"));
        return scope switch{
            "main"=>B(p,"replacementIncluded")?N(p,"normal")-N(p,"replacement"):N(p,"normal"),"normal"=>pool,"shared"=>pool+N(p,"vegetarian"),"vegetarian"=>N(p,"vegetarian"),"replacement"=>N(p,"replacement"),"fixed"=>fixedCount,_=>0
        }
        ;
    }
    static decimal? Convert(decimal q,string from,string to)=>from==to?q:(from,to) switch{
        ("g","kg")=>q/1000,("kg","g")=>q*1000,("ml","l")=>q/1000,("l","ml")=>q*1000,_=>null
    }
    ;
    public static void Validate(JsonObject s){
        foreach(var key in new[]{
            "items","dishes","recipes","plans","menus","warehouses"
        }
        ){
            var ids=new HashSet<string>();
            foreach(var x in Rows(s,key))Need(!string.IsNullOrEmpty(T(x,"id"))&&ids.Add(T(x,"id")),"Trùng hoặc thiếu mã "+key);
        }
        foreach(var i in Rows(s,"items")){
            Need(T(i,"name")!=""&&T(i,"baseUnit")!=""&&Find(s,"warehouses",T(i,"warehouseId")) is not null,"NVL thiếu tên, đơn vị hoặc kho.");
            foreach(var k in new[]{
                "stock","reserved","safety","unitCost"
            }
            )Need(i[k] is JsonValue&&N(i,k)>=0,"Số liệu kho phải không âm.");
            Need(N(i,"packQuantity")>0,"Quy cách mua phải dương.");
            Need(N(i,"reserved")<=N(i,"stock"),"Giữ hàng vượt tồn.");
            var cv=i["conversions"]?.AsObject()??throw new RuleError("Thiếu quy đổi.");
            Need(N(cv,T(i,"baseUnit"))==1&&cv.All(p=>p.Value is not null&&p.Value.GetValue<decimal>()>0),"Quy đổi phải dương, đơn vị kho hệ số 1.");
        }
        foreach(var r in Rows(s,"recipes")){
            Need(Find(s,"dishes",T(r,"dishId")) is not null&&N(r,"yieldQuantity")>0&&Rows(r,"lines").Count>0,"Công thức thiếu món, thành phần hoặc sản lượng.");
            foreach(var l in Rows(r,"lines")){
                Need(N(l,"quantity")>0&&T(l,"unit")!="","Định mức và đơn vị bắt buộc.");
                Need(T(l,"basis") is "raw" or "cooked","Cơ sở định mức không hợp lệ.");
                Need(T(l,"basis")!="cooked"||N(l,"yieldRate")>0,"Lượng chín cần tỷ lệ thu hồi.");
                Need(T(l,"kind") is "item" or "recipe" or "auxiliary","Loại thành phần không hợp lệ.");
                if(T(l,"kind")=="item")Need(Find(s,"items",T(l,"itemId")) is not null,"Thiếu mã hàng kho.");
                if(T(l,"kind")=="recipe")Need(Find(s,"recipes",T(l,"recipeId")) is not null,"Thiếu công thức con.");
            }
        }
        void Walk(string id,List<string> path){
            Need(!path.Contains(id),"Công thức vòng lặp.");
            foreach(var l in Rows(Find(s,"recipes",id)!,"lines"))if(T(l,"kind")=="recipe")Walk(T(l,"recipeId"),[..path,id]);
        }
        foreach(var r in Rows(s,"recipes"))Walk(T(r,"id"),[]);
        var planKeys=new HashSet<string>();
        foreach(var p in Rows(s,"plans")){
            Need(DateOnly.TryParseExact(T(p,"date"),"yyyy-MM-dd",out _)&&T(p,"meal") is "SANG" or "CHIEU","Ngày/bữa không hợp lệ.");
            foreach(var k in new[]{
                "normal","vegetarian","replacement"
            }
            )Need(N(p,k)>=0&&N(p,k)==decimal.Truncate(N(p,k)),"Số suất phải nguyên không âm.");
            Need(!B(p,"replacementIncluded")||N(p,"replacement")<=N(p,"normal"),"Thay thế vượt suất thường.");
            Need(planKeys.Add(T(p,"date")+"|"+T(p,"meal")),"Trùng báo suất ngày/bữa.");
        }
        var menuKeys=new HashSet<string>();
        foreach(var m in Rows(s,"menus")){
            Need(DateOnly.TryParseExact(T(m,"date"),"yyyy-MM-dd",out _)&&T(m,"meal") is "SANG" or "CHIEU"&&T(m,"slot")!="","Ngày/bữa/vị trí menu không hợp lệ.");
            Need(menuKeys.Add(T(m,"date")+"|"+T(m,"meal")+"|"+T(m,"slot")),"Trùng vị trí món trong bữa.");
            var r=Find(s,"recipes",T(m,"recipeId"));
            Need(r is not null&&T(r,"dishId")==T(m,"dishId"),"Món và công thức không khớp.");
            Need(T(m,"scope") is "main" or "normal" or "shared" or "vegetarian" or "replacement" or "fixed","Nhóm suất không hợp lệ.");
            if(T(m,"scope")=="fixed")Need(N(m,"fixedServings")>=0&&N(m,"fixedServings")==decimal.Truncate(N(m,"fixedServings")),"Suất riêng phải nguyên không âm.");
        }
    }
    public static JsonObject Analyse(JsonObject s,string from,string to){
        var errors=new JsonArray();
        var details=new JsonArray();
        var auxiliary=new JsonArray();
        var totals=new Dictionary<string,JsonObject>();
        void Error(JsonObject m,string text)=>errors.Add(new JsonObject{
            ["date"]=T(m,"date"),["meal"]=T(m,"meal"),["slot"]=T(m,"slot"),["message"]=text
        }
        );
        if(string.CompareOrdinal(from,to)>0)errors.Add(new JsonObject{
            ["date"]=from,["slot"]="Khoảng ngày",["message"]="Ngày bắt đầu sau ngày kết thúc."
        }
        );
        var menus=Rows(s,"menus").Where(m=>string.CompareOrdinal(T(m,"date"),from)>=0&&string.CompareOrdinal(T(m,"date"),to)<=0).ToList();
        foreach(var n in s["issuedDates"]!.AsArray()){
            var date=n!.GetValue<string>();
            if(string.CompareOrdinal(date,from)>=0&&string.CompareOrdinal(date,to)<=0)errors.Add(new JsonObject{
                ["date"]=date,["slot"]="Đã xuất kho",["message"]="Chọn khoảng chưa xuất để tránh tính mua lại."
            }
            );
        }
        foreach(var p in Rows(s,"plans").Where(p=>string.CompareOrdinal(T(p,"date"),from)>=0&&string.CompareOrdinal(T(p,"date"),to)<=0))if(N(p,"normal")+N(p,"vegetarian")+N(p,"replacement")>0&&!menus.Any(m=>T(m,"date")==T(p,"date")&&T(m,"meal")==T(p,"meal")))Error(p,"Bữa có báo suất nhưng chưa có món.");
        void Expand(JsonObject m,JsonObject recipe,decimal scale,List<string> path){
            var id=T(recipe,"id");
            if(path.Contains(id)){
                Error(m,"Công thức vòng lặp.");
                return;
            }
            if(!B(recipe,"approved")){
                Error(m,"Công thức chưa duyệt: "+T(recipe,"name"));
                return;
            }
            foreach(var l in Rows(recipe,"lines")){
                var q=N(l,"quantity")*scale;
                if(T(l,"basis")=="cooked"){
                    if(N(l,"yieldRate")<=0){
                        Error(m,"Thiếu tỷ lệ thu hồi.");
                        continue;
                    }
                    q/=N(l,"yieldRate");
                }
                if(T(l,"kind")=="auxiliary"){
                    auxiliary.Add(new JsonObject{
                        ["date"]=T(m,"date"),["dish"]=T(recipe,"name"),["name"]=T(l,"name"),["quantity"]=R(q),["unit"]=T(l,"unit")
                    }
                    );
                    continue;
                }
                if(T(l,"kind")=="recipe"){
                    var child=Find(s,"recipes",T(l,"recipeId"));
                    if(child is null){
                        Error(m,"Thiếu công thức con.");
                        continue;
                    }
                    var converted=Convert(q,T(l,"unit"),T(child,"yieldUnit"));
                    if(converted is null){
                        Error(m,"Không đổi được đơn vị sản lượng công thức con.");
                        continue;
                    }
                    Expand(m,child,converted.Value/N(child,"yieldQuantity"),[..path,id]);
                    continue;
                }
                var i=Find(s,"items",T(l,"itemId"));
                var factor=i?["conversions"]?[T(l,"unit")]?.GetValue<decimal>();
                if(i is null||factor is null||factor<=0){
                    Error(m,"Thiếu mã hàng hoặc quy đổi.");
                    continue;
                }
                var p=Rows(s,"plans").First(p=>T(p,"date")==T(m,"date")&&T(p,"meal")==T(m,"meal"));
                if(i["vegetarianAllowed"]?.GetValue<bool>()==false&&(T(m,"scope")=="vegetarian"||T(m,"scope")=="shared"&&N(p,"vegetarian")>0))Error(m,"Thành phần "+T(i,"name")+" không dùng cho suất chay mẫu.");
                var baseQty=R(q*factor.Value);
                var root=Find(s,"dishes",T(m,"dishId"));
                var detail=new JsonObject{
                    ["date"]=T(m,"date"),["meal"]=T(m,"meal"),["slot"]=T(m,"slot"),["dish"]=root is null?"":T(root,"name"),["recipe"]=T(recipe,"name"),["path"]=string.Join(" → ",path.Append(id)),["itemId"]=T(i,"id"),["item"]=T(i,"name"),["warehouseId"]=T(i,"warehouseId"),["quantity"]=baseQty,["unit"]=T(i,"baseUnit"),["scope"]=T(m,"scope"),["formula"]=$"{N(l,"quantity")} {T(l,"unit")} × {R(scale)}"+(T(l,"basis")=="cooked"?$" / {N(l,"yieldRate")}":"")+$" × {factor.Value}"
                }
                ;
                details.Add(detail);
                if(!totals.TryGetValue(T(i,"id"),out var t)){
                    t=new(){
                        ["itemId"]=T(i,"id"),["quantity"]=0m,["sources"]=new JsonArray()
                    }
                    ;
                    totals[T(i,"id")]=t;
                }
                t["quantity"]=R(N(t,"quantity")+baseQty);
                t["sources"]!.AsArray().Add(detail.DeepClone());
            }
        }
        foreach(var m in menus){
            var p=Rows(s,"plans").FirstOrDefault(p=>T(p,"date")==T(m,"date")&&T(p,"meal")==T(m,"meal"));
            if(p is null){
                Error(m,"Chưa có báo suất.");
                continue;
            }
            if(!B(p,"approved")){
                Error(m,"Báo suất chưa chốt.");
                continue;
            }
            var n=Servings(p,T(m,"scope"),N(m,"fixedServings"));
            if(n==0)continue;
            var recipe=Find(s,"recipes",T(m,"recipeId"));
            if(recipe is null||T(recipe,"yieldUnit")!="suat"){
                Error(m,"Món menu phải có công thức theo suất.");
                continue;
            }
            Expand(m,recipe,n/N(recipe,"yieldQuantity"),[]);
        }
        var output=new JsonArray();
        foreach(var t in totals.Values){
            var i=Find(s,"items",T(t,"itemId"))!;
            var incoming=Rows(s,"orders").Where(o=>T(o,"itemId")==T(i,"id")&&string.CompareOrdinal(T(o,"dueDate"),from)<=0).Sum(o=>Math.Max(0,N(o,"quantity")-N(o,"received")));
            var shortage=Math.Max(0,R(N(t,"quantity")+N(i,"safety")-(N(i,"stock")-N(i,"reserved")+incoming)));
            var packs=decimal.Ceiling(shortage/N(i,"packQuantity"));
            t["item"]=T(i,"name");
            t["unit"]=T(i,"baseUnit");
            t["warehouseId"]=T(i,"warehouseId");
            foreach(var k in new[]{
                "stock","safety","reserved","packQuantity"
            }
            )t[k]=N(i,k);
            t["incoming"]=incoming;
            t["shortage"]=shortage;
            t["packs"]=packs;
            t["packName"]=T(i,"packName");
            t["buyQuantity"]=R(packs*N(i,"packQuantity"));
            t["estimatedCost"]=R(N(t,"quantity")*N(i,"unitCost"));
            output.Add(t);
        }
        return new(){
            ["from"]=from,["to"]=to,["menuCount"]=menus.Count,["details"]=details,["totals"]=output,["errors"]=errors,["auxiliary"]=auxiliary,["ready"]=menus.Count>0&&errors.Count==0
        }
        ;
    }
    public static JsonObject Change(JsonObject current,JsonObject cmd){
        var s=current.DeepClone().AsObject();
        var p=cmd["payload"]?.AsObject()??new();
        string type=T(cmd,"type"),requestId=T(cmd,"requestId");
        Need(Guid.TryParse(requestId,out _),"Thiếu mã yêu cầu UUID.");
        var hash=type+"|"+p.ToJsonString();
        var req=s["requests"]!.AsObject();
        if(req[requestId] is {
        }
        previous){
            Need(previous.GetValue<string>()==hash,"Mã gửi lại khác nội dung.");
            return s;
        }
        Need(N(cmd,"expectedRevision")==N(s,"revision"),"Dữ liệu đã đổi. Tải lại trước khi lưu.");
        if(type=="meal"){
            Need(!s["issuedDates"]!.AsArray().Any(x=>x!.GetValue<string>()==T(p,"date")),"Ngày đã xuất kho, không sửa đầu vào.");
            var menus=Rows(s,"menus").Where(m=>!(T(m,"date")==T(p,"date")&&T(m,"meal")==T(p,"meal"))).Select(m=>m.DeepClone()).ToList();
            menus.AddRange(Rows(p,"rows").Select(m=>m.DeepClone()));
            s["menus"]=new JsonArray(menus.ToArray());
            var plans=Rows(s,"plans").Where(m=>!(T(m,"date")==T(p,"date")&&T(m,"meal")==T(p,"meal"))).Select(m=>m.DeepClone()).ToList();
            plans.Add(p["plan"]!.DeepClone());
            s["plans"]=new JsonArray(plans.ToArray());
            Validate(s);
            s["dataVersion"]=N(s,"dataVersion")+1;
        }
        else if(type=="recipe"){
            Need(Rows(s,"ledger").Count==0,"Đã có phát sinh kho; cần phiên bản công thức mới.");
            foreach(var pair in new[]{
                ("recipes","recipe"),("dishes","dish")
            }
            ){
                var row=p[pair.Item2]!.AsObject();
                var rows=Rows(s,pair.Item1).Where(r=>T(r,"id")!=T(row,"id")).Select(r=>r.DeepClone()).ToList();
                rows.Add(row.DeepClone());
                s[pair.Item1]=new JsonArray(rows.ToArray());
            }
            Validate(s);
            s["dataVersion"]=N(s,"dataVersion")+1;
        }
        else if(type=="replace"){
            var collection=T(p,"collection");
            Need(new[]{
                "menus","plans","items","recipes","warehouses"
            }
            .Contains(collection),"Không được sửa tập dữ liệu này.");
            if(collection=="items"&&Rows(s,"ledger").Count>0)foreach(var i in Rows(p,"rows")){
                var old=Find(s,"items",T(i,"id"));
                if(old is not null)Need(N(i,"stock")==N(old,"stock")&&T(i,"baseUnit")==T(old,"baseUnit")&&T(i,"warehouseId")==T(old,"warehouseId"),"Không sửa tồn/đơn vị/kho sau phát sinh.");
            }
            if(collection is "menus" or "plans")foreach(var n in s["issuedDates"]!.AsArray()){
                var date=n!.GetValue<string>();
                string Serialized(IEnumerable<JsonObject> rr)=>new JsonArray(rr.OrderBy(r=>T(r,"id")).Select(r=>r.DeepClone()).ToArray()).ToJsonString();
                Need(Serialized(Rows(s,collection).Where(r=>T(r,"date")==date))==Serialized(Rows(p,"rows").Where(r=>T(r,"date")==date)),"Không đổi ngày đã xuất kho.");
            }
            s[collection]=p["rows"]!.DeepClone();
            Validate(s);
            s["dataVersion"]=N(s,"dataVersion")+1;
        }
        else if(type=="delete"){
            var collection=T(p,"collection");
            var id=T(p,"id");
            Need(collection is "items" or "dishes","Không được xóa dữ liệu này.");
            var row=Find(s,collection,id);
            Need(row is not null,"Không tìm thấy dữ liệu.");
            if(collection=="items"){
                Need(N(row!,"stock")==0&&N(row!,"reserved")==0&&!Rows(s,"recipes").Any(r=>Rows(r,"lines").Any(l=>T(l,"itemId")==id))&&!Rows(s,"orders").Any(o=>T(o,"itemId")==id)&&!Rows(s,"ledger").Any(l=>T(l,"itemId")==id),"Nguyên liệu đang có tồn hoặc liên kết, không thể xóa.");
            }
            else{
                Need(!Rows(s,"menus").Any(m=>T(m,"dishId")==id)&&!Rows(s,"recipes").Any(r=>Rows(r,"lines").Any(l=>T(l,"kind")=="recipe"&&T(l,"recipeId")==T(row!,"recipeId")))&&Rows(s,"ledger").Count==0,"Món đang sử dụng hoặc có lịch sử kho, không thể xóa.");
                s["recipes"]=new JsonArray(Rows(s,"recipes").Where(r=>T(r,"dishId")!=id).Select(r=>r.DeepClone()).ToArray());
            }
            s[collection]=new JsonArray(Rows(s,collection).Where(r=>T(r,"id")!=id).Select(r=>r.DeepClone()).ToArray());
            Validate(s);
            s["dataVersion"]=N(s,"dataVersion")+1;
        }
        else if(type=="orders"){
            string from=T(p,"from"),to=T(p,"to");
            var r=Analyse(s,from,to);
            Need(B(r,"ready"),"Dự trù còn thiếu dữ liệu.");
            var orders=s["orders"]!.AsArray();
            int n=0;
            foreach(var t in Rows(r,"totals"))if(N(t,"packs")>0){
                orders.Add(new JsonObject{
                    ["id"]="PO-"+(orders.Count+1),["itemId"]=T(t,"itemId"),["warehouseId"]=T(t,"warehouseId"),["quantity"]=N(t,"buyQuantity"),["received"]=0,["packName"]=T(t,"packName"),["packQuantity"]=N(t,"packQuantity"),["packs"]=N(t,"packs"),["dueDate"]=from,["unitCost"]=N(Find(s,"items",T(t,"itemId"))!,"unitCost")
                }
                );
                n++;
            }
            Need(n>0,"Tồn và hàng đang về đã đủ.");
        }
        else if(type=="receive"){
            var o=Find(s,"orders",T(p,"orderId"));
            Need(o is not null&&N(p,"quantity")>0&&N(p,"quantity")<=N(o!,"quantity")-N(o!,"received"),"Số nhận không hợp lệ hoặc vượt phần còn thiếu.");
            var i=Find(s,"items",T(o!,"itemId"))!;
            o!["received"]=R(N(o,"received")+N(p,"quantity"));
            i["stock"]=R(N(i,"stock")+N(p,"quantity"));
            s["ledger"]!.AsArray().Add(new JsonObject{
                ["id"]=Guid.NewGuid().ToString(),["type"]="receipt",["date"]=DateTimeOffset.UtcNow.ToString("O"),["itemId"]=T(i,"id"),["quantity"]=N(p,"quantity"),["source"]=T(o,"id")
            }
            );
        }
        else if(type=="issue"){
            var date=T(p,"date");
            Need(!s["issuedDates"]!.AsArray().Any(n=>n!.GetValue<string>()==date),"Ngày này đã xuất, không ghi hai lần.");
            var r=Analyse(s,date,date);
            Need(B(r,"ready"),"Ngày xuất còn thiếu dữ liệu.");
            foreach(var t in Rows(r,"totals"))Need(N(t,"quantity")<=N(t,"stock")-N(t,"reserved"),"Thiếu "+T(t,"item")+"; chưa ghi bất kỳ dòng nào.");
            foreach(var t in Rows(r,"totals")){
                Find(s,"items",T(t,"itemId"))!["stock"]=R(N(t,"stock")-N(t,"quantity"));
                s["ledger"]!.AsArray().Add(new JsonObject{
                    ["id"]=Guid.NewGuid().ToString(),["type"]="issue",["date"]=date,["itemId"]=T(t,"itemId"),["quantity"]=-N(t,"quantity"),["source"]="Menu "+date
                }
                );
            }
            s["issuedDates"]!.AsArray().Add(date);
        }
        else throw new RuleError("Thao tác không hỗ trợ.");
        s["revision"]=N(s,"revision")+1;
        req[requestId]=hash;
        s["audit"]!.AsArray().Insert(0,new JsonObject{
            ["at"]=DateTimeOffset.UtcNow.ToString("O"),["action"]=type,["detail"]=type=="replace"?T(p,"collection"):T(p,"date")
        }
        );
        return s;
    }
}
