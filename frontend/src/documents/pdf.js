import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fontData from "./font-data.js";
import { validateTemplate, renderText } from "./templates.js";
export async function makePDF(t, c) {
  validateTemplate(t);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const bytes = Uint8Array.from(atob(fontData), (x) => x.charCodeAt(0));
  const font = await doc.embedFont(bytes, { subset: true });
  const size =
      t.orientation === "landscape" ? [841.89, 595.28] : [595.28, 841.89],
    margin = 35,
    width = size[0] - 2 * margin,
    fs = t.fontSize,
    leading = fs * 1.5;
  let page, y;
  const gray = rgb(0.45, 0.48, 0.46),
    black = rgb(0.1, 0.13, 0.11);
  function wrap(text, w, f = fs) {
    const lines = [];
    for (const para of String(text ?? "").split("\n")) {
      let line = "";
      for (const ch of para) {
        if (font.widthOfTextAtSize(line + ch, f) > w && line) {
          lines.push(line.trimEnd());
          line = "";
        }
        line += ch;
      }
      lines.push(line);
    }
    return lines;
  }
  function draw(text, x, top, w, f = fs, color = black) {
    const lines = wrap(text, w, f);
    for (let i = 0; i < lines.length; i++)
      page.drawText(lines[i], {
        x,
        y: top - f - i * f * 1.5,
        size: f,
        font,
        color,
      });
    return lines.length * f * 1.5;
  }
  function newPage() {
    page = doc.addPage(size);
    y = size[1] - margin;
  }
  function block(text, f = fs) {
    const lines = wrap(text, width, f);
    for (const line of lines) {
      if (y - f * 1.5 < margin + 22) newPage();
      draw(line, margin, y, width, f);
      y -= f * 1.5;
    }
    y -= 8;
  }
  newPage();
  block(renderText(t.header, c));
  y -= 6;
  block(renderText(t.title, c), 16);
  block(renderText(t.subtitle, c), 10);
  block(renderText(t.info, c));
  const total = t.columns.reduce((n, col) => n + col.width, 0),
    widths = t.columns.map((col) => (width * col.width) / total);
  function row(values, header = false) {
    const heights = values.map(
        (v, i) => wrap(v, widths[i] - 10).length * leading + 12,
      ),
      h = Math.max(...heights);
    if (h > size[1] - margin * 2 - 50)
      throw Error(
        "Một dòng quá dài để in. Rút gọn nội dung hoặc tăng chiều rộng cột.",
      );
    if (y - h < margin + 35) {
      newPage();
      if (!header)
        row(
          t.columns.map((col) => col.label),
          true,
        );
    }
    let x = margin;
    for (let i = 0; i < values.length; i++) {
      page.drawRectangle({
        x,
        y: y - h,
        width: widths[i],
        height: h,
        color: header ? rgb(0.94, 0.96, 0.94) : rgb(1, 1, 1),
        borderColor: gray,
        borderWidth: 0.45,
      });
      draw(values[i], x + 5, y - 6, widths[i] - 10);
      x += widths[i];
    }
    y -= h;
  }
  row(
    t.columns.map((col) => col.label),
    true,
  );
  for (const line of c.lines)
    row(t.columns.map((col) => String(line[col.key] ?? "")));
  y -= 22;
  const sigHeight = 80;
  if (y - sigHeight < margin + 35) newPage();
  const sw = width / Math.max(1, t.signatures.length);
  for (let i = 0; i < t.signatures.length; i++) {
    draw(t.signatures[i], margin + i * sw, y, sw - 9, 9);
    draw("(Ký, ghi rõ họ tên)", margin + i * sw, y - 28, sw - 9, 8, gray);
  }
  y -= sigHeight;
  block(renderText(t.footer, c), 9);
  block(c.document.status, 9);
  const pages = doc.getPages();
  pages.forEach((p, i) =>
    p.drawText(c.document.number + " · " + (i + 1) + "/" + pages.length, {
      x: margin,
      y: 18,
      size: 8,
      font,
      color: gray,
    }),
  );
  return doc.save();
}
export async function downloadPDF(t, c) {
  const bytes = await makePDF(t, c);
  const u = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = u;
  a.download = c.document.number.replace(/[^a-zA-Z0-9_-]/g, "_") + ".pdf";
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
