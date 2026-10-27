# Đưa LONA V7 lên GitHub và Render

Bộ này đã có Dockerfile, render.yaml, cổng PORT, health check, dữ liệu JSON ở /var/data, cookie HTTPS và public origin để POST đăng nhập hoạt động khi Render kết thúc TLS. Một dịch vụ Docker phục vụ cả React và .NET, không cần host frontend riêng.

## 1. GitHub

Tạo repository Private tên lona-kitchen-demo trong GitHub. Không chọn tạo README ban đầu nếu dùng các lệnh bên dưới. Giải nén bộ triển khai, mở Terminal trong lona-kitchen-management:

```bash
git init
git branch -M main
git add .
git commit -m "Prepare LONA demo for Render"
```

Copy lệnh git remote add origin từ trang repo của chính bạn, chạy lệnh đó, rồi:

```bash
git push -u origin main
```

Nếu Git yêu cầu đăng nhập GitHub, dùng phương thức GitHub đang hỗ trợ trên máy bạn. Không dùng mật khẩu tài khoản GitHub làm token. Bộ này không chứa AppData từ máy của bạn. Không upload thư mục backend/AppData, .env hoặc mật khẩu vào repository. Không upload thư mục node_modules, frontend/dist hoặc file menu đối tác gốc.

## 2. Render — cách ít nhập nhất

Trong Render: New → Blueprint → kết nối GitHub → chọn repo lona-kitchen-demo, branch main. Render đọc render.yaml ở gốc repo.

Cấu hình có sẵn: Web Service Docker, tên lona-kitchen-demo, region Singapore, plan Starter, một instance, disk 1 GB tại /var/data. Đây là dịch vụ trả phí; kiểm tra mức phí hiện tại hiển thị trên Render trước khi tạo. Không có tài nguyên nào được tạo chỉ bằng việc giải nén hoặc đẩy code.

Render yêu cầu LONA_ADMIN_PASSWORD: tự đặt mật khẩu mới tối thiểu 12 ký tự, tối đa 256 ký tự. Không dùng lại mật khẩu demo đã ghi trong cuộc trò chuyện cho bản public. Nhập secret trong Render, không nhập vào render.yaml.

Sau khi kiểm tra cấu hình và phí, tạo Blueprint. Chờ build/deploy chuyển Live. Mở chính Service URL Render cấp, không tự đoán tên URL. Repo private vẫn có thể triển khai thành một web app public có trang đăng nhập.

## 3. Nếu tạo Web Service bằng tay

| Trường | Giá trị |
|---|---|
| Source | Repository GitHub vừa tạo |
| Language / Runtime | Docker |
| Branch | main |
| Root Directory | Để trống |
| Dockerfile Path | ./Dockerfile |
| Docker Context | . |
| Docker Command | Để trống, dùng entrypoint |
| Health Check Path | /healthz |
| Instance | Starter, 1 instance |
| Disk mount | /var/data, 1 GB |

Environment: LONA_ADMIN_PASSWORD là mật khẩu mới tự đặt; ASPNETCORE_ENVIRONMENT=Production; PORT=10000; DataPath=/var/data/state.json; IdentityPath=/var/data/identity.json; OperationsPath=/var/data/operations.json; DataProtectionPath=/var/data/keys. Các path cũng có mặc định trong Dockerfile.

RENDER_EXTERNAL_URL được Render cung cấp. Ứng dụng dùng origin này kiểm tra POST và bật cookie Secure. Nếu dùng domain riêng, đặt PUBLIC_ORIGIN=https://domain-cua-ban, không có đường dẫn; khi đó đăng nhập ở domain này. Không cần bật tin cậy mọi forwarded header.

## 4. Gửi khách

Đăng nhập thử bằng admin + mật khẩu vừa đặt. Tạo một tài khoản cho khách với vai trò và quyền cần demo trong Người dùng; nên dùng viewer khi chỉ xem, manager khi cần sửa thử. Thử đăng nhập bằng tài khoản khách trong cửa sổ riêng tư rồi mới gửi Service URL và thông tin đăng nhập. Chưa có luồng gửi email tự động hoặc tạo tài khoản khách mặc định.

Đây là dữ liệu demo mới, không tự mang dữ liệu từ localhost. Vào Thực đơn, chọn tháng 10/2026 và Tạo các bữa còn thiếu nếu server chưa có thực đơn; mở Bảng tuần, chọn tuần 26/10/2026. Mẫu có món/định mức sẵn, không phải file đối tác đã chuẩn hóa.

## 5. Lưu trữ và lịch nền

Chỉ /var/data được giữ sau restart/deploy; chứa state.json, identity.json, operations.json và keys. Không lưu các file này vào Git. Giữ một instance vì JSON và khóa hiện tại chỉ dùng trong một tiến trình. Dùng sao lưu nhất quán khi server đã dừng trước khi di chuyển dữ liệu; không chép đè identity hoặc operations đang hoạt động.

Render Free không hỗ trợ persistent disk. Nếu bỏ disk để chọn Free, dữ liệu tài khoản và kho có thể mất khi restart/redeploy/spin-down. Không cam kết lịch nền hoạt động liên tục trên Free. Bộ render.yaml này chủ động dùng Starter + disk, không cấu hình Free.

Lịch lập kế hoạch mặc định tắt, quản lý bật trong trang Kế hoạch nguyên liệu. Lịch chạy trong tiến trình .NET, theo giờ Việt Nam, chỉ lập snapshot; không tự xuất kho hay gửi đơn mua hàng. Chưa có PostgreSQL adapter hoặc tích hợp kế toán.

## 6. Kiểm tra sau deploy

1. /healthz trả status ok, trang login mở được qua HTTPS.
2. Đăng nhập admin không bị 403 do Origin.
3. Sửa thực đơn thử, tải lại thấy dữ liệu.
4. Tạo tài khoản khách đúng vai trò, thử quyền.
5. Restart trong Render rồi kiểm tra dữ liệu và tài khoản còn nguyên.
6. Kiểm tra đăng xuất và đăng nhập lại.

Health check chỉ xác nhận tiến trình HTTP sẵn sàng; không thay thế kiểm thử ghi dữ liệu và restart ở trên.

## 7. Nguồn cấu hình

https://render.com/docs/docker
https://render.com/docs/blueprint-spec
https://render.com/docs/disks
https://render.com/docs/environment-variables
https://render.com/docs/free

Bản V7 đã build/publish .NET và kiểm tra HTTP, public origin, cookie Secure, lưu tài khoản qua restart trong môi trường kiểm thử. Chưa build Docker image tại đây và chưa cập nhật service Render hiện hữu. Xem HUONG_DAN_V7.md, mục nâng cấp để giữ dữ liệu.
