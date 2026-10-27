import React, { useState, useEffect } from "react";
import { Button, Table, Icon, Title } from "../components/Primitives.jsx";
import { apiEnabled } from "../data.js";
import {
  getAccess,
  saveUser,
  saveRole,
  request,
  roleNames,
  togglePermission,
} from "../services/access.js";
export function Administration({ page, modal, notify, session }) {
  const [a, setA] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [role, setRole] = useState("manager"),
    [draft, setDraft] = useState([]),
    [saving, setSaving] = useState(false);
  async function refresh() {
    setLoading(true);
    try {
      const v = await getAccess();
      setA(v);
      setDraft(v.roles.find((r) => r.id === role)?.permissions || []);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  function edit(user) {
    modal({
      title: user ? "Sửa tài khoản" : "Thêm tài khoản",
      body: (
        <UserEditor
          user={user}
          access={a}
          session={session}
          close={() => modal(null)}
          done={(v) => {
            setA(v);
            modal(null);
            notify(
              "Đã lưu tài khoản. Phiên cũ của tài khoản được sửa sẽ hết hiệu lực.",
            );
          }}
        />
      ),
    });
  }
  async function storeRole() {
    setSaving(true);
    try {
      const v = await saveRole({
        role,
        permissions: draft,
        revision: a.revision,
      });
      setA(v);
      notify("Đã cập nhật quyền vai trò.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  if (loading)
    return (
      <div className="loading-card">
        <span className="spinner" /> Đang tải cấu hình quản trị…
      </div>
    );
  if (!a)
    return (
      <div className="error">
        {error}
        <Button onClick={refresh}>Thử lại</Button>
      </div>
    );
  return (
    <>
      <Title
        title={
          page === "users" ? "Tài khoản người dùng" : "Vai trò & phân quyền"
        }
        text={
          page === "users"
            ? "Tạo tài khoản, phân vai trò và khóa truy cập khi cần."
            : "Quyền theo từng chức năng và thao tác. Thay đổi áp dụng cho toàn bộ người dùng thuộc vai trò."
        }
      >
        <Button icon="refresh" onClick={refresh}>
          Tải lại
        </Button>
        {page === "users" && (
          <Button primary onClick={() => edit(null)}>
            Thêm tài khoản
          </Button>
        )}
      </Title>
      {!apiEnabled && (
        <div className="preview-note">
          Chế độ xem thử: tài khoản và quyền chỉ lưu trên trình duyệt. Chạy .NET
          để kiểm tra đăng nhập và phân quyền thực.
        </div>
      )}
      {error && <div className="error">{error}</div>}
      {page === "users" ? (
        <section className="card">
          <Table
            heads={[
              "Người dùng",
              "Tên đăng nhập",
              "Vai trò",
              "Trạng thái",
              "Thao tác",
            ]}
            rows={a.users.map((u) => [
              <div className="person-cell">
                <span className="avatar">{u.name.slice(0, 1)}</span>
                <strong>{u.name}</strong>
              </div>,
              u.username,
              <span className="badge">{roleNames[u.role]}</span>,
              <span className={"badge " + (u.active ? "success" : "warning")}>
                {u.active ? "Hoạt động" : "Đã khóa"}
              </span>,
              <Button icon="edit" onClick={() => edit(u)}>
                Sửa / khóa
              </Button>,
            ])}
          />
        </section>
      ) : (
        <>
          <div className="role-select">
            {a.roles.map((r) => (
              <button
                key={r.id}
                className={role === r.id ? "active" : ""}
                onClick={() => {
                  setRole(r.id);
                  setDraft(r.permissions);
                }}
              >
                <Icon name="shield" />
                {r.name}
                <small>{r.permissions.length} quyền</small>
              </button>
            ))}
          </div>
          <section className="card permission-panel">
            <header>
              <div>
                <h2>{roleNames[role]}</h2>
                <p>
                  {role === "admin"
                    ? "Quản trị hệ thống luôn có toàn bộ quyền; không thể thay đổi."
                    : "Tick để cấp quyền, bỏ tick để thu hồi. Các quyền xem cần thiết được chọn cùng; bỏ quyền nền sẽ bỏ các quyền phụ thuộc."}
                </p>
              </div>
              <Button
                disabled={saving || role === "admin"}
                primary
                onClick={storeRole}
              >
                {saving ? "Đang lưu…" : "Lưu phân quyền"}
              </Button>
            </header>
            <div className="permission-grid">
              {[
                "operations",
                "transfer",
                "planning",
                "templates",
                "documents",
                "dashboard",
                "menus",
                "recipes",
                "items",
                "stock",
                "purchase",
                "reports",
                "costs",
                "users",
                "roles",
                "audit",
              ].map((group) => (
                <section key={group}>
                  <h3>
                    {
                      {
                        operations: "Kế hoạch & kho",
                        transfer: "Điều chuyển",
                        planning: "Lịch xử lý",
                        templates: "Mẫu chứng từ",
                        documents: "Phát hành",
                        dashboard: "Tổng quan",
                        menus: "Thực đơn",
                        recipes: "Định lượng",
                        items: "Nguyên liệu",
                        stock: "Kho",
                        purchase: "Mua hàng",
                        reports: "Báo cáo",
                        costs: "Giá & chi phí",
                        users: "Tài khoản",
                        roles: "Phân quyền",
                        audit: "Nhật ký",
                      }[group]
                    }
                  </h3>
                  {Object.entries(a.catalog)
                    .filter(([k]) => k.startsWith(group + "."))
                    .map(([key, label]) => (
                      <label key={key}>
                        <input
                          type="checkbox"
                          disabled={
                            role === "admin" ||
                            ["users.manage", "roles.manage"].includes(key)
                          }
                          checked={draft.includes(key)}
                          onChange={(e) =>
                            setDraft(
                              togglePermission(draft, key, e.target.checked),
                            )
                          }
                        />
                        <span>
                          {label}
                          <small>{key}</small>
                        </span>
                      </label>
                    ))}
                </section>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
function UserEditor({ user, access, session, done, close }) {
  const [v, setV] = useState(
      user || { username: "", name: "", role: "viewer", active: true },
    ),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      done(await saveUser({ ...v, password, revision: access.revision }));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <div className="formrow">
        <label>
          Họ tên
          <input
            required
            value={v.name}
            onChange={(e) => setV({ ...v, name: e.target.value })}
          />
        </label>
        <label>
          Tên đăng nhập
          <input
            required
            pattern="[a-z0-9._-]{3,40}"
            value={v.username}
            onChange={(e) => setV({ ...v, username: e.target.value })}
          />
        </label>
        <label>
          Vai trò
          <select
            value={v.role}
            onChange={(e) => setV({ ...v, role: e.target.value })}
          >
            {access.roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {user
            ? "Đặt mật khẩu mới (để trống nếu giữ nguyên)"
            : "Mật khẩu ban đầu"}
          <input
            type="password"
            autoComplete="new-password"
            required={apiEnabled && !user}
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      </div>
      <div className="checks">
        <label>
          <input
            type="checkbox"
            checked={v.active}
            onChange={(e) => setV({ ...v, active: e.target.checked })}
          />
          Cho phép đăng nhập
        </label>
      </div>
      {error && <div className="error">{error}</div>}
      <p>
        Mật khẩu tối thiểu 12 ký tự. Khóa hoặc đổi tài khoản sẽ vô hiệu phiên
        đăng nhập cũ. Không xóa tài khoản để giữ lịch sử.
      </p>
      <div className="actions">
        <Button type="button" onClick={close}>
          Hủy
        </Button>
        <Button type="submit" primary disabled={saving}>
          {saving ? "Đang lưu…" : "Lưu tài khoản"}
        </Button>
      </div>
    </form>
  );
}
export function Audit({ s }) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (apiEnabled)
      request("/api/admin/audit")
        .then(setData)
        .catch((e) => setError(e.message));
    else setData({ security: [], business: s.audit });
  }, [s.revision]);
  return (
    <>
      <Title
        title="Nhật ký hoạt động"
        text="Theo dõi thao tác nghiệp vụ và thay đổi tài khoản, vai trò."
      />
      {error && <div className="error">{error}</div>}
      {!data ? (
        <div className="loading-card">Đang tải nhật ký…</div>
      ) : (
        <>
          <section className="card">
            <header>
              <h2>Nghiệp vụ</h2>
            </header>
            <Table
              heads={["Thời gian", "Người thao tác", "Hành động", "Nội dung"]}
              rows={(data.business || []).map((a) => [
                new Date(a.at).toLocaleString("vi-VN"),
                a.actor || "Phiên demo",
                a.action,
                a.detail,
              ])}
            />
          </section>
          <section className="card audit-section">
            <header>
              <h2>Đăng nhập & quản trị</h2>
            </header>
            <Table
              heads={["Thời gian", "Tài khoản", "Hành động", "Nội dung"]}
              rows={(data.security || []).map((a) => [
                new Date(a.at).toLocaleString("vi-VN"),
                a.actor,
                a.action,
                a.detail,
              ])}
            />
          </section>
        </>
      )}
    </>
  );
}
