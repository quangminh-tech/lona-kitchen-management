# Bản sửa phiếu mua V7.1

- Danh sách Mua & nhận và chi tiết phiếu có nút Sửa.
- Quyền sửa: purchase.create và phạm vi kho. API kiểm tra quyền, phạm vi, revision và mã chống lặp.
- Chưa nhận: sửa kho, nhà cung cấp, ngày, thêm/xóa/đổi dòng hàng.
- Nhận một phần: không đổi kho; không xóa/đổi hàng đã nhận; lượng đặt không được thấp hơn lượng thực nhận. Có thể sửa phần còn lại.
- Nhận đủ: khóa sửa, hiển thị lý do. Chưa bổ sung phiếu trả/đảo, không tự sửa số tồn.
- Lý do sửa bắt buộc, lưu lịch sử trên dòng và bản trước/sau nội bộ. Phiếu nhập, sổ kho, tồn và chứng từ đã phát hành không bị ghi lại khi sửa.
- Đổi nhãn mua APPROVED thành Chưa nhận hàng để không nhầm với Đã giữ hàng của điều chuyển.

## Cập nhật dự án hiện có
Sao lưu backend/AppData trước khi cập nhật. Thay các file code cùng đường dẫn từ gói nguồn, không thay AppData. Đẩy code lên repository Render đang liên kết rồi triển khai lại. Không cần thay mật khẩu hoặc xóa dữ liệu. Bản HTML offline có thể mở riêng, không sửa dữ liệu Render.

## Kiểm tra
Frontend 20 tests qua, gồm sửa sau nhận một phần, giữ nguyên tồn/phiếu nhập, chặn đổi kho/xóa hàng nhận/giảm dưới lượng nhận và chặn sửa nhận đủ. Frontend online/offline build qua. Backend build thành công; chưa chạy kiểm thử API trực tiếp cho command mới.
