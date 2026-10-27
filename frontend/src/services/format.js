export const f = (n) =>
    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(n),
  money = (n) => f(Math.round(n)) + "đ",
  scopes = {
    main: "Món chính thường",
    normal: "Thường & thay thế",
    shared: "Dùng chung",
    vegetarian: "Chay",
    replacement: "Thay thế",
    fixed: "Số riêng",
  },
  units = {
    kg: "kg",
    g: "g",
    l: "lít",
    ml: "ml",
    qua: "quả",
    hop: "hộp",
    cai: "cái",
    suat: "suất",
  };
export const days = Array.from({ length: 7 }, (_, i) =>
  new Date(Date.UTC(2026, 9, 26 + i)).toISOString().slice(0, 10),
);
export const dayLabel = (d) => {
  const x = new Date(d + "T00:00:00Z");
  return (
    [
      "Chủ nhật",
      "Thứ hai",
      "Thứ ba",
      "Thứ tư",
      "Thứ năm",
      "Thứ sáu",
      "Thứ bảy",
    ][x.getUTCDay()] +
    " " +
    d.slice(8) +
    "/" +
    d.slice(5, 7)
  );
};
