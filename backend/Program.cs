using Microsoft.AspNetCore.DataProtection;
using Lona.Admin.Operations;
using System.Security.Claims;
using System.Text.Json.Nodes;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.RateLimiting;
using Lona.Admin.Auth;
using Lona.Admin.Storage;
using Lona.Admin.Endpoints;
using Lona.Week;
var b = WebApplication.CreateBuilder(args);
b.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 4 * 1024 * 1024);
// Use a configured public origin behind Render TLS termination, never caller-supplied proxy headers.
var publicOrigin = b.Configuration["PUBLIC_ORIGIN"] ?? b.Configuration["RENDER_EXTERNAL_URL"];
if (!string.IsNullOrEmpty(publicOrigin)) {
    if (!Uri.TryCreate(publicOrigin, UriKind.Absolute, out var uri) || uri.Scheme != "https" || uri.AbsolutePath != "/" || !string.IsNullOrEmpty(uri.Query) || !string.IsNullOrEmpty(uri.Fragment) || !string.IsNullOrEmpty(uri.UserInfo))
        throw new InvalidOperationException("PUBLIC_ORIGIN must be an HTTPS origin without path, query or credentials.");
    publicOrigin = uri.GetLeftPart(UriPartial.Authority);
}
var keyPath = b.Configuration["DataProtectionPath"];
if (!string.IsNullOrEmpty(keyPath)) {
    Directory.CreateDirectory(keyPath);
    b.Services.AddDataProtection().SetApplicationName("Lona.Kitchen").PersistKeysToFileSystem(new DirectoryInfo(keyPath));
}

b.Services.AddSingleton<IdentityStore>();
b.Services.AddSingleton<BusinessStore>();
b.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(o => {
    o.Cookie.Name = "Lona.Session";  o.Cookie.HttpOnly = true;  o.Cookie.SameSite = SameSiteMode.Strict;  o.Cookie.SecurePolicy = publicOrigin is null ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;  o.ExpireTimeSpan = TimeSpan.FromHours(8);  o.SlidingExpiration = false;  o.Events.OnRedirectToLogin = c => {
        c.Response.StatusCode = 401;  return Task.CompletedTask;
    }
    ;  o.Events.OnRedirectToAccessDenied = c => {
        c.Response.StatusCode = 403;  return Task.CompletedTask;
    }
    ;  o.Events.OnValidatePrincipal = c => {
        var store = c.HttpContext.RequestServices.GetRequiredService<IdentityStore>();  var u = store.Read().Users.FirstOrDefault(u => u.Id == c.Principal?.FindFirstValue(ClaimTypes.NameIdentifier));  if (u is null || !u.Active || u.Version.ToString() != c.Principal?.FindFirstValue("version")) c.RejectPrincipal();  return Task.CompletedTask;
    }
    ;
}
);
b.Services.AddAuthorization();
b.Services.AddRateLimiter(o => {
    o.RejectionStatusCode = 429;  o.AddPolicy("login", c => RateLimitPartition.GetFixedWindowLimiter(c.Connection.RemoteIpAddress?.ToString() ?? "local", _ => new() {
        PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0
    }
    ));
}
);
b.Services.AddSingleton<OperationsStore>();
b.Services.AddHostedService<PlanningWorker>();
var app = b.Build();
_ = app.Services.GetRequiredService<IdentityStore>();
_ = app.Services.GetRequiredService<BusinessStore>();
app.Use(async (c, next) => {
    try {
        if (c.Request.Path.StartsWithSegments("/api")) {
            c.Response.Headers.CacheControl = "no-store";  c.Response.Headers["X-Content-Type-Options"] = "nosniff";  if (HttpMethods.IsPost(c.Request.Method)) {
                if (c.Request.Headers["X-Lona-Request"] != "1") {
                    c.Response.StatusCode = 403;  await c.Response.WriteAsJsonAsync(new {
                        message = "Thiếu header bảo vệ request."
                    }
                    );  return;
                }
                var origin = c.Request.Headers.Origin.ToString();  if (origin.Length > 0 && origin != (publicOrigin ?? $"{c.Request.Scheme}://{c.Request.Host}")) {
                    c.Response.StatusCode = 403;  return;
                }
            }
        }
        await next();
    }
    catch (UnauthorizedAccessException e) {
        c.Response.StatusCode = 403;  await c.Response.WriteAsJsonAsync(new {
            message = e.Message
        }
        );
    }
    catch (RuleError e) {
        c.Response.StatusCode = 409;  await c.Response.WriteAsJsonAsync(new {
            message = e.Message
        }
        );
    }
    catch (Exception e) when (e is System.Text.Json.JsonException or InvalidOperationException or FormatException or ArgumentException) {
        c.Response.StatusCode = 400;  await c.Response.WriteAsJsonAsync(new {
            message = "Dữ liệu không hợp lệ."
        }
        );
    }
}
);
app.MapGet("/healthz", () => Results.Ok(new { status = "ok" }));
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapAuthRoutes();
app.MapAdminRoutes();
app.MapBusinessRoutes();
app.MapOperations();
app.MapMethods("/api/{**p}", ["GET", "POST"], () => Results.NotFound(new {
    message = "Không có API này."
}
));
app.MapFallbackToFile("index.html");
app.Run();
