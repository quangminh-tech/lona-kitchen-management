using System.Security.Cryptography;
using System.Text;
using Lona.Admin.Storage;
namespace Lona.Admin.Auth;
public sealed record UserRecord(string Id,string Username,string Name,string Role,bool Active,string Hash,int Version=1);
public sealed record AuditEntry(DateTimeOffset At,string Actor,string Action,string Detail);
public sealed class IdentityData {
    public int Revision{
        get;
        set;
    }
    =1;
    public List<UserRecord> Users{
        get;
        set;
    }
    =[];
    public Dictionary<string,string[]> Roles{
        get;
        set;
    }
    =PermissionCatalog.Defaults();
    public List<AuditEntry> Audit{
        get;
        set;
    }
    =[];
}
public sealed record UserInput(string? Id,string Username,string Name,string Role,bool Active,string? Password,int Revision);
public sealed record RoleInput(string Role,string[] Permissions,int Revision);
public sealed class IdentityStore {
    readonly string path;
    readonly object gate=new();
    public IdentityStore(IConfiguration config,IHostEnvironment env){
        path=Path.GetFullPath(config["IdentityPath"]??Path.Combine(env.ContentRootPath,"AppData/identity.json"));
        if(!File.Exists(path)){
            var password=config["LONA_ADMIN_PASSWORD"];
            if(string.IsNullOrWhiteSpace(password)||password.Length<12)throw new InvalidOperationException("Set LONA_ADMIN_PASSWORD (at least 12 characters) for first start.");
            var s=new IdentityData();
            s.Users.Add(new(Guid.NewGuid().ToString(),"admin","Quản trị viên","admin",true,Hash(password)));
            JsonFile.Write(path,s);
        }
    }
    public static string Hash(string password){
        var salt=RandomNumberGenerator.GetBytes(16);
        var key=Rfc2898DeriveBytes.Pbkdf2(password,salt,210000,HashAlgorithmName.SHA256,32);
        return Convert.ToBase64String(salt)+":"+Convert.ToBase64String(key);
    }
    static bool Verify(string password,string hash){
        var parts=hash.Split(':');
        var key=Rfc2898DeriveBytes.Pbkdf2(password,Convert.FromBase64String(parts[0]),210000,HashAlgorithmName.SHA256,32);
        return CryptographicOperations.FixedTimeEquals(key,Convert.FromBase64String(parts[1]));
    }
    public IdentityData Read(){
        lock(gate)return JsonFile.Read<IdentityData>(path);
    }
    public UserRecord? Authenticate(string username,string password){
        lock(gate){
            var s=JsonFile.Read<IdentityData>(path);
            var u=s.Users.FirstOrDefault(u=>u.Username==username.Trim().ToLowerInvariant()&&u.Active);
            var valid=Verify(password,u?.Hash??dummy);
            s.Audit.Insert(0,new(DateTimeOffset.UtcNow,u?.Username??"unknown","login",valid&&u is not null?"Thành công":"Không thành công"));
            JsonFile.Write(path,s);
            return valid?u:null;
        }
    }
    static readonly string dummy=Hash("unused-password-for-timing");
    public string[] Permissions(UserRecord u){
        var s=Read();
        return u.Role=="admin"?PermissionCatalog.All.Keys.ToArray():s.Roles.GetValueOrDefault(u.Role)??[];
    }
    public static object Public(UserRecord u)=>new{
        id=u.Id,username=u.Username,name=u.Name,role=u.Role,active=u.Active
    }
    ;
    public object Session(UserRecord u)=>new{
        user=Public(u),permissions=Permissions(u)
    }
    ;
    public object AdminView(){
        var s=Read();
        return new{
            revision=s.Revision,users=s.Users.Select(Public),roles=s.Roles.Select(r=>new{
                id=r.Key,name=PermissionCatalog.Names[r.Key],permissions=r.Value
            }
            ),catalog=PermissionCatalog.All
        }
        ;
    }
    public void SaveUser(UserInput input,UserRecord actor){
        lock(gate){
            var s=JsonFile.Read<IdentityData>(path);
            if(input.Revision!=s.Revision)throw new Lona.Week.RuleError("Danh sách đã thay đổi. Tải lại trước khi lưu.");
            var username=(input.Username??"").Trim().ToLowerInvariant();
            if(!System.Text.RegularExpressions.Regex.IsMatch(username,@"^[a-z0-9._-]{3,40}$")||string.IsNullOrWhiteSpace(input.Name)||!s.Roles.ContainsKey(input.Role))throw new Lona.Week.RuleError("Tên đăng nhập, họ tên hoặc vai trò không hợp lệ.");
            var old=s.Users.FirstOrDefault(u=>u.Id==input.Id);
            if(input.Id is not null&&old is null)throw new Lona.Week.RuleError("Không tìm thấy tài khoản.");
            if(s.Users.Any(u=>u.Username==username&&u.Id!=input.Id))throw new Lona.Week.RuleError("Tên đăng nhập đã tồn tại.");
            if(old?.Role=="admin"&&(!input.Active||input.Role!="admin")&&s.Users.Count(u=>u.Active&&u.Role=="admin")<=1)throw new Lona.Week.RuleError("Phải giữ ít nhất một quản trị viên hoạt động.");
            if(old?.Id==actor.Id&&(!input.Active||input.Role!="admin"))throw new Lona.Week.RuleError("Không tự khóa hoặc hạ quyền tài khoản đang dùng.");
            if((old is null||!string.IsNullOrEmpty(input.Password))&&(input.Password?.Length<12||input.Password is null))throw new Lona.Week.RuleError("Mật khẩu cần ít nhất 12 ký tự.");
            var u=new UserRecord(old?.Id??Guid.NewGuid().ToString(),username,input.Name.Trim(),input.Role,input.Active,string.IsNullOrEmpty(input.Password)?old!.Hash:Hash(input.Password),(old?.Version??0)+1);
            s.Users.RemoveAll(x=>x.Id==u.Id);
            s.Users.Add(u);
            s.Revision++;
            s.Audit.Insert(0,new(DateTimeOffset.UtcNow,actor.Username,old is null?"user.create":"user.update",username+" / "+input.Role+" / "+(input.Active?"active":"locked")));
            JsonFile.Write(path,s);
        }
    }
    public void SaveRole(RoleInput input,UserRecord actor){
        lock(gate){
            var s=JsonFile.Read<IdentityData>(path);
            if(s.Revision!=input.Revision)throw new Lona.Week.RuleError("Vai trò đã thay đổi. Tải lại.");
            if(input.Role=="admin"||!s.Roles.ContainsKey(input.Role)||input.Permissions.Any(p=>!PermissionCatalog.All.ContainsKey(p))||input.Permissions.Any(p=>p is "users.manage" or "roles.manage"))throw new Lona.Week.RuleError("Không được thay quyền quản trị hệ thống; quản lý tài khoản/vai trò chỉ dành cho admin.");
            if(input.Permissions.Any(p=>PermissionCatalog.Dependencies.TryGetValue(p,out var deps)&&deps.Any(d=>!input.Permissions.Contains(d))))throw new Lona.Week.RuleError("Thiếu quyền xem liên quan. Cấp đủ quyền phụ thuộc trước khi lưu.");
            s.Roles[input.Role]=input.Permissions.Distinct().ToArray();
            s.Revision++;
            s.Audit.Insert(0,new(DateTimeOffset.UtcNow,actor.Username,"role.update",input.Role));
            JsonFile.Write(path,s);
        }
    }
}
