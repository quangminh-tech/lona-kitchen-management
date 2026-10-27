import React, { useState, useRef, useEffect } from "react";
import { Button, Table, Title, Icon } from "../components/Primitives.jsx";
import {
  defaultTemplates,
  variables,
  lineVariables,
  sampleContext,
  validateTemplate,
  documentHTML,
} from "../documents/templates.js";

const sections = [
  ["content", "Nội dung", "edit"],
  ["columns", "Bảng hàng hóa", "grid"],
  ["signatures", "Chữ ký", "people"],
  ["layout", "Trang in", "book"],
];
export function TemplateEditor({ data, send, can, notify }) {
  const [id, setId] = useState("TRANSFER"),
    [draft, setDraft] = useState(null),
    [tab, setTab] = useState("content"),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false),
    [preview, setPreview] = useState(true),
    [picker, setPicker] = useState(false),
    [query, setQuery] = useState(""),
    [target, setTarget] = useState("title"),
    [pending, setPending] = useState(null);
  const refs = useRef({}),
    selection = useRef({});
  const stored = data.templates.find((t) => t.id === id) || defaultTemplates[0];
  const template = draft || stored,
    dirty = !!draft,
    editable = can("templates.edit");
  const context = structuredClone(sampleContext);
  context.company = data.company;
  context.system.templateVersion = template.version;
  const field = (key, value) => {
    setDraft((t) => ({ ...(t || stored), [key]: value }));
    setError("");
  };
  useEffect(() => {
    const warn = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function changeTemplate(next) {
    setId(next);
    setDraft(null);
    setError("");
    setPending(null);
    setTab("content");
    setPicker(false);
  }
  function remember(key, e) {
    setTarget(key);
    selection.current[key] = [e.target.selectionStart, e.target.selectionEnd];
  }
  function insert(key) {
    const token = "{{" + key + "}}",
      value = template[target] || "",
      [start, end] = selection.current[target] || [value.length, value.length];
    field(target, value.slice(0, start) + token + value.slice(end));
    setPicker(false);
    setTab("content");
    requestAnimationFrame(() => {
      const el = refs.current[target];
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
      selection.current[target] = [start + token.length, start + token.length];
    });
  }
  async function save() {
    try {
      validateTemplate(template);
      setWorking(true);
      if (await send("template", { template })) {
        setDraft(null);
        setError("");
        notify("Đã lưu phiên bản mới. Chứng từ đã phát hành giữ nguyên.");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setWorking(false);
    }
  }
  async function pdf() {
    try {
      validateTemplate(template);
      setWorking(true);
      await (
        await import("../documents/pdf.js")
      ).downloadPDF(template, context);
    } catch (e) {
      setError(e.message);
    } finally {
      setWorking(false);
    }
  }
  let html = "",
    previewError = "";
  try {
    validateTemplate(template);
    html = documentHTML(template, context);
  } catch (e) {
    previewError = e.message;
  }
  const labels = {
    header: "Thông tin công ty",
    title: "Tiêu đề chứng từ",
    subtitle: "Số phiếu và ngày",
    info: "Thông tin giao nhận",
    footer: "Ghi chú cuối trang",
  };
  const textField = (key, rows) => (
    <label className="doc-field" key={key}>
      <span>
        {labels[key]}{" "}
        {editable && (
          <button
            type="button"
            className="text-action"
            aria-label={"Chèn biến vào " + labels[key]}
            onClick={() => {
              setTarget(key);
              setPicker(true);
              setQuery("");
            }}
          >
            Chèn biến
          </button>
        )}
      </span>
      <textarea
        aria-label={labels[key]}
        ref={(el) => (refs.current[key] = el)}
        rows={rows}
        value={template[key]}
        onSelect={(e) => remember(key, e)}
        onFocus={(e) => remember(key, e)}
        onChange={(e) => {
          field(key, e.target.value);
          remember(key, e);
        }}
      />
    </label>
  );
  const updateColumn = (i, patch) =>
    field(
      "columns",
      template.columns.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    );
  function move(i, step) {
    const next = [...template.columns],
      j = i + step;
    [next[i], next[j]] = [next[j], next[i]];
    field("columns", next);
  }
  return (
    <section className="document-workspace" aria-busy={working}>
      <Title
        title="Mẫu chứng từ"
        text="Chỉnh mẫu, kiểm tra bản in rồi lưu phiên bản mới."
      >
        <Button
          icon="eye"
          onClick={() => setPreview(!preview)}
          aria-pressed={preview}
        >
          {preview ? "Ẩn bản xem trước" : "Xem trước"}
        </Button>
        <Button
          icon="download"
          disabled={working || !!previewError}
          onClick={pdf}
        >
          Tải PDF mẫu
        </Button>
        {editable && (
          <Button
            primary
            icon="save"
            disabled={working || !dirty}
            onClick={save}
          >
            {working ? "Đang xử lý…" : "Lưu thay đổi"}
          </Button>
        )}
      </Title>
      <div className="doc-selector">
        <label>
          Mẫu đang chỉnh
          <select
            value={id}
            disabled={working}
            onChange={(e) => {
              if (dirty) setPending(e.target.value);
              else changeTemplate(e.target.value);
            }}
          >
            {data.templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <div className="doc-version">
          <span className="badge">Phiên bản {stored.version}</span>
          <span className={dirty ? "unsaved" : "saved"}>
            {dirty ? "Có thay đổi chưa lưu" : "Đã lưu"}
          </span>
        </div>
        <p>Mẫu dùng chung cho các bếp và kho.</p>
      </div>
      {pending && (
        <div className="doc-confirm" role="alert">
          <span>
            Mẫu hiện tại có thay đổi chưa lưu. Chuyển mẫu sẽ bỏ các thay đổi
            này.
          </span>
          <Button onClick={() => setPending(null)}>Tiếp tục chỉnh</Button>
          <Button onClick={() => changeTemplate(pending)}>
            Bỏ thay đổi và chuyển
          </Button>
        </div>
      )}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className={"doc-studio " + (!preview ? "without-preview" : "")}>
        <div className="doc-editor card">
          <div className="doc-tabs" role="tablist" aria-label="Cấu hình mẫu">
            {sections.map(([key, label, icon]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                aria-controls={"panel-" + key}
                id={"tab-" + key}
                onClick={() => {
                  setTab(key);
                  setPicker(false);
                }}
              >
                <Icon name={icon} size={16} />
                {label}
              </button>
            ))}
          </div>
          <div
            className="doc-panel"
            role="tabpanel"
            id={"panel-" + tab}
            aria-labelledby={"tab-" + tab}
          >
            <fieldset disabled={!editable || working}>
              {tab === "content" && (
                <>
                  <div className="section-intro">
                    <h2>Nội dung chứng từ</h2>
                    <p>Biến tự lấy thông tin từ phiếu nguồn khi phát hành.</p>
                  </div>
                  <label className="doc-field">
                    Tên mẫu
                    <input
                      value={template.name}
                      onChange={(e) => field("name", e.target.value)}
                    />
                  </label>
                  {textField("header", 3)}
                  {textField("title", 1)}
                  {textField("subtitle", 2)}
                  {textField("info", 4)}
                  {textField("footer", 2)}
                </>
              )}
              {tab === "columns" && (
                <>
                  <div className="section-intro">
                    <h2>Bảng hàng hóa</h2>
                    <p>
                      Chọn dữ liệu, đặt tên cột và sắp xếp thứ tự. Độ rộng tính
                      theo tỷ lệ.
                    </p>
                  </div>
                  <div className="doc-columns">
                    <div className="column-heading">
                      <span>Dữ liệu</span>
                      <span>Tên trên bản in</span>
                      <span>Độ rộng</span>
                      <span>Thứ tự / xóa</span>
                    </div>
                    {template.columns.map((c, i) => (
                      <div className="doc-column" key={i}>
                        <select
                          aria-label={"Dữ liệu cột " + (i + 1)}
                          value={c.key}
                          onChange={(e) =>
                            updateColumn(i, { key: e.target.value })
                          }
                        >
                          {Object.entries(lineVariables).map(([k, n]) => (
                            <option key={k} value={k}>
                              {n}
                            </option>
                          ))}
                        </select>
                        <input
                          aria-label={"Tên cột " + (i + 1)}
                          value={c.label}
                          onChange={(e) =>
                            updateColumn(i, { label: e.target.value })
                          }
                        />
                        <input
                          aria-label={"Độ rộng cột " + (i + 1)}
                          type="number"
                          min="1"
                          value={c.width}
                          onChange={(e) =>
                            updateColumn(i, { width: Number(e.target.value) })
                          }
                        />
                        <div className="column-actions">
                          <button
                            title="Đưa lên"
                            aria-label={"Đưa cột " + (i + 1) + " lên"}
                            disabled={i === 0}
                            onClick={() => move(i, -1)}
                          >
                            ↑
                          </button>
                          <button
                            title="Đưa xuống"
                            aria-label={"Đưa cột " + (i + 1) + " xuống"}
                            disabled={i === template.columns.length - 1}
                            onClick={() => move(i, 1)}
                          >
                            ↓
                          </button>
                          <button
                            title="Xóa cột"
                            aria-label={"Xóa cột " + (i + 1)}
                            disabled={template.columns.length === 1}
                            onClick={() =>
                              field(
                                "columns",
                                template.columns.filter((_, j) => j !== i),
                              )
                            }
                          >
                            <Icon name="trash" size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    disabled={template.columns.length >= 12}
                    onClick={() =>
                      field("columns", [
                        ...template.columns,
                        { key: "note", label: "Ghi chú", width: 15 },
                      ])
                    }
                  >
                    Thêm cột
                  </Button>
                  <p className="field-help">
                    {template.columns.length}/12 cột. Bản xem trước phản ánh
                    đúng thứ tự đã chọn.
                  </p>
                </>
              )}
              {tab === "signatures" && (
                <>
                  <div className="section-intro">
                    <h2>Khu vực chữ ký</h2>
                    <p>
                      Đặt tên từng vị trí ký theo thứ tự từ trái sang phải. Đây
                      là ô ký trên bản in.
                    </p>
                  </div>
                  {template.signatures.map((s, i) => (
                    <label className="doc-field" key={i}>
                      <span>Vị trí {i + 1}</span>
                      <div className="signature-row">
                        <input
                          value={s}
                          onChange={(e) =>
                            field(
                              "signatures",
                              template.signatures.map((x, j) =>
                                i === j ? e.target.value : x,
                              ),
                            )
                          }
                        />
                        <button
                          aria-label={"Xóa ô ký " + (i + 1)}
                          onClick={() =>
                            field(
                              "signatures",
                              template.signatures.filter((_, j) => j !== i),
                            )
                          }
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    </label>
                  ))}
                  <Button
                    disabled={template.signatures.length >= 5}
                    onClick={() =>
                      field("signatures", [...template.signatures, "Người ký"])
                    }
                  >
                    Thêm vị trí ký
                  </Button>
                  <p className="field-help">
                    Tối đa 5 vị trí. Tên người ký lấy theo dữ liệu chứng từ nếu
                    mẫu sử dụng biến tương ứng.
                  </p>
                </>
              )}
              {tab === "layout" && (
                <>
                  <div className="section-intro">
                    <h2>Thiết lập trang in</h2>
                    <p>Áp dụng cho bản xem trước và file PDF.</p>
                  </div>
                  <div className="doc-print-options">
                    <label>
                      Khổ giấy
                      <select
                        value={template.orientation}
                        onChange={(e) => field("orientation", e.target.value)}
                      >
                        <option value="portrait">A4 dọc</option>
                        <option value="landscape">A4 ngang</option>
                      </select>
                    </label>
                    <label>
                      Cỡ chữ nội dung
                      <input
                        type="number"
                        min="8"
                        max="14"
                        value={template.fontSize}
                        onChange={(e) =>
                          field("fontSize", Number(e.target.value))
                        }
                      />
                      <small>Từ 8 đến 14 pt</small>
                    </label>
                  </div>
                  <div className="doc-note">
                    <Icon name="book" />
                    <p>
                      Bảng dài tự sang trang trong PDF. Hãy tải PDF mẫu để kiểm
                      tra ngắt trang trước khi sử dụng.
                    </p>
                  </div>
                </>
              )}
            </fieldset>
          </div>
          <div className="doc-editor-footer">
            <Icon name="shield" size={16} />
            <span>
              Lưu tạo phiên bản mới. Chứng từ đã phát hành giữ nguyên.
            </span>
          </div>
        </div>
        {preview && (
          <aside className="doc-preview card">
            <header>
              <div>
                <Icon name="eye" />
                <b>Bản xem trước</b>
              </div>
              <span>
                Dữ liệu minh họa · A4{" "}
                {template.orientation === "portrait" ? "dọc" : "ngang"}
              </span>
            </header>
            {previewError ? (
              <div className="error" role="status">
                {previewError}
              </div>
            ) : (
              <iframe title="Xem trước mẫu chứng từ" sandbox="" srcDoc={html} />
            )}
            <p>Kiểm tra phân trang bằng file PDF mẫu.</p>
          </aside>
        )}
      </div>
      {picker && (
        <div className="variable-overlay" onClick={() => setPicker(false)}>
          <section
            className="variable-dialog card"
            role="dialog"
            aria-modal="true"
            aria-label="Chèn biến"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setPicker(false);
              if (e.key === "Tab") {
                const list = [
                  ...e.currentTarget.querySelectorAll("button,input"),
                ];
                const first = list[0],
                  last = list.at(-1);
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <header>
              <div>
                <h2>Chèn biến</h2>
                <p>Chèn vào: {labels[target]}</p>
              </div>
              <button
                aria-label="Đóng chọn biến"
                onClick={() => {
                  setPicker(false);
                  refs.current[target]?.focus();
                }}
              >
                <Icon name="close" />
              </button>
            </header>
            <div className="variable-search">
              <Icon name="search" />
              <input
                autoFocus
                placeholder="Tìm số phiếu, kho nhận, công ty…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="variable-results">
              {Object.entries(variables)
                .filter(([k, n]) =>
                  (n + " " + k)
                    .toLocaleLowerCase("vi")
                    .includes(query.toLocaleLowerCase("vi")),
                )
                .map(([k, n]) => (
                  <button key={k} onClick={() => insert(k)}>
                    <span>
                      <b>{n}</b>
                      <code>{"{{" + k + "}}"}</code>
                    </span>
                    <Icon name="plus" size={16} />
                  </button>
                ))}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
export function DocumentArchive({ data, send, can, notify }) {
  const [source, setSource] = useState(""),
    [template, setTemplate] = useState("TRANSFER"),
    [working, setWorking] = useState(false);
  const sources = [
    ...data.transfers,
    ...data.issues,
    ...(data.stockReceipts || []),
  ];
  const sourceType = (id) =>
    data.issues.some((d) => d.id === id)
      ? "ISSUE"
      : (data.stockReceipts || []).some((d) => d.id === id)
        ? "RECEIVE"
        : "TRANSFER";
  async function publish() {
    setWorking(true);
    try {
      await send("publish", { transferId: source, templateId: template });
    } finally {
      setWorking(false);
    }
  }
  async function pdf(d) {
    setWorking(true);
    try {
      await (
        await import("../documents/pdf.js")
      ).downloadPDF(d.template, d.context);
    } catch (e) {
      notify(e.message);
    } finally {
      setWorking(false);
    }
  }
  return (
    <>
      <Title
        title="Chứng từ đã phát hành"
        text="Mỗi bản lưu dữ liệu phiếu và mẫu tại thời điểm phát hành; in lại không lấy mẫu mới."
      />
      <div className="toolbar">
        <label>
          Phiếu nguồn
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setTemplate(sourceType(e.target.value));
            }}
          >
            <option value="">Chọn phiếu</option>
            {sources.map((t) => (
              <option key={t.id} value={t.id}>
                {t.number} · {t.status}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mẫu
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          >
            {data.templates
              .filter(
                (t) =>
                  t.id === sourceType(source) ||
                  (t.id === "REQUEST" && sourceType(source) === "TRANSFER"),
              )
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} v{t.version}
                </option>
              ))}
          </select>
        </label>
        <Button
          primary
          disabled={!source || working || !can("documents.publish")}
          onClick={publish}
        >
          Phát hành bản in
        </Button>
      </div>
      <Table
        heads={[
          "Số phiếu",
          "Mẫu / phiên bản",
          "Trạng thái nguồn",
          "Người phát hành",
          "Thời điểm",
          "",
        ]}
        rows={data.documents.map((d) => [
          d.number,
          d.template.name + " · v" + d.template.version,
          d.context.document.status,
          d.publishedBy,
          new Date(d.publishedAt).toLocaleString("vi-VN"),
          <Button
            disabled={working || !can("documents.view")}
            onClick={() => pdf(d)}
          >
            Tải PDF
          </Button>,
        ])}
      />
    </>
  );
}
