using System.Security.Claims;
namespace Lona.Admin.Auth;
public static class SessionAccess {
    public static UserRecord Current(HttpContext c)=>c.RequestServices.GetRequiredService<IdentityStore>().Read().Users.Single(u=>u.Id==c.User.FindFirstValue(ClaimTypes.NameIdentifier));
    public static HashSet<string> Permissions(HttpContext c)=>c.RequestServices.GetRequiredService<IdentityStore>().Permissions(Current(c)).ToHashSet();
    public static void Demand(HttpContext c,string permission){
        if(!Permissions(c).Contains(permission))throw new UnauthorizedAccessException("Bạn không có quyền: "+permission);
    }
}
