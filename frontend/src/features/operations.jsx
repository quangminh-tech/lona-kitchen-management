import { WarehouseHub } from "./warehouse-hub.jsx";
import { WorkflowHome, MenuImport } from "./workflow-home.jsx";
import { workflowPreview } from "../services/workflow-preview.js";
import workflowSeed from "../services/demo-workflow.json";
import { WeeklyMenu } from "./weekly-menu.jsx";
import { MealEditor } from "./menus.jsx";
import React, { useState, useEffect, useRef } from "react";
import { Button, Table, Title } from "../components/Primitives.jsx";
import { request } from "../services/access.js";
import { apiEnabled } from "../data.js";
import { execute, repeatMenu, id } from "../services/operations-engine.js";
import { TemplateEditor, DocumentArchive } from "./documents.jsx";
import { validateTemplate } from "../documents/templates.js";
const status = {
  DRAFT: "Nháp",
  APPROVED: "Đã duyệt",
  IN_TRANSIT: "Đang đi",
  PARTIAL: "Nhận một phần",
  RECEIVED: "Đã nhận đủ",
  CANCELLED: "Đã hủy",
  READY: "Đủ dữ liệu",
  BLOCKED: "Chưa đủ dữ liệu",
};
const number = (n) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(n);
const KEY = "lona-operations-preview-v7";
function savedContext() {
  try {
    return JSON.parse(localStorage.getItem("lona-context-v7") || "{}");
  } catch {
    return {};
  }
}
export function Operations({ page, can, notify, session, s: catalog, modal }) {
  const [view, setView] = useState("board"),
    [planTab, setPlanTab] = useState("D+1");
  const [data, setData] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [kitchen, setKitchen] = useState(
      savedContext().kitchen || (apiEnabled ? "CG" : "B2"),
    ),
    [month, setMonth] = useState(
      savedContext().month || (apiEnabled ? "2026-10" : "2026-11"),
    ),
    [year, setYear] = useState("2026"),
    [period, setPeriod] = useState("month"),
    [date, setDate] = useState(
      savedContext().date ||
        (apiEnabled
          ? new Date().toLocaleDateString("en-CA", {
              timeZone: "Asia/Ho_Chi_Minh",
            })
          : "2026-11-01"),
    ),
    [transfer, setTransfer] = useState({
      from: "TT",
      to: "CG",
      item: "GAO",
      qty: 100,
      due: "2026-10-28",
    }),
    [receive, setReceive] = useState(null),
    [username, setUsername] = useState(""),
    [scopes, setScopes] = useState(["CG"]);
  const gate = useRef(false);
  useEffect(() => {
    localStorage.setItem(
      "lona-context-v7",
      JSON.stringify({ kitchen, month, date }),
    );
  }, [kitchen, month, date]);
  async function load() {
    setBusy(true);
    try {
      setData(
        apiEnabled
          ? await request("/api/operations")
          : JSON.parse(localStorage.getItem(KEY) || "null") ||
              structuredClone(workflowSeed),
      );
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function send(type, payload) {
    if (gate.current) return false;
    gate.current = true;
    setBusy(true);
    try {
      let next;
      if (apiEnabled)
        next = await request("/api/operations", {
          type,
          payload,
          expectedRevision: data.revision,
          requestId: id(),
        });
      else {
        if (["run", "purchase", "productionIssue"].includes(type))
          throw Error(
            "Tính BOM và lập phiếu từ kế hoạch cần chạy bản .NET. Bản HTML có sẵn kết quả mẫu để xem và thử các phiếu kho.",
          );
        next = structuredClone(data);
        const workflowResult = workflowPreview(next, type, payload);
        if (workflowResult) next = workflowResult;
        else if (type === "repeat") next = repeatMenu(next, payload);
        else if (type === "menus") {
          next.menus = next.menus.map(
            (m) => payload.rows.find((r) => r.id === m.id) || m,
          );
          next.revision++;
        } else if (type === "template") {
          validateTemplate(payload.template);
          next.templates = next.templates.map((t) =>
            t.id === payload.template.id
              ? { ...payload.template, version: t.version + 1 }
              : t,
          );
          next.revision++;
        } else if (type === "company") {
          next.company = payload;
          next.revision++;
        } else if (type === "schedule") {
          next.schedule = payload;
          next.revision++;
        } else if (type === "scopes") {
          next.scopes[payload.username] = payload.warehouseIds;
          next.revision++;
        } else if (type === "productionIssue")
          throw Error(
            "Xuất sản xuất cần máy chủ tính lại BOM và kiểm tra tồn.",
          );
        else
          next = execute(next, {
            type,
            payload,
            revision: next.revision,
            requestId: id(),
          });
        if (["approve", "dispatch", "receive", "cancel"].includes(type)) {
          const t = next.transfers.find((t) => t.id === payload.id);
          if (t) {
            t.history ||= [];
            t.history.push({
              label: {
                approve: "Duyệt giữ hàng",
                dispatch: "Xuất chuyển",
                receive: "Nhận hàng",
                cancel: "Hủy phiếu",
              }[type],
              at: new Date().toISOString(),
              actor: "preview",
              qty: type === "receive" ? payload.qty : 0,
            });
          }
        }
        localStorage.setItem(KEY, JSON.stringify(next));
      }
      setData(next);
      setError("");
      notify("Đã lưu.");
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
      gate.current = false;
    }
  }
  useEffect(() => {
    if (data?.allowedWarehouses && !data.allowedWarehouses.includes(kitchen)) {
      const next = data.allowedWarehouses.find((w) => ["CG", "B2"].includes(w));
      if (next) setKitchen(next);
    }
  }, [data?.revision, kitchen]);
  if (!data)
    return (
      <section className="card smallcard">
        <p>{error || "Đang tải kế hoạch và kho…"}</p>
        <Button onClick={load}>Thử lại</Button>
      </section>
    );
  const wh = (id) => data.warehouses.find((w) => w.id === id)?.name || id,
    item = (id) => data.items.find((i) => i.id === id),
    allowed = data.allowedWarehouses || [
      "TT",
      "CG",
      "B2",
      "TRANSIT",
      "PRODUCTION",
    ];
  const menus = data.menus.filter(
    (m) =>
      m.kitchen === kitchen &&
      (period === "year" ? m.date.startsWith(year) : m.date.startsWith(month)),
  );
  function editMeal(m) {
    const rows = (m.rows || []).map((r) => ({
      ...r,
      date: m.date,
      meal: m.meal,
    }));
    const plan = {
      id: m.id,
      date: m.date,
      meal: m.meal,
      normal: m.normal,
      vegetarian: m.vegetarian,
      replacement: m.replacement || 0,
      replacementIncluded: m.replacementIncluded !== false,
      approved: m.approved,
    };
    modal({
      title: m.date + " · " + (m.meal === "SANG" ? "Bữa sáng" : "Bữa chiều"),
      body: (
        <MealEditor
          s={{ ...catalog, menus: rows, plans: [plan] }}
          date={m.date}
          meal={m.meal}
          editable={can("menus.edit")}
          canApprove={can("menus.approve")}
          close={() => modal(null)}
          commit={async (type, p) =>
            send("menus", {
              kitchen,
              rows: [{ ...m, ...p.plan, rows: p.rows }],
            })
          }
        />
      ),
    });
  }
  function dates() {
    if (period === "year")
      return { from: year + "-01-01", to: year + "-12-31" };
    const d = new Date(
      Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
    );
    return { from: month + "-01", to: d.toISOString().slice(0, 10) };
  }
  if (["stock", "purchase", "transfers", "issues", "ledger"].includes(page))
    return (
      <WarehouseHub
        data={data}
        send={send}
        can={can}
        busy={busy}
        error={error}
        reload={load}
        page={page}
        notify={notify}
      />
    );
  return (
    <div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {busy && (
        <div className="inline-progress" role="status">
          <span className="spinner" />
          Đang lưu/tải dữ liệu…
        </div>
      )}
      <div className="toolbar operations-context">
        {!["templates", "documents", "settings"].includes(page) && (
          <label>
            Bếp / nhánh
            <select
              value={kitchen}
              onChange={(e) => setKitchen(e.target.value)}
            >
              {data.warehouses
                .filter(
                  (w) => ["CG", "B2"].includes(w.id) && allowed.includes(w.id),
                )
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        {page !== "templates" && (
          <Button disabled={busy} onClick={load}>
            Tải lại dữ liệu
          </Button>
        )}
        {!apiEnabled && (
          <span className="badge warning">
            Xem thử cục bộ. Lịch nền và phát hành cần server.
          </span>
        )}
      </div>
      {page === "overview" ? (
        <WorkflowHome
          data={data}
          send={send}
          busy={busy}
          can={can}
          apiEnabled={apiEnabled}
        />
      ) : page === "templates" ? (
        <TemplateEditor data={data} send={send} can={can} notify={notify} />
      ) : page === "documents" ? (
        <DocumentArchive data={data} send={send} can={can} notify={notify} />
      ) : page === "calendar" ? (
        <>
          <Title
            title="Thực đơn"
            text="Xem theo tuần, sửa từng bữa và chốt số suất trước khi lập kế hoạch."
          />
          <MenuImport
            catalog={catalog}
            kitchen={kitchen}
            send={send}
            busy={busy}
            can={can}
          />
          <div className="toolbar">
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="month">Tháng</option>
              <option value="year">Năm</option>
            </select>
            {period === "month" ? (
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            ) : (
              <input
                type="number"
                min="2026"
                max="2040"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            )}
            <Button
              disabled={busy || !can("menus.edit")}
              primary
              onClick={() => send("repeat", { kitchen, ...dates() })}
            >
              Tạo các bữa còn thiếu
            </Button>
            <Button
              disabled={busy || !menus.length || !can("menus.approve")}
              onClick={() => {
                if (
                  confirm(
                    `Chốt ${menus.length} bữa trong ${period === "year" ? "năm " + year : "tháng " + month} của ${wh(kitchen)}? Phạm vi này gồm cả các tuần khác trong kỳ.`,
                  )
                )
                  send("menus", {
                    kitchen,
                    rows: menus.map((m) => ({ ...m, approved: true })),
                  });
              }}
            >
              Chốt cả kỳ đang chọn
            </Button>
          </div>
          <div
            className="menu-view-switch"
            role="group"
            aria-label="Chế độ xem thực đơn"
          >
            <button
              className={view === "board" ? "active" : ""}
              aria-pressed={view === "board"}
              onClick={() => setView("board")}
            >
              Bảng tuần
            </button>
            <button
              className={view === "list" ? "active" : ""}
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              Danh sách
            </button>
            <span>
              Quản lý tháng / năm ở trên · Xem chi tiết từng tuần ở dưới
            </span>
          </div>
          {view === "board" ? (
            <WeeklyMenu
              menus={data.menus.filter((m) => m.kitchen === kitchen)}
              catalog={catalog}
              period={period}
              month={month}
              year={year}
              kitchenName={wh(kitchen)}
              canEdit={can("menus.edit")}
              busy={busy}
              onEdit={editMeal}
            />
          ) : (
            <Table
              heads={["Ngày", "Bữa", "Món", "Số suất", "Trạng thái", ""]}
              rows={menus.map((m) => [
                m.date,
                m.meal === "SANG" ? "Sáng" : "Chiều",
                <span className="menu-wrap">{m.dishes.join(" · ")}</span>,
                m.normal + m.vegetarian,
                <span
                  className={"badge " + (m.approved ? "success" : "warning")}
                >
                  {m.approved ? "Đã chốt" : "Nháp"}
                </span>,
                <Button
                  disabled={!can("menus.edit") || busy}
                  onClick={() => editMeal(m)}
                >
                  Sửa bữa
                </Button>,
              ])}
            />
          )}
        </>
      ) : page === "schedule" ? (
        <>
          <Title
            title="Kế hoạch nấu & lịch xử lý"
            text="Server tính đầy đủ BOM từ công thức; lịch tự động chỉ tạo kế hoạch nháp, không tự xuất kho."
          />
          {!apiEnabled && (
            <div className="help">
              Bản HTML có sẵn kế hoạch mẫu. Chạy bản .NET để tính lại BOM, lập
              mua hoặc xuất theo kế hoạch.
            </div>
          )}
          <div className="toolbar">
            <label>
              Mốc D
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <Button
              primary
              disabled={busy || !apiEnabled || !can("planning.run")}
              onClick={() => send("run", { kitchen, date })}
            >
              Tính D+1/D+2/D+3/tuần/tháng
            </Button>
          </div>
          {can("planning.run") &&
            ["admin", "manager"].includes(session.user.role) && (
              <details className="card smallcard">
                <summary>Cấu hình lịch tự động</summary>
                <div className="checks">
                  <label>
                    <input
                      type="checkbox"
                      checked={data.schedule.enabled}
                      onChange={(e) =>
                        send("schedule", {
                          ...data.schedule,
                          enabled: e.target.checked,
                        })
                      }
                    />
                    Bật chạy hằng ngày trên server
                  </label>
                </div>
                <div className="toolbar">
                  <label>
                    Giờ
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={data.schedule.hour}
                      onChange={(e) =>
                        setData({
                          ...data,
                          schedule: {
                            ...data.schedule,
                            hour: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    Phút
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={data.schedule.minute}
                      onChange={(e) =>
                        setData({
                          ...data,
                          schedule: {
                            ...data.schedule,
                            minute: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                  <Button
                    disabled={busy}
                    onClick={() => send("schedule", data.schedule)}
                  >
                    Lưu lịch
                  </Button>
                  <span className="muted">
                    Asia/Ho_Chi_Minh · tiến trình .NET phải đang chạy
                  </span>
                </div>
              </details>
            )}
          <div className="section-tabs">
            {["D+1", "D+2", "D+3", "7 ngày", "Tháng sau"].map((tab) => (
              <button
                key={tab}
                className={planTab === tab ? "active" : ""}
                onClick={() => setPlanTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <Table
            heads={["Mốc D / bếp", "Khoảng", "Bữa đã chốt", "Kết quả", ""]}
            rows={data.jobs
              .filter((j) => j.kitchen === kitchen && j.date === date)
              .slice(0, 1)
              .flatMap((j) =>
                j.snapshots
                  .filter((r) => r.key === planTab)
                  .map((r) => [
                    j.date + " / " + j.kitchen,
                    r.key + " " + r.from + " → " + r.to,
                    r.approved + " / " + r.expected,
                    <span
                      className={
                        "badge " +
                        (r.status === "READY" ? "success" : "warning")
                      }
                    >
                      {j.isCurrent === false
                        ? "Cần tính lại"
                        : status[r.status]}
                    </span>,
                    <div className="row-actions">
                      <Button onClick={() => setReceive({ report: r })}>
                        Xem NVL
                      </Button>
                      {r.key === "D+1" &&
                        r.status === "READY" &&
                        apiEnabled &&
                        j.isCurrent !== false &&
                        can("purchase.create") && (
                          <Button
                            disabled={busy}
                            onClick={async () => {
                              if (
                                await send("purchase", {
                                  kitchen: j.kitchen,
                                  jobId: j.id,
                                })
                              )
                                location.hash = "purchase";
                            }}
                          >
                            Lập đề nghị mua D+1
                          </Button>
                        )}
                      {r.key === "D+1" &&
                        r.status === "READY" &&
                        apiEnabled &&
                        j.isCurrent !== false &&
                        can("stock.issue") && (
                          <Button
                            disabled={busy}
                            onClick={() => {
                              if (
                                confirm(
                                  "Xác nhận xuất đủ toàn bộ nguyên liệu cho ngày " +
                                    r.from +
                                    "?",
                                )
                              )
                                send("productionIssue", {
                                  kitchen: j.kitchen,
                                  jobId: j.id,
                                });
                            }}
                          >
                            Xuất sản xuất
                          </Button>
                        )}
                    </div>,
                  ]),
              )}
          />
          {receive?.report && (
            <section className="card smallcard">
              <h3>
                {receive.report.key} · {receive.report.from}
              </h3>
              <Table
                heads={[
                  "Mã / nguyên liệu",
                  "Cần dùng",
                  "ĐVT",
                  "Thiếu",
                  "Đề xuất mua",
                ]}
                rows={(receive.report.totals || []).map((t) => [
                  t.itemId + " / " + t.item,
                  number(t.quantity),
                  t.unit,
                  number(t.shortage),
                  number(t.buyQuantity),
                ])}
              />
              {receive.report.status !== "READY" && (
                <div className="error">
                  Thiếu bữa/chưa chốt suất hoặc công thức chưa hợp lệ.
                </div>
              )}
              <Button onClick={() => setReceive(null)}>Đóng chi tiết</Button>
            </section>
          )}
        </>
      ) : (
        <>
          <Title
            title="Thiết lập chứng từ & phạm vi"
            text="Thông tin công ty dùng làm biến mẫu in; phạm vi kho được kiểm tra ở server."
          />
          <section className="card smallcard">
            <div className="formrow">
              {[
                ["name", "Tên công ty"],
                ["address", "Địa chỉ"],
                ["taxCode", "Mã số thuế"],
              ].map(([k, label]) => (
                <label key={k}>
                  {label}
                  <input
                    value={data.company[k]}
                    disabled={!can("templates.edit")}
                    onChange={(e) =>
                      setData({
                        ...data,
                        company: { ...data.company, [k]: e.target.value },
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <Button
              disabled={busy || !can("templates.edit")}
              primary
              onClick={() => send("company", data.company)}
            >
              Lưu thông tin công ty
            </Button>
          </section>
          {can("roles.manage") && (
            <section className="card smallcard">
              <h3>Phạm vi kho của tài khoản</h3>
              <label>
                Tên đăng nhập
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </label>
              <div className="checks">
                {data.warehouses
                  .filter((w) => !["TRANSIT", "PRODUCTION"].includes(w.id))
                  .map((w) => (
                    <label key={w.id}>
                      <input
                        type="checkbox"
                        checked={scopes.includes(w.id)}
                        onChange={(e) =>
                          setScopes(
                            e.target.checked
                              ? [...scopes, w.id]
                              : scopes.filter((x) => x !== w.id),
                          )
                        }
                      />
                      {w.name}
                    </label>
                  ))}
              </div>
              <Button
                disabled={!username || busy}
                onClick={() =>
                  send("scopes", { username, warehouseIds: scopes })
                }
              >
                Lưu phạm vi kho
              </Button>
              <p>
                Admin và quản lý có toàn bộ kho. Tài khoản khác mặc định chỉ CG
                nếu chưa cấu hình. Người nhận CG không được xuất TT.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
