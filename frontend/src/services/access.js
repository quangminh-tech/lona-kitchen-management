import { apiEnabled } from "../data.js";
export const catalog = {
  "dashboard.view": "Xem tổng quan",
  "menus.view": "Xem thực đơn",
  "menus.edit": "Thêm / sửa / xóa dòng món",
  "menus.approve": "Chốt số suất",
  "recipes.view": "Xem công thức",
  "recipes.edit": "Quản lý món / định lượng",
  "recipes.approve": "Duyệt công thức",
  "items.view": "Xem nguyên liệu",
  "items.edit": "Quản lý danh mục nguyên liệu",
  "stock.view": "Xem kho",
  "stock.opening": "Nhập tồn ban đầu",
  "stock.receive": "Nhận hàng",
  "stock.issue": "Xuất kho",
  "purchase.view": "Xem đề nghị mua",
  "purchase.create": "Lập đề nghị mua",
  "reports.view": "Xem / xuất báo cáo NVL",
  "costs.view": "Xem giá và chi phí",
  "costs.edit": "Sửa giá tham chiếu",
  "users.manage": "Quản lý tài khoản",
  "roles.manage": "Cấu hình vai trò",
  "audit.view": "Xem nhật ký",
};
export const roleNames = {
  admin: "Quản trị hệ thống",
  manager: "Quản lý bếp",
  planner: "Kế hoạch & định mức",
  chef: "Nhân viên bếp",
  warehouse: "Thủ kho",
  buyer: "Mua hàng",
  viewer: "Chỉ xem",
};
const defaults = {
  admin: Object.keys(catalog),
  manager: Object.keys(catalog).filter(
    (k) => !["users.manage", "roles.manage"].includes(k),
  ),
  planner: [
    "dashboard.view",
    "menus.view",
    "menus.edit",
    "menus.approve",
    "recipes.view",
    "recipes.edit",
    "recipes.approve",
    "items.view",
    "stock.view",
    "purchase.view",
    "reports.view",
  ],
  chef: [
    "dashboard.view",
    "menus.view",
    "recipes.view",
    "items.view",
    "stock.view",
    "reports.view",
  ],
  warehouse: [
    "dashboard.view",
    "menus.view",
    "recipes.view",
    "items.view",
    "stock.view",
    "stock.receive",
    "stock.issue",
    "purchase.view",
    "reports.view",
  ],
  buyer: [
    "dashboard.view",
    "recipes.view",
    "menus.view",
    "items.view",
    "stock.view",
    "purchase.view",
    "purchase.create",
    "reports.view",
    "costs.view",
  ],
  viewer: [
    "dashboard.view",
    "menus.view",
    "recipes.view",
    "items.view",
    "stock.view",
    "purchase.view",
    "reports.view",
  ],
};
Object.assign(catalog, {
  "operations.view": "Xem kế hoạch & kho",
  "transfer.request": "Yêu cầu chuyển kho",
  "transfer.approve": "Duyệt chuyển kho",
  "transfer.dispatch": "Xuất chuyển kho",
  "transfer.receive": "Nhận chuyển kho",
  "planning.run": "Chạy/cấu hình kế hoạch",
  "templates.edit": "Sửa mẫu chứng từ",
  "documents.view": "Xem/in chứng từ",
  "documents.publish": "Phát hành snapshot",
});
defaults.admin = Object.keys(catalog);
defaults.manager = Object.keys(catalog).filter(
  (k) => !["users.manage", "roles.manage"].includes(k),
);
for (const role of ["planner", "chef", "warehouse", "buyer", "viewer"])
  defaults[role].push("operations.view", "documents.view");
defaults.planner.push("planning.run");
defaults.warehouse.push(
  "transfer.request",
  "transfer.dispatch",
  "transfer.receive",
);
defaults.buyer.push("transfer.request");
const KEY = "lona-admin-preview-access-v6";
export const previewAccess = () =>
  JSON.parse(localStorage.getItem(KEY) || "null") || {
    revision: 1,
    users: Object.entries(roleNames).map(([role, name], i) => ({
      id: String(i + 1),
      username: role,
      name,
      role,
      active: true,
    })),
    roles: Object.entries(defaults).map(([id, permissions]) => ({
      id,
      name: roleNames[id],
      permissions,
    })),
    catalog,
  };
export async function request(url, data) {
  const r = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Lona-Request": "1" },
    ...(data ? { method: "POST", body: JSON.stringify(data) } : {}),
  });
  let v = {};
  if (r.status !== 204) {
    try {
      v = await r.json();
    } catch {}
  }
  if (!r.ok) {
    if (r.status === 401) window.dispatchEvent(new Event("lona:unauthorized"));
    throw Error(
      v.message ||
        (r.status === 403
          ? "Bạn không có quyền thực hiện thao tác."
          : r.status === 429
            ? "Thử quá nhiều lần. Vui lòng chờ một phút."
            : "Không kết nối được máy chủ."),
    );
  }
  return v;
}
export const getAccess = () =>
  apiEnabled ? request("/api/admin/access") : Promise.resolve(previewAccess());
export async function saveUser(input) {
  if (apiEnabled) return request("/api/admin/users", input);
  const a = previewAccess();
  if (input.revision !== a.revision)
    throw Error("Dữ liệu đã thay đổi. Tải lại.");
  if (a.users.some((u) => u.username === input.username && u.id !== input.id))
    throw Error("Tên đăng nhập đã tồn tại.");
  a.users = a.users.filter((u) => u.id !== input.id);
  const { password, ...safe } = input;
  a.users.push({ ...safe, id: input.id || crypto.randomUUID() });
  a.revision++;
  localStorage.setItem(KEY, JSON.stringify(a));
  return a;
}
export async function saveRole(input) {
  if (apiEnabled) return request("/api/admin/roles", input);
  const a = previewAccess();
  a.roles = a.roles.map((r) =>
    r.id === input.role ? { ...r, permissions: input.permissions } : r,
  );
  a.revision++;
  localStorage.setItem(KEY, JSON.stringify(a));
  return a;
}
export function previewSession(role) {
  const a = previewAccess();
  return {
    user: {
      id: "preview",
      username: role,
      name: roleNames[role],
      role,
      active: true,
    },
    permissions:
      role === "admin"
        ? Object.keys(catalog)
        : a.roles.find((r) => r.id === role)?.permissions || [],
  };
}

export const dependencies = {
  "menus.view": ["recipes.view"],
  "recipes.view": ["items.view"],
  "items.view": ["stock.view"],
  "dashboard.view": [
    "menus.view",
    "recipes.view",
    "items.view",
    "stock.view",
    "purchase.view",
  ],
  "reports.view": [
    "menus.view",
    "recipes.view",
    "items.view",
    "stock.view",
    "purchase.view",
  ],
  "menus.edit": ["menus.view"],
  "menus.approve": ["menus.edit"],
  "recipes.edit": ["recipes.view"],
  "recipes.approve": ["recipes.edit"],
  "items.edit": ["items.view"],
  "stock.opening": ["items.edit"],
  "stock.receive": ["stock.view", "items.view", "purchase.view"],
  "stock.issue": ["reports.view"],
  "purchase.create": ["reports.view"],
  "costs.edit": ["costs.view", "items.edit"],
};
export function togglePermission(current, key, enabled) {
  const set = new Set(current);
  if (enabled) {
    function add(p) {
      set.add(p);
      for (const d of dependencies[p] || []) if (!set.has(d)) add(d);
    }
    add(key);
  } else {
    set.delete(key);
    let changed = true;
    while (changed) {
      changed = false;
      for (const p of set)
        if ((dependencies[p] || []).some((d) => !set.has(d))) {
          set.delete(p);
          changed = true;
        }
    }
  }
  return [...set];
}
