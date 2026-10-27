using System.Text.Json.Nodes;
using Lona.Admin.Auth;
using static Lona.Admin.Auth.SessionAccess;
namespace Lona.Admin.Operations;
public static class OperationsEndpoints {
    public static void MapOperations(this WebApplication app){
        var store=app.Services.GetRequiredService<OperationsStore>();
        app.MapGet("/api/operations",async(HttpContext c)=>{
            Demand(c,"operations.view");
            await store.Gate.WaitAsync();
            try{
                return Results.Json(OperationsStore.Public(store.Read(),Current(c),Permissions(c)));
            }
            finally{
                store.Gate.Release();
            }
        }
        ).RequireAuthorization();
        app.MapPost("/api/operations",async(HttpContext c,JsonObject cmd)=>{
            Demand(c,"operations.view");
            await store.Gate.WaitAsync();
            try{
                var next=store.Apply(store.Read(),cmd,Current(c),Permissions(c));
                return Results.Json(OperationsStore.Public(next,Current(c),Permissions(c)));
            }
            finally{
                store.Gate.Release();
            }
        }
        ).RequireAuthorization();
    }
}
public sealed class PlanningWorker(IServiceProvider services,ILogger<PlanningWorker> logger,IConfiguration configuration):BackgroundService {
    protected override async Task ExecuteAsync(CancellationToken stoppingToken){
        using var timer=new PeriodicTimer(TimeSpan.FromSeconds(Math.Clamp(configuration.GetValue<int>("PlanningPollSeconds",30),1,60)));
        do{
            try{
                var store=services.GetRequiredService<OperationsStore>();
                await store.Gate.WaitAsync(stoppingToken);
                try{
                    var s=store.Read();
                    var cfg=s["schedule"]!.AsObject();
                    if(cfg["enabled"]?.GetValue<bool>()==true){
                        var zone=TimeZoneInfo.FindSystemTimeZoneById(OperatingSystem.IsWindows()?"SE Asia Standard Time":"Asia/Ho_Chi_Minh");
                        var now=TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow,zone);
                        if(now.Hour*60+now.Minute>=(int)Lona.Week.WeekEngine.N(cfg,"hour")*60+(int)Lona.Week.WeekEngine.N(cfg,"minute")){
                            var before=s["jobs"]!.AsArray().Count;
                            foreach(var kitchen in new[]{
                                "CG","B2"
                            }
                            )OperationsStore.Run(s,kitchen,DateOnly.FromDateTime(now.DateTime));
                            if(s["jobs"]!.AsArray().Count!=before){
                                s["revision"]=Lona.Week.WeekEngine.N(s,"revision")+1;
                                store.Write(s);
                                logger.LogInformation("Planning drafts updated for {Date}",now.Date);
                            }
                        }
                    }
                }
                finally{
                    store.Gate.Release();
                }
            }
            catch(OperationCanceledException)when(stoppingToken.IsCancellationRequested){
                break;
            }
            catch(Exception e){
                logger.LogError(e,"Planning job failed; retry next tick");
            }
        }
        while(await timer.WaitForNextTickAsync(stoppingToken));
    }
}
