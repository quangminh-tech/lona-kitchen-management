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
import { Button, Table, Title, Icon } from "../components/Primitives.jsx";
export function Needs({
  s,
  commit,
  manager,
  modal,
  can,
  from,
  to,
  setFrom,
  setTo,
}) {
  const r = analyse(s, from, to),
    [tab, setTab] = useState("totals");
  const exportDetail = () =>
    download(
      "Chi-tiet-NVL.csv",
      csv([
        [
          "ngay",
          "bua",
          "vi_tri",
          "mon",
          "cong_thuc",
          "duong_dan",
          "ma_NVL",
          "NVL",
          "kho",
          "nhu_cau",
          "don_vi",
          "phep_tinh",
        ],
        ...r.details.map((x) => [
          x.date,
          x.meal,
          x.slot,
          x.dish,
          x.recipe,
          x.path,
          x.itemId,
          x.item,
          x.warehouseId,
          x.quantity,
          x.unit,
          x.formula,
        ]),
      ]),
      "text/csv;charset=utf-8",
    );
  function trace(t) {
    modal({
      title: "Nguồn nhu cầu · " + t.item,
      body: (
        <Table
          heads={["Ngày / bữa", "Món", "Công thức / nhánh", "Lượng"]}
          rows={t.sources.map((x) => [
            <>
              {dayLabel(x.date)}
              <small>{x.meal === "SANG" ? "Sáng" : "Chiều"}</small>
            </>,
            <>
              {x.dish}
              <small>
                {x.slot} · {scopes[x.scope]}
              </small>
            </>,
            <>
              {x.recipe}
              <small>{x.formula}</small>
            </>,
            `${f(x.quantity)} ${units[x.unit]}`,
          ])}
        />
      ),
    });
  }
  function receive(o) {
    modal({
      title: "Nhận hàng · " + s.items.find((i) => i.id === o.itemId)?.name,
      body: <Receive o={o} s={s} commit={commit} close={() => modal(null)} />,
    });
  }
  return (
    <>
      <Title
        title="Dự trù & mua hàng"
        text="Tổng nguyên liệu được cộng từ tất cả món, theo đúng số suất từng bữa và công thức con."
      >
        <Button onClick={exportDetail}>Xuất chi tiết</Button>
        <Button
          primary
          disabled={!can("purchase.create") || !r.ready}
          onClick={() => commit("orders", { from, to })}
        >
          Lập đề nghị mua
        </Button>
      </Title>
      <div className="toolbar">
        <label>
          Từ ngày
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Đến ngày
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <div className="segments">
          {[
            ["totals", "Nhu cầu & thiếu mua"],
            ["details", "Chi tiết theo món"],
            ["orders", "Đơn mua / nhận hàng"],
          ].map(([k, t]) => (
            <button
              key={k}
              className={tab === k ? "active" : ""}
              onClick={() => setTab(k)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="summary">
        <div>
          <b>{r.menuCount}</b>
          <span>món trong khoảng ngày</span>
        </div>
        <div>
          <b>{r.totals.length}</b>
          <span>loại NVL cần dùng</span>
        </div>
        <div>
          <b>{r.totals.filter((t) => t.packs > 0).length}</b>
          <span>loại thiếu cần mua</span>
        </div>
        <div>
          <b>
            {can("costs.view")
              ? money(r.totals.reduce((n, t) => n + t.estimatedCost, 0))
              : "—"}
          </b>
          <span>chi phí định mức tham khảo</span>
        </div>
      </div>
      {r.errors.length > 0 && (
        <div className="error">
          <b>Còn {r.errors.length} điểm cần xử lý. Chưa lập mua từ bản này.</b>
          <ul>
            {r.errors.slice(0, 12).map((e, j) => (
              <li key={j}>
                {e.date} · {e.slot}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {tab === "totals" ? (
        <section className="card">
          <Table
            heads={[
              "Nguyên liệu / kho",
              "Cần dùng",
              "Tồn / giữ",
              "Hàng về kịp",
              "Thiếu thực",
              "Đề xuất mua",
              "",
            ]}
            rows={r.totals.map((t) => [
              <>
                <strong>{t.item}</strong>
                <small>
                  {s.warehouses.find((w) => w.id === t.warehouseId)?.name}
                </small>
              </>,
              `${f(t.quantity)} ${units[t.unit]}`,
              <>
                {f(t.stock)}
                <small>
                  Giữ {f(t.reserved)} · An toàn {f(t.safety)}
                </small>
              </>,
              f(t.incoming),
              `${f(t.shortage)} ${units[t.unit]}`,
              <>
                <b>
                  {t.packs} × {t.packName}
                </b>
                <small>
                  {f(t.buyQuantity)} {units[t.unit]}
                </small>
              </>,
              <Button onClick={() => trace(t)}>Xem nguồn</Button>,
            ])}
          />
        </section>
      ) : tab === "details" ? (
        <section className="card">
          <Table
            heads={["Ngày / bữa", "Món", "NVL", "Cách tính", "Nhu cầu"]}
            rows={r.details.map((x) => [
              <>
                {x.date}
                <small>{x.meal === "SANG" ? "Sáng" : "Chiều"}</small>
              </>,
              <>
                {x.dish}
                <small>
                  {x.slot}
                  {x.path.includes(" → ") ? " · qua công thức con" : ""}
                </small>
              </>,
              x.item,
              <small>{x.formula}</small>,
              `${f(x.quantity)} ${units[x.unit]}`,
            ])}
          />
        </section>
      ) : (
        <section className="card">
          <Table
            heads={[
              "Đề nghị",
              "Nguyên liệu",
              "Quy cách / lượng đặt",
              "Đã nhận",
              "Còn thiếu",
              "Ngày cần",
              "",
            ]}
            rows={s.orders.map((o) => [
              o.id,
              s.items.find((i) => i.id === o.itemId)?.name,
              <>
                {o.packs} × {o.packName}
                <small>
                  {f(o.quantity)}{" "}
                  {units[s.items.find((i) => i.id === o.itemId)?.baseUnit]}
                </small>
              </>,
              f(o.received),
              f(o.quantity - o.received),
              o.dueDate,
              <Button
                disabled={!can("stock.receive") || o.received >= o.quantity}
                onClick={() => receive(o)}
              >
                Nhận hàng
              </Button>,
            ])}
          />
        </section>
      )}
      <div className="help">
        Thiếu mua = nhu cầu + tồn an toàn − (tồn − giữ + hàng về kịp). Hàng đến
        sau ngày đầu của khoảng đang xem chưa được trừ; nên lọc theo ngày khi
        đặt hàng tươi. Quy cách được làm tròn lên và giữ lượng dư trong kho.
      </div>
      <section className="card smallcard">
        <h3>Xuất nguyên liệu cho một ngày</h3>
        <p>
          Chỉ trừ tồn khi xác nhận xuất. Đề nghị mua và dự trù không tự làm giảm
          kho.
        </p>
        <div className="actions">
          <label>
            Ngày xuất
            <input id="issueDate" type="date" defaultValue={from} />
          </label>
          <Button
            disabled={!can("stock.issue")}
            onClick={() =>
              commit("issue", {
                date: document.querySelector("#issueDate").value,
              })
            }
          >
            Xác nhận xuất theo ngày
          </Button>
          <span className="muted">
            {s.issuedDates.length} ngày đã xuất · chặn xuất thiếu và xuất trùng
          </span>
        </div>
      </section>
      {r.auxiliary.length > 0 && (
        <details>
          <summary>
            {r.auxiliary.length} dòng phụ trợ (nước…) được giữ riêng, không đưa
            vào mua hàng
          </summary>
          <Table
            heads={["Ngày", "Công thức", "Phụ trợ", "Lượng"]}
            rows={r.auxiliary.map((a) => [
              a.date,
              a.dish,
              a.name,
              `${f(a.quantity)} ${a.unit}`,
            ])}
          />
        </details>
      )}
    </>
  );
}

export function Receive({ o, s, commit, close }) {
  const [q, setQ] = useState(o.quantity - o.received),
    i = s.items.find((i) => i.id === o.itemId);
  return (
    <>
      <p>
        Đặt {o.packs} × {o.packName}. Đã nhận {f(o.received)} / {f(o.quantity)}{" "}
        {units[i.baseUnit]}.
      </p>
      <label>
        Lượng thực nhận đạt chất lượng ({units[i.baseUnit]})
        <input
          type="number"
          min="0.001"
          step="0.001"
          max={o.quantity - o.received}
          value={q}
          onChange={(e) => setQ(Number(e.target.value))}
        />
      </label>
      <p className="muted">
        Chỉ lượng thực nhận được cộng kho. Phần chưa nhận tiếp tục là hàng đang
        về.
      </p>
      <Button
        primary
        onClick={async () => {
          if (await commit("receive", { orderId: o.id, quantity: q })) close();
        }}
      >
        Xác nhận nhận hàng
      </Button>
    </>
  );
}
