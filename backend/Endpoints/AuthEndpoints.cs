using System.Security.Claims;
using System.Text.Json.Nodes;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.RateLimiting;
using Lona.Admin.Auth;
using Lona.Admin.Storage;
using Lona.Week;
using static Lona.Admin.Auth.SessionAccess;
namespace Lona.Admin.Endpoints;
public static class AuthEndpoints {
    public static void MapAuthRoutes(this WebApplication app){
        var identity=app.Services.GetRequiredService<IdentityStore>();
        var store=app.Services.GetRequiredService<BusinessStore>();
        var gate=store.Gate;
        var path=store.Path;
        app.MapPost("/api/auth/login",async(HttpContext c,LoginInput input)=>{
            if(input.Password is null||input.Password.Length>256||input.Username is null||input.Username.Length>40)return Results.BadRequest(new{
                message="Thông tin đăng nhập không hợp lệ."
            }
            ); var u=identity.Authenticate(input.Username,input.Password); if(u is null)return Results.Json(new{
                message="Tên đăng nhập hoặc mật khẩu không đúng."
            }
            ,statusCode:401); var claims=new[]{
                new Claim(ClaimTypes.NameIdentifier,u.Id),new Claim(ClaimTypes.Name,u.Username),new Claim("version",u.Version.ToString())
            }
            ; await c.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,new ClaimsPrincipal(new ClaimsIdentity(claims,CookieAuthenticationDefaults.AuthenticationScheme))); return Results.Ok(identity.Session(u));
        }
        ).RequireRateLimiting("login");
        app.MapGet("/api/auth/me",(HttpContext c)=>identity.Session(Current(c))).RequireAuthorization();
        app.MapPost("/api/auth/logout",async(HttpContext c)=>{
            await c.SignOutAsync(); return Results.Ok();
        }
        ).RequireAuthorization();
    }
}
public sealed record LoginInput(string? Username,string? Password);
