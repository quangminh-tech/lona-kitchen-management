using System.Text.Json.Nodes;
namespace Lona.Admin.Storage;
public sealed class BusinessStore {
    public string Path{
        get;
    }
    public SemaphoreSlim Gate{
        get;
    }
    =new(1,1);
    public BusinessStore(IConfiguration config,IHostEnvironment env){
        Path=System.IO.Path.GetFullPath(config["DataPath"]??System.IO.Path.Combine(env.ContentRootPath,"AppData/state.json"));
        if(!File.Exists(Path)){
            var seed=System.IO.Path.Combine(env.ContentRootPath,"../samples/seed.json");
            if(!File.Exists(seed))seed=System.IO.Path.Combine(AppContext.BaseDirectory,"Data/seed.json");
            JsonFile.Write(Path,JsonNode.Parse(File.ReadAllText(seed))!);
        }
    }
}
