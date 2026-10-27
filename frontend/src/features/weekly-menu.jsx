import React, { useEffect, useRef, useState } from "react";
import { Button, Icon } from "../components/Primitives.jsx";
export const addDays = (date, count) => {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + count);
  return d.toISOString().slice(0, 10);
};
export const mondayOf = (date) => {
  const day = new Date(date + "T00:00:00Z").getUTCDay();
  return addDays(date, -((day + 6) % 7));
};
const shortDate = (date) => date.slice(8) + "/" + date.slice(5, 7);
const kinds = [
  ["regular", "Thực đơn chính"],
  ["vegetarian", "Món chay"],
  ["replacement", "Món thay thế"],
];
export function mealGroups(meal, catalog) {
  if (!meal) return [];
  if (!meal.rows?.length)
    return [
      {
        key: "regular",
        label: "Thực đơn chính",
        lines: (meal.dishes || []).map((name) => ({ name, slot: "" })),
      },
    ];
  return kinds
    .map(([key, label]) => ({
      key,
      label,
      lines: meal.rows
        .filter((r) =>
          key === "regular"
            ? !["vegetarian", "replacement"].includes(r.scope)
            : r.scope === key,
        )
        .map((r) => ({
          name:
            catalog.dishes.find((d) => d.id === r.dishId)?.name ||
            catalog.recipes.find((x) => x.id === r.recipeId)?.name ||
            r.dishId ||
            "Chưa chọn món",
          slot: r.slot,
        })),
    }))
    .filter((g) => g.lines.length);
}
export function WeeklyMenu({
  menus,
  catalog,
  period,
  month,
  year,
  canEdit,
  busy,
  onEdit,
  kitchenName,
}) {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
  const [week, setWeek] = useState(mondayOf(today)),
    [dark, setDark] = useState(false),
    [present, setPresent] = useState(false),
    [showExtra, setShowExtra] = useState(false),
    [span, setSpan] = useState(4),
    [page, setPage] = useState(0);
  const root = useRef(null);
  useEffect(() => {
    const prefix = period === "year" ? year : month;
    const anchor = today.startsWith(prefix)
      ? today
      : period === "year"
        ? year + "-01-01"
        : month + "-01";
    setWeek(mondayOf(anchor));
    setPage(0);
  }, [month, year, period]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setPresent(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(week, i)),
    shown = dates.slice(page * span, Math.min(7, (page + 1) * span));
  return (
    <section
      ref={root}
      className={
        "week-board " +
        (dark ? "dark-board " : "") +
        (present ? "is-presenting" : "")
      }
    >
      <div className="week-board-toolbar">
        <div className="week-navigation">
          <button
            aria-label="Tuần trước"
            onClick={() => {
              setWeek(addDays(week, -7));
              setPage(0);
            }}
          >
            <Icon name="left" />
          </button>
          <div>
            <b>THỰC ĐƠN TUẦN</b>
            <span>
              {shortDate(week)} – {shortDate(addDays(week, 6))}/
              {week.slice(0, 4)} · {kitchenName}
            </span>
          </div>
          <button
            aria-label="Tuần sau"
            onClick={() => {
              setWeek(addDays(week, 7));
              setPage(0);
            }}
          >
            <Icon name="right" />
          </button>
        </div>
        <div className="week-options">
          <label className="sr-only" htmlFor="week-anchor">
            Chọn tuần
          </label>
          <input
            id="week-anchor"
            type="date"
            value={week}
            onChange={(e) => {
              if (e.target.value) {
                setWeek(mondayOf(e.target.value));
                setPage(0);
              }
            }}
          />
          <select
            aria-label="Số ngày hiển thị"
            value={span}
            onChange={(e) => {
              setSpan(Number(e.target.value));
              setPage(0);
            }}
          >
            <option value={7}>7 ngày</option>
            <option value={4}>4 ngày</option>
          </select>
          <button aria-pressed={dark} onClick={() => setDark(!dark)}>
            {dark ? "Nền sáng" : "Nền tối"}
          </button>
          <button aria-pressed={present} onClick={() => setPresent(!present)}>
            <Icon name={present ? "close" : "eye"} size={16} />
            {present ? "Đóng trình chiếu" : "Trình chiếu"}
          </button>
        </div>
      </div>
      <div className="week-summary">
        <span>Mỗi cột một ngày · Mỗi dòng một món</span>
        <label>
          <input
            type="checkbox"
            checked={showExtra}
            onChange={(e) => setShowExtra(e.target.checked)}
          />
          Hiện món chay & thay thế
        </label>
        {span === 4 && (
          <div>
            <button disabled={page === 0} onClick={() => setPage(0)}>
              Thứ 2–5
            </button>
            <button disabled={page === 1} onClick={() => setPage(1)}>
              Thứ 6–CN
            </button>
          </div>
        )}
      </div>
      <div className="week-board-scroll">
        <table className="weekly-menu-table">
          <thead>
            <tr>
              <th className="meal-label">Bữa ăn</th>
              {shown.map((d) => (
                <th key={d}>
                  <span>
                    {
                      [
                        "CHỦ NHẬT",
                        "THỨ 2",
                        "THỨ 3",
                        "THỨ 4",
                        "THỨ 5",
                        "THỨ 6",
                        "THỨ 7",
                      ][new Date(d + "T00:00:00Z").getUTCDay()]
                    }
                  </span>
                  <b>{shortDate(d)}</b>
                  {d === today && <small>Hôm nay</small>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["SANG", "SÁNG"],
              ["CHIEU", "CHIỀU"],
            ].map(([code, label]) => (
              <tr key={code}>
                <th scope="row" className="meal-label">
                  <b>{label}</b>
                </th>
                {shown.map((d) => {
                  const m = menus.find((x) => x.date === d && x.meal === code);
                  const groups = mealGroups(m, catalog);
                  return (
                    <td key={d} className={m ? "" : "no-meal"}>
                      {m ? (
                        <>
                          <div className="meal-status">
                            <span className={m.approved ? "approved" : "draft"}>
                              {m.approved ? "Đã chốt" : "Nháp"}
                            </span>
                            <span>{m.normal + m.vegetarian} suất</span>
                          </div>
                          <div className="board-dishes">
                            {groups
                              .filter((g) => g.key === "regular" || showExtra)
                              .map((g) => (
                                <section
                                  key={g.key}
                                  className={"dish-group " + g.key}
                                >
                                  {g.key !== "regular" && <h4>{g.label}</h4>}
                                  {g.lines.map((line, i) => (
                                    <div className="board-dish" key={i}>
                                      <span>{line.name}</span>
                                    </div>
                                  ))}
                                </section>
                              ))}
                          </div>
                          <div className="board-meal-footer">
                            <small>
                              Thường {m.normal} · Chay {m.vegetarian}
                              {m.replacement
                                ? " · Thay thế " + m.replacement
                                : ""}
                            </small>
                            <button
                              disabled={!canEdit || busy}
                              onClick={() => onEdit(m)}
                            >
                              <Icon name="edit" size={14} />
                              Sửa bữa
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="missing-meal">
                          <Icon name="calendar" size={22} />
                          <b>Chưa có thực đơn</b>
                          <small>
                            Tạo các bữa còn thiếu cho tháng / năm đã chọn.
                          </small>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="week-board-footnote">
        Món chay và thay thế được tách riêng để tránh nhầm thành món ăn chung.
        Suất thay thế đã bao gồm trong suất thường khi bữa ăn chọn chế độ này.
      </div>
    </section>
  );
}
