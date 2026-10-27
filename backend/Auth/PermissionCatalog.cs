namespace Lona.Admin.Auth;
public static class PermissionCatalog {
    public static readonly Dictionary<string,string> All=new(){
        ["operations.view"]="Xem kế hoạch và điều chuyển",["transfer.request"]="Yêu cầu chuyển kho",["transfer.approve"]="Duyệt chuyển kho",["transfer.dispatch"]="Xuất chuyển kho",["transfer.receive"]="Nhận chuyển kho",["planning.run"]="Chạy/cấu hình kế hoạch",["templates.edit"]="Sửa mẫu chứng từ",["documents.view"]="Xem/in chứng từ",["documents.publish"]="Phát hành snapshot",["dashboard.view"]="Xem tổng quan",["menus.view"]="Xem thực đơn",["menus.edit"]="Thêm / sửa / xóa dòng món",["menus.approve"]="Chốt số suất",["recipes.view"]="Xem công thức",["recipes.edit"]="Quản lý món / định lượng",["recipes.approve"]="Duyệt công thức",["items.view"]="Xem nguyên liệu",["items.edit"]="Quản lý danh mục nguyên liệu",["stock.view"]="Xem kho",["stock.opening"]="Nhập tồn ban đầu",["stock.receive"]="Nhận hàng",["stock.issue"]="Xuất kho",["purchase.view"]="Xem đề nghị mua",["purchase.create"]="Lập đề nghị mua",["reports.view"]="Xem / xuất báo cáo NVL",["costs.view"]="Xem giá và chi phí",["costs.edit"]="Sửa giá tham chiếu",["users.manage"]="Quản lý tài khoản",["roles.manage"]="Cấu hình vai trò",["audit.view"]="Xem nhật ký"
    }
    ;
    public static Dictionary<string,string[]> Defaults()=>new(){
        ["admin"]=All.Keys.ToArray(),["manager"]=All.Keys.Where(k=>k is not "users.manage" and not "roles.manage").ToArray(),["planner"]=["operations.view","planning.run","documents.view","dashboard.view","menus.view","menus.edit","menus.approve","recipes.view","recipes.edit","recipes.approve","items.view","stock.view","purchase.view","reports.view"],["chef"]=["operations.view","documents.view","dashboard.view","menus.view","recipes.view","items.view","stock.view","reports.view"],["warehouse"]=["operations.view","transfer.request","transfer.dispatch","transfer.receive","documents.view","dashboard.view","menus.view","recipes.view","items.view","stock.view","stock.receive","stock.issue","purchase.view","reports.view"],["buyer"]=["operations.view","transfer.request","documents.view","dashboard.view","recipes.view","menus.view","items.view","stock.view","purchase.view","purchase.create","reports.view","costs.view"],["viewer"]=["operations.view","documents.view","dashboard.view","menus.view","recipes.view","items.view","stock.view","purchase.view","reports.view"]
    }
    ;
    public static readonly Dictionary<string,string[]> Dependencies=new(){
        ["menus.view"]=["recipes.view"],["recipes.view"]=["items.view"],["items.view"]=["stock.view"],["dashboard.view"]=["menus.view","recipes.view","items.view","stock.view","purchase.view"],["reports.view"]=["menus.view","recipes.view","items.view","stock.view","purchase.view"],["menus.edit"]=["menus.view"],["menus.approve"]=["menus.edit"],["recipes.edit"]=["recipes.view"],["recipes.approve"]=["recipes.edit"],["items.edit"]=["items.view"],["stock.opening"]=["items.edit"],["stock.receive"]=["stock.view","items.view","purchase.view"],["stock.issue"]=["reports.view"],["purchase.create"]=["reports.view"],["costs.edit"]=["costs.view","items.edit"]
    }
    ;
    public static readonly Dictionary<string,string> Names=new(){
        ["admin"]="Quản trị hệ thống",["manager"]="Quản lý bếp",["planner"]="Kế hoạch & định mức",["chef"]="Nhân viên bếp",["warehouse"]="Thủ kho",["buyer"]="Mua hàng",["viewer"]="Chỉ xem"
    }
    ;
}
