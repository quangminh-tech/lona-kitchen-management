using System.Text.Json.Nodes;
using Lona.Week;
namespace Lona.Admin.Auth;
public static class CommandPolicy {
    public static string Required(JsonObject cmd)=>WeekEngine.T(cmd,"type") switch{
        "meal"=>"menus.edit","recipe"=>"recipes.edit","orders"=>"purchase.create","receive"=>"stock.receive","issue"=>"stock.issue","delete"=>WeekEngine.T(cmd["payload"]!.AsObject(),"collection")=="items"?"items.edit":"recipes.edit","replace"=>WeekEngine.T(cmd["payload"]!.AsObject(),"collection") switch{
            "menus"=>"menus.edit","items"=>"items.edit",_=>"DENY"
        }
        ,_=>"DENY"
    }
    ;
    public static void Check(JsonObject s,JsonObject cmd,HashSet<string> permissions){
        void Need(string p){
            if(!permissions.Contains(p))throw new UnauthorizedAccessException("Bạn không có quyền: "+p);
        }
        Need(Required(cmd));
        var type=WeekEngine.T(cmd,"type");
        var p=cmd["payload"]!.AsObject();
        if(type=="meal"){
            var plan=p["plan"]!.AsObject();
            if(WeekEngine.T(plan,"date")!=WeekEngine.T(p,"date")||WeekEngine.T(plan,"meal")!=WeekEngine.T(p,"meal")||WeekEngine.Rows(p,"rows").Any(m=>WeekEngine.T(m,"date")!=WeekEngine.T(p,"date")||WeekEngine.T(m,"meal")!=WeekEngine.T(p,"meal")))throw new Lona.Week.RuleError("Dòng món không thuộc bữa đang sửa.");
            if(WeekEngine.B(plan,"approved"))Need("menus.approve");
        }
        if(type=="recipe"&&WeekEngine.B(p["recipe"]!.AsObject(),"approved"))Need("recipes.approve");
        if(type=="replace"&&WeekEngine.T(p,"collection")=="items"){
            if(WeekEngine.Rows(s,"items").Any(old=>!WeekEngine.Rows(p,"rows").Any(row=>WeekEngine.T(row,"id")==WeekEngine.T(old,"id"))))throw new Lona.Week.RuleError("Dùng lệnh xóa riêng để kiểm tra liên kết.");
            foreach(var row in WeekEngine.Rows(p,"rows")){
                var old=WeekEngine.Find(s,"items",WeekEngine.T(row,"id"));
                if(WeekEngine.N(row,"stock")!=(old is null?0:WeekEngine.N(old,"stock")))Need("stock.opening");
                if(!permissions.Contains("costs.view")&&old is not null){
                    if(WeekEngine.N(row,"unitCost")!=0)Need("costs.edit");
                    row["unitCost"]=old["unitCost"]!.DeepClone();
                }
                else if(WeekEngine.N(row,"unitCost")!=(old is null?0:WeekEngine.N(old,"unitCost")))Need("costs.edit");
            }
            if(!permissions.Contains("costs.view"))foreach(var row in WeekEngine.Rows(p,"rows")){
                var old=WeekEngine.Find(s,"items",WeekEngine.T(row,"id"));
                if(old is not null)row["unitCost"]=old["unitCost"]!.DeepClone();
            }
        }
    }
    public static JsonObject Redact(JsonObject state,HashSet<string> permissions){
        var s=state.DeepClone().AsObject();
        s["requests"]=new JsonObject();
        if(!permissions.Contains("menus.view")){
            s["menus"]=new JsonArray();
            s["plans"]=new JsonArray();
        }
        if(!permissions.Contains("recipes.view")){
            s["recipes"]=new JsonArray();
            s["dishes"]=new JsonArray();
        }
        if(!permissions.Contains("items.view"))s["items"]=new JsonArray();
        if(!permissions.Contains("stock.view")){
            s["warehouses"]=new JsonArray();
            s["ledger"]=new JsonArray();
            s["issuedDates"]=new JsonArray();
        }
        if(!permissions.Contains("purchase.view"))s["orders"]=new JsonArray();
        if(!permissions.Contains("costs.view")){
            foreach(var i in WeekEngine.Rows(s,"items"))i["unitCost"]=0;
            foreach(var o in WeekEngine.Rows(s,"orders"))o["unitCost"]=0;
        }
        if(!permissions.Contains("audit.view"))s["audit"]=new JsonArray();
        return s;
    }
}
