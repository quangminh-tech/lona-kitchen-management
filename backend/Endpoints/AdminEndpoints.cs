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
public static class AdminEndpoints {
    public static void MapAdminRoutes(this WebApplication app){
        var identity=app.Services.GetRequiredService<IdentityStore>();
        var store=app.Services.GetRequiredService<BusinessStore>();
        var gate=store.Gate;
        var path=store.Path;
        app.MapGet("/api/admin/access",(HttpContext c)=>{
            Demand(c,"users.manage"); return identity.AdminView();
        }
        ).RequireAuthorization();
        app.MapPost("/api/admin/users",(HttpContext c,UserInput input)=>{
            Demand(c,"users.manage"); identity.SaveUser(input,Current(c)); return Results.Ok(identity.AdminView());
        }
        ).RequireAuthorization();
        app.MapPost("/api/admin/roles",(HttpContext c,RoleInput input)=>{
            Demand(c,"roles.manage"); identity.SaveRole(input,Current(c)); return Results.Ok(identity.AdminView());
        }
        ).RequireAuthorization();
        app.MapGet("/api/admin/audit",async(HttpContext c)=>{
            Demand(c,"audit.view"); await gate.WaitAsync(); try{
                return Results.Ok(new{
                    security=identity.Read().Audit.Take(300),business=WeekEngine.Rows(JsonFile.Read<JsonObject>(path),"audit").Concat(WeekEngine.Rows(app.Services.GetRequiredService<OperationsStore>().Read(),"audit")).OrderByDescending(a=>WeekEngine.T(a,"at")).Take(500)
                }
                );
            }
            finally{
                gate.Release();
            }
        }
        ).RequireAuthorization();
    }
}
