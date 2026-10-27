# LONA — Quản lý bếp & kho

Phiên bản 7. React + ASP.NET Core 10; lưu JSON để chạy demo. Đây là bản có luồng mua/nhập/xuất liên kết, menu gọn và timeline phiếu kho. PostgreSQL chưa được kết nối runtime.

## Chạy local

Cần Node.js và .NET SDK 10. Trong thư mục dự án:

```bash
bash scripts/build-and-run.sh
```

Mở http://localhost:5080. Tài khoản admin, mật khẩu tự đặt lần đầu (12–256 ký tự). Dữ liệu và tài khoản nằm trong backend/AppData; không đưa thư mục này lên GitHub.

## Demo khách

Bản HTML trong demo/LONA_V7.html có sẵn bộ dữ liệu liên kết. Chọn vai trò rồi Mở dashboard. Bản HTML xử lý phiếu kho cục bộ và xuất PDF; tính lại BOM, mua/xuất từ kế hoạch và lịch nền cần bản .NET.

Trên bản .NET, Tổng quan → Nạp bộ mẫu liên kết → đọc phạm vi → xác nhận. Chỉ dùng môi trường demo: bổ sung giao dịch tại bếp B2 ngày 02–04/11/2026, có thay đổi tồn; không xóa dữ liệu cũ. Nếu B2 đã có thực đơn trùng kỳ, hệ thống từ chối. Không nạp lặp.

## Menu chính

1. Tổng quan.
2. Thực đơn & kế hoạch: Thực đơn / Kế hoạch nguyên liệu.
3. Kho & mua hàng: Tồn kho / Mua & nhận / Điều chuyển / Xuất bếp / Sổ kho.
4. Danh mục: Món & định lượng / Nguyên liệu.
5. Chứng từ: Đã phát hành / Mẫu chứng từ.
6. Quản trị: Người dùng / Vai trò & quyền / Thiết lập.

Đã bỏ trang Nhật ký hoạt động khỏi giao diện. Các mốc nghiệp vụ của từng phiếu vẫn dùng để hiển thị timeline; không phải một menu nhật ký hệ thống.

## Hướng dẫn chi tiết

Xem docs/HUONG_DAN_V7.html hoặc docs/HUONG_DAN_V7.md: kịch bản mẫu, import CSV, lập phiếu, nhận từng phần, xuất kho, chứng từ, kiểm thử và nâng cấp Render.

## Kiểm tra

```bash
npm --prefix frontend test
dotnet build backend/Lona.Week.Api.csproj
python3 scripts/check_v6.py
python3 scripts/check_v7.py
```

Chạy build backend trước các bài kiểm tra HTTP. Bài kiểm tra dùng file tạm, không sửa AppData thật. Có thể đặt biến DOTNET trỏ đến dotnet trên máy.

## Render

Dockerfile phục vụ React + .NET chung một dịch vụ. render.yaml: tên lona-kitchen-management, Starter, một instance, disk /var/data. Giữ các biến DataPath, IdentityPath, OperationsPath, DataProtectionPath và LONA_ADMIN_PASSWORD đang dùng. Không đổi đường dẫn hoặc xóa disk khi cập nhật mã. Không có tự động reset tài khoản.

## Giới hạn

- Một tiến trình JSON, không scale nhiều instance.
- Chưa có định giá xuất kho, công nợ/hóa đơn, bút toán kế toán, trả hàng/đảo phiếu, lô/hạn dùng.
- Import CSV theo mẫu; chưa đọc XLSX/XLSM/RAR đối tác tự động hoặc tự ghép mã.
- Dữ liệu nguồn và công thức demo không thay việc chuẩn hóa file đối tác.
- Chuyển nhiều mặt hàng tạo từng dòng phiếu điều chuyển có mã riêng trong cùng đợt; chưa phải một chứng từ điều chuyển nhiều dòng.
- Transaction phiếu mới được ghi một lần vào operations.json; đồng bộ danh mục vẫn qua hai file JSON, chưa có transaction database chống mất điện ở giữa hai lần ghi.
