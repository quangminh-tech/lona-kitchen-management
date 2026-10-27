# LONA V6.1 — Phân tích giao diện và luồng vận hành

Ngày lập: 27/10/2026. Bản chỉnh giao diện trên mã nguồn V6 React + .NET; dữ liệu chạy bằng JSON. Tài liệu phân biệt phần đã làm và phần cần phát triển tiếp.

## 1. Vì sao màn hình V6 khó sử dụng

| Vấn đề quan sát từ ảnh | Tác động | Cách xử lý V6.1 |
|---|---|---|
| Menu bắt đầu bằng mua hàng, rồi sổ kho, rồi thực đơn; Tổng quan nằm giữa | Người mới không biết bắt đầu từ đâu | Xếp theo Điều hành → Kho & mua hàng → Danh mục → Chứng từ → Quản trị |
| Mẫu chứng từ có bộ chọn bếp dù mẫu dùng chung | Tạo cảm giác phải lưu riêng từng bếp | Bỏ bộ chọn bếp ở mẫu, phát hành và thiết lập chung |
| Hai nút tải lại ở hai cấp | Khó biết nút nào tải dữ liệu nào | Trang vận hành giữ nút tải dữ liệu của chính trang; bỏ nút tải lại chung bị trùng |
| Mọi nội dung, cấu hình cột và chữ ký nối dài | Người dùng phải cuộn nhiều và dễ bỏ sót | Chia 4 tab, giữ dữ liệu chỉnh giữa các tab |
| Danh sách biến luôn hiện, chiếm diện tích | Người dùng thường phải đọc mã kỹ thuật | Chỉ mở khi bấm Chèn biến; hỗ trợ tìm và chèn trực tiếp |
| Tiêu đề một dòng vẫn dùng ô nhiều dòng quá cao | Tăng chiều dài biểu mẫu | Kích thước từng ô theo loại nội dung; vẫn cho kéo cao khi cần |
| Bản xem trước nằm sau toàn bộ biểu mẫu | Sửa xong phải cuộn xuống mới thấy kết quả | Hiển thị bên phải ở màn hình rộng; cập nhật ngay khi sửa |
| Tổng quan mở cùng nội dung kế hoạch | Có menu nhưng không có giá trị riêng | Thay bằng chỉ số việc chờ xử lý và đường dẫn theo luồng nghiệp vụ |
| Nội dung chính bị bó vào vùng hẹp trên màn hình lớn | Chữ và bảng nhỏ, khoảng trống ngoài nhiều | Nội dung dùng toàn bộ vùng còn lại sau sidebar, căn lề thống nhất |

Chữ thân biểu mẫu dùng khoảng 14px, tiêu đề trang 26px, nhãn 13px. Không thu nhỏ toàn bộ giao diện để nhét nhiều nội dung. Nút quan trọng có nhãn rõ; icon chỉ hỗ trợ nhận diện.

## 2. Cấu trúc điều hướng

| Nhóm | Trang | Công việc chính | Người dùng thường dùng |
|---|---|---|---|
| Điều hành | Tổng quan | Nhìn việc đang chờ, mở đúng danh sách | Quản lý |
| Điều hành | Thực đơn | Chọn tháng/năm, nhiều món trong ca sáng/chiều, số suất, duyệt | Kế hoạch, quản lý |
| Điều hành | Kế hoạch nguyên liệu | Tính BOM, D+1/D+2/D+3, tuần/tháng, kiểm tra thiếu dữ liệu | Kế hoạch, mua hàng |
| Kho & mua hàng | Tồn kho & điều chuyển | Yêu cầu, duyệt, xuất chuyển, nhận một phần/đủ | Thủ kho, quản lý |
| Kho & mua hàng | Mua & nhận hàng | Đề nghị theo nhu cầu và ghi nhận nhận hàng thực tế | Mua hàng, thủ kho |
| Kho & mua hàng | Sổ kho | Đọc các biến động phát sinh | Thủ kho, quản lý |
| Danh mục | Món & định lượng | Công thức và nguyên liệu cho từng món | Kế hoạch, bếp |
| Danh mục | Nguyên liệu | Mã hàng, đơn vị, quy cách và thông tin hàng | Người quản lý danh mục |
| Chứng từ | Đã phát hành | Lưu và tải bản in theo phiếu nguồn | Người có quyền chứng từ |
| Chứng từ | Mẫu chứng từ | Chỉnh mẫu, kiểm tra, lưu phiên bản | Quản trị mẫu |
| Quản trị | Người dùng, Vai trò, Thiết lập, Nhật ký | Tài khoản, quyền, phạm vi, công ty và tra cứu | Quản trị hệ thống |

Menu vẫn theo quyền hiện có. Ẩn menu không thay thế việc kiểm tra quyền ở API. Tài khoản bếp không cần quyền sửa mẫu hoặc quản trị người dùng để vận hành.

## 3. Trang mẫu chứng từ — thiết kế đã triển khai

Thanh đầu trang có tên trang, Ẩn/Hiện bản xem trước, Tải PDF mẫu và Lưu thay đổi. Lưu chỉ bật khi có chỉnh sửa và người dùng có quyền. Trong lúc tạo PDF hoặc lưu, khóa thao tác liên quan và hiển thị đang xử lý.

Bên dưới là bộ chọn mẫu, phiên bản đã lưu và trạng thái Có thay đổi chưa lưu/Đã lưu. Đổi sang mẫu khác khi đang chỉnh phải chọn tiếp tục chỉnh hoặc bỏ thay đổi để chuyển. Tải lại/đóng trang khi đang chỉnh có cảnh báo của trình duyệt. Không có tự động lưu; nên bấm Lưu trước khi đi sang menu khác.

| Tab | Trường hiển thị | Hành vi |
|---|---|---|
| Nội dung | Tên mẫu, công ty, tiêu đề, số/ngày, giao nhận, ghi chú | Chèn biến đúng ô và vị trí con trỏ; không cần chép/dán mã |
| Bảng hàng hóa | Dữ liệu, nhãn cột, tỷ lệ rộng, lên/xuống, xóa | 1–12 cột; không cho xóa cột cuối cùng; xem ngay thứ tự bản in |
| Chữ ký | Từng tên vị trí ký, thêm/xóa | Tối đa 5 ô; bố trí theo thứ tự; đây là ô ký trên bản in |
| Trang in | A4 dọc/ngang, cỡ chữ 8–14pt | Dùng cho PDF và mô tả bản xem trước |

Bản xem trước dùng dữ liệu minh họa cố định và thông tin công ty đang lưu. Không phải chứng từ thật. HTML trong khung giúp kiểm tra nội dung/thứ tự cột; ngắt trang và tỷ lệ A4 phải kiểm tra trong PDF tải xuống. Khung trình duyệt có thể xuống dòng khác PDF, đặc biệt khi màn hình hẹp.

Ở màn hình rộng, trình sửa và bản xem trước nằm hai cột. Ở màn hình hẹp, bản xem trước xuống dưới để ô nhập không bị bó nhỏ. Có thể ẩn bản xem trước khi cần tập trung nhập liệu.

## 4. Cách sử dụng biến

Ví dụ tiêu đề: `PHIẾU CẤP HÀNG — {{warehouse.to}}`. Khi phát hành với kho nhận Cần Giờ, tên kho được lấy từ phiếu nguồn. Người dùng bấm Chèn biến ở trường Tiêu đề, tìm Kho nhận, rồi chọn kết quả.

| Nhóm | Biến ví dụ | Nguồn dữ liệu |
|---|---|---|
| Công ty | company.name, company.address, company.taxCode | Thiết lập công ty |
| Chứng từ | document.number, date, status, reason, reference | Phiếu nghiệp vụ được chọn |
| Kho/bếp | warehouse.from, warehouse.to, kitchen.name | Kho nguồn, kho đích, bếp của phiếu |
| Người ký | signatures.requester, approver, sender, receiver | Ngữ cảnh chứng từ, có thể trống nếu chưa có |
| Hệ thống | system.printedAt, system.templateVersion | Thời điểm in và phiên bản mẫu |
| Dòng hàng | code, name, unit, requested, dispatched, received, inTransit | Từng dòng hàng từ phiếu nguồn |

Biến nội dung phải nằm trong hai cặp ngoặc nhọn. Biến dòng hàng được chọn trong tab Bảng hàng hóa, không chèn thành công thức lặp ở trường nội dung. Hệ thống chỉ chấp nhận danh sách biến được hỗ trợ, báo lỗi biến sai hoặc dữ liệu còn thiếu, và xử lý nội dung như văn bản. Không thực thi mã HTML/JavaScript do người dùng nhập.

Không cộng chung kg, lít và cái thành một tổng số lượng. Không dùng mẫu chứng từ để sửa số lượng xuất/nhận hoặc thay thế kiểm tra tồn kho.

## 5. Luồng chứng từ và tính toàn vẹn dữ liệu

1. Lập phiếu nghiệp vụ: điều chuyển hoặc xuất sản xuất.
2. Thực hiện nghiệp vụ theo quyền và trạng thái cho phép. Nhận hàng có thể một phần.
3. Vào Chứng từ → Đã phát hành, chọn phiếu nguồn và mẫu phù hợp.
4. Phát hành: lưu bản chụp dữ liệu phiếu và phiên bản mẫu.
5. Tải lại PDF từ bản đã phát hành, không lấy mẫu mới ghi đè bản cũ.

Sửa mẫu tạo phiên bản tiếp theo. Bản in đã phát hành giữ nội dung tại thời điểm phát hành. Nếu số lượng nghiệp vụ sai, cần quy trình điều chỉnh/hoàn trả và chứng từ liên quan; V6.1 chưa triển khai các nghiệp vụ đảo/điều chỉnh này. Không dùng sửa mẫu để sửa lịch sử giao nhận.

## 6. Luồng thực đơn đến nguyên liệu

| Bước | Nhập/kiểm tra | Kết quả |
|---|---|---|
| Thực đơn | Bếp, ngày, ca, nhiều món, số suất thường/chay/thay thế | Dữ liệu bữa ăn |
| Định mức | Công thức món, món bán thành phẩm, lượng và quy đổi đơn vị | BOM có thể phân rã |
| Duyệt | Đủ ca, đủ công thức, định mức hợp lệ | Được phép lập nhu cầu |
| Kế hoạch | Chạy tại ngày gốc theo bếp | Snapshot D+1/2/3 và kỳ dài hơn |
| Cân đối | Nhu cầu, tồn, hàng đang về, hàng đã giữ chỗ | Thiếu/đủ và đề nghị bổ sung |
| Mua/điều chuyển | Chọn hành động phù hợp phạm vi kho | Phiếu nghiệp vụ |
| Nhận/xuất thực tế | Lượng thực tế và quyền thao tác | Biến động kho và nguồn chứng từ |

Suất thay thế thuộc suất thường khi chọn chế độ đã bao gồm, không cộng lại thành suất mới. Suất chay được theo dõi riêng. Một ca có nhiều món; không coi một dòng nguyên liệu trong file đối tác là một suất ăn. Dữ liệu import đối tác chưa đủ đơn vị/ca/mapping phải xử lý tại bước đối chiếu, không nhập thẳng thành phiếu xuất.

## 7. Quy tắc kho trong bản demo

Kho trung tâm và kho nhánh có tồn riêng. Duyệt phiếu giữ chỗ ở kho xuất; xuất chuyển giảm kho xuất và tăng hàng đang đi; nhận thực tế giảm hàng đang đi và tăng kho nhận. Nhận một phần chỉ cập nhật phần nhận thực tế. Xuất bếp chuyển tồn kho nhánh sang vị trí sản xuất. Sổ kho là dữ liệu phát sinh từ nghiệp vụ, không phải bảng để chỉnh tồn trực tiếp.

Nút thao tác phải tương ứng trạng thái: nháp có thể duyệt/hủy; đã duyệt có thể xuất/hủy; đang đi có thể nhận; nhận đủ không được nhận thêm. Backend hiện kiểm tra quyền, phạm vi, revision và mã chống lặp. JSON chỉ dành cho demo một tiến trình; cần transaction PostgreSQL trước khi dùng cho nhiều người trong vận hành thật.

Đây là sổ số lượng vận hành. Chưa có tính giá xuất kho, định khoản, công nợ, hóa đơn, đối soát kế toán hay chữ ký số. Nhãn ô ký không có giá trị thay chữ ký điện tử.

## 8. Cách làm sạch các màn hình tiếp theo

Các mục sau là đề xuất thiết kế tiếp theo, chưa phải toàn bộ đã viết trong V6.1:

| Trang | Bố cục nên dùng | Không nên dồn cùng màn hình |
|---|---|---|
| Thực đơn | Thanh bếp/kỳ; danh sách ngày; mở một ca để sửa nhiều món | Toàn bộ 365 ngày và tất cả định mức ở cùng một bảng |
| Kế hoạch | Ngày gốc; tab D+1/D+2/D+3/Tuần/Tháng; lỗi cần xử lý trước | Mọi báo cáo và cấu hình lịch nền cùng lúc |
| Tồn kho | Tab Tồn kho/Điều chuyển; bảng lọc theo kho/nhóm; form lập phiếu trong panel | Form tạo phiếu dài luôn nằm trên bảng |
| Mua hàng | Danh sách chờ nhận; mở phiếu xem từng lần nhận | Gộp đề nghị, đơn mua, hóa đơn và công nợ |
| Phân quyền | Chọn vai trò; quyền theo nhóm nghiệp vụ; phạm vi kho riêng | Một danh sách mã quyền dài không có giải thích |
| Import | Chọn file → ghép cột → đối chiếu mã/đơn vị → xem lỗi → xác nhận | Âm thầm đoán ca ăn, mã món hoặc đơn vị |

Bản V6.1 đã chỉnh khung dùng chung, menu, tổng quan và viết lại trang sửa mẫu. Các trang nghiệp vụ khác tiếp tục dùng chức năng V6; chưa viết lại tất cả thành thiết kế trong bảng này.

## 9. Cấu trúc mã nguồn và bảo trì

| File | Vai trò trong bản sửa |
|---|---|
| frontend/src/App.jsx | Sắp menu, route tổng quan, bỏ thanh tải lại bị lặp ở trang vận hành |
| frontend/src/features/documents.jsx | Editor theo tab, chọn/chèn biến, bản xem trước, thứ tự cột và chữ ký |
| frontend/src/features/operations.jsx | Tổng quan mới, phạm vi bếp phù hợp từng trang |
| frontend/src/styles/workspace.css | CSS mới tách riêng cho khung, tổng quan và trình sửa mẫu |
| frontend/src/main.jsx | Nạp CSS V6.1 sau các stylesheet cũ |
| frontend/src/documents/templates.js | Danh sách biến, kiểm tra hợp lệ và render HTML có escape, giữ từ V6 |
| frontend/src/documents/pdf.js | PDF tiếng Việt và ngắt trang, giữ từ V6 |
| backend/Operations | API, phiên bản mẫu, snapshot chứng từ và quy tắc kho, giữ từ V6 |

Không đổi cấu trúc JSON hoặc API trong lần chỉnh giao diện này. Không cần xóa dữ liệu V6 đang dùng. Không lấy AppData trống trong bộ mới ghi đè dữ liệu đã nhập. Hãy sao lưu thư mục backend/AppData trước khi thay phiên bản; dừng server trước khi sao chép mã.

## 10. Kiểm tra và giới hạn

Build frontend và 13 nhóm kiểm tra hiện có đã chạy qua. Đã kiểm tra trên trình duyệt preview: bố cục thật, sửa tiêu đề/chèn biến, các tab cấu hình, lưu phiên bản và xác nhận khi đổi mẫu đang chỉnh. Bản demo HTML chạy cục bộ; các chức năng nền và phát hành nghiệp vụ phải chạy server .NET. API .NET và luồng kho giữ nguyên V6, không thực hiện lại toàn bộ kiểm thử backend trong lần chỉnh giao diện này.

Không có tự động lưu khi chuyển menu, chế độ so sánh lịch sử mẫu, kéo thả tự do, upload mẫu Word, chữ ký số, trình thiết kế WYSIWYG, PostgreSQL runtime hay tích hợp kế toán. Các điểm này cần được triển khai và nghiệm thu riêng nếu thuộc phạm vi hợp đồng.

## 11. Chạy và xem demo

Giải nén bản nguồn, mở Terminal trong LONA_V6_1 rồi chạy:

```bash
bash scripts/build-and-run.sh
```

Cần Node.js và .NET SDK 10. Mở http://localhost:5080, tài khoản admin, mật khẩu do người cài đặt đặt khi chạy lần đầu. Không có mật khẩu mặc định ghi sẵn.

Xem giao diện nhanh: giải nén demo, mở LONA_V6_1_Admin.html; chọn vai trò Quản trị hệ thống rồi Mở dashboard. Dữ liệu sửa trong demo được lưu trong trình duyệt, không đồng bộ với server. Muốn thử luồng nhập/xuất và phát hành thật phải chạy bản full.
