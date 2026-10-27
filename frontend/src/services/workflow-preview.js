import { id, execute } from "./operations-engine.js";
export function workflowPreview(state, type, p) {
  const s = structuredClone(state),
    at = new Date().toISOString();
  s.stockReceipts ||= [];
  s.importKeys ||= {};
  const stock = (w, i) => Number(s.balances[w + "|" + i] || 0),
    move = (from, to, item, qty, doc) => {
      if (!(qty > 0) || stock(from, item) < qty) throw Error("Không đủ tồn.");
      s.balances[from + "|" + item] = stock(from, item) - qty;
      s.balances[to + "|" + item] = stock(to, item) + qty;
      s.ledger.push({
        id: id(),
        doc,
        from,
        to,
        item,
        qty,
        actor: "preview",
        at,
      });
    };
  if (["purchaseBatch", "transferBatch", "issueManual"].includes(type)) {
    if (!p.lines?.length) throw Error("Phiếu cần dòng hàng.");
    const seen = new Set();
    for (const l of p.lines) {
      const i = s.items.find((x) => x.id === l.itemId);
      if (
        !i ||
        i.unit !== l.unit ||
        !(l.quantity > 0) ||
        !Number.isFinite(l.quantity) ||
        seen.has(l.itemId)
      )
        throw Error("Sai mã hàng, lượng, đơn vị hoặc trùng mã.");
      seen.add(l.itemId);
    }
    if (p.importKey && s.importKeys[p.importKey])
      throw Error("Đã import nội dung này.");
  }
  if (type === "purchaseBatch") {
    const batchId = id(),
      number = "DM-" + String(s.orders.length + 1).padStart(5, "0");
    for (const l of p.lines)
      s.orders.push({
        id: id(),
        number,
        batchId,
        warehouseId: p.warehouseId,
        itemId: l.itemId,
        quantity: l.quantity,
        received: 0,
        dueDate: p.dueDate,
        supplier: p.supplier,
        reference: p.reference,
        sourceKind: "MANUAL",
        createdBy: "preview",
        createdAt: at,
      });
  } else if (type === "purchaseReceive") {
    const o = s.orders.find((x) => x.id === p.id);
    if (!o || !(p.qty > 0) || p.qty > o.quantity - o.received)
      throw Error("Nhận vượt lượng còn thiếu.");
    o.received += p.qty;
    s.balances[o.warehouseId + "|" + o.itemId] =
      stock(o.warehouseId, o.itemId) + p.qty;
    const receipt = {
      id: id(),
      number: "PNK-" + String(s.stockReceipts.length + 1).padStart(5, "0"),
      sourceKind: "RECEIVE",
      from: "SUPPLIER",
      to: o.warehouseId,
      due: new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
      }),
      reason: "Nhận hàng theo đề nghị " + o.number,
      status: "POSTED",
      reference: o.id,
      createdBy: "preview",
      createdAt: at,
      lines: [{ item: o.itemId, qty: p.qty, received: p.qty }],
    };
    s.stockReceipts.push(receipt);
    s.ledger.push({
      id: id(),
      doc: receipt.id,
      source: o.id,
      from: "SUPPLIER",
      to: o.warehouseId,
      item: o.itemId,
      qty: p.qty,
      actor: "preview",
      at,
    });
  } else if (type === "transferBatch") {
    let n = s;
    for (const l of p.lines)
      n = execute(n, {
        type: "create",
        payload: { ...p, item: l.itemId, qty: l.quantity },
        revision: n.revision,
        requestId: id(),
      });
    for (const t of n.transfers.slice(s.transfers.length)) {
      t.createdAt = at;
      t.createdBy = "preview";
      t.history = [{ label: "Lập yêu cầu", at, actor: "preview" }];
    }
    if (p.importKey) n.importKeys[p.importKey] = at;
    return n;
  } else if (type === "issueManual") {
    for (const l of p.lines) {
      const held = s.transfers
        .filter(
          (t) =>
            t.from === p.from && t.item === l.itemId && t.status === "APPROVED",
        )
        .reduce((sum, t) => sum + t.qty, 0);
      if (stock(p.from, l.itemId) - held < l.quantity)
        throw Error("Không đủ khả dụng: " + l.itemId);
    }
    const doc = {
      id: id(),
      number: "PXK-" + String(s.issues.length + 1).padStart(5, "0"),
      sourceKind: "ISSUE",
      from: p.from,
      to: "PRODUCTION",
      due: p.due,
      status: "POSTED",
      reason: p.reason,
      reference: p.reference,
      createdAt: at,
      createdBy: "preview",
      lines: p.lines.map((l) => ({ item: l.itemId, qty: l.quantity })),
    };
    for (const l of p.lines)
      move(p.from, "PRODUCTION", l.itemId, l.quantity, doc.id);
    s.issues.push(doc);
  } else if (type === "publish") {
    const d = [...s.transfers, ...s.issues, ...s.stockReceipts].find(
        (d) => d.id === p.transferId,
      ),
      template = s.templates.find((t) => t.id === p.templateId);
    if (!d || !template) throw Error("Không có phiếu nguồn hoặc mẫu.");
    const expected =
      d.sourceKind === "ISSUE"
        ? "ISSUE"
        : d.sourceKind === "RECEIVE"
          ? "RECEIVE"
          : "TRANSFER";
    if (
      template.id !== expected &&
      !(expected === "TRANSFER" && template.id === "REQUEST")
    )
      throw Error("Mẫu không khớp phiếu.");
    const wh = (id) => s.warehouses.find((w) => w.id === id)?.name || id,
      key =
        d.id +
        "|" +
        template.id +
        "|" +
        template.version +
        "|" +
        d.status +
        "|" +
        (d.received || 0);
    if (!s.documents.some((x) => x.key === key))
      s.documents.push({
        id: id(),
        key,
        number: d.number,
        warehouseFrom: d.from,
        warehouseTo: d.to,
        template: structuredClone(template),
        publishedBy: "preview",
        publishedAt: at,
        context: {
          company: structuredClone(s.company),
          document: {
            number: d.number,
            date: d.due,
            status: d.status,
            reason: d.reason || "Dữ liệu demo cục bộ",
            reference: d.reference || "",
          },
          warehouse: { from: wh(d.from), to: wh(d.to) },
          kitchen: { name: wh(d.sourceKind === "ISSUE" ? d.from : d.to) },
          signatures: {
            requester: d.createdBy || "preview",
            approver: d.approvedBy || "",
            sender: "",
            receiver: "",
          },
          totals: { quantity: "Không cộng khác đơn vị" },
          system: { printedAt: at, templateVersion: template.version },
          lines: (
            d.lines || [{ item: d.item, qty: d.qty, received: d.received }]
          ).map((l, i) => {
            const item = s.items.find((x) => x.id === l.item),
              dispatched = [
                "POSTED",
                "PARTIAL",
                "IN_TRANSIT",
                "RECEIVED",
              ].includes(d.status)
                ? l.qty
                : 0;
            return {
              index: i + 1,
              code: l.item,
              name: item?.name,
              unit: item?.unit,
              stock: d.stockSnapshot || 0,
              requested: l.qty,
              approved: d.status === "DRAFT" ? 0 : l.qty,
              dispatched,
              received: l.received || 0,
              inTransit:
                expected === "TRANSFER" ? dispatched - (l.received || 0) : 0,
              note: "",
            };
          }),
        },
      });
  } else if (type === "menuImport") {
    for (const m of p.meals) {
      const old = s.menus.find(
        (x) =>
          x.kitchen === p.kitchen && x.date === m.date && x.meal === m.meal,
      );
      if (old?.approved) throw Error("Bữa đã chốt, không import thay thế.");
      s.menus = s.menus.filter((x) => x.id !== old?.id);
      s.menus.push({
        ...m,
        id: old?.id || id(),
        kitchen: p.kitchen,
        approved: false,
        dishes: m.rows.map(
          (r) => s.base.dishes.find((d) => d.id === r.dishId)?.name || r.dishId,
        ),
      });
    }
  } else return null;
  if (p.importKey) s.importKeys[p.importKey] = at;
  s.revision++;
  return s;
}
