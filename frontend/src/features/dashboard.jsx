import React from "react";
import { Icon, Button, Table, Title } from "../components/Primitives.jsx";
import { analyse } from "../engine.js";
import { days, dayLabel, f, money } from "../services/format.js";
export function Dashboard({ s, can, navigate }) {
  const r = analyse(s, days[0], days[6]),
    meals = s.plans.length,
    people = s.plans.reduce(
      (n, p) =>
        n +
        p.normal +
        p.vegetarian +
        (p.replacementIncluded ? 0 : p.replacement),
      0,
    ),
    pending = s.orders.filter((o) => o.received < o.quantity),
    short = r.totals.filter((t) => t.shortage > 0),
    unapproved = s.recipes.filter((r) => !r.approved).length;
  return (
    <>
      <Title
        title="Tổng quan vận hành"
        text="Tuần 26/10 – 01/11/2026 · Bếp Cần Giờ"
      >
        <span className="badge success">Tuần mẫu đang hoạt động</span>
      </Title>
      <div className="kpis">
        {[
          ["calendar", "Bữa trong tuần", meals, "7 ngày · sáng và chiều"],
          [
            "people",
            "Lượt suất ăn",
            f(people),
            "Đã tính riêng chay và thay thế",
          ],
          ["box", "Nguyên liệu thiếu", short.length, "Theo dự trù cả tuần"],
          ["cart", "Đơn đang chờ nhận", pending.length, "Theo lượng chưa nhận"],
        ].map(([icon, label, value, note]) => (
          <article className="kpi" key={label}>
            <span className="kpi-icon">
              <Icon name={icon} size={23} />
            </span>
            <div>
              <span>{label}</span>
              <b>{value}</b>
              <small>{note}</small>
            </div>
          </article>
        ))}
      </div>
      <div className="dashboard-columns">
        <section className="card">
          <header>
            <div>
              <h2>Kế hoạch 7 ngày</h2>
              <p>Số suất theo từng bữa, không cộng số món thành số người.</p>
            </div>
            {can("menus.view") && (
              <Button icon="calendar" onClick={() => navigate("week")}>
                Thực đơn
              </Button>
            )}
          </header>
          <Table
            pageSize={10}
            searchable={false}
            heads={["Ngày", "Bữa sáng", "Bữa chiều", "Trạng thái"]}
            rows={days.map((date) => {
              const count = (meal) => {
                const p = s.plans.find(
                  (p) => p.date === date && p.meal === meal,
                );
                return p
                  ? p.normal +
                      p.vegetarian +
                      (p.replacementIncluded ? 0 : p.replacement)
                  : 0;
              };
              return [
                dayLabel(date),
                f(count("SANG")) + " suất",
                f(count("CHIEU")) + " suất",
                <span
                  className={
                    "badge " + (s.issuedDates.includes(date) ? "success" : "")
                  }
                >
                  {s.issuedDates.includes(date)
                    ? "Đã xuất kho"
                    : "Đã lên thực đơn"}
                </span>,
              ];
            })}
          />
        </section>
        <section className="card attention">
          <header>
            <h2>Cần xử lý</h2>
          </header>
          <div>
            <span className="attention-icon">
              <Icon name="box" />
            </span>
            <p>
              <b>{short.length} nguyên liệu cần bổ sung</b>
              <small>Kiểm tra tồn và đề nghị mua trước khi xuất.</small>
            </p>
            {can("reports.view") && (
              <Button icon="right" onClick={() => navigate("needs")}>
                Xem
              </Button>
            )}
          </div>
          <div>
            <span className="attention-icon">
              <Icon name="book" />
            </span>
            <p>
              <b>{unapproved} công thức chờ duyệt</b>
              <small>Chỉ dùng công thức đã duyệt để lập mua.</small>
            </p>
            {can("recipes.view") && (
              <Button icon="right" onClick={() => navigate("recipes")}>
                Xem
              </Button>
            )}
          </div>
          <div>
            <span className="attention-icon">
              <Icon name="cart" />
            </span>
            <p>
              <b>{pending.length} đơn chưa nhận đủ</b>
              <small>Nhận thực tế mới tăng tồn kho.</small>
            </p>
            {can("purchase.view") && (
              <Button icon="right" onClick={() => navigate("needs")}>
                Xem
              </Button>
            )}
          </div>
          {can("costs.view") && (
            <div className="cost-box">
              <p>Chi phí định mức cả tuần</p>
              <b>{money(r.totals.reduce((n, t) => n + t.estimatedCost, 0))}</b>
              <small>Giá tham chiếu từ dữ liệu mẫu</small>
            </div>
          )}
        </section>
      </div>
      <section className="card">
        <header>
          <h2>Truy cập nhanh</h2>
        </header>
        <div className="quick-links">
          {[
            [
              "week",
              "calendar",
              "Thực đơn tuần",
              "14 bữa · nhiều món mỗi bữa",
              "menus.view",
            ],
            [
              "recipes",
              "book",
              "Món & định lượng",
              "Công thức và thành phần",
              "recipes.view",
            ],
            [
              "items",
              "box",
              "Nguyên liệu & kho",
              "Danh mục, tồn và quy cách",
              "items.view",
            ],
            [
              "needs",
              "cart",
              "Dự trù & mua hàng",
              "Nguồn nhu cầu và nhận hàng",
              "reports.view",
            ],
          ]
            .filter((x) => can(x[4]))
            .map(([key, icon, title, text]) => (
              <button key={key} onClick={() => navigate(key)}>
                <Icon name={icon} size={25} />
                <span>
                  <b>{title}</b>
                  <small>{text}</small>
                </span>
                <Icon name="right" />
              </button>
            ))}
        </div>
      </section>
    </>
  );
}
