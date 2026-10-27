using System.Security.Claims;
using System.Text.Json.Nodes;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.RateLimiting;
using Lona.Admin.Auth;
using Lona.Admin.Operations;
using Lona.Admin.Storage;
using Lona.Week;
using static Lona.Admin.Auth.SessionAccess;
namespace Lona.Admin.Endpoints;
public static class BusinessEndpoints {
    public static void MapBusinessRoutes(this WebApplication app){
        var identity=app.Services.GetRequiredService<IdentityStore>();
        var store=app.Services.GetRequiredService<BusinessStore>();
        var gate=store.Gate;
        var path=store.Path;
var ops=app.Services.GetRequiredService<OperationsStore>();
        app.MapGet("/api/state",async(HttpContext c)=>{
            await gate.WaitAsync(); try{
                return Results.Json(CommandPolicy.Redact(JsonFile.Read<JsonObject>(path),Permissions(c)));
            }
            finally{
                gate.Release();
            }
        }
        ).RequireAuthorization();
        app.MapGet("/api/requirements",async(HttpContext c,string from,string to)=>{
            Demand(c,"reports.view"); await gate.WaitAsync(); try{
                var s=CommandPolicy.Redact(JsonFile.Read<JsonObject>(path),Permissions(c)); return Results.Json(WeekEngine.Analyse(s,from,to));
            }
            finally{
                gate.Release();
            }
        }
        ).RequireAuthorization();
        app.MapPost("/api/change",async(HttpContext c,JsonObject cmd)=>{
            await gate.WaitAsync(); try{
                var s=JsonFile.Read<JsonObject>(path);var kind=WeekEngine.T(cmd,"type");var payload=cmd["payload"]!.AsObject();if(kind is not ("recipe" or "replace" or "delete")||(kind=="replace"&&WeekEngine.T(payload,"collection")!="items"))throw new RuleError("Dùng nghiệp vụ kế hoạch và kho V6; endpoint cũ chỉ quản lý danh mục.");
await ops.Gate.WaitAsync();try{var os=ops.Read();if(kind=="replace")foreach(var item in WeekEngine.Rows(payload,"rows")){var old=WeekEngine.Find(s,"items",WeekEngine.T(item,"id"));if(old is not null&&(WeekEngine.N(item,"stock")!=WeekEngine.N(old,"stock")||WeekEngine.T(item,"baseUnit")!=WeekEngine.T(old,"baseUnit")))throw new RuleError("Không sửa tồn hoặc đơn vị cơ sở trực tiếp; cần nghiệp vụ kho.");}if(kind=="delete"&&WeekEngine.T(payload,"collection")=="items"&&os["balances"]!.AsObject().Any(x=>x.Key.EndsWith("|"+WeekEngine.T(payload,"id"))&&(x.Value?.GetValue<decimal>()??0)!=0))throw new RuleError("Mặt hàng còn tồn trong hệ thống kho.");}finally{ops.Gate.Release();}
CommandPolicy.Check(s,cmd,Permissions(c)); var next=WeekEngine.Change(s,cmd); if(WeekEngine.N(next,"revision")>WeekEngine.N(s,"revision"))next["audit"]!.AsArray()[0]!["actor"]=Current(c).Username; JsonFile.Write(path,next);await ops.Gate.WaitAsync();try{var os=ops.Read();os["base"]=next.DeepClone();os["items"]=new JsonArray(WeekEngine.Rows(next,"items").Select(i=>(JsonNode)new JsonObject{["id"]=WeekEngine.T(i,"id"),["name"]=WeekEngine.T(i,"name"),["unit"]=WeekEngine.T(i,"baseUnit"),["pack"]=WeekEngine.N(i,"packQuantity")}).ToArray());os["revision"]=WeekEngine.N(os,"revision")+1;ops.Write(os);}finally{ops.Gate.Release();} return Results.Json(CommandPolicy.Redact(next,Permissions(c)));
            }
            finally{
                gate.Release();
            }
        }
        ).RequireAuthorization();
    }
}
