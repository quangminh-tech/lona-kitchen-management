# LONA V6.2 — Thực đơn bảng tuần

Mở Thực đơn → Bảng tuần. Cột theo ngày, hàng sáng/chiều, mỗi món một dòng. Có nền sáng/tối, trình chiếu, sửa bữa và chế độ danh sách. Xem docs/THUC_DON_BANG_TUAN_V6_2.md.

# LONA V6.1 — Bản chỉnh giao diện

Bản này làm lại trang mẫu chứng từ, menu và tổng quan trên nền V6. Xem `docs/PHAN_TICH_UI_UX_V6_1.md` để biết phạm vi đã làm và đề xuất tiếp theo. Chạy bằng lệnh cũ bên dưới.

# LONA V6 - Quản trị bếp, kho và chứng từ có biến

Bộ mã nguồn React + .NET10 chạy được với JSON, dùng cho demo và rà nghiệp vụ. V6 tích hợp thực đơn tháng/năm, kế hoạch BOM, điều chuyển, mua/nhận D+1, xuất sản xuất, mẫu chứng từ và snapshot phát hành. PostgreSQL vẫn là thiết kế tham khảo, chưa kết nối. Chưa tích hợp phần mềm kế toán/AWS.

## Chạy trên Mac/Linux

Cần Node.js 22.12+ và .NET SDK10. Giải nén vào thư mục mới `LONA_V6`, mở Terminal tại đó:

```bash
bash scripts/build-and-run.sh
```

Lần đầu Terminal hỏi bạn đặt mật khẩu admin tối thiểu12 ký tự; khi gõ không hiện ký tự. Mở **http://localhost:5080**, tên đăng nhập **admin**, mật khẩu vừa đặt. Windows: `powershell -ExecutionPolicy Bypass -File scripts/run.ps1`.

Không chép AppData V4/V5 đè vào V6: cấu trúc đã đổi. Dùng thư mục mới để khởi tạo sạch. Bản HTML `demo/LONA_V6_Admin.html` xem thử không cần cài, cho chọn vai trò; phát hành, tính BOM server và lịch nền phải chạy source .NET.

## Chạy thử đầy đủ trên server

1. Vào **Thiết lập & phạm vi**, khai báo công ty/địa chỉ/MST.
2. Vào **Mẫu chứng từ**, sửa tiêu đề thành `PHIẾU CẤP HÀNG - {{warehouse.to}}`; đổi cột/chữ ký; Xem trước; Lưu phiên bản mới; Tải PDF mẫu.
3. Vào **Thực đơn tháng/năm**, chọn bếp/kỳ; Tạo các bữa còn thiếu; Sửa bữa để thêm nhiều món, đổi món/nhóm suất/định mức; chốt các bữa đã kiểm tra.
4. Vào **Kế hoạch nấu & lịch**, chọn mốcD rồi tính. D+1/D+2/D+3 là từng ngày, tuần là7 ngày tới, tháng là tháng dương lịch sau. Thiếu bữa/chưa duyệt sẽ BLOCKED.
5. Xem NVL của D+1; lập đề nghị mua D+1 nếu thiếu, hoặc tạo yêu cầu điều chuyển từTTvềCG. Đề nghị mua chưa làm tăng tồn. Nhận đủ/thực tế qua màn Đề nghị mua & nhận hoặc Nhận điều chuyển.
6. Điều chuyển: Tạo → Duyệt giữ hàng → Xuất chuyển → Nhận một phần/đủ. Sổ kho ghi riêng nguồn/transit/đích. Tài khoản chỉ có CG không được xuất TT.
7. Sau biến động tồn phải tính lại kế hoạch; Xuất sản xuất chỉ dùng snapshot còn mới, đủ vật tư. Ghi toàn bộ hoặc không ghi gì; chặn xuất trùng bếp/ngày. Không có nút sửa tồn trực tiếp.
8. **Chứng từ phát hành**: chọn phiếu nguồn và đúng loại mẫu, phát hành, tải PDF. Đổi mẫu lênv2 rồi in bản đã phát hànhv1: nội dungv1 giữ nguyên. Phiếu điều chuyển không được in thành phiếu xuất sản xuất giả.
9. Bật lịch nền nếu muốn: mặc định tắt, giờ04:00 Việt Nam. Server kiểm tra mỗi30 giây; phải giữ tiến trình đang chạy. Lịch chỉ tạo snapshot, không tự mua hoặc trừ kho. Sau giờ đã đặt, khởi động lại sẽ chạy cho ngày hiện tại; không tự bù ghi sổ các ngày cũ.

## File cần sửa theo chức năng

| Phần | File |
|---|---|
| Sidebar/phiên đăng nhập | frontend/src/App.jsx |
| Lịch, tháng/năm, chuyển/nhận, tồn | frontend/src/features/operations.jsx |
| UI sửa mẫu / kho chứng từ | frontend/src/features/documents.jsx |
| Biến, schema mẫu, HTML preview | frontend/src/documents/templates.js |
| PDF tiếng Việt, phân trang | frontend/src/documents/pdf.js |
| Font nhúng offline | frontend/src/documents/font-data.js |
| CSS form/bảng | frontend/src/styles/base.css |
| CSS admin/mẫu/chứng từ | frontend/src/styles/admin.css |
| API & nghiệp vụ vận hành | backend/Operations/OperationsStore.cs |
| Endpoint và worker lịch nền | backend/Operations/OperationsEndpoints.cs |
| Kiểm mẫu, tạo context snapshot | backend/Operations/TemplateRules.cs |
| Quyền vai trò | backend/Auth/PermissionCatalog.cs |
| Nghiệp vụ BOM | backend/WeekEngine.cs |
| Danh mục món/NVL | backend/Endpoints/BusinessEndpoints.cs |
| Template seed | samples/templates.json và samples/operations.json |

## Kiểm tra và đóng gói

```bash
npm --prefix frontend ci
npm --prefix frontend test
npm --prefix frontend run build
dotnet build backend/Lona.Week.Api.csproj
python3 scripts/check_v6.py
npm --prefix frontend run build:offline
node scripts/package-demo.mjs
```

Kiểm thử HTTP dùng tệp tạm. Có thể đặt biến DOTNET thành đường dẫn executable nếu không có trongPATH. Build online tách PDF/font khỏi bundle đầu; build offline gộp để HTML mở trực tiếp.

## Lưu trữ và giới hạn

- backend/AppData/state.json: danh mục/công thức mẫu.
- backend/AppData/operations.json: sổ kho vận hành, menus tháng/năm, mua/nhận, chuyển, xuất sản xuất, lịch, templates và snapshots.
- backend/AppData/identity.json: tài khoản hash và vai trò.

Dừng server trước khi backup/restore cả3 tệp. Một tiến trình .NET duy nhất; khóa ghi trong tiến trình, ghi tệp tạm/rename, revision và UUIDlệnh chống lặp. Chưa dùngDBtransaction nhiều tiến trình; đồng bộ danh mục giữa2 tệp chưa phải transaction SQL nguyên tử khi máy bị mất điện.

Tồn runtime mới nằm trong operations, không dùng sốstockcũ trong danh mục. Endpoint nghiệp vụ kho V4 đã bị chặn để tránh ghi2 sổ; danh mục cũ chỉ còn quản lý mã/công thức. Stock ban đầu là dữ liệu mẫu; chưa có nhập tồn đầu, điều chỉnh kiểm kê, hoàn/hủy phiếu đã ghi, hoặc lô/hạn dùng hoàn chỉnh.

Dự trù tuần/tháng là tổng hợp tham khảo, chưa phải mô phỏng tồn/lô theo từng ngày và phân bổ PO toàn chuỗi. Chỉ tạo đề nghị mua thực hiện từD+1 trong bản này để tránh cộng các cửa sổ chồng nhau. Chưa gửi đơn cho NCC, chưa có giá vốn kế toán, hóa đơn, outbox đồng bộ hoặc khóa kỳ vận hành. Biểu mẫu là chứng từ nội bộ, chưa phải mẫu pháp định đã được kế toán xác nhận.

Đọc docs/CHUNG_TU_VA_VAN_HANH.md để biết chi tiết biến và API. database/*.sql là thiết kế chưa được chạy thử trong phiên này, không phải adapter đang hoạt động.
