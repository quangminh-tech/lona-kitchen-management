using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Lona.Week;
namespace Lona.Admin.Operations;
public static class TemplateRules {
    public static readonly HashSet<string> Variables=["company.name","company.address","company.taxCode","document.number","document.date","document.status","document.reason","document.reference","warehouse.from","warehouse.to","kitchen.name","signatures.requester","signatures.approver","signatures.sender","signatures.receiver","totals.quantity","system.printedAt","system.templateVersion"];
    static readonly HashSet<string> Columns=["index","code","name","unit","stock","requested","approved","dispatched","received","inTransit","note"];
    public static void Validate(JsonObject t){
        void Need(bool c,string m){
            if(!c)throw new RuleError(m);
        }
        Need(WeekEngine.T(t,"name").Length>0&&WeekEngine.T(t,"title").Length>0,"Mẫu thiếu tên/tiêu đề.");
        Need(WeekEngine.T(t,"orientation") is "portrait" or "landscape","Khổ giấy không hợp lệ.");
        Need(WeekEngine.N(t,"fontSize") is >=8 and <=14,"Cỡ chữ 8–14.");
        var cols=t["columns"]!.AsArray();
        Need(cols.Count is >0 and <=12,"Cần 1–12 cột.");
        foreach(var n in cols){
            var c=n!.AsObject();
            Need(Columns.Contains(WeekEngine.T(c,"key"))&&WeekEngine.N(c,"width")>0&&WeekEngine.T(c,"label").Length>0,"Cột không hợp lệ.");
        }
        Need(t["signatures"]!.AsArray().Count<=5,"Tối đa 5 ô chữ ký.");
        foreach(var k in new[]{
            "header","title","subtitle","info","footer"
        }
        ){
            var text=WeekEngine.T(t,k);
            Need(text.Length<=4000,"Mẫu quá dài.");
            foreach(Match m in Regex.Matches(text,@"\{\{(.*?)\}\}"))Need(Variables.Contains(m.Groups[1].Value.Trim()),"Biến không hợp lệ: "+m.Groups[1].Value);
            Need(!Regex.Replace(text,@"\{\{[^{}]+\}\}","").Contains("{{"),"Biến thiếu dấu đóng.");
        }
    }
    public static JsonObject Context(JsonObject s,JsonObject document,JsonObject template){
        string T(JsonObject x,string k)=>WeekEngine.T(x,k);
        decimal N(JsonObject x,string k)=>WeekEngine.N(x,k);
        string Wh(string id)=>id=="SUPPLIER"?"Nhà cung cấp":WeekEngine.Rows(s,"warehouses").FirstOrDefault(w=>T(w,"id")==id)?["name"]?.GetValue<string>()??id;
        var lines=new JsonArray();
        var inputs=document["lines"]?.AsArray()??new JsonArray(new JsonObject{
            ["item"]=T(document,"item"),["qty"]=N(document,"qty"),["received"]=N(document,"received")
        }
        );
        int index=0;
        foreach(var n in inputs){
            var l=n!.AsObject();
            var item=WeekEngine.Rows(s,"items").Single(i=>T(i,"id")==T(l,"item"));
            var dispatched=T(document,"status") is "IN_TRANSIT" or "PARTIAL" or "RECEIVED" or "POSTED"?N(l,"qty"):0;
            lines.Add(new JsonObject{
                ["index"]=++index,["code"]=T(item,"id"),["name"]=T(document,"itemNameSnapshot")==""?T(item,"name"):T(document,"itemNameSnapshot"),["unit"]=T(document,"unitSnapshot")==""?T(item,"unit"):T(document,"unitSnapshot"),["stock"]=document["stockSnapshot"]?.DeepClone()??JsonValue.Create(0),["requested"]=N(l,"qty"),["approved"]=T(document,"status") is "DRAFT" or "CANCELLED"?0:N(l,"qty"),["dispatched"]=dispatched,["received"]=N(l,"received"),["inTransit"]=T(document,"sourceKind") is "ISSUE" or "RECEIVE"?0:dispatched-N(l,"received"),["note"]=""
            }
            );
        }
        return new JsonObject{
            ["company"]=s["company"]!.DeepClone(),["document"]=new JsonObject{
                ["number"]=T(document,"number"),["date"]=T(document,"due"),["status"]=T(document,"status")=="POSTED"?(T(document,"sourceKind")=="RECEIVE"?"ĐÃ NHẬN HÀNG":"ĐÃ GHI NHẬN XUẤT SẢN XUẤT"):T(document,"status"),["reason"]=T(document,"reason")==""?"Cấp nguyên liệu theo kế hoạch":T(document,"reason"),["reference"]=T(document,"reference")
            }
            ,["warehouse"]=new JsonObject{
                ["from"]=Wh(T(document,"from")),["to"]=Wh(T(document,"to"))
            }
            ,["kitchen"]=new JsonObject{
                ["name"]=Wh(T(document,"to")=="PRODUCTION"?T(document,"from"):T(document,"to"))
            }
            ,["signatures"]=new JsonObject{
                ["requester"]=T(document,"createdBy"),["approver"]=T(document,"approvedBy"),["sender"]="",["receiver"]=""
            }
            ,["totals"]=new JsonObject{
                ["quantity"]="Không cộng khác đơn vị"
            }
            ,["system"]=new JsonObject{
                ["printedAt"]=DateTimeOffset.UtcNow.ToString("O"),["templateVersion"]=N(template,"version")
            }
            ,["lines"]=lines
        }
        ;
    }
}
