import React, { useState, useEffect } from "react";
import { Button, Icon, Table, Title } from "../components/Primitives.jsx";
import {
  validateItemCSV,
  saveText,
  exportRows,
} from "../services/import-workflow.js";
const fmt = (n) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(n || 0);
const time = (at) =>
  at
    ? new Date(at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
    : "Chưa có thời điểm";
const labels = {
  DRAFT: "Chờ duyệt",
  APPROVED: "Đã giữ hàng",
  IN_TRANSIT: "Đang giao",
  PARTIAL: "Nhận một phần",
  RECEIVED: "Đã nhận đủ",
  CANCELLED: "Đã hủy",
  POSTED: "Đã ghi sổ",
};
export const warehouseTabs = [
  ["stock", "Tồn kho", "box"],
  ["purchase", "Mua & nhận", "cart"],
  ["transfers", "Điều chuyển", "refresh"],
  ["issues", "Xuất bếp", "upload"],
  ["ledger", "Sổ kho", "book"],
];
function Timeline({ steps, active }) {
  return (
    <ol className="workflow-timeline">
      {steps.map(([title, description], i) => (
        <li
          key={title}
          className={i < active ? "complete" : i === active ? "current" : ""}
        >
          <span>{i < active ? <Icon name="check" size={14} /> : i + 1}</span>
          <div>
            <b>{title}</b>
            <small>{description}</small>
          </div>
        </li>
      ))}
    </ol>
  );
}
export function WarehouseHub({
  data,
  send,
  can,
  busy,
  error,
  reload,
  page,
  notify,
}) {
  const [filter, setFilter] = useState("ALL"),
    [status, setStatus] = useState("ALL"),
    [selected, setSelected] = useState(null),
    [form, setForm] = useState(null),
    [receive, setReceive] = useState(null),
    [validation, setValidation] = useState([]),
    [localError, setLocalError] = useState(""),
    [imported, setImported] = useState(false),
    [acting, setActing] = useState(false);
  useEffect(() => {
    if (!selected && !form) return;
    const layer = document.querySelector(".workflow-overlay"),
      before = document.activeElement;
    const focusables = () => [
      ...layer.querySelectorAll(
        "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
      ),
    ];
    focusables()[0]?.focus();
    const key = (e) => {
      if (e.key === "Escape" && !busy && !acting) {
        setSelected(null);
        setForm(null);
        setReceive(null);
      }
      if (e.key === "Tab") {
        const list = focusables(),
          first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    layer.addEventListener("keydown", key);
    return () => {
      layer.removeEventListener("keydown", key);
      if (before?.isConnected) before.focus();
    };
  }, [!!selected, !!form, busy, acting]);
  const allowed = data.allowedWarehouses || data.warehouses.map((w) => w.id),
    warehouses = data.warehouses.filter(
      (w) =>
        allowed.includes(w.id) && !["TRANSIT", "PRODUCTION"].includes(w.id),
    ),
    wh = (id) =>
      data.warehouses.find((w) => w.id === id)?.name ||
      { SUPPLIER: "Nhà cung cấp", PRODUCTION: "Bếp sản xuất" }[id] ||
      id,
    item = (id) => data.items.find((i) => i.id === id),
    physical = data.warehouses.filter(
      (w) => !["TRANSIT", "PRODUCTION"].includes(w.id),
    ),
    defaultWh = warehouses.find((w) => w.id === "CG")?.id || warehouses[0]?.id;
  const orders = data.orders || [],
    transfers = data.transfers || [],
    issues = data.issues || [],
    receipts = data.stockReceipts || [];
  const grouped = Object.values(
    orders.reduce((all, o) => {
      const k = o.batchId || o.id;
      all[k] ||= { ...o, lines: [] };
      all[k].lines.push(o);
      return all;
    }, {}),
  ).map((o) => ({
    ...o,
    status: o.lines.every((l) => l.received >= l.quantity)
      ? "RECEIVED"
      : o.lines.some((l) => l.received > 0)
        ? "PARTIAL"
        : "APPROVED",
  }));
  const setPage = (p) => {
    location.hash = p;
    setSelected(null);
    setReceive(null);
    setStatus("ALL");
  };
  const find = (kind, id) =>
    kind === "purchase"
      ? grouped.find((o) => o.id === id || o.lines.some((l) => l.id === id))
      : kind === "transfers"
        ? transfers.find((t) => t.id === id)
        : kind === "receipts"
          ? receipts.find((r) => r.id === id)
          : issues.find((i) => i.id === id);
  const doc = selected ? find(selected.kind, selected.id) : null;
  const scope = (w) => allowed.includes(w);
  async function action(type, p) {
    setActing(true);
    try {
      return await send(type, p);
    } finally {
      setActing(false);
    }
  }
  function openForm(kind) {
    setValidation([]);
    setLocalError("");
    setImported(false);
    setForm({
      kind,
      from: warehouses[0]?.id,
      to: defaultWh,
      warehouseId: defaultWh,
      due: new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
      }),
      supplier: "",
      reason: "",
      reference: "",
      lines: [
        { itemId: data.items[0].id, quantity: 1, unit: data.items[0].unit },
      ],
    });
  }
  function updateLine(index, patch) {
    setForm({
      ...form,
      lines: form.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    });
    setImported(false);
  }
  async function importFile(file) {
    if (!file) return;
    setLocalError("");
    try {
      if (file.size > 500000) throw Error("File tối đa 500 KB.");
      const result = validateItemCSV(await file.text(), data.items);
      setValidation(result);
      if (result.every((r) => !r.error)) {
        setForm({
          ...form,
          lines: result.map(({ itemId, quantity, unit }) => ({
            itemId,
            quantity,
            unit,
          })),
        });
        setImported(true);
      }
    } catch (e) {
      setLocalError(e.message);
    }
  }
  async function submit(e) {
    e.preventDefault();
    setLocalError("");
    try {
      if (validation.some((r) => r.error))
        throw Error("Sửa lỗi CSV trước khi lập phiếu.");
      const p = { ...form, dueDate: form.due };
      delete p.kind;
      if (imported) {
        const raw = new TextEncoder().encode(JSON.stringify(p));
        p.importKey = Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", raw)),
        )
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      }
      if (
        await action(
          form.kind === "purchase"
            ? "purchaseBatch"
            : form.kind === "transfers"
              ? "transferBatch"
              : "issueManual",
          p,
        )
      ) {
        setForm(null);
        notify("Đã lập phiếu. Mở Chi tiết để xử lý bước tiếp theo.");
      }
    } catch (e) {
      setLocalError(e.message);
    }
  }
  const relatedJobs = doc?.sourceJob
    ? data.jobs.filter((j) => j.id === doc.sourceJob)
    : [];
  const sourcePlan = doc
    ? data.jobs.find((j) => j.id === (doc.sourceJob || doc.reference))
    : null;
  const samePlan = (jobId) => {
    const j = data.jobs.find((j) => j.id === jobId);
    return sourcePlan && j && j.key === sourcePlan.key;
  };
  const linkedPurchases =
    selected?.kind === "issues"
      ? grouped.filter((g) => samePlan(g.sourceJob))
      : [];
  const receiptOrder =
    selected?.kind === "receipts"
      ? orders.find((o) => o.id === doc?.reference)
      : null;
  const receiptPlan = receiptOrder
    ? data.jobs.find((j) => j.id === receiptOrder.sourceJob)
    : null;
  const linkedIssues = receiptPlan
    ? issues.filter(
        (i) =>
          data.jobs.find((j) => j.id === i.reference)?.key === receiptPlan.key,
      )
    : [];
  const docId = doc?.id,
    docLines = doc
      ? selected.kind === "purchase"
        ? doc.lines
        : doc.lines || [
            { item: doc.item, qty: doc.qty, received: doc.received },
          ]
      : [];
  const relatedReceipts =
    selected?.kind === "purchase"
      ? receipts.filter((r) => doc?.lines.some((l) => l.id === r.reference))
      : [];
  const docMovements = doc
    ? data.ledger.filter(
        (l) => l.doc === doc.id || relatedReceipts.some((r) => r.id === l.doc),
      )
    : [];
  const snapshotDocs = doc
    ? data.documents.filter((d) => d.number === doc.number)
    : [];
  const tableRows = (
    page === "purchase" ? grouped : page === "issues" ? issues : transfers
  ).filter(
    (d) =>
      (filter === "ALL" || [d.from, d.to, d.warehouseId].includes(filter)) &&
      (status === "ALL" || d.status === status),
  );
  const stockRows = Object.entries(data.balances)
    .filter(([key]) => {
      const [w] = key.split("|");
      return (
        allowed.includes(w) &&
        !["PRODUCTION"].includes(w) &&
        (filter === "ALL" || filter === w)
      );
    })
    .map(([key, n]) => {
      const [w, i] = key.split("|"),
        held = transfers
          .filter(
            (t) => t.from === w && t.item === i && t.status === "APPROVED",
          )
          .reduce((v, t) => v + t.qty, 0);
      return [
        wh(w),
        <>
          <b>{item(i)?.name || i}</b>
          <small>{i}</small>
        </>,
        item(i)?.unit,
        fmt(n),
        fmt(held),
        fmt(n - held),
      ];
    });
  return (
    <div className="warehouse-hub">
      <Title
        title="Kho & mua hàng"
        text="Lập phiếu, theo dõi giao nhận và xem biến động từ cùng một nơi."
      >
        <Button
          icon="download"
          disabled={busy}
          onClick={() => {
            try {
              const rows =
                page === "stock"
                  ? Object.entries(data.balances)
                      .filter(
                        ([key]) =>
                          filter === "ALL" || key.startsWith(filter + "|"),
                      )
                      .map(([key, quantity]) => {
                        const [warehouseId, itemId] = key.split("|");
                        return {
                          warehouseId,
                          itemId,
                          quantity,
                          unit: item(itemId)?.unit,
                        };
                      })
                  : page === "purchase"
                    ? orders
                        .filter(
                          (o) => filter === "ALL" || o.warehouseId === filter,
                        )
                        .map((o) => ({
                          number: o.number,
                          warehouseId: o.warehouseId,
                          itemId: o.itemId,
                          quantity: o.quantity,
                          received: o.received,
                          unit: item(o.itemId)?.unit,
                          dueDate: o.dueDate,
                        }))
                    : page === "ledger"
                      ? data.ledger
                          .filter(
                            (l) =>
                              filter === "ALL" ||
                              [l.from, l.to].includes(filter),
                          )
                          .map((l) => ({
                            at: l.at,
                            documentId: l.doc,
                            from: l.from,
                            to: l.to,
                            itemId: l.item,
                            quantity: l.qty,
                            unit: item(l.item)?.unit,
                          }))
                      : page === "transfers"
                        ? tableRows.map((t) => ({
                            number: t.number,
                            from: t.from,
                            to: t.to,
                            itemId: t.item,
                            quantity: t.qty,
                            received: t.received,
                            unit: item(t.item)?.unit,
                            status: t.status,
                          }))
                        : tableRows.flatMap((d) =>
                            d.lines.map((l) => ({
                              number: d.number,
                              from: d.from,
                              itemId: l.item,
                              quantity: l.qty,
                              unit: item(l.item)?.unit,
                              date: d.due,
                            })),
                          );
              exportRows("LONA_" + page + ".csv", rows);
            } catch (e) {
              setLocalError(e.message);
            }
          }}
        >
          Xuất CSV
        </Button>
        <Button icon="refresh" disabled={busy} onClick={reload}>
          Tải lại
        </Button>
        {["purchase", "transfers", "issues"].includes(page) && (
          <Button
            primary
            icon="plus"
            disabled={
              busy ||
              !can(
                page === "purchase"
                  ? "purchase.create"
                  : page === "transfers"
                    ? "transfer.request"
                    : "stock.issue",
              )
            }
            onClick={() => openForm(page)}
          >
            {page === "purchase"
              ? "Lập đề nghị mua"
              : page === "transfers"
                ? "Lập điều chuyển"
                : "Lập phiếu xuất"}
          </Button>
        )}
      </Title>
      {(busy || acting) && (
        <div className="inline-progress" role="status">
          <span className="spinner" />
          Đang ghi / tải dữ liệu…
        </div>
      )}
      <div className="hub-tabs">
        {warehouseTabs.map(([id, label, icon]) => (
          <button
            key={id}
            className={page === id ? "active" : ""}
            onClick={() => setPage(id)}
          >
            <Icon name={icon} size={16} />
            {label}
          </button>
        ))}
      </div>
      {(error || localError) && (
        <div className="error" role="alert">
          {error || localError}
        </div>
      )}
      <div className="warehouse-kpis">
        <div>
          <span>Chờ duyệt chuyển</span>
          <b>{transfers.filter((t) => t.status === "DRAFT").length}</b>
        </div>
        <div>
          <span>Đang giao / nhận dở</span>
          <b>
            {
              transfers.filter((t) =>
                ["PARTIAL", "IN_TRANSIT"].includes(t.status),
              ).length
            }
          </b>
        </div>
        <div>
          <span>Đề nghị mua chưa nhận đủ</span>
          <b>{grouped.filter((t) => t.status !== "RECEIVED").length}</b>
        </div>
        <div>
          <span>Phiếu nhập / xuất</span>
          <b>
            {receipts.length} / {issues.length}
          </b>
        </div>
      </div>
      <div className="warehouse-filter">
        <label>
          Kho
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="ALL">Tất cả kho được phép</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        {["purchase", "transfers"].includes(page) && (
          <label>
            Trạng thái
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ALL">Tất cả trạng thái</option>
              {Object.entries(labels)
                .filter(
                  ([k]) =>
                    page === "transfers" ||
                    ["APPROVED", "PARTIAL", "RECEIVED"].includes(k),
                )
                .map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
            </select>
          </label>
        )}
        <span>
          {page === "stock"
            ? "Tồn vật lý − giữ chỗ = khả dụng. Hàng đang đi theo dõi riêng."
            : "Bấm Chi tiết để xem nguồn, timeline và các lần ghi nhận."}
        </span>
      </div>
      <section className="card hub-table">
        {page === "stock" ? (
          <Table
            heads={["Kho", "Nguyên liệu", "ĐVT", "Tồn", "Giữ chỗ", "Khả dụng"]}
            rows={stockRows}
          />
        ) : page === "ledger" ? (
          <Table
            heads={[
              "Thời điểm",
              "Phiếu nguồn",
              "Nguồn → đích",
              "Nguyên liệu",
              "Số lượng",
              "Người ghi",
            ]}
            rows={[...data.ledger]
              .reverse()
              .filter(
                (l) => filter === "ALL" || [l.from, l.to].includes(filter),
              )
              .map((l) => {
                const p =
                  transfers.find((t) => t.id === l.doc) ||
                  issues.find((t) => t.id === l.doc) ||
                  receipts.find((t) => t.id === l.doc) ||
                  orders.find((t) => t.id === l.doc);
                const kind = transfers.some((t) => t.id === l.doc)
                  ? "transfers"
                  : issues.some((t) => t.id === l.doc)
                    ? "issues"
                    : "receipts";
                return [
                  time(l.at),
                  <button
                    className="link-button"
                    onClick={() => setSelected({ kind, id: l.doc })}
                  >
                    {p?.number || l.doc}
                  </button>,
                  wh(l.from) + " → " + wh(l.to),
                  item(l.item)?.name || l.item,
                  fmt(l.qty) + " " + (item(l.item)?.unit || ""),
                  l.actor,
                ];
              })}
          />
        ) : (
          <Table
            heads={[
              "Số phiếu",
              "Nguồn / kho nhận",
              "Nội dung",
              "Ngày cần",
              "Trạng thái",
              "",
            ]}
            rows={tableRows.map((d) => [
              <>
                <b>{d.number}</b>
                {d.demo && <small>Dữ liệu mẫu</small>}
              </>,
              page === "purchase"
                ? wh(d.warehouseId)
                : wh(d.from) + " → " + wh(d.to),
              page === "purchase" ? (
                d.lines.length + " dòng · " + (d.supplier || "Từ kế hoạch D+1")
              ) : page === "issues" ? (
                d.lines.length + " nguyên liệu"
              ) : (
                <>
                  {item(d.item)?.name}
                  <small>
                    {fmt(d.received)} / {fmt(d.qty)} {item(d.item)?.unit}
                  </small>
                </>
              ),
              d.dueDate || d.due,
              <span
                className={
                  "badge " +
                  (d.status === "RECEIVED" || d.status === "POSTED"
                    ? "success"
                    : "warning")
                }
              >
                {labels[d.status]}
              </span>,
              <Button
                icon="eye"
                onClick={() => setSelected({ kind: page, id: d.id })}
              >
                Chi tiết
              </Button>,
            ])}
          />
        )}
      </section>
      {tableRows.length === 0 && page !== "stock" && page !== "ledger" && (
        <div className="hub-empty">
          <h3>Chưa có phiếu trong phạm vi đang xem</h3>
          <p>
            Lập phiếu bằng nút góc trên, import CSV trong form, hoặc mở kế hoạch
            D+1 để lập theo nhu cầu.
          </p>
          <Button onClick={() => (location.hash = "schedule")}>
            Đến kế hoạch nguyên liệu
          </Button>
        </div>
      )}
      {selected && doc && (
        <div className="workflow-overlay">
          <section
            className="workflow-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={"Chi tiết " + doc.number}
          >
            <header>
              <div>
                <small>
                  {selected.kind === "purchase"
                    ? "Đề nghị mua"
                    : selected.kind === "receipts"
                      ? "Phiếu nhập"
                      : selected.kind === "issues"
                        ? "Phiếu xuất bếp"
                        : "Điều chuyển kho"}
                </small>
                <h2>{doc.number}</h2>
              </div>
              <button
                aria-label="Đóng chi tiết"
                onClick={() => {
                  setSelected(null);
                  setReceive(null);
                }}
              >
                <Icon name="close" />
              </button>
            </header>
            <div className="drawer-body">
              <div className="document-facts">
                <span>
                  <small>Trạng thái</small>
                  <b>{labels[doc.status]}</b>
                </span>
                <span>
                  <small>Kho / tuyến</small>
                  <b>
                    {selected.kind === "purchase"
                      ? wh(doc.warehouseId)
                      : wh(doc.from) + " → " + wh(doc.to)}
                  </b>
                </span>
                <span>
                  <small>Ngày cần</small>
                  <b>{doc.dueDate || doc.due}</b>
                </span>
              </div>
              <Timeline
                steps={
                  selected.kind === "purchase"
                    ? [
                        [
                          "Đề nghị mua",
                          doc.sourceJob
                            ? "Từ kế hoạch D+1"
                            : "Lập trực tiếp / import",
                        ],
                        ["Nhận hàng", "Mỗi lần nhận tạo một phiếu nhập"],
                        ["Hoàn tất", "Đủ lượng của tất cả dòng"],
                      ]
                    : selected.kind === "transfers"
                      ? [
                          ["Yêu cầu", "Kho nhận lập yêu cầu"],
                          ["Duyệt", "Giữ chỗ tại kho xuất"],
                          ["Xuất chuyển", "Hàng chuyển sang đang đi"],
                          ["Nhận hàng", "Nhận một phần hoặc đủ"],
                        ]
                      : [
                          ["Lập phiếu", "Liên kết chứng từ nguồn"],
                          ["Ghi sổ", "Cập nhật tồn thực tế"],
                          ["Chứng từ", "Phát hành bản in"],
                        ]
                }
                active={
                  selected.kind === "purchase"
                    ? doc.status === "RECEIVED"
                      ? 3
                      : doc.status === "PARTIAL"
                        ? 1
                        : 0
                    : selected.kind === "transfers"
                      ? {
                          DRAFT: 0,
                          APPROVED: 1,
                          IN_TRANSIT: 2,
                          PARTIAL: 3,
                          RECEIVED: 4,
                          CANCELLED: -1,
                        }[doc.status]
                      : 2
                }
              />
              <h3>Hàng hóa trên phiếu</h3>
              <div className="detail-lines">
                {docLines.map((l, i) => {
                  const iid = l.itemId || l.item,
                    q = l.quantity ?? l.qty,
                    r = l.received || 0;
                  return (
                    <div key={l.id || i}>
                      <div>
                        <b>{item(iid)?.name || iid}</b>
                        <small>
                          {iid} · {item(iid)?.unit}
                        </small>
                      </div>
                      <div>
                        <b>
                          {fmt(q)} {item(iid)?.unit}
                        </b>
                        {["purchase", "transfers"].includes(selected.kind) && (
                          <small>
                            Đã nhận {fmt(r)} · Còn {fmt(q - r)}
                          </small>
                        )}
                      </div>
                      {selected.kind === "purchase" &&
                        q > r &&
                        can("stock.receive") &&
                        scope(doc.warehouseId) && (
                          <Button
                            disabled={busy || acting}
                            onClick={() =>
                              setReceive({
                                type: "purchaseReceive",
                                id: l.id,
                                qty: q - r,
                                max: q - r,
                                unit: item(iid)?.unit,
                              })
                            }
                          >
                            Nhận hàng
                          </Button>
                        )}
                    </div>
                  );
                })}
              </div>
              {selected.kind === "transfers" && (
                <div className="document-actions">
                  {doc.status === "DRAFT" &&
                    can("transfer.approve") &&
                    scope(doc.from) && (
                      <Button
                        primary
                        disabled={busy || acting}
                        onClick={() => action("approve", { id: doc.id })}
                      >
                        Duyệt yêu cầu
                      </Button>
                    )}
                  {doc.status === "APPROVED" &&
                    can("transfer.dispatch") &&
                    scope(doc.from) && (
                      <Button
                        primary
                        disabled={busy || acting}
                        onClick={() => action("dispatch", { id: doc.id })}
                      >
                        Xuất chuyển
                      </Button>
                    )}
                  {["IN_TRANSIT", "PARTIAL"].includes(doc.status) &&
                    can("transfer.receive") &&
                    scope(doc.to) && (
                      <Button
                        primary
                        disabled={busy || acting}
                        onClick={() =>
                          setReceive({
                            type: "receive",
                            id: doc.id,
                            qty: doc.qty - doc.received,
                            max: doc.qty - doc.received,
                            unit: item(doc.item)?.unit,
                          })
                        }
                      >
                        Nhận hàng
                      </Button>
                    )}
                  {["DRAFT", "APPROVED"].includes(doc.status) &&
                    can("transfer.request") &&
                    scope(doc.to) && (
                      <Button
                        disabled={busy || acting}
                        onClick={() => action("cancel", { id: doc.id })}
                      >
                        Hủy yêu cầu
                      </Button>
                    )}
                </div>
              )}
              {receive && (
                <form
                  className="receipt-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (
                      await action(receive.type, {
                        id: receive.id,
                        qty: receive.qty,
                      })
                    )
                      setReceive(null);
                  }}
                >
                  <h3>Ghi nhận lượng nhận thực tế</h3>
                  <label>
                    Lượng nhận lần này ({receive.unit})
                    <input
                      required
                      type="number"
                      min="0.001"
                      max={receive.max}
                      step="0.001"
                      value={receive.qty}
                      onChange={(e) =>
                        setReceive({ ...receive, qty: Number(e.target.value) })
                      }
                    />
                  </label>
                  <p>
                    Còn tối đa {fmt(receive.max)} {receive.unit}. Chỉ lượng nhận
                    thực tế làm tăng tồn kho nhận.
                  </p>
                  <Button primary disabled={busy || acting} type="submit">
                    Xác nhận nhận
                  </Button>
                  <Button type="button" onClick={() => setReceive(null)}>
                    Đóng
                  </Button>
                </form>
              )}
              <h3>Liên kết nghiệp vụ</h3>
              <div className="document-links">
                {doc.sourceJob && (
                  <button
                    onClick={() => {
                      localStorage.setItem(
                        "lona-context-v7",
                        JSON.stringify({
                          kitchen:
                            relatedJobs[0]?.kitchen ||
                            doc.from ||
                            doc.warehouseId,
                          month: (
                            relatedJobs[0]?.date ||
                            doc.dueDate ||
                            doc.due
                          ).slice(0, 7),
                          date: relatedJobs[0]?.date || doc.dueDate || doc.due,
                        }),
                      );
                      location.hash = "schedule";
                      setSelected(null);
                    }}
                  >
                    Kế hoạch D+1 · {relatedJobs[0]?.date || doc.sourceJob}
                  </button>
                )}
                {doc.reference &&
                  (() => {
                    const o = orders.find((x) => x.id === doc.reference),
                      t = transfers.find((x) => x.id === doc.reference),
                      r = receipts.find((x) => x.id === doc.reference),
                      j = data.jobs.find((x) => x.id === doc.reference);
                    return o || t || r ? (
                      <button
                        onClick={() =>
                          setSelected({
                            kind: o ? "purchase" : t ? "transfers" : "receipts",
                            id: doc.reference,
                          })
                        }
                      >
                        Nguồn: {(o || t || r).number}
                      </button>
                    ) : j ? (
                      <button
                        onClick={() => {
                          localStorage.setItem(
                            "lona-context-v7",
                            JSON.stringify({
                              kitchen: j.kitchen,
                              month: j.date.slice(0, 7),
                              date: j.date,
                            }),
                          );
                          location.hash = "schedule";
                          setSelected(null);
                        }}
                      >
                        Kế hoạch {j.date} · {j.kitchen}
                      </button>
                    ) : (
                      <span>Tham chiếu: {doc.reference}</span>
                    );
                  })()}
                {linkedPurchases.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setSelected({ kind: "purchase", id: o.id })}
                  >
                    Đề nghị mua: {o.number}
                  </button>
                ))}
                {linkedIssues.map((i) => (
                  <button
                    key={i.id}
                    onClick={() => setSelected({ kind: "issues", id: i.id })}
                  >
                    Đã cấp bếp: {i.number}
                  </button>
                ))}
                {relatedReceipts.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelected({ kind: "receipts", id: r.id })}
                  >
                    {r.number} · {fmt(r.lines[0].qty)}{" "}
                    {item(r.lines[0].item)?.unit} · {time(r.createdAt)}
                  </button>
                ))}
                {!doc.sourceJob &&
                  !doc.reference &&
                  !relatedReceipts.length && (
                    <p>Phiếu lập trực tiếp, không gắn kế hoạch.</p>
                  )}
              </div>
              {(doc.history?.length > 0 || docMovements.length > 0) && (
                <>
                  <h3>Lịch sử của phiếu</h3>
                  <ul className="document-history">
                    {(doc.history || []).map((h, i) => (
                      <li key={i}>
                        <b>
                          {h.label}
                          {h.qty ? " · " + fmt(h.qty) : ""}
                        </b>
                        <small>
                          {time(h.at)} · {h.actor}
                        </small>
                      </li>
                    ))}
                    {!doc.history?.length &&
                      docMovements.map((l) => (
                        <li key={l.id}>
                          <b>
                            {wh(l.from)} → {wh(l.to)} · {fmt(l.qty)}{" "}
                            {item(l.item)?.unit}
                          </b>
                          <small>
                            {time(l.at)} · {l.actor}
                          </small>
                        </li>
                      ))}
                  </ul>
                </>
              )}
              {selected.kind !== "purchase" && (
                <section className="detail-documents">
                  <h3>Chứng từ</h3>
                  {can("documents.publish") && (
                    <Button
                      disabled={busy || acting}
                      onClick={() =>
                        action("publish", {
                          transferId: doc.id,
                          templateId:
                            selected.kind === "issues"
                              ? "ISSUE"
                              : selected.kind === "receipts"
                                ? "RECEIVE"
                                : "TRANSFER",
                        })
                      }
                    >
                      Phát hành bản in
                    </Button>
                  )}
                  {snapshotDocs.map((d) => (
                    <Button
                      key={d.id}
                      icon="download"
                      disabled={busy || acting || !can("documents.view")}
                      onClick={async () => {
                        setActing(true);
                        try {
                          await (
                            await import("../documents/pdf.js")
                          ).downloadPDF(d.template, d.context);
                        } catch (e) {
                          setLocalError(e.message);
                        } finally {
                          setActing(false);
                        }
                      }}
                    >
                      PDF · v{d.template.version}
                    </Button>
                  ))}
                </section>
              )}
              {(error || localError) && (
                <div className="error" role="alert">
                  {error || localError}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
      {form && (
        <div className="workflow-overlay">
          <section
            className="workflow-form"
            role="dialog"
            aria-modal="true"
            aria-label="Lập phiếu kho"
          >
            <header>
              <div>
                <small>Phiếu mới</small>
                <h2>
                  {form.kind === "purchase"
                    ? "Đề nghị mua hàng"
                    : form.kind === "transfers"
                      ? "Yêu cầu điều chuyển"
                      : "Xuất nguyên liệu cho bếp"}
                </h2>
              </div>
              <button
                aria-label="Đóng form phiếu"
                disabled={busy || acting}
                onClick={() => setForm(null)}
              >
                <Icon name="close" />
              </button>
            </header>
            <form onSubmit={submit}>
              <fieldset disabled={busy || acting} className="workflow-fieldset">
                <div className="formrow">
                  {form.kind === "purchase" ? (
                    <>
                      <label>
                        Kho nhận
                        <select
                          value={form.warehouseId}
                          onChange={(e) =>
                            setForm({ ...form, warehouseId: e.target.value })
                          }
                        >
                          {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Nhà cung cấp
                        <input
                          required
                          maxLength={250}
                          value={form.supplier}
                          onChange={(e) =>
                            setForm({ ...form, supplier: e.target.value })
                          }
                        />
                      </label>
                    </>
                  ) : (
                    <>
                      <label>
                        Kho xuất
                        <select
                          value={form.from}
                          onChange={(e) =>
                            setForm({ ...form, from: e.target.value })
                          }
                        >
                          {(form.kind === "issues" ? warehouses : physical).map(
                            (w) => (
                              <option key={w.id} value={w.id}>
                                {w.name}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                      {form.kind === "transfers" && (
                        <label>
                          Kho nhận
                          <select
                            value={form.to}
                            onChange={(e) =>
                              setForm({ ...form, to: e.target.value })
                            }
                          >
                            {warehouses.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </>
                  )}
                  <label>
                    Ngày cần
                    <input
                      required
                      type="date"
                      value={form.due}
                      onChange={(e) =>
                        setForm({ ...form, due: e.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="formrow">
                  <label>
                    Lý do
                    <input
                      required={form.kind === "issues"}
                      value={form.reason}
                      onChange={(e) =>
                        setForm({ ...form, reason: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Phiếu nguồn (nếu có)
                    <select
                      value={form.reference}
                      onChange={(e) =>
                        setForm({ ...form, reference: e.target.value })
                      }
                    >
                      <option value="">Lập trực tiếp</option>
                      {receipts.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.number} · {wh(r.to)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="import-strip">
                  <div>
                    <b>Nhập nhiều hàng bằng CSV</b>
                    <small>
                      Cột itemId, quantity, unit · dùng đơn vị gốc, không tự quy
                      đổi
                    </small>
                  </div>
                  <Button
                    type="button"
                    icon="download"
                    onClick={() =>
                      saveText(
                        "LONA_mau_hang.csv",
                        "itemId,quantity,unit\n" +
                          data.items
                            .slice(0, 3)
                            .map((i) => i.id + ",1," + i.unit)
                            .join("\n"),
                      )
                    }
                  >
                    Tải mẫu
                  </Button>
                  <label className="file-button">
                    Chọn CSV
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) => importFile(e.target.files?.[0])}
                    />
                  </label>
                </div>
                {validation.length > 0 && (
                  <div className="import-result">
                    <b>
                      {validation.filter((r) => !r.error).length}/
                      {validation.length} dòng hợp lệ
                    </b>
                    {validation.some((r) => r.error) && (
                      <Table
                        heads={["Dòng", "Mã", "Lỗi"]}
                        rows={validation
                          .filter((r) => r.error)
                          .map((r) => [r.row, r.itemId, r.error])}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setValidation([]);
                        setImported(false);
                      }}
                    >
                      Bỏ kết quả import
                    </button>
                  </div>
                )}
                <div className="warehouse-line-head">
                  <span>Nguyên liệu</span>
                  <span>Số lượng</span>
                  <span>Đơn vị</span>
                  <span />
                </div>
                {form.lines.map((l, i) => (
                  <div key={i} className="warehouse-line">
                    <select
                      aria-label={"Hàng dòng " + (i + 1)}
                      value={l.itemId}
                      onChange={(e) =>
                        updateLine(i, {
                          itemId: e.target.value,
                          unit: item(e.target.value).unit,
                        })
                      }
                    >
                      {data.items.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.id} · {x.name}
                        </option>
                      ))}
                    </select>
                    <input
                      required
                      aria-label={"Lượng dòng " + (i + 1)}
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={l.quantity}
                      onChange={(e) =>
                        updateLine(i, { quantity: Number(e.target.value) })
                      }
                    />
                    <span>{l.unit}</span>
                    <button
                      type="button"
                      aria-label={"Xóa dòng " + (i + 1)}
                      disabled={form.lines.length === 1}
                      onClick={() => {
                        setForm({
                          ...form,
                          lines: form.lines.filter((_, j) => j !== i),
                        });
                        setImported(false);
                      }}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  disabled={form.lines.length >= 100}
                  onClick={() => {
                    setForm({
                      ...form,
                      lines: [
                        ...form.lines,
                        {
                          itemId: data.items[0].id,
                          quantity: 1,
                          unit: data.items[0].unit,
                        },
                      ],
                    });
                    setImported(false);
                  }}
                >
                  Thêm hàng
                </Button>
                <p className="form-warning">
                  {form.kind === "purchase"
                    ? "Lập đề nghị chưa tăng tồn. Mỗi lần nhận sẽ tạo phiếu nhập riêng."
                    : form.kind === "transfers"
                      ? "Tạo yêu cầu chưa trừ tồn; duyệt giữ hàng, xuất rồi mới nhận. Mỗi dòng hàng có mã điều chuyển riêng, cùng đợt lập."
                      : "Xác nhận sẽ ghi sổ và giảm tồn khả dụng. Bản demo chưa có phiếu hoàn/đảo."}
                </p>
                {(localError || error) && (
                  <div className="error" role="alert">
                    {localError || error}
                  </div>
                )}
                <div className="form-footer">
                  <Button
                    type="button"
                    disabled={busy || acting}
                    onClick={() => setForm(null)}
                  >
                    Đóng
                  </Button>
                  <Button
                    primary
                    type="submit"
                    disabled={busy || acting || validation.some((r) => r.error)}
                  >
                    {busy || acting
                      ? "Đang ghi…"
                      : form.kind === "issues"
                        ? "Xác nhận xuất kho"
                        : "Lập phiếu"}
                  </Button>
                </div>
              </fieldset>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
