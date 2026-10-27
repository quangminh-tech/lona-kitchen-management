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
export function Recipes({ s, commit, manager, modal, can }) {
  const [q, setQ] = useState(""),
    [group, setGroup] = useState("ALL");
  const recipes = s.dishes.filter(
    (d) =>
      (group === "ALL" || d.group === group) &&
      (d.name + " " + d.id).toLowerCase().includes(q.toLowerCase()),
  );
  function edit(d) {
    const r = s.recipes.find((r) => r.id === d.recipeId);
    modal({
      title: "Định lượng · " + d.name,
      body: (
        <RecipeEditor
          s={s}
          recipe={r}
          dish={d}
          commit={commit}
          canApprove={can("recipes.approve")}
          close={() => modal(null)}
        />
      ),
    });
  }
  function detail(d) {
    const r = s.recipes.find((r) => r.id === d.recipeId);
    modal({
      title: d.name,
      body: (
        <>
          <div className="help">
            Công thức cho {f(r.yieldQuantity)} {units[r.yieldUnit]} · Phiên bản{" "}
            {r.version} · {r.approved ? "Đã duyệt" : "Chưa duyệt"}
          </div>
          <Table
            heads={["Thành phần", "Loại", "Định lượng", "Cơ sở", "Mã liên kết"]}
            rows={r.lines.map((l) => [
              l.kind === "item"
                ? s.items.find((i) => i.id === l.itemId)?.name
                : l.kind === "recipe"
                  ? s.recipes.find((r) => r.id === l.recipeId)?.name
                  : l.name,
              l.kind === "item"
                ? "Nguyên liệu"
                : l.kind === "recipe"
                  ? "Công thức con"
                  : "Phụ trợ",
              f(l.quantity) + " " + (units[l.unit] || l.unit),
              l.basis === "cooked"
                ? "Chín / thu hồi " + l.yieldRate
                : "Sống / đầu vào",
              l.itemId || l.recipeId || "Không mua",
            ])}
          />
        </>
      ),
    });
  }
  return (
    <>
      <Title
        title="Món ăn & định lượng"
        text="Quản lý danh mục món, công thức và nguyên liệu trong cùng một bảng."
      >
        {manager && (
          <Button
            primary
            onClick={() => {
              const id = "MON-" + uuid().slice(0, 6);
              modal({
                title: "Thêm món và công thức",
                body: (
                  <RecipeEditor
                    s={s}
                    dish={{
                      id,
                      name: "Món mới",
                      group: "Món chính",
                      recipeId: "R-" + id,
                      isSubrecipe: false,
                    }}
                    recipe={{
                      id: "R-" + id,
                      dishId: id,
                      name: "Món mới",
                      version: 1,
                      approved: false,
                      yieldQuantity: 1,
                      yieldUnit: "suat",
                      lines: [
                        {
                          id: uuid(),
                          kind: "item",
                          itemId: s.items[0].id,
                          quantity: 1,
                          unit: s.items[0].baseUnit,
                          basis: "raw",
                          yieldRate: 1,
                        },
                      ],
                    }}
                    commit={commit}
                    canApprove={can("recipes.approve")}
                    close={() => modal(null)}
                  />
                ),
              });
            }}
          >
            ＋ Thêm món
          </Button>
        )}
      </Title>
      <div className="toolbar">
        <div className="searchbox">
          <Icon name="search" />
          <input
            aria-label="Tìm món ăn"
            placeholder="Tìm tên hoặc mã món…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          aria-label="Lọc nhóm món"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
        >
          <option value="ALL">Tất cả nhóm món</option>
          {[...new Set(s.dishes.map((d) => d.group))].map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <span className="muted">{recipes.length} món ăn / công thức</span>
      </div>
      <section className="card">
        <Table
          searchable={false}
          heads={[
            "Món ăn / mã",
            "Phân loại",
            "Định lượng chuẩn",
            "Thành phần",
            "Trạng thái",
            "Thao tác",
          ]}
          rows={recipes.map((d) => {
            const r = s.recipes.find((r) => r.id === d.recipeId);
            return [
              <>
                <strong>{d.name}</strong>
                <small>{d.id}</small>
              </>,
              <span className="badge">{d.group}</span>,
              f(r.yieldQuantity) + " " + units[r.yieldUnit],
              r.lines.length + " thành phần",
              <span className={"badge " + (r.approved ? "success" : "warning")}>
                {r.approved ? "Đã duyệt" : "Chờ duyệt"}
              </span>,
              <div className="row-actions">
                <Button icon="eye" onClick={() => detail(d)}>
                  Xem
                </Button>
                {manager && (
                  <>
                    <Button icon="edit" onClick={() => edit(d)}>
                      Sửa
                    </Button>
                    <Button
                      icon="trash"
                      onClick={() =>
                        confirmDelete({
                          s,
                          commit,
                          modal,
                          collection: "dishes",
                          row: d,
                        })
                      }
                    >
                      Xóa
                    </Button>
                  </>
                )}
              </div>,
            ];
          })}
        />
      </section>
    </>
  );
}

export function RecipeEditor({
  s,
  recipe,
  dish,
  commit,
  close,
  canApprove = true,
}) {
  const [r, setR] = useState(clone(recipe)),
    [d, setD] = useState(clone(dish)),
    [error, setError] = useState("");
  function row(i, k, v) {
    setR({
      ...r,
      lines: r.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)),
    });
  }
  async function saveR() {
    try {
      const c = clone(s),
        rr = {
          ...r,
          approved: canApprove ? r.approved : false,
          name: d.name,
          version: (s.recipes.find((x) => x.id === r.id)?.version || 0) + 1,
        };
      c.recipes = [...c.recipes.filter((x) => x.id !== r.id), rr];
      c.dishes = [...c.dishes.filter((x) => x.id !== d.id), d];
      validate(c);
      if (await commit("recipe", { dish: d, recipe: rr })) close();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <div className="formrow">
        <label>
          Tên món
          <input
            value={d.name}
            onChange={(e) => setD({ ...d, name: e.target.value })}
          />
        </label>
        <label>
          Phân loại
          <select
            value={d.group}
            onChange={(e) => setD({ ...d, group: e.target.value })}
          >
            {[
              "Món sáng",
              "Cơm",
              "Món chính",
              "Món phụ",
              "Rau",
              "Canh",
              "Món chay",
              "Tráng miệng",
              "Bán thành phẩm",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Công thức cho
          <input
            type="number"
            min="0.001"
            step="0.001"
            value={r.yieldQuantity}
            onChange={(e) =>
              setR({ ...r, yieldQuantity: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Đơn vị đầu ra
          <select
            value={r.yieldUnit}
            onChange={(e) => {
              setR({ ...r, yieldUnit: e.target.value });
              setD({ ...d, isSubrecipe: e.target.value !== "suat" });
            }}
          >
            {["suat", "kg", "l"].map((u) => (
              <option key={u} value={u}>
                {units[u]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Table
        heads={[
          "Loại",
          "Tên thành phần",
          "Lượng",
          "Đơn vị",
          "Cơ sở / thu hồi",
          "",
        ]}
        rows={r.lines.map((l, i) => [
          <select
            value={l.kind}
            onChange={(e) => row(i, "kind", e.target.value)}
          >
            <option value="item">NVL mua</option>
            <option value="recipe">Bán thành phẩm</option>
            <option value="auxiliary">Phụ trợ</option>
          </select>,
          l.kind === "item" ? (
            <select
              value={l.itemId || ""}
              onChange={(e) => row(i, "itemId", e.target.value)}
            >
              <option value="">Chọn NVL</option>
              {s.items.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          ) : l.kind === "recipe" ? (
            <select
              value={l.recipeId || ""}
              onChange={(e) => row(i, "recipeId", e.target.value)}
            >
              <option value="">Chọn công thức con</option>
              {s.recipes
                .filter((x) => x.id !== r.id)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
          ) : (
            <input
              placeholder="Ví dụ: Nước"
              value={l.name || ""}
              onChange={(e) => row(i, "name", e.target.value)}
            />
          ),
          <input
            type="number"
            min="0.001"
            step="0.001"
            value={l.quantity}
            onChange={(e) => row(i, "quantity", Number(e.target.value))}
          />,
          <input
            className="short"
            value={l.unit}
            list="unit-list"
            onChange={(e) => row(i, "unit", e.target.value)}
          />,
          <div>
            <select
              value={l.basis}
              onChange={(e) => row(i, "basis", e.target.value)}
            >
              <option value="raw">Sống / đầu vào</option>
              <option value="cooked">Chín</option>
            </select>
            {l.basis === "cooked" && (
              <label>
                Tỷ lệ thu hồi
                <input
                  type="number"
                  min="0.001"
                  step="0.01"
                  value={l.yieldRate}
                  onChange={(e) => row(i, "yieldRate", Number(e.target.value))}
                />
              </label>
            )}
          </div>,
          <button
            onClick={() =>
              setR({ ...r, lines: r.lines.filter((_, j) => j !== i) })
            }
          >
            <Icon name="trash" size={15} /> Bỏ
          </button>,
        ])}
      />
      <datalist id="unit-list">
        {Object.keys(units).map((u) => (
          <option key={u}>{u}</option>
        ))}
      </datalist>
      <div className="checks">
        <label>
          <input
            disabled={!canApprove}
            type="checkbox"
            checked={r.approved}
            onChange={(e) => setR({ ...r, approved: e.target.checked })}
          />{" "}
          Đã xác nhận định lượng và đơn vị của công thức này
        </label>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="actions">
        <Button
          onClick={() =>
            setR({
              ...r,
              lines: [
                ...r.lines,
                {
                  id: uuid(),
                  kind: "item",
                  itemId: s.items[0].id,
                  quantity: 1,
                  unit: "g",
                  basis: "raw",
                  yieldRate: 1,
                },
              ],
            })
          }
        >
          ＋ Thêm thành phần
        </Button>
        <Button primary onClick={saveR}>
          Lưu công thức
        </Button>
      </div>
    </>
  );
}
