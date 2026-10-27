export const variables = {
  "company.name": "Tên công ty",
  "company.address": "Địa chỉ",
  "company.taxCode": "Mã số thuế",
  "document.number": "Số chứng từ",
  "document.date": "Ngày chứng từ",
  "document.status": "Trạng thái",
  "document.reason": "Lý do",
  "document.reference": "Chứng từ nguồn",
  "warehouse.from": "Kho xuất",
  "warehouse.to": "Kho nhận",
  "kitchen.name": "Bộ phận/bếp",
  "signatures.requester": "Người lập",
  "signatures.approver": "Người duyệt",
  "signatures.sender": "Thủ kho xuất",
  "signatures.receiver": "Người nhận",
  "totals.quantity": "Tổng lượng (chỉ khi cùng ĐVT)",
  "system.printedAt": "Thời điểm in",
  "system.templateVersion": "Phiên bản mẫu",
};
export const lineVariables = {
  index: "STT",
  code: "Mã hàng",
  name: "Tên hàng",
  unit: "ĐVT",
  stock: "Tồn tại thời điểm lập",
  requested: "Yêu cầu",
  approved: "Phê duyệt",
  dispatched: "Thực xuất",
  received: "Thực nhận",
  inTransit: "Đang đi",
  note: "Ghi chú",
};
export const defaultTemplates = [
  {
    id: "TRANSFER",
    name: "Phiếu điều chuyển nội bộ",
    version: 1,
    title: "PHIẾU ĐIỀU CHUYỂN NỘI BỘ",
    subtitle: "Số {{document.number}} · Ngày {{document.date}}",
    header: "{{company.name}}\n{{company.address}}\nMST: {{company.taxCode}}",
    info: "Kho xuất: {{warehouse.from}}\nKho nhận: {{warehouse.to}}\nLý do: {{document.reason}}\nTham chiếu: {{document.reference}}",
    footer: "Ghi chú: {{document.reason}}\nMẫu v{{system.templateVersion}}",
    columns: [
      { key: "index", label: "STT", width: 6 },
      { key: "code", label: "Mã hàng", width: 12 },
      { key: "name", label: "Tên hàng", width: 26 },
      { key: "unit", label: "ĐVT", width: 8 },
      { key: "requested", label: "Yêu cầu", width: 12 },
      { key: "dispatched", label: "Thực xuất", width: 12 },
      { key: "received", label: "Thực nhận", width: 12 },
      { key: "inTransit", label: "Đang đi", width: 12 },
    ],
    signatures: [
      "Người lập",
      "Thủ kho xuất",
      "Người vận chuyển",
      "Thủ kho nhận",
    ],
    fontSize: 10,
    orientation: "portrait",
  },
  {
    id: "ISSUE",
    name: "Phiếu xuất cho sản xuất",
    version: 1,
    title: "PHIẾU XUẤT KHO",
    subtitle: "Số {{document.number}} · Ngày {{document.date}}",
    header: "{{company.name}}\n{{company.address}}",
    info: "Bộ phận: {{kitchen.name}}\nKho xuất: {{warehouse.from}}\nLý do: {{document.reason}}\nTheo: {{document.reference}}",
    footer: "{{document.status}} · Mẫu v{{system.templateVersion}}",
    columns: [
      { key: "index", label: "STT", width: 6 },
      { key: "code", label: "Mã", width: 12 },
      { key: "name", label: "Tên nguyên liệu", width: 30 },
      { key: "unit", label: "ĐVT", width: 8 },
      { key: "requested", label: "Yêu cầu", width: 14 },
      { key: "approved", label: "Duyệt", width: 14 },
      { key: "dispatched", label: "Thực xuất", width: 16 },
    ],
    signatures: ["Người lập phiếu", "Người nhận", "Thủ kho", "Người duyệt"],
    fontSize: 10,
    orientation: "portrait",
  },
  {
    id: "REQUEST",
    name: "Phiếu đề nghị xuất",
    version: 1,
    title: "PHIẾU ĐỀ NGHỊ XUẤT KHO",
    subtitle: "Số {{document.number}} · Ngày {{document.date}}",
    header: "{{company.name}}",
    info: "Bộ phận: {{kitchen.name}}\nKho: {{warehouse.from}}\nLý do: {{document.reason}}",
    footer:
      "Phiếu đề nghị chưa làm giảm tồn kho.\nMẫu v{{system.templateVersion}}",
    columns: [
      { key: "index", label: "STT", width: 6 },
      { key: "name", label: "Tên gia vị / nguyên liệu", width: 38 },
      { key: "unit", label: "ĐVT", width: 10 },
      { key: "stock", label: "Tồn", width: 14 },
      { key: "requested", label: "Đề xuất", width: 16 },
      { key: "approved", label: "Phê duyệt", width: 16 },
    ],
    signatures: ["Người đề nghị", "Người duyệt", "Thủ kho"],
    fontSize: 10,
    orientation: "portrait",
  },
];
export function resolve(context, path) {
  return path.split(".").reduce((o, k) => o?.[k], context);
}
export function renderText(text, context) {
  return String(text || "").replace(/\{\{\s*([a-zA-Z.]+)\s*\}\}/g, (_, key) => {
    if (!variables[key]) throw Error("Biến không được hỗ trợ: " + key);
    const val = resolve(context, key);
    if (val === undefined || val === null)
      throw Error("Chưa có dữ liệu cho biến " + key);
    return String(val);
  });
}
export function validateTemplate(t) {
  if (
    !t.id ||
    !t.name?.trim() ||
    !t.title?.trim() ||
    !t.columns?.length ||
    t.columns.length > 12
  )
    throw Error("Mẫu cần tên, tiêu đề và 1–12 cột.");
  if (
    !["portrait", "landscape"].includes(t.orientation) ||
    t.fontSize < 8 ||
    t.fontSize > 14
  )
    throw Error("Khổ giấy hoặc cỡ chữ không hợp lệ.");
  for (const c of t.columns)
    if (
      !lineVariables[c.key] ||
      !c.label?.trim() ||
      !Number.isFinite(c.width) ||
      c.width <= 0
    )
      throw Error("Cột hoặc độ rộng không hợp lệ.");
  if (t.signatures.length > 5 || t.signatures.some((s) => !s.trim()))
    throw Error("Tối đa 5 ô chữ ký có nhãn.");
  for (const k of ["header", "title", "subtitle", "info", "footer"]) {
    const text = t[k] || "";
    if (text.length > 4000) throw Error("Nội dung mẫu quá dài.");
    for (const m of text.matchAll(/\{\{(.*?)\}\}/g))
      if (!variables[m[1].trim()])
        throw Error("Biến không được hỗ trợ: " + m[1]);
    if (text.replace(/\{\{[^{}]+\}\}/g, "").includes("{{"))
      throw Error("Biến thiếu dấu đóng.");
  }
  return true;
}
export const sampleContext = {
  company: {
    name: "CÔNG TY TNHH LONA FOOD",
    address: "Địa chỉ doanh nghiệp",
    taxCode: "Chưa khai báo",
  },
  document: {
    number: "DC-2026-0001",
    date: "27/10/2026",
    status: "BẢN NHÁP",
    reason: "Cấp nguyên liệu theo kế hoạch nấu",
    reference: "KHNAU-CG-20261028",
  },
  warehouse: { from: "Kho trung tâm", to: "Kho Cần Giờ" },
  kitchen: { name: "Bếp Cần Giờ" },
  signatures: { requester: "", approver: "", sender: "", receiver: "" },
  totals: { quantity: "Không cộng khác đơn vị" },
  system: { printedAt: "27/10/2026", templateVersion: 1 },
  lines: [
    {
      index: 1,
      code: "GAO",
      name: "Gạo thơm",
      unit: "kg",
      stock: 1000,
      requested: 100,
      approved: 100,
      dispatched: 100,
      received: 60,
      inTransit: 40,
      note: "",
    },
    {
      index: 2,
      code: "DAU",
      name: "Dầu ăn",
      unit: "lít",
      stock: 100,
      requested: 10,
      approved: 10,
      dispatched: 10,
      received: 10,
      inTransit: 0,
      note: "",
    },
  ],
};
export function documentHTML(template, context) {
  validateTemplate(template);
  const esc = (x) =>
    String(x ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const text = (k) =>
    esc(renderText(template[k], context)).replace(/\n/g, "<br>");
  const width = template.columns.reduce((a, c) => a + c.width, 0);
  return `<!doctype html><html lang="vi"><meta charset="utf-8"><title>${esc(context.document.number)}</title><style>@page{size:A4 ${template.orientation};margin:15mm}body{font:${template.fontSize}pt/1.6 Arial;color:#111;margin:25px}h1{text-align:center;font-size:18pt;margin:25px 0 4px}.subtitle{text-align:center;margin-bottom:22px}table{border-collapse:collapse;width:100%;margin:22px 0;table-layout:fixed}th,td{border:1px solid #888;padding:7px;overflow-wrap:anywhere;vertical-align:top}thead{display:table-header-group}tr{break-inside:avoid}th{background:#f2f3f2}.signatures{display:flex;gap:12px;margin:30px 0 65px;break-inside:avoid}.signatures div{flex:1;text-align:center}.signatures small{display:block}.footer{font-size:9pt;white-space:normal}button{padding:10px}@media print{button{display:none}body{margin:0}}</style><div>${text("header")}</div><h1>${text("title")}</h1><div class="subtitle">${text("subtitle")}</div><div>${text("info")}</div><table><thead><tr>${template.columns.map((c) => `<th style="width:${(100 * c.width) / width}%">${esc(c.label)}</th>`).join("")}</tr></thead><tbody>${context.lines.map((l) => `<tr>${template.columns.map((c) => `<td>${esc(l[c.key])}</td>`).join("")}</tr>`).join("")}</tbody></table><div class="signatures">${template.signatures.map((s) => `<div><b>${esc(s)}</b><small>(Ký, ghi rõ họ tên)</small></div>`).join("")}</div><div class="footer">${text("footer")}</div><p style="font-size:8pt">${esc(context.document.status)} · ${esc(context.document.number)}</p><button onclick="window.print()">In / Lưu thành PDF</button></html>`;
}
