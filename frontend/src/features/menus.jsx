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
export function Week({ s, commit, manager, modal, can }) {
  const [selectedDay, setSelectedDay] = useState(days[0]),
    [layout, setLayout] = useState("day");
  const [meal, setMeal] = useState("ALL"),
    [edit, setEdit] = useState(false),
    [draft, setDraft] = useState(() => clone(s.menus));
  function start() {
    setDraft(clone(s.menus));
    setEdit(true);
  }
  function dishName(id) {
    return s.dishes.find((d) => d.id === id)?.name || id;
  }
  function showMeal(date, m) {
    const plan = s.plans.find((p) => p.date === date && p.meal === m);
    modal({
      title: dayLabel(date) + " · " + (m === "SANG" ? "Bữa sáng" : "Bữa chiều"),
      body: (
        <MealEditor
          s={s}
          date={date}
          meal={m}
          commit={commit}
          close={() => modal(null)}
          editable={can("menus.edit")}
          canApprove={can("menus.approve")}
        />
      ),
    });
  }
  function bulk() {
    modal({
      title: "Thêm nhiều món vào nhiều bữa",
      body: <BulkMenu s={s} commit={commit} close={() => modal(null)} />,
    });
  }
  const exportKeys = [
    "Ngày",
    "Bữa",
    "Vị trí món",
    "Tên món",
    "Nhóm suất",
    "Số suất riêng",
  ];
  const businessRow = (m) => [
    m.date,
    m.meal === "SANG" ? "Sáng" : "Chiều",
    dishName(m.dishId) ? m.slot : m.slot,
    dishName(m.dishId),
    scopes[m.scope],
    m.fixedServings,
  ];
  return (
    <>
      <Title
        title="Thực đơn tuần"
        text="7 ngày · 2 bữa mỗi ngày · Mỗi bữa có nhiều món và định lượng riêng."
      >
        <Button
          onClick={() =>
            download(
              "Thuc-don-tuan.csv",
              csv([exportKeys, ...s.menus.map(businessRow)]),
              "text/csv;charset=utf-8",
            )
          }
        >
          Xuất thực đơn
        </Button>
        {manager && (
          <>
            <Button
              onClick={() =>
                modal({
                  title: "Nhập thực đơn hàng loạt",
                  body: (
                    <ImportMenu
                      s={s}
                      commit={commit}
                      close={() => modal(null)}
                    />
                  ),
                })
              }
            >
              Nhập thực đơn
            </Button>
            <Button
              onClick={() =>
                modal({
                  title: "Sao chép một bữa cho nhiều ngày",
                  body: (
                    <CopyMeal s={s} commit={commit} close={() => modal(null)} />
                  ),
                })
              }
            >
              Sao chép bữa
            </Button>
            <Button primary onClick={bulk}>
              Thêm nhiều món
            </Button>
          </>
        )}
      </Title>
      <div className="summary">
        <div>
          <b>7</b>
          <span>ngày phục vụ</span>
        </div>
        <div>
          <b>14</b>
          <span>bữa sáng & chiều</span>
        </div>
        <div>
          <b>{s.menus.length}</b>
          <span>dòng món trong tuần</span>
        </div>
        <div>
          <b>{s.items.length}</b>
          <span>nguyên liệu đã gắn mã kho</span>
        </div>
      </div>
      <div className="toolbar">
        <div className="segments">
          {[
            ["ALL", "Cả ngày"],
            ["SANG", "Bữa sáng"],
            ["CHIEU", "Bữa chiều"],
          ].map(([k, t]) => (
            <button
              key={k}
              className={meal === k ? "active" : ""}
              onClick={() => setMeal(k)}
            >
              {t}
            </button>
          ))}
        </div>
        <span className="muted">
          Chọn một bữa để thêm, sửa món hoặc số suất.
        </span>
      </div>
      <div className="day-switch">
        <div className="date-tabs">
          {days.map((d) => (
            <button
              className={selectedDay === d ? "active" : ""}
              onClick={() => {
                setSelectedDay(d);
                setLayout("day");
              }}
              key={d}
            >
              <span>{dayLabel(d).split(" ").slice(0, -1).join(" ")}</span>
              <b>
                {d.slice(8)}/{d.slice(5, 7)}
              </b>
            </button>
          ))}
        </div>
        <button
          className={layout === "week" ? "active" : ""}
          onClick={() => setLayout(layout === "week" ? "day" : "week")}
        >
          <Icon name="calendar" />{" "}
          {layout === "week" ? "Xem từng ngày" : "Xem cả tuần"}
        </button>
      </div>
      <div className={layout === "week" ? "week-grid" : "day-focus"}>
        {(layout === "week" ? days : [selectedDay]).map((date) => (
          <section className="day" key={date}>
            <header>
              <strong>{dayLabel(date)}</strong>
              <small>
                {s.issuedDates.includes(date) ? "Đã xuất kho" : "Kế hoạch mẫu"}
              </small>
            </header>
            {["SANG", "CHIEU"]
              .filter((m) => meal === "ALL" || meal === m)
              .map((m) => {
                const p = s.plans.find((p) => p.date === date && p.meal === m),
                  rows = s.menus.filter((r) => r.date === date && r.meal === m);
                return (
                  <article className="meal" key={m}>
                    <div className="meal-head">
                      <h3>{m === "SANG" ? "Bữa sáng" : "Bữa chiều"}</h3>
                      <button onClick={() => showMeal(date, m)}>
                        <Icon name={manager ? "edit" : "eye"} size={14} />
                        {manager ? "Sửa bữa" : "Xem bữa"}
                      </button>
                    </div>
                    <div className="portion">
                      {p
                        ? `${p.normal} thường${p.vegetarian ? " · " + p.vegetarian + " chay" : ""}${p.replacement ? " · " + p.replacement + " thay thế" : ""}`
                        : "Chưa báo suất"}
                    </div>
                    {rows.map((r) => (
                      <div className="dish-line" key={r.id}>
                        <span className="slot">{r.slot}</span>
                        <strong>{dishName(r.dishId)}</strong>
                        {["vegetarian", "replacement"].includes(r.scope) && (
                          <small className="tag">{scopes[r.scope]}</small>
                        )}
                      </div>
                    ))}
                    {!rows.length && <p className="empty">Chưa có món.</p>}
                  </article>
                );
              })}
          </section>
        ))}
      </div>
      <div className="help">
        Số suất được nhập theo bữa; các món cùng bữa sử dụng đúng nhóm suất.
        Không cộng số suất của từng món thành số người ăn.
      </div>
    </>
  );
}
export function MealEditor({
  s,
  date,
  meal,
  commit,
  close,
  editable,
  canApprove,
}) {
  const [rows, setRows] = useState(() =>
      clone(s.menus.filter((m) => m.date === date && m.meal === meal)),
    ),
    [plan, setPlan] = useState(() =>
      clone(
        s.plans.find((p) => p.date === date && p.meal === meal) || {
          id: uuid(),
          date,
          meal,
          normal: 0,
          vegetarian: 0,
          replacement: 0,
          replacementIncluded: true,
          approved: false,
        },
      ),
    );
  const choices = s.dishes.filter((d) => !d.isSubrecipe);
  function update(i, k, v) {
    setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  }
  async function submit() {
    try {
      const candidate = clone(s);
      candidate.menus = [
        ...s.menus.filter((m) => !(m.date === date && m.meal === meal)),
        ...rows,
      ];
      candidate.plans = [
        ...s.plans.filter((p) => !(p.date === date && p.meal === meal)),
        plan,
      ];
      validate(candidate);
      if (await commit("meal", { date, meal, rows, plan })) close();
    } catch (e) {
      alert(e.message);
    }
  }
  return (
    <>
      <div className="formrow">
        {[
          ["normal", "Suất thường"],
          ["vegetarian", "Suất chay"],
          ["replacement", "Suất thay thế"],
        ].map(([k, t]) => (
          <label key={k}>
            {t}
            <input
              disabled={!editable}
              type="number"
              min="0"
              step="1"
              value={plan[k]}
              onChange={(e) =>
                setPlan({
                  ...plan,
                  [k]: Number(e.target.value),
                  approved: canApprove ? plan.approved : false,
                })
              }
            />
          </label>
        ))}
      </div>
      <div className="checks">
        <label>
          <input
            disabled={!editable}
            type="checkbox"
            checked={plan.replacementIncluded}
            onChange={(e) =>
              setPlan({ ...plan, replacementIncluded: e.target.checked })
            }
          />{" "}
          Suất thường đã bao gồm suất thay thế
        </label>
        <label>
          <input
            disabled={!editable || !canApprove}
            type="checkbox"
            checked={plan.approved}
            onChange={(e) => setPlan({ ...plan, approved: e.target.checked })}
          />{" "}
          Đã chốt số suất bữa này
        </label>
      </div>
      <Table
        heads={["Vị trí món", "Món ăn", "Dùng số suất", "Áp dụng", ""]}
        rows={rows.map((r, i) => [
          <input
            disabled={!editable}
            value={r.slot}
            onChange={(e) => update(i, "slot", e.target.value)}
          />,
          <select
            disabled={!editable}
            value={r.dishId}
            onChange={(e) => {
              const d = choices.find((d) => d.id === e.target.value);
              setRows(
                rows.map((x, j) =>
                  j === i ? { ...x, dishId: d.id, recipeId: d.recipeId } : x,
                ),
              );
            }}
          >
            {choices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>,
          <select
            disabled={!editable}
            value={r.scope}
            onChange={(e) => update(i, "scope", e.target.value)}
          >
            {Object.entries(scopes).map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </select>,
          r.scope === "fixed" ? (
            <input
              disabled={!editable}
              type="number"
              min="0"
              value={r.fixedServings}
              onChange={(e) =>
                update(i, "fixedServings", Number(e.target.value))
              }
            />
          ) : (
            f(servings(plan, r.scope, r.fixedServings)) + " suất"
          ),
          editable ? (
            <button onClick={() => setRows(rows.filter((_, j) => j !== i))}>
              <Icon name="trash" size={15} /> Bỏ
            </button>
          ) : (
            ""
          ),
        ])}
      />
      {editable && (
        <div className="actions" style={{ marginTop: 18 }}>
          <Button
            onClick={() =>
              setRows([
                ...rows,
                {
                  id: uuid(),
                  date,
                  meal,
                  slot: "Món thêm " + (rows.length + 1),
                  dishId: choices[0].id,
                  recipeId: choices[0].recipeId,
                  scope: "shared",
                  fixedServings: 0,
                },
              ])
            }
          >
            ＋ Thêm món trong bữa
          </Button>
          <Button primary onClick={submit}>
            Lưu cả bữa
          </Button>
        </div>
      )}
      <p className="muted">
        Thay thế trong bộ mẫu là thay riêng món chính, vẫn ăn cơm/canh chung. Ví
        dụ 100 thường đã gồm 10 thay thế: món chính 90, thay thế 10; món chung
        105 nếu có thêm 5 chay.
      </p>
    </>
  );
}

export function BulkMenu({ s, commit, close }) {
  const [start, setStart] = useState(days[0]),
    [end, setEnd] = useState(days[6]),
    [meal, setMeal] = useState("CHIEU"),
    [ids, setIds] = useState([]);
  async function add() {
    const chosen = days.filter((d) => d >= start && d <= end);
    if (!chosen.length || !ids.length)
      return alert("Chọn ngày và ít nhất một món.");
    const rows = clone(s.menus);
    for (const date of chosen)
      for (const id of ids) {
        const d = s.dishes.find((d) => d.id === id),
          prefix = d.group;
        let slot = prefix,
          n = 2;
        while (
          rows.some(
            (m) => m.date === date && m.meal === meal && m.slot === slot,
          )
        )
          slot = prefix + " " + n++;
        rows.push({
          id: uuid(),
          date,
          meal,
          slot,
          dishId: d.id,
          recipeId: d.recipeId,
          scope:
            d.group === "Món chay"
              ? "vegetarian"
              : ["Món chính", "Món sáng"].includes(d.group)
                ? "main"
                : d.group === "Món phụ"
                  ? "normal"
                  : "shared",
          fixedServings: 0,
        });
      }
    if (await commit("replace", { collection: "menus", rows })) close();
  }
  return (
    <>
      <div className="formrow">
        <label>
          Từ ngày
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          Đến ngày
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <label>
          Bữa
          <select value={meal} onChange={(e) => setMeal(e.target.value)}>
            <option value="SANG">Sáng</option>
            <option value="CHIEU">Chiều</option>
          </select>
        </label>
      </div>
      <p>
        Chọn nhiều món; hệ thống thêm từng món vào mọi bữa được chọn, không xóa
        món cũ.
      </p>
      <div className="dish-picker">
        {s.dishes
          .filter((d) => !d.isSubrecipe)
          .map((d) => (
            <label key={d.id}>
              <input
                type="checkbox"
                checked={ids.includes(d.id)}
                onChange={(e) =>
                  setIds(
                    e.target.checked
                      ? [...ids, d.id]
                      : ids.filter((x) => x !== d.id),
                  )
                }
              />
              {d.name}
            </label>
          ))}
      </div>
      <Button primary onClick={add}>
        Thêm {ids.length} món vào các ngày đã chọn
      </Button>
    </>
  );
}

export function ImportMenu({ s, commit, close }) {
  const [text, setText] = useState(""),
    [preview, setPreview] = useState(null),
    [error, setError] = useState("");
  function check() {
    try {
      const raw = text.trim().startsWith("[")
        ? JSON.parse(text)
        : parseCSV(text);
      const norm = (x) =>
        String(x || "")
          .normalize("NFC")
          .trim()
          .toLowerCase();
      const rows = raw.map((r) => {
        if (r["Ngày"]) {
          const d = s.dishes.find((d) => norm(d.name) === norm(r["Tên món"]));
          if (!d)
            throw Error(
              "Chưa có món: " + r["Tên món"] + ". Thêm món và định mức trước.",
            );
          const scope = Object.entries(scopes).find(
            ([k, t]) => norm(t) === norm(r["Nhóm suất"]),
          )?.[0];
          return {
            id: uuid(),
            date: r["Ngày"],
            meal:
              norm(r["Bữa"]) === "sáng"
                ? "SANG"
                : norm(r["Bữa"]) === "chiều"
                  ? "CHIEU"
                  : "",
            slot: r["Vị trí món"],
            dishId: d.id,
            recipeId: d.recipeId,
            scope,
            fixedServings: Number(r["Số suất riêng"] || 0),
          };
        }
        return {
          ...r,
          id: r.id || uuid(),
          fixedServings: Number(r.fixedServings || 0),
        };
      });
      const keys = new Set();
      for (const r of rows) {
        const k = r.date + "|" + r.meal + "|" + r.slot;
        if (keys.has(k))
          throw Error("File có vị trí món trùng trong cùng bữa: " + r.slot);
        keys.add(k);
      }
      const merged = clone(s.menus);
      for (const r of rows) {
        const idx = merged.findIndex(
          (x) => x.date === r.date && x.meal === r.meal && x.slot === r.slot,
        );
        if (idx >= 0) merged[idx] = r;
        else merged.push(r);
      }
      const c = clone(s);
      c.menus = merged;
      validate(c);
      setPreview({ rows, merged });
      setError("");
    } catch (e) {
      setError(e.message);
      setPreview(null);
    }
  }
  return (
    <>
      <p>
        Dán bảng từ mẫu CSV (mở bằng Excel). Một dòng là một món trong một bữa.
        Nhập nhiều dòng cùng ngày và bữa được hỗ trợ.
      </p>
      <div className="actions">
        <Button
          onClick={() =>
            setText(
              csv([
                [
                  "Ngày",
                  "Bữa",
                  "Vị trí món",
                  "Tên món",
                  "Nhóm suất",
                  "Số suất riêng",
                ],
                ...s.menus
                  .slice(0, 11)
                  .map((m) => [
                    m.date,
                    m.meal === "SANG" ? "Sáng" : "Chiều",
                    m.slot,
                    s.dishes.find((d) => d.id === m.dishId)?.name,
                    scopes[m.scope],
                    m.fixedServings,
                  ]),
              ]),
            )
          }
        >
          Điền mẫu một ngày (11 món)
        </Button>
        <Button
          onClick={() =>
            download(
              "Mau-thuc-don.csv",
              csv([
                [
                  "Ngày",
                  "Bữa",
                  "Vị trí món",
                  "Tên món",
                  "Nhóm suất",
                  "Số suất riêng",
                ],
                ...s.menus.map((m) => [
                  m.date,
                  m.meal === "SANG" ? "Sáng" : "Chiều",
                  m.slot,
                  s.dishes.find((d) => d.id === m.dishId)?.name,
                  scopes[m.scope],
                  m.fixedServings,
                ]),
              ]),
              "text/csv;charset=utf-8",
            )
          }
        >
          Tải mẫu đầy đủ
        </Button>
      </div>
      <textarea
        aria-label="Dữ liệu thực đơn nhập"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setPreview(null);
        }}
        placeholder="Ngày,Bữa,Vị trí món,Tên món,Nhóm suất,Số suất riêng"
      />
      {error && <div className="error">{error}</div>}
      <div className="actions">
        <Button onClick={check}>Kiểm tra trước khi nhập</Button>
        {preview && (
          <>
            <span>
              {preview.rows.length} dòng hợp lệ · tổng sau nhập{" "}
              {preview.merged.length} món
            </span>
            <Button
              primary
              onClick={async () => {
                if (
                  await commit("replace", {
                    collection: "menus",
                    rows: preview.merged,
                  })
                )
                  close();
              }}
            >
              Xác nhận nhập
            </Button>
          </>
        )}
      </div>
      <p className="muted">
        Nhập trùng ngày/bữa/vị trí sẽ cập nhật vị trí đó; không ghi đè các món
        khác ngoài file.
      </p>
    </>
  );
}

export function CopyMeal({ s, commit, close }) {
  const [src, setSrc] = useState(days[0]),
    [meal, setMeal] = useState("CHIEU"),
    [targets, setTargets] = useState([]);
  async function copy() {
    const template = s.menus.filter((m) => m.date === src && m.meal === meal);
    if (!template.length || !targets.length)
      return alert("Chọn bữa nguồn có món và ngày nhận.");
    const untouched = s.menus.filter(
      (m) => !(targets.includes(m.date) && m.meal === meal),
    );
    const rows = [
      ...untouched,
      ...targets.flatMap((date) =>
        template.map((m) => ({ ...m, id: uuid(), date })),
      ),
    ];
    if (await commit("replace", { collection: "menus", rows })) close();
  }
  return (
    <>
      <div className="formrow">
        <label>
          Ngày nguồn
          <select value={src} onChange={(e) => setSrc(e.target.value)}>
            {days.map((d) => (
              <option key={d} value={d}>
                {dayLabel(d)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Bữa nguồn
          <select value={meal} onChange={(e) => setMeal(e.target.value)}>
            <option value="SANG">Sáng</option>
            <option value="CHIEU">Chiều</option>
          </select>
        </label>
      </div>
      <p>
        Chọn ngày nhận. Toàn bộ món của bữa tương ứng ở ngày nhận sẽ được thay
        bằng bữa nguồn. Số suất từng ngày được giữ riêng.
      </p>
      <div className="dish-picker">
        {days
          .filter((d) => d !== src)
          .map((d) => (
            <label key={d}>
              <input
                type="checkbox"
                checked={targets.includes(d)}
                onChange={(e) =>
                  setTargets(
                    e.target.checked
                      ? [...targets, d]
                      : targets.filter((x) => x !== d),
                  )
                }
              />
              {dayLabel(d)}
            </label>
          ))}
      </div>
      <Button primary onClick={copy}>
        Sao chép sang {targets.length} bữa đã chọn
      </Button>
    </>
  );
}
