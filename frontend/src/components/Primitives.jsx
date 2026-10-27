import React, {
  useState,
  useEffect,
  useRef,
  useContext,
  createContext,
} from "react";
import { analyse, clone, validate, uuid, servings } from "../engine.js";
import {
  load,
  save,
  reset,
  download,
  csv,
  parseCSV,
  apiEnabled,
  loadServer,
} from "../data.js";
import { f, money, scopes, units, days, dayLabel } from "../services/format.js";
export const BusyContext = createContext(false);
export function Icon({ name = "grid", size = 18 }) {
  const paths = {
    people:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 21v-2a4 4 0 0 0-3-4 M16 3a4 4 0 0 1 0 8",
    shield: "M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6z m-5 10 3 3 5-6",
    clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M12 6v6l4 2",
    logout: "M10 3H3v18h7 M8 12h14 m-5-5 5 5-5 5",
    menu: "M3 6h18 M3 12h18 M3 18h18",
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    calendar:
      "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2",
    box: "m3 7 9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10",
    book: "M4 3h7a3 3 0 0 1 3 3v15a4 4 0 0 0-4-2H4z M14 6a3 3 0 0 1 3-3h4v16h-4a4 4 0 0 0-3 2",
    cart: "M2 3h3l3 12h11l3-9H6 M9 20h.01 M18 20h.01",
    plus: "M12 5v14 M5 12h14",
    edit: "m15 4 5 5 M4 20l5-1L21 7l-5-5L4 14z",
    trash: "M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
    search: "M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16 M16 16l6 6",
    refresh: "M20 7a9 9 0 1 0 1 9 M20 2v6h-6",
    download: "M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5",
    upload: "M12 16V3 m-5 5 5-5 5 5 M4 16v5h16v-5",
    copy: "M8 8h13v13H8z M16 8V3H3v13h5",
    save: "M4 3h14l3 3v15H3V3z M7 3v7h10V3 M7 21v-7h10v7",
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
    check: "m4 12 5 5L20 6",
    left: "m15 5-7 7 7 7",
    right: "m9 5 7 7-7 7",
    close: "m6 6 12 12 M18 6 6 18",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.grid} />
    </svg>
  );
}
export function plain(x) {
  if (x == null || typeof x === "boolean") return "";
  if (typeof x === "string" || typeof x === "number") return String(x);
  if (Array.isArray(x)) return x.map(plain).join(" ");
  return plain(x.props?.children);
}
export function Button({ children, onClick, primary = false, icon, ...rest }) {
  const busy = useContext(BusyContext),
    t = plain(children);
  const n =
    icon ||
    (/Xóa|Bỏ/.test(t)
      ? "trash"
      : /Thêm/.test(t)
        ? "plus"
        : /Sửa|Chi tiết/.test(t)
          ? "edit"
          : /Lưu/.test(t)
            ? "save"
            : /Nhập/.test(t)
              ? "upload"
              : /Xuất|Tải mẫu/.test(t)
                ? "download"
                : /Sao chép/.test(t)
                  ? "copy"
                  : /Xem/.test(t)
                    ? "eye"
                    : /Tải lại/.test(t)
                      ? "refresh"
                      : "check");
  return (
    <button
      className={primary ? "primary" : ""}
      onClick={onClick}
      {...rest}
      disabled={busy || rest.disabled}
    >
      <Icon name={n} size={16} />
      {typeof children === "string" ? children.replace(/^＋\s*/, "") : children}
    </button>
  );
}
export function Table({ heads, rows, pageSize = 10, searchable = true }) {
  const [page, setPage] = useState(1),
    [size, setSize] = useState(pageSize),
    [q, setQ] = useState("");
  const editing = rows.some((r) =>
    r.some(
      (c) => React.isValidElement(c) && ["input", "select"].includes(c.type),
    ),
  );
  const list = editing
      ? rows
      : rows.filter((r) =>
          plain(r).toLocaleLowerCase("vi").includes(q.toLocaleLowerCase("vi")),
        ),
    pages = Math.max(1, Math.ceil(list.length / size)),
    current = Math.min(page, pages),
    start = (current - 1) * size,
    shown = editing ? list : list.slice(start, start + size);
  return (
    <div className="data-table">
      {!editing && searchable && rows.length > 10 && (
        <div className="table-tools">
          <div className="searchbox">
            <Icon name="search" />
            <input
              aria-label="Tìm trong bảng"
              placeholder="Tìm nhanh trong bảng…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <span>{list.length} kết quả</span>
        </div>
      )}
      <div className="scroll">
        <table>
          <thead>
            <tr>
              {heads.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={start + i}>
                {r.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))}
            {!list.length && (
              <tr>
                <td colSpan={heads.length} className="empty">
                  <Icon name="search" size={26} />
                  <p>Không có dữ liệu phù hợp.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!editing && rows.length > 0 && (
        <div className="pagination">
          <span>
            Hiển thị {list.length ? start + 1 : 0}–
            {Math.min(start + size, list.length)} / {list.length}
          </span>
          <div>
            <label>
              Số dòng
              <select
                aria-label="Số dòng mỗi trang"
                value={size}
                onChange={(e) => {
                  setSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[5, 10, 20, 50].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <button
              aria-label="Trang trước"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              <Icon name="left" />
            </button>
            <b>
              {current} / {pages}
            </b>
            <button
              aria-label="Trang sau"
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
            >
              <Icon name="right" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export function Title({ title, text, children }) {
  return (
    <div className="title">
      <div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}
