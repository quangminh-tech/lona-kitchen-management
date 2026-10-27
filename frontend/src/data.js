import seed from "./seed.json";
import { change, clone, uuid } from "./engine.js";
const KEY = "lona-week-demo-2";
export function load() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return clone(seed);
  const s = JSON.parse(raw);
  if (s.schemaVersion !== "lona-week-2")
    throw Error("Dữ liệu không cùng phiên bản.");
  return s;
}
export const apiEnabled =
  location.protocol !== "file:" &&
  !new URLSearchParams(location.search).has("preview") &&
  import.meta.env.VITE_PREVIEW !== "1";
export async function loadServer() {
  const r = await fetch("/api/state");
  if (!r.ok) {
    if (r.status === 401) window.dispatchEvent(new Event("lona:unauthorized"));
    throw Error("Chưa đăng nhập hoặc không kết nối được máy chủ.");
  }
  return r.json();
}
export async function save(s, type, payload) {
  if (apiEnabled) {
    const r = await fetch("/api/change", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Lona-Request": "1" },
      body: JSON.stringify({
        type,
        payload,
        expectedRevision: s.revision,
        requestId: uuid(),
      }),
    });
    const v = await r.json();
    if (!r.ok) {
      if (r.status === 401)
        window.dispatchEvent(new Event("lona:unauthorized"));
      throw Error(
        v.message || "Không có quyền hoặc phiên đăng nhập đã hết hạn.",
      );
    }
    return v;
  }
  const out = change(s, {
    type,
    payload,
    expectedRevision: s.revision,
    requestId: uuid(),
  });
  localStorage.setItem(KEY, JSON.stringify(out));
  return out;
}
export const reset = () => {
  localStorage.removeItem(KEY);
  return clone(seed);
};
export const download = (name, obj, type = "application/json") => {
  const u = URL.createObjectURL(
    new Blob([typeof obj === "string" ? obj : JSON.stringify(obj, null, 2)], {
      type,
    }),
  );
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
};
export const csv = (rows) =>
  "\uFEFF" +
  rows
    .map((r) =>
      r
        .map((v) => {
          let x = String(v ?? "");
          if (/^[=+@]/.test(x)) x = "'" + x;
          return '"' + x.replace(/"/g, '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
export function parseCSV(text) {
  text = text.replace(/^\uFEFF/, "");
  const rows = [];
  let r = [],
    v = "",
    q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (q && text[i + 1] === '"') {
        v += '"';
        i++;
      } else q = !q;
    } else if (c === "," && !q) {
      r.push(v);
      v = "";
    } else if ((c === "\n" || c === "\r") && !q) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      r.push(v);
      if (r.some(Boolean)) rows.push(r);
      r = [];
      v = "";
    } else v += c;
  }
  if (q) throw Error("CSV thiếu dấu ngoặc kép.");
  if (v || r.length) {
    r.push(v);
    rows.push(r);
  }
  return rows
    .slice(1)
    .map((r) =>
      Object.fromEntries(rows[0].map((h, i) => [h.trim(), r[i] || ""])),
    );
}
