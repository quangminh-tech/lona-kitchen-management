import { Operations } from "./features/operations.jsx";
import React, { useState, useEffect, useRef } from "react";
import { BusyContext, Icon, Button } from "./components/Primitives.jsx";
import { Week } from "./features/menus.jsx";
import { Recipes } from "./features/recipes.jsx";
import { Items } from "./features/items.jsx";
import { Needs } from "./features/purchase.jsx";
import { Dashboard } from "./features/dashboard.jsx";
import { Administration, Audit } from "./features/administration.jsx";
import { load, save, download, apiEnabled, loadServer } from "./data.js";
import { days } from "./services/format.js";
import { request, previewSession, roleNames } from "./services/access.js";
const pages = [
  {
    group: "ĐIỀU HÀNH",
    id: "dashboard",
    title: "Tổng quan",
    icon: "grid",
    permission: "dashboard.view",
  },
  {
    group: "",
    id: "calendar",
    title: "Thực đơn",
    icon: "calendar",
    permission: "operations.view",
  },
  {
    group: "",
    id: "schedule",
    title: "Kế hoạch nguyên liệu",
    icon: "clock",
    permission: "operations.view",
  },
  {
    group: "KHO & MUA HÀNG",
    id: "transfers",
    title: "Tồn kho & điều chuyển",
    icon: "box",
    permission: "operations.view",
  },
  {
    group: "",
    id: "purchase",
    title: "Mua & nhận hàng",
    icon: "cart",
    permission: "operations.view",
  },
  {
    group: "",
    id: "ledger",
    title: "Sổ kho",
    icon: "book",
    permission: "operations.view",
  },
  {
    group: "DANH MỤC",
    id: "recipes",
    title: "Món & định lượng",
    icon: "book",
    permission: "recipes.view",
  },
  {
    group: "",
    id: "items",
    title: "Nguyên liệu",
    icon: "box",
    permission: "items.view",
  },
  {
    group: "CHỨNG TỪ",
    id: "documents",
    title: "Đã phát hành",
    icon: "book",
    permission: "documents.view",
  },
  {
    group: "",
    id: "templates",
    title: "Mẫu chứng từ",
    icon: "edit",
    permission: "documents.view",
  },
  {
    group: "QUẢN TRỊ",
    id: "users",
    title: "Người dùng",
    icon: "people",
    permission: "users.manage",
  },
  {
    group: "",
    id: "roles",
    title: "Vai trò & phân quyền",
    icon: "shield",
    permission: "roles.manage",
  },
  {
    group: "",
    id: "settings",
    title: "Thiết lập chung",
    icon: "shield",
    permission: "templates.edit",
  },
  {
    group: "",
    id: "audit",
    title: "Nhật ký hoạt động",
    icon: "clock",
    permission: "audit.view",
  },
];
export default function App() {
  const [session, setSession] = useState(null),
    [boot, setBoot] = useState(true),
    [s, setS] = useState(null),
    [page, setPage] = useState(location.hash.slice(1) || "dashboard"),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState(null),
    [notice, setNotice] = useState(""),
    [failure, setFailure] = useState(""),
    [sideOpen, setSideOpen] = useState(false),
    [updated, setUpdated] = useState(null),
    [from, setFrom] = useState(days[0]),
    [to, setTo] = useState(days[6]);
  const gate = useRef(false),
    timer = useRef();
  const can = (p) => session?.permissions.includes(p) || false;
  function notify(text) {
    setNotice(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(""), 4500);
  }
  function navigate(key) {
    setPage(key);
    location.hash = key;
    setSideOpen(false);
    setModal(null);
  }
  async function openData(auth) {
    setBusy(true);
    try {
      const state = apiEnabled ? await loadServer() : load();
      setS(state);
      setSession(auth);
      setUpdated(new Date());
      setFailure("");
    } catch (e) {
      setFailure(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const expired = () => {
      setSession(null);
      setS(null);
      setModal(null);
      setBoot(false);
    };
    window.addEventListener("lona:unauthorized", expired);
    if (apiEnabled)
      request("/api/auth/me")
        .then(openData)
        .catch(() => {})
        .finally(() => setBoot(false));
    else setBoot(false);
    const hash = () => setPage(location.hash.slice(1) || "dashboard");
    window.addEventListener("hashchange", hash);
    return () => {
      window.removeEventListener("lona:unauthorized", expired);
      window.removeEventListener("hashchange", hash);
      clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    if (!modal) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !gate.current) setModal(null);
    };
    window.addEventListener("keydown", onKey);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = old;
    };
  }, [modal]);
  async function refresh() {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    try {
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      const auth = apiEnabled
        ? await request("/api/auth/me")
        : previewSession(session.user.role);
      await openData(auth);
      notify("Đã tải lại dữ liệu mới nhất.");
    } catch (e) {
      notify(e.message);
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  async function commit(type, payload) {
    if (gate.current) return false;
    gate.current = true;
    setBusy(true);
    try {
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      setS(await save(s, type, payload));
      setUpdated(new Date());
      notify("Đã lưu thay đổi.");
      return true;
    } catch (e) {
      notify(e.message);
      return false;
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  async function logout() {
    try {
      if (apiEnabled) await request("/api/auth/logout", {});
      setSession(null);
      setS(null);
      setModal(null);
    } catch (e) {
      notify(e.message);
    }
  }
  if (boot)
    return (
      <div className="loading-screen">
        <span className="spinner" />
        <h2>Đang mở trang quản trị…</h2>
      </div>
    );
  if (!session || !s)
    return <Login onLogin={openData} busy={busy} failure={failure} />;
  const route = pages.find((p) => p.id === page),
    permitted = route && can(route.permission),
    ctx = {
      s,
      commit,
      manager: can(
        page === "week"
          ? "menus.edit"
          : page === "recipes"
            ? "recipes.edit"
            : "items.edit",
      ),
      can,
      modal: setModal,
      from,
      to,
      setFrom,
      setTo,
      notify,
      session,
    };
  return (
    <BusyContext.Provider value={busy}>
      <div className="admin-layout">
        <aside className={"sidebar " + (sideOpen ? "open" : "")}>
          <div className="sidebar-brand">
            LONA<span>.</span>
            <small>HỆ THỐNG QUẢN TRỊ BẾP</small>
          </div>
          <div className="workspace">
            <span className="workspace-icon">
              <Icon name="box" />
            </span>
            <div>
              <b>Bếp Cần Giờ</b>
              <small>Không gian làm việc</small>
            </div>
          </div>
          <nav aria-label="Điều hướng quản trị">
            {pages
              .filter((p) => can(p.permission))
              .map((p) => (
                <React.Fragment key={p.id}>
                  {p.group && <div className="nav-group">{p.group}</div>}
                  <button
                    className={page === p.id ? "active" : ""}
                    onClick={() => navigate(p.id)}
                  >
                    <Icon name={p.icon} />
                    <span>{p.title}</span>
                    {page === p.id && <i />}
                  </button>
                </React.Fragment>
              ))}
          </nav>
          <div className="sidebar-bottom">
            <span className="avatar">{session.user.name.slice(0, 1)}</span>
            <div>
              <b>{session.user.name}</b>
              <small>{roleNames[session.user.role]}</small>
            </div>
            <button aria-label="Đăng xuất" onClick={logout}>
              <Icon name="logout" />
            </button>
          </div>
        </aside>
        {sideOpen && (
          <button
            className="sidebar-backdrop"
            aria-label="Đóng menu"
            onClick={() => setSideOpen(false)}
          />
        )}
        <div className="admin-body">
          <header className="admin-header">
            <div>
              <button
                className="mobile-menu"
                aria-label="Mở menu"
                onClick={() => setSideOpen(!sideOpen)}
              >
                <Icon name="menu" />
              </button>
              <span className="breadcrumb">
                Quản trị <Icon name="right" size={13} />
                <b>{route?.title || "Trang không tồn tại"}</b>
              </span>
            </div>
            <div className="header-tools">
              <span className="status-dot" />
              <span>
                {apiEnabled ? "Đã đăng nhập máy chủ" : "Chế độ xem thử"}
              </span>
              <span className="avatar">{session.user.name.slice(0, 1)}</span>
            </div>
          </header>
          <main className="admin-content">
            <div
              className="content-meta"
              hidden={[
                "dashboard",
                "purchase",
                "ledger",
                "calendar",
                "schedule",
                "transfers",
                "documents",
                "templates",
                "settings",
              ].includes(page)}
            >
              <span>Vận hành / Bếp Cần Giờ</span>
              <div>
                <span>
                  Cập nhật{" "}
                  {updated?.toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <Button icon="refresh" onClick={refresh}>
                  Tải lại
                </Button>
              </div>
            </div>
            {!apiEnabled && (
              <div className="preview-note">
                <Icon name="eye" /> Bản xem thử giao diện ·{" "}
                {roleNames[session.user.role]} · Phân quyền bảo mật hoạt động
                khi chạy cùng máy chủ .NET.
              </div>
            )}
            <div className="page-enter" key={page}>
              {!permitted ? (
                <section className="no-access card">
                  <Icon name="shield" size={40} />
                  <h1>Không có quyền truy cập</h1>
                  <p>
                    Liên hệ quản trị viên để được cấp quyền cho chức năng này.
                  </p>
                  {pages
                    .filter((p) => can(p.permission))
                    .slice(0, 1)
                    .map((p) => (
                      <Button key={p.id} onClick={() => navigate(p.id)}>
                        Đến {p.title}
                      </Button>
                    ))}
                </section>
              ) : page === "dashboard" ? (
                <Operations {...ctx} page="overview" />
              ) : [
                  "purchase",
                  "ledger",
                  "calendar",
                  "schedule",
                  "transfers",
                  "documents",
                  "templates",
                  "settings",
                ].includes(page) ? (
                <Operations {...ctx} page={page} />
              ) : page === "week" ? (
                <Week {...ctx} />
              ) : page === "recipes" ? (
                <Recipes {...ctx} />
              ) : page === "items" ? (
                <Items {...ctx} />
              ) : page === "needs" ? (
                <Needs {...ctx} />
              ) : page === "users" || page === "roles" ? (
                <Administration {...ctx} page={page} />
              ) : (
                <Audit {...ctx} />
              )}
            </div>
            <footer className="admin-footer">
              <span>LONA · Quản trị vận hành bếp</span>
              <span>
                {apiEnabled ? "Dữ liệu máy chủ" : "Dữ liệu mẫu 1 tuần"}
              </span>
            </footer>
          </main>
        </div>
      </div>
      {busy && (
        <div className="busy-bar" role="status">
          <span className="spinner" />
          Đang xử lý…
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <Icon name="check" />
          {notice}
        </div>
      )}
      {modal && (
        <div
          className="overlay"
          onClick={() => {
            if (!gate.current) setModal(null);
          }}
        >
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label={modal.title}
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <h2>{modal.title}</h2>
              <button
                disabled={busy}
                aria-label="Đóng"
                onClick={() => setModal(null)}
              >
                <Icon name="close" />
              </button>
            </header>
            <div className="pad">{modal.body}</div>
          </section>
        </div>
      )}
    </BusyContext.Provider>
  );
}
function Login({ onLogin, busy, failure }) {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [role, setRole] = useState("admin"),
    [error, setError] = useState(""),
    [submitting, setSubmitting] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const auth = apiEnabled
        ? await request("/api/auth/login", { username, password })
        : previewSession(role);
      await onLogin(auth);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div className="login-layout">
      <section className="login-story">
        <div className="sidebar-brand">
          LONA<span>.</span>
          <small>QUẢN TRỊ VẬN HÀNH BẾP</small>
        </div>
        <div>
          <span className="login-eyebrow">LONA FOOD</span>
          <h1>
            Quản lý bếp
            <br />
            và kho
            <br />
          </h1>
          <p>
            Quản lý kế hoạch bữa ăn, kho và mua hàng theo từng vai trò trong đội
            ngũ.
          </p>
          <div className="login-modules">
            <span>
              <Icon name="calendar" />
              Thực đơn
            </span>
            <span>
              <Icon name="box" />
              Kho
            </span>
            <span>
              <Icon name="shield" />
              Phân quyền
            </span>
          </div>
        </div>
        <small>Dữ liệu minh họa cho một tuần vận hành</small>
      </section>
      <section className="login-form">
        <form onSubmit={submit}>
          <span className="login-icon">
            <Icon name="shield" size={28} />
          </span>
          <h1>{apiEnabled ? "Đăng nhập quản trị" : "Xem thử dashboard"}</h1>
          <p>
            {apiEnabled
              ? "Sử dụng tài khoản được quản trị viên cấp."
              : "Chọn vai trò để trải nghiệm giao diện tương ứng."}
          </p>
          {apiEnabled ? (
            <>
              <label>
                Tên đăng nhập
                <input
                  autoFocus
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </label>
              <label>
                Mật khẩu
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            </>
          ) : (
            <label>
              Vai trò xem thử
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                {Object.entries(roleNames).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(error || failure) && (
            <div className="error" role="alert">
              {error || failure}
            </div>
          )}
          <Button
            primary
            type="submit"
            disabled={busy || submitting}
            icon="logout"
          >
            {busy || submitting
              ? "Đang mở…"
              : apiEnabled
                ? "Đăng nhập"
                : "Mở dashboard"}
          </Button>
          <small>
            {apiEnabled
              ? "Liên hệ quản trị viên khi cần đặt lại mật khẩu."
              : "Chế độ mẫu không cung cấp bảo mật tài khoản. Dữ liệu chỉ lưu tại trình duyệt."}
          </small>
        </form>
      </section>
    </div>
  );
}
