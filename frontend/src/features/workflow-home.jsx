import React, { useState } from "react";
import { Button, Icon, Title, Table } from "../components/Primitives.jsx";
import { validateMenuCSV, saveText } from "../services/import-workflow.js";
export function MenuImport({ catalog, kitchen, send, busy, can }) {
  const [open, setOpen] = useState(false),
    [result, setResult] = useState(null),
    [error, setError] = useState("");
  return (
    <>
      <div className="menu-import-toolbar">
        <Button
          disabled={!can("menus.edit") || busy}
          icon="upload"
          onClick={() => setOpen(!open)}
        >
          Import thực đơn CSV
        </Button>
        <span>Nhập theo mã món, ngày và ca; kiểm tra trước khi lưu.</span>
      </div>
      {open && (
        <section className="card menu-import-panel">
          <h3>Import thực đơn · bếp {kitchen}</h3>
          <p>
            Một dòng là một món. Các dòng cùng ngày/ca phải có cùng số suất.
            Dùng mã món có trong danh mục; import giữ trạng thái nháp. Bữa đã
            chốt không bị ghi đè.
          </p>
          <div className="actions">
            <Button
              icon="download"
              onClick={() =>
                saveText(
                  "LONA_thuc_don.csv",
                  "date,meal,normal,vegetarian,replacement,slot,dishId,scope\n2026-12-01,SANG,80,0,0,Món sáng,PHOGA,main\n2026-12-01,SANG,80,0,0,Tráng miệng,CHUOI,shared",
                )
              }
            >
              Tải CSV mẫu
            </Button>
            <label className="file-button">
              Chọn CSV
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={busy}
                onChange={async (e) => {
                  setError("");
                  setResult(null);
                  try {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 1000000) throw Error("File tối đa 1 MB");
                    setResult(validateMenuCSV(await f.text(), catalog));
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              />
            </label>
            <Button
              onClick={() =>
                saveText(
                  "LONA_ma_mon.csv",
                  "dishId,name\n" +
                    catalog.dishes
                      .filter((d) => !d.isSubrecipe)
                      .map(
                        (d) => d.id + ',"' + d.name.replaceAll('"', '""') + '"',
                      )
                      .join("\n"),
                )
              }
            >
              Danh sách mã món
            </Button>
          </div>
          {error && <div className="error">{error}</div>}
          {result && (
            <>
              <p>
                {result.rows.length} dòng món · {result.meals.length} bữa ·{" "}
                {result.errors.length} lỗi
              </p>
              {result.errors.length > 0 ? (
                <div className="error">
                  {result.errors.map((e, i) => (
                    <div key={i}>{e}</div>
                  ))}
                </div>
              ) : (
                <>
                  <Table
                    heads={["Ngày", "Ca", "Số suất", "Số món"]}
                    rows={result.meals.map((m) => [
                      m.date,
                      m.meal,
                      m.normal + m.vegetarian,
                      m.rows.length,
                    ])}
                  />
                  <Button
                    primary
                    disabled={busy || !can("menus.edit")}
                    onClick={async () => {
                      if (
                        await send("menuImport", {
                          kitchen,
                          meals: result.meals,
                        })
                      ) {
                        setResult(null);
                        setOpen(false);
                      }
                    }}
                  >
                    Xác nhận import {result.meals.length} bữa
                  </Button>
                </>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}
export function WorkflowHome({ data, send, busy, can, apiEnabled }) {
  const [question, setQuestion] = useState(false);
  const docs = data.documents || [],
    orders = data.orders || [],
    receipts = data.stockReceipts || [];
  const go = (hash) => (location.hash = hash);
  return (
    <>
      <Title
        title="Vận hành bếp & kho"
        text="Theo dõi công việc theo luồng, từ thực đơn đến chứng từ."
      />
      <div className="warehouse-kpis">
        <div>
          <span>Bữa chưa chốt</span>
          <b>{data.menus.filter((m) => !m.approved).length}</b>
        </div>
        <div>
          <span>Đề nghị mua còn thiếu</span>
          <b>{orders.filter((o) => o.received < o.quantity).length}</b>
        </div>
        <div>
          <span>Phiếu đang giao</span>
          <b>
            {
              data.transfers.filter((t) =>
                ["IN_TRANSIT", "PARTIAL"].includes(t.status),
              ).length
            }
          </b>
        </div>
        <div>
          <span>Chứng từ đã phát hành</span>
          <b>{docs.length}</b>
        </div>
      </div>
      <section className="card workflow-map">
        <header>
          <div>
            <h2>Luồng công việc</h2>
            <p>Mở từng bước để xem dữ liệu và xử lý việc tiếp theo.</p>
          </div>
          {data.demoLoaded && (
            <span className="badge success">Đã có bộ mẫu liên kết</span>
          )}
        </header>
        <div className="workflow-map-steps">
          {[
            [
              "calendar",
              "calendar",
              "1",
              "Thực đơn",
              "Chọn ca, nhiều món, số suất và chốt bữa",
              data.menus.length + " bữa",
            ],
            [
              "schedule",
              "clock",
              "2",
              "Nhu cầu nguyên liệu",
              "Tính BOM theo định mức và tồn khả dụng",
              data.jobs.length + " lần tính",
            ],
            [
              "purchase",
              "cart",
              "3",
              "Mua / điều chuyển",
              "Đặt lượng thiếu hoặc cấp hàng giữa kho",
              orders.length + " dòng mua",
            ],
            [
              "stock",
              "box",
              "4",
              "Nhập / xuất kho",
              "Nhận thực tế, xuất bếp và xem biến động",
              receipts.length +
                " phiếu nhập · " +
                data.issues.length +
                " phiếu xuất",
            ],
            [
              "documents",
              "book",
              "5",
              "Chứng từ",
              "Phát hành PDF gắn với phiếu nguồn",
              docs.length + " bản in",
            ],
          ].map(([route, icon, n, label, desc, count]) => (
            <button key={route} onClick={() => go(route)}>
              <span className="workflow-step-number">{n}</span>
              <Icon name={icon} size={24} />
              <b>{label}</b>
              <p>{desc}</p>
              <small>{count}</small>
              <span className="workflow-open">Mở →</span>
            </button>
          ))}
        </div>
      </section>
      <div className="home-columns">
        <section className="card demo-case">
          <h2>Tình huống mẫu để trình khách</h2>
          <p>Bếp nhánh 02 · thực đơn 02–04/11/2026 · mốc D: 01/11/2026.</p>
          <ol>
            <li>Thực đơn đã chốt và kế hoạch D+1 có đủ công thức.</li>
            <li>Mua lượng thiếu theo kế hoạch; nhận hàng sinh phiếu nhập.</li>
            <li>Xuất bếp theo đúng BOM và phát hành PDF.</li>
            <li>
              Một đề nghị mua còn chờ 60 kg, điều chuyển còn đang đi 12 kg để
              thử nhận tiếp.
            </li>
          </ol>
          {data.demoLoaded ? (
            <div className="actions">
              <Button
                onClick={() => {
                  localStorage.setItem(
                    "lona-context-v7",
                    JSON.stringify({
                      kitchen: "B2",
                      month: "2026-11",
                      date: "2026-11-01",
                    }),
                  );
                  go("calendar");
                }}
              >
                Xem thực đơn mẫu
              </Button>
              <Button onClick={() => go("purchase")}>Xem mua & nhận</Button>
              <Button onClick={() => go("transfers")}>
                Xem timeline chuyển kho
              </Button>
            </div>
          ) : (
            can("roles.manage") && (
              <>
                <Button
                  disabled={busy}
                  primary
                  onClick={() => setQuestion(!question)}
                >
                  Nạp bộ mẫu liên kết
                </Button>
                {question && (
                  <div className="demo-confirm">
                    <p>
                      Bổ sung giao dịch mẫu tại bếp B2, có nhập/xuất và làm thay
                      đổi tồn. Không xóa dữ liệu cũ. Dừng nếu B2 đã có thực đơn
                      trùng ngày. Chỉ dùng trên môi trường demo.
                    </p>
                    <Button
                      disabled={busy || !apiEnabled}
                      primary
                      onClick={async () => {
                        if (await send("loadDemo", {})) setQuestion(false);
                      }}
                    >
                      Xác nhận nạp mẫu
                    </Button>
                  </div>
                )}
              </>
            )
          )}
        </section>
        <section className="card demo-case">
          <h2>Import & lập phiếu</h2>
          <div className="home-help">
            <b>Thực đơn</b>
            <p>
              Vào Thực đơn → Import CSV → tải mẫu → nhập mã món → xem lỗi → xác
              nhận.
            </p>
            <b>Hàng hóa trên phiếu</b>
            <p>
              Kho & mua hàng → chọn tab → Lập phiếu → tải CSV mẫu → chọn file →
              kiểm tra → lập phiếu.
            </p>
            <b>Chứng từ</b>
            <p>
              Mở Chi tiết phiếu → Phát hành bản in → tải PDF. Mỗi lần nhận tạo
              một phiếu nhập riêng.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
