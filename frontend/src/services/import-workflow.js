export function parseCSV(text) {
  const rows = [];
  let row = [],
    value = "",
    quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      value = "";
    } else value += c;
  }
  if (quoted) throw Error("Dấu ngoặc kép trong CSV chưa đóng.");
  row.push(value);
  if (row.some((x) => x.trim())) rows.push(row);
  if (rows.length < 2)
    throw Error("File cần tiêu đề và ít nhất một dòng dữ liệu.");
  const heads = rows.shift().map((x) => x.trim());
  if (new Set(heads).size !== heads.length) throw Error("Tên cột bị trùng.");
  return rows.map((r, i) => {
    if (r.length !== heads.length)
      throw Error("Dòng " + (i + 2) + " không đúng số cột.");
    return Object.fromEntries(heads.map((h, j) => [h, r[j].trim()]));
  });
}
export function validateItemCSV(text, items) {
  const data = parseCSV(text);
  if (data.length > 100) throw Error("Tối đa 100 dòng/lần.");
  const seen = new Set();
  return data.map((r, i) => {
    const item = items.find((x) => x.id === r.itemId);
    let errors = [];
    if (!item) errors.push("Mã hàng chưa có");
    if (
      !r.quantity ||
      !Number.isFinite(Number(r.quantity)) ||
      Number(r.quantity) <= 0
    )
      errors.push("Lượng phải > 0, dùng dấu chấm thập phân");
    if (item && r.unit !== item.unit) errors.push("Đơn vị cần là " + item.unit);
    if (seen.has(r.itemId)) errors.push("Trùng mã hàng");
    seen.add(r.itemId);
    return {
      row: i + 2,
      itemId: r.itemId,
      name: item?.name || "",
      quantity: Number(r.quantity),
      unit: r.unit,
      error: errors.join("; "),
    };
  });
}
export function validateMenuCSV(text, catalog) {
  const rows = parseCSV(text),
    meals = new Map(),
    errors = [];
  if (rows.length > 500) throw Error("Tối đa 500 dòng món/lần.");
  for (const [i, r] of rows.entries()) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
      Number.isNaN(Date.parse(r.date)) ||
      new Date(r.date + "T00:00:00Z").toISOString().slice(0, 10) !== r.date
    )
      errors.push("Dòng " + (i + 2) + ": ngày yyyy-mm-dd không hợp lệ");
    if (!["SANG", "CHIEU"].includes(r.meal))
      errors.push("Dòng " + (i + 2) + ": meal cần SANG hoặc CHIEU");
    const dish = catalog.dishes.find((d) => d.id === r.dishId);
    if (!dish) errors.push("Dòng " + (i + 2) + ": mã món không tồn tại");
    if (
      !r.normal ||
      !r.vegetarian ||
      !r.replacement ||
      [r.normal, r.vegetarian, r.replacement].some(
        (v) => !Number.isInteger(Number(v)) || Number(v) < 0,
      )
    )
      errors.push("Dòng " + (i + 2) + ": nhập đủ số suất nguyên không âm");
    if (
      ![
        "main",
        "normal",
        "shared",
        "vegetarian",
        "replacement",
        "fixed",
      ].includes(r.scope) ||
      !r.slot
    )
      errors.push("Dòng " + (i + 2) + ": thiếu slot hoặc sai scope");
    if (r.scope === "fixed")
      errors.push(
        "Dòng " +
          (i + 2) +
          ": mẫu CSV chưa hỗ trợ scope fixed; nhập trong Sửa bữa",
      );
    const key = r.date + "|" + r.meal;
    let m = meals.get(key);
    if (!m) {
      m = {
        date: r.date,
        meal: r.meal,
        normal: Number(r.normal),
        vegetarian: Number(r.vegetarian),
        replacement: Number(r.replacement),
        replacementIncluded: true,
        rows: [],
      };
      meals.set(key, m);
    } else if (
      m.normal !== Number(r.normal) ||
      m.vegetarian !== Number(r.vegetarian) ||
      m.replacement !== Number(r.replacement)
    )
      errors.push("Dòng " + (i + 2) + ": số suất không đồng nhất trong bữa");
    if (m.rows.some((x) => x.slot === r.slot))
      errors.push("Dòng " + (i + 2) + ": trùng slot trong bữa");
    m.rows.push({
      date: r.date,
      meal: r.meal,
      slot: r.slot,
      dishId: r.dishId,
      recipeId: dish?.recipeId || "",
      scope: r.scope,
      fixedServings: 0,
    });
  }
  if (meals.size > 62) errors.push("Tối đa 62 bữa/lần.");
  return { meals: [...meals.values()], errors, rows };
}
export function saveText(name, text, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob(["\uFEFF" + text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportRows(name, rows) {
  if (!rows.length) throw Error("Không có dữ liệu để xuất.");
  const keys = Object.keys(rows[0]),
    cell = (v) => {
      let s = String(v ?? "");
      if (typeof v === "string" && /^[=+@\-\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
  saveText(
    name,
    keys.map(cell).join(",") +
      "\n" +
      rows.map((r) => keys.map((k) => cell(r[k])).join(",")).join("\n"),
  );
}
