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
import { confirmDelete } from "../components/DeleteDialog.jsx";
export function Items({ s, commit, manager, modal, can }) {
  const [search, setSearch] = useState(""),
    [warehouse, setWarehouse] = useState("ALL");
  const filtered = s.items.filter(
    (i) =>
      (warehouse === "ALL" || i.warehouseId === warehouse) &&
      (i.name + " " + i.id + " " + i.category)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  function edit(i) {
    modal({
      title: "Nguyên liệu & quy cách · " + i.name,
      body: (
        <ItemEditor
          s={s}
          item={i}
          commit={commit}
          can={(p) => (p === "stock.opening" ? false : can(p))}
          close={() => modal(null)}
        />
      ),
    });
  }
  return (
    <>
      <Title
        title="Danh mục nguyên liệu"
        text="Phân loại mặt hàng riêng với kho bảo quản. Mọi định lượng quy về cùng đơn vị kho trước khi tính mua."
      >
        {manager && (
          <Button
            primary
            onClick={() =>
              edit({
                id: "NVL-" + uuid().slice(0, 6),
                name: "Nguyên liệu mới",
                category: "Đồ khô",
                baseUnit: "kg",
                warehouseId: s.warehouses[0].id,
                stock: 0,
                reserved: 0,
                safety: 0,
                unitCost: 0,
                conversions: { kg: 1, g: 0.001 },
                packName: "túi 1 kg",
                packQuantity: 1,
                supplier: "",
                bin: "",
                storageNote: "",
              })
            }
          >
            ＋ Thêm nguyên liệu
          </Button>
        )}
      </Title>
      <div className="warehouse-grid">
        {s.warehouses.map((w) => (
          <article className="card" key={w.id}>
            <h3>{w.name}</h3>
            <p>{w.purpose}</p>
            <small>
              {s.items.filter((i) => i.warehouseId === w.id).length} mặt hàng ·{" "}
              {w.location}
            </small>
          </article>
        ))}
      </div>
      <div className="toolbar">
        <input
          aria-label="Tìm nguyên liệu"
          placeholder="Tìm tên, mã hoặc nhóm hàng…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Lọc kho"
          value={warehouse}
          onChange={(e) => setWarehouse(e.target.value)}
        >
          <option value="ALL">Tất cả kho</option>
          {s.warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <Button
          onClick={() =>
            download(
              "Danh-muc-NVL.csv",
              csv([
                [
                  "ma",
                  "ten",
                  "nhom",
                  "kho",
                  "don_vi_kho",
                  "ton",
                  "ton_an_toan",
                  "quy_cach",
                  "luong_mot_quy_cach",
                ],
                ...s.items.map((i) => [
                  i.id,
                  i.name,
                  i.category,
                  i.warehouseId,
                  i.baseUnit,
                  0,
                  i.safety,
                  i.packName,
                  i.packQuantity,
                ]),
              ]),
              "text/csv;charset=utf-8",
            )
          }
        >
          Xuất danh mục
        </Button>
      </div>
      <section className="card">
        <Table
          searchable={false}
          heads={[
            "Mã / tên hàng",
            "Nhóm / vị trí",
            "Tồn kho",
            "Quy cách mua",
            "Quy đổi định lượng",
            "",
          ]}
          rows={filtered.map((i) => [
            <>
              <strong>{i.name}</strong>
              <small>{i.id}</small>
            </>,
            <>
              {i.category}
              <small>
                {s.warehouses.find((w) => w.id === i.warehouseId)?.name} /{" "}
                {i.bin}
              </small>
            </>,
            <>
              <small>Xem Điều chuyển & tồn kho</small>
            </>,
            <>
              {i.packName}
              <small>
                1 quy cách = {f(i.packQuantity)} {units[i.baseUnit]}
              </small>
            </>,
            Object.entries(i.conversions).map(([u, q]) => (
              <small key={u}>
                1 {units[u] || u} = {f(q)} {units[i.baseUnit]}
              </small>
            )),
            manager ? (
              <div className="row-actions">
                <Button icon="edit" onClick={() => edit(i)}>
                  Sửa
                </Button>
                <Button
                  icon="trash"
                  onClick={() =>
                    confirmDelete({
                      s,
                      commit,
                      modal,
                      collection: "items",
                      row: i,
                    })
                  }
                >
                  Xóa
                </Button>
              </div>
            ) : (
              ""
            ),
          ])}
        />
      </section>
      <div className="help">
        Ví dụ: công thức dùng 73g gạo; kho lưu kg; mua theo bao 25kg. Với trứng,
        quả và kg không tự đổi cho nhau nếu chưa có trọng lượng/quả được xác
        nhận.
      </div>
    </>
  );
}

export function ItemEditor({ s, item, commit, close, can }) {
  const [i, setI] = useState(clone(item)),
    [conv, setConv] = useState(
      Object.entries(item.conversions).map(([unit, factor]) => ({
        unit,
        factor,
      })),
    ),
    [error, setError] = useState("");
  function field(k, v) {
    setI({ ...i, [k]: v });
  }
  async function submit() {
    try {
      const conversions = Object.fromEntries(
        conv.map((x) => [x.unit, Number(x.factor)]),
      );
      conversions[i.baseUnit] = 1;
      const val = { ...i, conversions };
      const rows = [...s.items.filter((x) => x.id !== i.id), val];
      const c = clone(s);
      c.items = rows;
      validate(c);
      if (await commit("replace", { collection: "items", rows })) close();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <div className="formrow">
        <label>
          Mã hàng
          <input value={i.id} readOnly />
        </label>
        <label>
          Tên nguyên liệu
          <input
            value={i.name}
            onChange={(e) => field("name", e.target.value)}
          />
        </label>
        <label>
          Nhóm hàng
          <input
            value={i.category}
            onChange={(e) => field("category", e.target.value)}
          />
        </label>
        <label>
          Nhóm bảo quản
          <select
            value={i.warehouseId}
            onChange={(e) => field("warehouseId", e.target.value)}
          >
            {s.warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Đơn vị kho
          <select
            value={i.baseUnit}
            onChange={(e) => {
              field("baseUnit", e.target.value);
              setConv([{ unit: e.target.value, factor: 1 }]);
            }}
          >
            {["kg", "l", "qua", "hop", "cai"].map((u) => (
              <option key={u} value={u}>
                {units[u]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Vị trí / kệ
          <input value={i.bin} onChange={(e) => field("bin", e.target.value)} />
        </label>
        {[
          ["stock", "Tồn hiện tại"],
          ["reserved", "Đã giữ cho việc khác"],
          ["safety", "Tồn an toàn"],
          ["unitCost", "Giá tham chiếu / đơn vị kho"],
        ].map(([k, t]) => (
          <label key={k}>
            {t}
            <input
              disabled={
                k === "unitCost"
                  ? !can("costs.edit")
                  : k === "stock"
                    ? !can("stock.opening")
                    : false
              }
              type="number"
              min="0"
              step="0.001"
              value={i[k]}
              onChange={(e) => field(k, Number(e.target.value))}
            />
          </label>
        ))}
        <label>
          Tên quy cách mua
          <input
            value={i.packName}
            onChange={(e) => field("packName", e.target.value)}
          />
        </label>
        <label>
          1 quy cách bằng bao nhiêu {units[i.baseUnit]}?
          <input
            type="number"
            min="0.001"
            step="0.001"
            value={i.packQuantity}
            onChange={(e) => field("packQuantity", Number(e.target.value))}
          />
        </label>
        <label>
          Nhà cung cấp
          <input
            value={i.supplier}
            onChange={(e) => field("supplier", e.target.value)}
          />
        </label>
        <label>
          Ghi chú bảo quản
          <input
            value={i.storageNote}
            onChange={(e) => field("storageNote", e.target.value)}
          />
        </label>
      </div>
      <h3>Quy đổi đơn vị dùng trong định mức</h3>
      <Table
        heads={["Một đơn vị", "Bằng số lượng", "Đơn vị kho", ""]}
        rows={conv.map((c, j) => [
          <input
            value={c.unit}
            onChange={(e) =>
              setConv(
                conv.map((x, k) =>
                  j === k ? { ...x, unit: e.target.value } : x,
                ),
              )
            }
          />,
          <input
            type="number"
            step="0.000001"
            min="0.000001"
            value={c.factor}
            onChange={(e) =>
              setConv(
                conv.map((x, k) =>
                  j === k ? { ...x, factor: Number(e.target.value) } : x,
                ),
              )
            }
          />,
          units[i.baseUnit],
          <button onClick={() => setConv(conv.filter((_, k) => k !== j))}>
            <Icon name="trash" size={15} /> Bỏ
          </button>,
        ])}
      />
      {error && <div className="error">{error}</div>}
      <div className="actions">
        <Button onClick={() => setConv([...conv, { unit: "", factor: 1 }])}>
          ＋ Thêm đơn vị
        </Button>
        <Button primary onClick={submit}>
          Lưu nguyên liệu
        </Button>
      </div>
      <p className="muted">
        Nếu đã có phát sinh kho, bản demo khóa sửa trực tiếp tồn, đơn vị và kho.
        Chức năng kiểm kê cần bổ sung ở bản chính thức. Bản demo sẽ chặn thay
        đổi gây lệch lịch sử.
      </p>
    </>
  );
}
