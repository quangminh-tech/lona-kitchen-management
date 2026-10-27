using System.Text.Json;
namespace Lona.Admin.Storage;
// Process-local serialization. For multiple instances, replace with database transactions.
public static class JsonFile {
    public static T Read<T>(string path)=>JsonSerializer.Deserialize<T>(File.ReadAllText(path))!;
    public static void Write<T>(string path,T value){
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var temp=path+".tmp";
        using(var f=new FileStream(temp,FileMode.Create,FileAccess.Write,FileShare.None)){
            JsonSerializer.Serialize(f,value,new JsonSerializerOptions{
                WriteIndented=true
            }
            );
            f.Flush(true);
        }
        File.Move(temp,path,true);
    }
}
