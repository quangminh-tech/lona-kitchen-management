# LONA V6.2 — Thực đơn dạng bảng tuần

Trang Thực đơn mở mặc định chế độ Bảng tuần. Cột là ngày, hàng là Sáng/Chiều. Mỗi món hiển thị một dòng, không nối nhiều tên bằng dấu chấm. Khung mặc định 4 ngày, chuyển Thứ 2–5 / Thứ 6–CN; có thể chọn 7 ngày để xem liên tục và cuộn ngang nếu cần.

- Mũi tên Tuần trước/Tuần sau hoặc ô Chọn tuần điều hướng theo tuần bắt đầu thứ Hai.
- Nền sáng dùng quản trị; Nền tối và Trình chiếu dùng xem bảng lớn. Trình chiếu chiếm vùng trình duyệt, Escape để thoát; không phải chế độ fullscreen cấp hệ điều hành.
- Sửa bữa mở trình sửa thực đơn hiện có; lưu cập nhật cùng dữ liệu tháng/năm, công thức và kế hoạch. Không tạo một nguồn thực đơn thứ hai.
- Món chính/dùng chung, món chay, món thay thế phân theo scope. Mặc định hiện thực đơn chính; tick Hiện món chay & thay thế để mở hai nhóm còn lại. Không xóa món trùng tên nếu thuộc hai nhóm khác nhau.
- Số suất tổng = thường + chay. Thay thế có thể nằm trong suất thường; giao diện không cộng thêm lần nữa.
- Tháng/năm ở phía trên xác định phạm vi Tạo các bữa còn thiếu và Chốt cả kỳ đang chọn. Bảng tuần là phạm vi xem, không tự đổi phạm vi hai lệnh này. Hộp xác nhận chốt ghi rõ số bữa, tháng/năm và bếp.
- Dữ liệu mẫu HTML có sẵn 14 bữa ngày 26/10–01/11/2026 ở Cần Giờ, dùng các món/công thức có sẵn của demo; không phải dữ liệu đã đối chiếu file thực đơn đối tác. Chưa bổ sung ca trưa/bữa phụ vì phạm vi demo trước đó là sáng và chiều.
- Dữ liệu server đang dùng không bị thay. Máy chủ khởi tạo theo seed vận hành V6 như trước; dùng Tạo các bữa còn thiếu nếu chưa có thực đơn.
- Trạng thái Nháp/Đã chốt hiển thị theo dữ liệu nguồn. Không tự duyệt chỉ vì chuyển sang bảng tuần hay trình chiếu.

Thay đổi nguồn: features/weekly-menu.jsx, styles/weekly-menu.css, features/operations.jsx, services/operations-engine.js (lặp tuần offline lấy đúng các dòng món từ mẫu), services/operations-seed.json (14 bữa offline), main.jsx.

Cách chạy: giải nén LONA_V6_2, chạy bash scripts/build-and-run.sh. Cần Node.js và .NET SDK 10; mở http://localhost:5080. Tài khoản admin, mật khẩu tự đặt lần đầu. Không ghi đè backend/AppData đang dùng. Backend và cấu trúc dữ liệu giữ từ V6.1; chạy JSON, PostgreSQL mới có thiết kế.
