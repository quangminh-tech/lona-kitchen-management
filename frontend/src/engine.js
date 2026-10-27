export const clone = (x) => structuredClone(x),
  round = (x) => Math.round((x + Number.EPSILON) * 1e6) / 1e6;
export function uuid() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 3) | 8).toString(16);
    })
  );
}
const fail = (m) => {
    throw Error(m);
  },
  valid = (n) => typeof n === "number" && Number.isFinite(n) && n >= 0;
export const context = (p) => p.date + "|" + p.meal;
export function servings(p, scope, fixed) {
  const pool = p.normal + (p.replacementIncluded ? 0 : p.replacement);
  return scope === "main"
    ? p.replacementIncluded
      ? p.normal - p.replacement
      : p.normal
    : scope === "normal"
      ? pool
      : scope === "shared"
        ? pool + p.vegetarian
        : scope === "vegetarian"
          ? p.vegetarian
          : scope === "replacement"
            ? p.replacement
            : scope === "fixed"
              ? fixed
              : 0;
}
const simple = (q, from, to) =>
  from === to
    ? q
    : from === "g" && to === "kg"
      ? q / 1000
      : from === "kg" && to === "g"
        ? q * 1000
        : from === "ml" && to === "l"
          ? q / 1000
          : from === "l" && to === "ml"
            ? q * 1000
            : null;
export function validate(s) {
  for (const key of [
    "items",
    "dishes",
    "recipes",
    "plans",
    "menus",
    "warehouses",
  ]) {
    if (!Array.isArray(s[key])) fail("Thiếu " + key);
    const set = new Set();
    for (const x of s[key]) {
      if (!x.id || set.has(x.id)) fail("Trùng hoặc thiếu mã " + key);
      set.add(x.id);
    }
  }
  for (const i of s.items) {
    if (
      !i.name ||
      !i.baseUnit ||
      !s.warehouses.some((w) => w.id === i.warehouseId)
    )
      fail("Nguyên liệu thiếu tên, đơn vị hoặc kho.");
    for (const k of ["stock", "safety", "reserved", "unitCost"])
      if (!valid(i[k])) fail("Số liệu kho phải là số không âm.");
    if (!valid(i.packQuantity) || i.packQuantity <= 0)
      fail("Quy cách mua phải >0.");
    if (
      !i.conversions ||
      i.conversions[i.baseUnit] !== 1 ||
      Object.values(i.conversions).some((v) => !valid(v) || v <= 0)
    )
      fail("Quy đổi đơn vị phải dương; đơn vị kho có hệ số 1.");
    if (i.reserved > i.stock) fail("Lượng giữ không được vượt tồn.");
  }
  for (const r of s.recipes) {
    if (
      !s.dishes.some((d) => d.id === r.dishId) ||
      !r.lines?.length ||
      !valid(r.yieldQuantity) ||
      r.yieldQuantity <= 0 ||
      !r.yieldUnit
    )
      fail("Công thức thiếu món, thành phần hoặc sản lượng.");
    for (const l of r.lines) {
      if (!valid(l.quantity) || l.quantity <= 0 || !l.unit)
        fail("Định mức phải dương và có đơn vị.");
      if (
        !["raw", "cooked"].includes(l.basis) ||
        (l.basis === "cooked" && (!valid(l.yieldRate) || l.yieldRate <= 0))
      )
        fail("Lượng chín cần tỷ lệ thu hồi >0.");
      if (l.kind === "item" && !s.items.some((i) => i.id === l.itemId))
        fail("Thành phần chưa có mã hàng kho.");
      if (l.kind === "recipe" && !s.recipes.some((r) => r.id === l.recipeId))
        fail("Thiếu công thức bán thành phẩm.");
      if (!["item", "recipe", "auxiliary"].includes(l.kind))
        fail("Loại thành phần không hợp lệ.");
    }
  }
  const walk = (id, path = []) => {
    if (path.includes(id))
      fail("Công thức vòng lặp: " + [...path, id].join(" → "));
    for (const l of s.recipes.find((r) => r.id === id).lines)
      if (l.kind === "recipe") walk(l.recipeId, [...path, id]);
  };
  s.recipes.forEach((r) => walk(r.id));
  const planKeys = new Set();
  for (const p of s.plans) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(p.date) ||
      !["SANG", "CHIEU"].includes(p.meal) ||
      ["normal", "vegetarian", "replacement"].some(
        (k) => !valid(p[k]) || !Number.isInteger(p[k]),
      )
    )
      fail("Báo suất cần ngày/ca hợp lệ và số nguyên không âm.");
    if (p.replacementIncluded && p.replacement > p.normal)
      fail("Thay thế không vượt số thường đã bao gồm.");
    if (planKeys.has(context(p))) fail("Trùng báo suất ngày/ca.");
    planKeys.add(context(p));
  }
  const menuKeys = new Set();
  for (const m of s.menus) {
    const key = context(m) + "|" + m.slot;
    if (menuKeys.has(key)) fail("Trùng vị trí món trong ngày/ca: " + m.slot);
    menuKeys.add(key);
    if (
      !m.slot ||
      !["SANG", "CHIEU"].includes(m.meal) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(m.date)
    )
      fail("Vị trí/ngày/ca menu không hợp lệ.");
    if (
      !s.dishes.some((d) => d.id === m.dishId) ||
      !s.recipes.some((r) => r.id === m.recipeId && r.dishId === m.dishId)
    )
      fail("Món và công thức không khớp.");
    if (
      ![
        "main",
        "normal",
        "shared",
        "vegetarian",
        "replacement",
        "fixed",
      ].includes(m.scope) ||
      (m.scope === "fixed" &&
        (!valid(m.fixedServings) || !Number.isInteger(m.fixedServings)))
    )
      fail("Nhóm suất không hợp lệ.");
  }
  return true;
}
export function analyse(s, from, to) {
  const details = [],
    errors = [],
    auxiliary = [];
  if (from > to)
    errors.push({
      date: from,
      slot: "Khoảng ngày",
      message: "Ngày bắt đầu sau ngày kết thúc.",
    });
  for (const date of s.issuedDates.filter((d) => d >= from && d <= to))
    errors.push({
      date,
      slot: "Đã xuất kho",
      message: "Chọn khoảng chưa xuất để tránh tính mua lại nhu cầu đã dùng.",
    });
  const menus = s.menus.filter((m) => m.date >= from && m.date <= to),
    byItem = new Map();
  for (const p of s.plans.filter((p) => p.date >= from && p.date <= to))
    if (
      p.normal + p.vegetarian + p.replacement > 0 &&
      !menus.some((m) => context(m) === context(p))
    )
      errors.push({
        date: p.date,
        meal: p.meal,
        slot: "Thực đơn",
        message: "Bữa có báo suất nhưng chưa có món.",
      });
  function error(m, msg) {
    errors.push({ date: m.date, meal: m.meal, slot: m.slot, message: msg });
  }
  function expand(m, r, scale, path) {
    if (path.includes(r.id)) {
      error(m, "Công thức vòng lặp.");
      return;
    }
    if (!r.approved) {
      error(m, "Công thức chưa duyệt: " + r.name);
      return;
    }
    for (const l of r.lines) {
      let q = l.quantity * scale;
      if (l.basis === "cooked") {
        if (!(l.yieldRate > 0)) {
          error(m, "Thiếu tỷ lệ thu hồi.");
          continue;
        }
        q /= l.yieldRate;
      }
      if (l.kind === "auxiliary") {
        auxiliary.push({
          date: m.date,
          dish: r.name,
          name: l.name || "Phụ trợ",
          quantity: round(q),
          unit: l.unit,
        });
        continue;
      }
      if (l.kind === "recipe") {
        const child = s.recipes.find((r) => r.id === l.recipeId);
        if (!child) {
          error(m, "Thiếu công thức con.");
          continue;
        }
        const converted = simple(q, l.unit, child.yieldUnit);
        if (converted === null) {
          error(
            m,
            "Không đổi được " +
              l.unit +
              " sang sản lượng " +
              child.yieldUnit +
              " của " +
              child.name,
          );
          continue;
        }
        expand(m, child, converted / child.yieldQuantity, [...path, r.id]);
        continue;
      }
      const i = s.items.find((i) => i.id === l.itemId),
        factor = i?.conversions?.[l.unit];
      if (!i || !(factor > 0)) {
        error(m, "Thiếu mã hàng hoặc quy đổi: " + (i?.name || l.itemId));
        continue;
      }
      const pl = s.plans.find((p) => context(p) === context(m));
      if (
        i.vegetarianAllowed === false &&
        (m.scope === "vegetarian" ||
          (m.scope === "shared" && pl?.vegetarian > 0))
      )
        error(
          m,
          "Thành phần " +
            i.name +
            " không dùng cho suất chay mẫu; tách nhóm thường và chay.",
        );
      const base = round(q * factor),
        root = s.dishes.find((d) => d.id === m.dishId);
      const d = {
        date: m.date,
        meal: m.meal,
        slot: m.slot,
        dish: root?.name,
        recipe: r.name,
        path: [...path, r.id].join(" → "),
        itemId: i.id,
        item: i.name,
        warehouseId: i.warehouseId,
        quantity: base,
        unit: i.baseUnit,
        formula: `${round(l.quantity)} ${l.unit} × ${round(scale)}${l.basis === "cooked" ? " / " + l.yieldRate : ""} × ${factor}`,
        scope: m.scope,
      };
      details.push(d);
      if (!byItem.has(i.id))
        byItem.set(i.id, { itemId: i.id, quantity: 0, sources: [] });
      const t = byItem.get(i.id);
      t.quantity = round(t.quantity + base);
      t.sources.push(d);
    }
  }
  for (const m of menus) {
    const p = s.plans.find((p) => context(p) === context(m));
    if (!p) {
      error(m, "Chưa có báo suất ngày/ca.");
      continue;
    }
    if (!p.approved) {
      error(m, "Báo suất chưa chốt.");
      continue;
    }
    const n = servings(p, m.scope, m.fixedServings);
    if (n === 0) continue;
    const r = s.recipes.find((r) => r.id === m.recipeId);
    if (!r) {
      error(m, "Thiếu định mức.");
      continue;
    }
    if (r.yieldUnit !== "suat") {
      error(m, "Món trên menu phải có sản lượng tính theo suất.");
      continue;
    }
    expand(m, r, n / r.yieldQuantity, []);
  }
  const totals = [...byItem.values()].map((t) => {
    const i = s.items.find((i) => i.id === t.itemId),
      incoming = s.orders
        .filter((o) => o.itemId === i.id && o.dueDate <= from)
        .reduce((a, o) => a + Math.max(0, o.quantity - o.received), 0),
      available = i.stock - i.reserved + incoming,
      shortage = Math.max(0, round(t.quantity + i.safety - available)),
      packs = Math.ceil(shortage / i.packQuantity);
    return {
      ...t,
      item: i.name,
      unit: i.baseUnit,
      warehouseId: i.warehouseId,
      stock: i.stock,
      reserved: i.reserved,
      safety: i.safety,
      incoming,
      shortage: round(shortage),
      packs,
      packName: i.packName,
      packQuantity: i.packQuantity,
      buyQuantity: round(packs * i.packQuantity),
      estimatedCost: round(t.quantity * i.unitCost),
    };
  });
  return {
    from,
    to,
    menuCount: menus.length,
    details,
    totals,
    errors,
    auxiliary,
    ready: menus.length > 0 && errors.length === 0,
  };
}
export function change(input, cmd) {
  const s = clone(input),
    p = cmd.payload || {};
  const stamp = JSON.stringify({ type: cmd.type, payload: p });
  if (s.requests[cmd.requestId]) {
    if (s.requests[cmd.requestId] !== stamp)
      fail("Mã gửi lại có nội dung khác.");
    return s;
  }
  if (cmd.expectedRevision !== s.revision)
    fail("Dữ liệu đã đổi. Tải lại trước khi lưu.");
  if (cmd.type === "meal") {
    if (s.issuedDates.includes(p.date))
      fail("Ngày đã xuất kho; không sửa lại đầu vào đã dùng.");
    s.menus = [
      ...s.menus.filter((m) => !(m.date === p.date && m.meal === p.meal)),
      ...p.rows,
    ];
    s.plans = [
      ...s.plans.filter((x) => !(x.date === p.date && x.meal === p.meal)),
      p.plan,
    ];
    validate(s);
    s.dataVersion++;
  } else if (cmd.type === "recipe") {
    if (s.ledger.length)
      fail(
        "Đã có phát sinh kho; cần phiên bản công thức mới trong hệ thống chính thức. Đặt lại mẫu để thử kịch bản mới.",
      );
    s.recipes = [...s.recipes.filter((r) => r.id !== p.recipe.id), p.recipe];
    s.dishes = [...s.dishes.filter((d) => d.id !== p.dish.id), p.dish];
    validate(s);
    s.dataVersion++;
  } else if (cmd.type === "replace") {
    if (
      !["menus", "plans", "recipes", "items", "warehouses"].includes(
        p.collection,
      )
    )
      fail("Không được sửa dữ liệu này.");
    if (p.collection === "items" && s.ledger.length)
      for (const i of p.rows) {
        const old = s.items.find((x) => x.id === i.id);
        if (
          old &&
          (i.stock !== old.stock ||
            i.baseUnit !== old.baseUnit ||
            i.warehouseId !== old.warehouseId)
        )
          fail("Đã phát sinh kho: không sửa trực tiếp tồn, đơn vị hoặc kho.");
      }
    if (["menus", "plans"].includes(p.collection))
      for (const date of s.issuedDates) {
        const norm = (a) =>
          JSON.stringify(
            a
              .filter((x) => x.date === date)
              .sort((a, b) => a.id.localeCompare(b.id)),
          );
        if (norm(s[p.collection]) !== norm(p.rows))
          fail("Không đổi đầu vào của ngày đã xuất kho: " + date);
      }
    s[p.collection] = p.rows;
    validate(s);
    s.dataVersion++;
  } else if (cmd.type === "delete") {
    if (!["items", "dishes"].includes(p.collection))
      fail("Không được xóa dữ liệu này.");
    const row = s[p.collection].find((x) => x.id === p.id);
    if (!row) fail("Không tìm thấy dữ liệu.");
    if (p.collection === "items") {
      if (
        row.stock > 0 ||
        row.reserved > 0 ||
        s.recipes.some((r) => r.lines.some((l) => l.itemId === p.id)) ||
        s.orders.some((o) => o.itemId === p.id) ||
        s.ledger.some((l) => l.itemId === p.id)
      )
        fail("Nguyên liệu đang có tồn hoặc liên kết, không thể xóa.");
      s.items = s.items.filter((x) => x.id !== p.id);
    } else {
      if (
        s.menus.some((m) => m.dishId === p.id) ||
        s.recipes.some((r) =>
          r.lines.some(
            (l) => l.kind === "recipe" && l.recipeId === row.recipeId,
          ),
        ) ||
        s.ledger.length
      )
        fail("Món đang sử dụng hoặc đã có lịch sử kho, không thể xóa.");
      s.dishes = s.dishes.filter((x) => x.id !== p.id);
      s.recipes = s.recipes.filter((x) => x.dishId !== p.id);
    }
    validate(s);
    s.dataVersion++;
  } else if (cmd.type === "orders") {
    const r = analyse(s, p.from, p.to);
    if (!r.ready) fail("Dự trù còn thiếu dữ liệu.");
    if (s.issuedDates.some((d) => d >= p.from && d <= p.to))
      fail("Khoảng ngày đã có xuất kho; không tạo mua lại cùng nhu cầu.");
    let n = 0;
    for (const t of r.totals)
      if (t.packs > 0) {
        s.orders.push({
          id: "PO-" + (s.orders.length + 1),
          itemId: t.itemId,
          warehouseId: t.warehouseId,
          quantity: t.buyQuantity,
          received: 0,
          packName: t.packName,
          packQuantity: t.packQuantity,
          packs: t.packs,
          dueDate: p.from,
          unitCost: s.items.find((i) => i.id === t.itemId).unitCost,
        });
        n++;
      }
    if (!n) fail("Tồn và hàng đang về đã đủ.");
  } else if (cmd.type === "receive") {
    const o = s.orders.find((o) => o.id === p.orderId);
    if (
      !o ||
      !valid(p.quantity) ||
      p.quantity <= 0 ||
      p.quantity > round(o.quantity - o.received)
    )
      fail("Số nhận không hợp lệ hoặc vượt phần còn thiếu.");
    const i = s.items.find((i) => i.id === o.itemId);
    o.received = round(o.received + p.quantity);
    i.stock = round(i.stock + p.quantity);
    s.ledger.push({
      id: uuid(),
      type: "receipt",
      date: new Date().toISOString(),
      itemId: i.id,
      quantity: p.quantity,
      source: o.id,
    });
  } else if (cmd.type === "issue") {
    if (s.issuedDates.includes(p.date))
      fail("Ngày này đã xuất, không ghi hai lần.");
    const r = analyse(s, p.date, p.date);
    if (!r.ready) fail("Ngày xuất còn dữ liệu chưa chốt.");
    for (const t of r.totals)
      if (t.quantity > t.stock - t.reserved)
        fail("Thiếu " + t.item + "; chưa ghi bất kỳ dòng nào.");
    for (const t of r.totals) {
      s.items.find((i) => i.id === t.itemId).stock = round(
        t.stock - t.quantity,
      );
      s.ledger.push({
        id: uuid(),
        type: "issue",
        date: p.date,
        itemId: t.itemId,
        quantity: -t.quantity,
        source: "Menu " + p.date,
      });
    }
    s.issuedDates.push(p.date);
  } else fail("Thao tác không hỗ trợ.");
  s.revision++;
  s.requests[cmd.requestId] = stamp;
  s.audit.unshift({
    at: new Date().toISOString(),
    action: cmd.type,
    detail:
      cmd.type === "replace" ? p.collection : p.date || p.orderId || p.from,
  });
  return s;
}
