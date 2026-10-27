export const copy = (x) => structuredClone(x);
export const dateAdd = (d, n) => {
  const x = new Date(d + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
export const id = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return (
    h.slice(0, 8) +
    "-" +
    h.slice(8, 12) +
    "-" +
    h.slice(12, 16) +
    "-" +
    h.slice(16, 20) +
    "-" +
    h.slice(20)
  );
};
export function ranges(d) {
  const next = dateAdd(d, 1),
    a = new Date(d + "T00:00:00Z");
  return [
    { key: "D+1", from: next, to: next },
    { key: "D+2", from: dateAdd(d, 2), to: dateAdd(d, 2) },
    { key: "D+3", from: dateAdd(d, 3), to: dateAdd(d, 3) },
    { key: "7 ngày", from: next, to: dateAdd(d, 7) },
    {
      key: "Tháng sau",
      from: new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 1))
        .toISOString()
        .slice(0, 10),
      to: new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 2, 0))
        .toISOString()
        .slice(0, 10),
    },
  ];
}
export const initial = () => ({
  revision: 1,
  warehouses: [
    { id: "TT", name: "Kho trung tâm", branch: "Trụ sở" },
    { id: "CG", name: "Kho nhánh Cần Giờ", branch: "Cần Giờ" },
    { id: "B2", name: "Kho nhánh 02 (minh họa)", branch: "Nhánh 02" },
    { id: "TRANSIT", name: "Hàng đang đi", branch: "Nội bộ" },
  ],
  items: [
    { id: "GAO", name: "Gạo thơm", unit: "kg", pack: 25 },
    { id: "DAU", name: "Dầu ăn", unit: "lít", pack: 5 },
    { id: "TRUNG", name: "Trứng", unit: "quả", pack: 30 },
  ],
  balances: {
    "TT|GAO": 1000,
    "CG|GAO": 80,
    "B2|GAO": 40,
    "TRANSIT|GAO": 0,
    "TT|DAU": 100,
    "CG|DAU": 20,
    "B2|DAU": 10,
    "TRANSIT|DAU": 0,
    "TT|TRUNG": 3000,
    "CG|TRUNG": 300,
    "B2|TRUNG": 150,
    "TRANSIT|TRUNG": 0,
  },
  transfers: [],
  ledger: [],
  receipts: {},
  jobs: [],
  menus: [],
});
export function available(s, w, i) {
  const held = s.transfers
    .filter((t) => t.from === w && t.status === "APPROVED" && t.item === i)
    .reduce((n, t) => n + t.qty, 0);
  return (s.balances[w + "|" + i] || 0) - held;
}
export function execute(state, command) {
  const s = copy(state);
  if (s.receipts[command.requestId]) return s;
  if (command.revision !== s.revision)
    throw Error("Dữ liệu đã đổi. Tải lại trước khi lưu.");
  const p = command.payload;
  const t = s.transfers.find((t) => t.id === p.id);
  function move(from, to, item, qty, doc) {
    if (qty <= 0 || !Number.isFinite(qty))
      throw Error("Số lượng phải lớn hơn 0.");
    if ((s.balances[from + "|" + item] || 0) < qty)
      throw Error("Kho nguồn không đủ tồn.");
    s.balances[from + "|" + item] -= qty;
    s.balances[to + "|" + item] = (s.balances[to + "|" + item] || 0) + qty;
    s.ledger.push({
      id: id(),
      doc,
      from,
      to,
      item,
      qty,
      at: new Date().toISOString(),
    });
  }
  if (command.type === "create") {
    if (
      !s.items.some((i) => i.id === p.item) ||
      p.from === p.to ||
      ["TRANSIT"].includes(p.from) ||
      ["TRANSIT"].includes(p.to) ||
      !s.warehouses.some((w) => w.id === p.from) ||
      !s.warehouses.some((w) => w.id === p.to) ||
      !Number.isFinite(p.qty) ||
      p.qty <= 0
    )
      throw Error("Kho, mặt hàng hoặc số lượng không hợp lệ.");
    s.transfers.push({
      ...p,
      id: id(),
      number: "DC-" + String(s.transfers.length + 1).padStart(4, "0"),
      status: "DRAFT",
      received: 0,
    });
  } else if (command.type === "approve") {
    if (t?.status !== "DRAFT") throw Error("Chỉ duyệt phiếu nháp.");
    if (available(s, t.from, t.item) < t.qty)
      throw Error("Không đủ tồn khả dụng để giữ hàng.");
    t.status = "APPROVED";
  } else if (command.type === "dispatch") {
    if (t?.status !== "APPROVED") throw Error("Phiếu chưa duyệt hoặc đã xuất.");
    if (available(s, t.from, t.item) + t.qty < t.qty)
      throw Error("Hàng đang giữ cho phiếu khác.");
    move(t.from, "TRANSIT", t.item, t.qty, t.id);
    t.status = "IN_TRANSIT";
  } else if (command.type === "receive") {
    if (!t || !["IN_TRANSIT", "PARTIAL"].includes(t.status))
      throw Error("Phiếu chưa xuất hoặc đã nhận đủ.");
    if (!Number.isFinite(p.qty) || p.qty <= 0 || p.qty > t.qty - t.received)
      throw Error("Nhận vượt số đang đi của phiếu này.");
    move("TRANSIT", t.to, t.item, p.qty, t.id);
    t.received += p.qty;
    t.status = t.received === t.qty ? "RECEIVED" : "PARTIAL";
  } else if (command.type === "cancel") {
    if (!t || !["DRAFT", "APPROVED"].includes(t.status))
      throw Error("Hàng đã xuất không hủy trực tiếp. Cần phiếu hoàn.");
    t.status = "CANCELLED";
  } else if (command.type === "run") {
    const key = p.kitchen + "|" + p.date;
    const relevant = s.menus.filter(
      (m) =>
        m.kitchen === p.kitchen &&
        m.date >= dateAdd(p.date, 1) &&
        m.date <= ranges(p.date)[4].to,
    );
    const fingerprint = JSON.stringify(relevant);
    const old = s.jobs.find(
      (j) => j.key === key && j.fingerprint === fingerprint,
    );
    if (old) return s;
    const version = s.jobs.filter((j) => j.key === key).length + 1;
    s.jobs.unshift({
      id: id(),
      key,
      version,
      kitchen: p.kitchen,
      date: p.date,
      fingerprint,
      at: new Date().toISOString(),
      snapshots: ranges(p.date).map((r) => {
        const rows = s.menus.filter(
            (m) =>
              m.kitchen === p.kitchen && m.date >= r.from && m.date <= r.to,
          ),
          expected =
            (Math.round((new Date(r.to) - new Date(r.from)) / 86400000) + 1) *
            2;
        return {
          ...r,
          meals: rows.length,
          expected,
          approved: rows.filter((m) => m.approved).length,
          status:
            rows.length === expected && rows.every((m) => m.approved)
              ? "READY"
              : "BLOCKED",
        };
      }),
    });
  } else throw Error("Lệnh không hợp lệ.");
  s.receipts[command.requestId] = true;
  s.revision++;
  return s;
}
export function repeatMenu(state, { kitchen, from, to, approved = false }) {
  const s = copy(state);
  if (from > to || new Date(to) - new Date(from) > 366 * 86400000)
    throw Error("Chọn khoảng tối đa 1 năm.");
  const dishes = [
    ["Phở gà", "Chuối"],
    [
      "Cơm trắng",
      "Thịt heo kho",
      "Trứng chiên",
      "Rau cải xào",
      "Canh bí đỏ",
      "Chuối",
    ],
  ];
  for (let d = from; d <= to; d = dateAdd(d, 1))
    for (const [meal, i] of [
      ["SANG", 0],
      ["CHIEU", 1],
    ]) {
      if (
        s.menus.some(
          (m) => m.date === d && m.meal === meal && m.kitchen === kitchen,
        )
      )
        continue;
      const weekday = new Date(d + "T00:00:00Z").getUTCDay();
      const source = s.base?.plans.find(
        (p) =>
          p.meal === meal &&
          new Date(p.date + "T00:00:00Z").getUTCDay() === weekday,
      );
      const rows = source
        ? s.base.menus
            .filter((r) => r.date === source.date && r.meal === meal)
            .map((r) => ({ ...r, id: id(), date: d, meal }))
        : [];
      s.menus.push({
        id: id(),
        kitchen,
        date: d,
        meal,
        normal: source?.normal ?? (meal === "SANG" ? 80 : 100),
        vegetarian: source?.vegetarian ?? (meal === "SANG" ? 0 : 5),
        replacement: source?.replacement ?? 0,
        replacementIncluded: source?.replacementIncluded !== false,
        approved,
        rows,
        dishes: rows.length
          ? rows.map(
              (r) =>
                s.base.dishes.find((x) => x.id === r.dishId)?.name || r.dishId,
            )
          : dishes[i],
        source: "Mẫu tuần minh họa; chưa phải thực đơn đối tác",
      });
    }
  s.revision++;
  return s;
}
export function forecast(state, kitchen, from, to) {
  const menu = state.menus.filter(
    (m) => m.kitchen === kitchen && m.date >= from && m.date <= to,
  );
  const expected =
    (Math.round((new Date(to) - new Date(from)) / 86400000) + 1) * 2;
  if (menu.length !== expected || menu.some((m) => !m.approved))
    return {
      ready: false,
      reason: "Thiếu thực đơn hoặc số suất/công thức chưa được duyệt.",
      rows: [],
    };
  let projected = state.balances[kitchen + "|GAO"] || 0;
  const rows = [];
  for (let d = from; d <= to; d = dateAdd(d, 1)) {
    const meals = menu.filter((m) => m.date === d && m.meal === "CHIEU"),
      need = meals.reduce((n, m) => n + (m.normal + m.vegetarian) * 0.082, 0),
      opening = projected;
    const incoming = state.transfers
        .filter(
          (t) =>
            t.to === kitchen &&
            t.item === "GAO" &&
            ["IN_TRANSIT", "PARTIAL"].includes(t.status) &&
            t.due === d,
        )
        .reduce((n, t) => n + t.qty - t.received, 0),
      shortage = Math.max(0, need - opening - incoming),
      packs = Math.ceil(shortage / 25),
      suggested = packs * 25;
    projected = opening + incoming + suggested - need;
    rows.push({
      date: d,
      opening,
      need,
      incoming,
      shortage,
      suggested,
      closing: projected,
    });
  }
  return {
    ready: true,
    rows,
    note: "Minh họa gạo cho bữa chiều (82 g/suất); tồn cuối là dự kiến nếu nhận đủ lượng đề xuất. Không phải BOM đầy đủ.",
  };
}
