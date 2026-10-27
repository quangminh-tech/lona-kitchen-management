# Hướng dẫn chứng từ có biến và vận hành V6

## Mẫu và dữ liệu là hai phần độc lập

Mẫu chứa văn bản, biến, danh sách cột, chữ ký, cỡ chữ và hướng giấy. Dữ liệu lấy từ phiếu thực tế. Sửa mẫu không được sửa lượng xuất/nhận hoặc phê duyệt phiếu nguồn. Khi phát hành, server lưu template_snapshot + context_snapshot + người/thời điểm. Tải PDF dùng hai snapshot đã lưu, không truy vấn lại tên hàng/mẫu mới.

Có3 loại: TRANSFER-điều chuyển; REQUEST-đề nghị xuất; ISSUE-xuất sản xuất. TRANSFER/REQUEST lấy nguồn điều chuyển. ISSUE chỉ lấy phiếu xuất sản xuất đã được ghi nhận từ kế hoạch; server chặn đổi loại mẫu để hợp thức hóa phiếu khác. PDF có trạng thái nguồn, không tự biến nháp thành đã duyệt.

## Biến có thể dùng

| Biến | Nội dung |
|---|---|
| {{company.name}} | Tên công ty |
| {{company.address}} | Địa chỉ |
| {{company.taxCode}} | Mã số thuế |
| {{document.number}} | Số chứng từ |
| {{document.date}} | Ngày phiếu |
| {{document.status}} | Trạng thái nguồn |
| {{document.reason}} | Lý do |
| {{document.reference}} | Phiếu/kế hoạch nguồn |
| {{warehouse.from}} | Kho nguồn |
| {{warehouse.to}} | Kho đích |
| {{kitchen.name}} | Bếp/bộ phận |
| {{signatures.requester}} | Người lập |
| {{signatures.approver}} | Người duyệt |
| {{signatures.sender}} | Thủ kho xuất (chưa ghi tên thì trống) |
| {{signatures.receiver}} | Người nhận (chưa ghi tên thì trống) |
| {{totals.quantity}} | Không cộng tổng khác đơn vị; hiện trả nhãn nhắc |
| {{system.printedAt}} | Thời điểm trong snapshot |
| {{system.templateVersion}} | Phiên bản mẫu |

Dùng biến trong đầu trang/tiêu đề/dòng số phiếu/thông tin/ghi chú. Nhãn ô chữ ký là văn bản chỉnh được, tên người ký có thể chèn vào phần thông tin bằng biến. Chưa có chữ ký số, ký điện tử hay ảnh chữ ký.

Mẫu ví dụ:

```
{{company.name}}
MST: {{company.taxCode}}

PHIẾU CẤP NGUYÊN LIỆU
Số: {{document.number}} - Ngày: {{document.date}}
Kho xuất: {{warehouse.from}}
Bộ phận nhận: {{kitchen.name}}
Theo kế hoạch: {{document.reference}}
```

Cột hàng có key index, code, name, unit, stock, requested, approved, dispatched, received, inTransit, note. Nhãn và độ rộng được sửa. Cột tự lặp theo dòng dữ liệu, không nhập cú pháp vòng lặp vào nội dung. Một phiếu có thể nhiều trang; lặp đầu bảng và có số trang. Không cộng quả+lít+kg. Phiên bản mẫu tăng trên server, không tin version gửi lên.

Mẫu không nhận HTML/JavaScript, biểu thức, gọi hàm, tài nguyên URL hoặc biến lạ. Nội dung được escape khi xem HTML; PDF vẽ văn bản, dùng font Unicode nhúng. Template giới hạn1–12 cột, tối đa5 ô chữ ký và cỡ chữ8–14. Không có trình kéo thả tùy ý hoặc upload logo trong V6.

## Chức năng đã nối vào server

Tháng/năm sinh từ mẫu tuần, mỗi bữa nhiều dòng. Sửa bữa dùng editor nhiều món, các scope main/normal/shared/chay/thaythế/fixed. Normal mặc định chiều100 đã gồm10 thaythế, thêm5 chay →105 người. Job tính lại công thức chuẩn và công thức con của20 mã NVL mẫu, không chỉ tính gạo như V5. Sau thay đổi suất/món, chốt lại trước khi xuất.

Kho mẫuTT,CG,B2 vàTRANSIT; PRODUCTIONlà điểm theo dõi đã cấp sản xuất, không hàng khả dụng để chuyển. Một mã có số tồn riêng theo kho. Duyệt giữ hàng; xuất nguồn→transit; nhận transit→đích; nhận mua tăng đích từSUPPLIER. Số thiếu/đang đi không tự đóng. V6 chưa có chia một dòng điều chuyển thành nhiều lần xuất; có nhiều lần nhận. Chưa có lô, FEFO hoặc chuyển liên pháp nhân.

Đề nghị muaD+1 lấy lượng thiếu đã trừ tồn/giữ/hàng đang về kịp, làm tròn quy cách. Sau lập đề nghị phải tính lại trước khi lập tiếp hoặc xuất vì fingerprint đã thay đổi. Nhận một phần được lưu; nhận vượt bị chặn. Lập đơn không tăng tồn. Không tự gửi đơn hoặc thanh toán NCC.

Xuất sản xuất dùng kế hoạchD+1 READYvà fingerprint còn mới. Kiểm toàn bộ tồn khả dụng trước khi ghi dòng đầu; chặn xuất lần2 cho cùng bếp/ngày. Sau xuất, có nguồn ISSUEđể phát hành phiếuPDF. Bản này không có hoàn/đảo phiếu đã ghi hoặc điều chỉnh số xuất, tránh sửa lịch sử trực tiếp.

Lịch nền nằm trong tiến trình .NET, mặc định tắt. Khi bật, kiểm mỗi30 giây theoAsia/Ho_Chi_Minh, sau giờ cấu hình sinh snapshot choCG/B2 nếu đầu vào đổi. Key+hashngăn chạy trùng cùng đầu vào. Chỉ sinh nháp, không tự xuất, không tự lập mua. Server tắt thì không chạy; chưa có scheduler phân tán/HA, cảnh báoemail hoặc catch-up nhiều ngày.

## Quyền và phạm vi

Bổ sung operations.view; transfer.request/approve/dispatch/receive; planning.run; templates.edit; documents.view/publish. Admin/quảnlý có các quyền này mặc định. Kế hoạch được tính; thủ kho được yêu cầu/xuất/nhận chuyển; mua hàng được yêu cầu cấp và lập mua; vai trò chỉ xem không sửa mẫu hoặc ghi kho. Chỉnh ở Vai trò&phânquyền.

Admin/quảnlý được toàn kho. Userkhác mặc địnhCG, có thể đặt phạm vi theo usernameởThiết lập&phạmvi. Tạo yêu cầu kiểm quyền đích; duyệt/xuất kiểmnguồn; nhận kiểmđích. Phản hồi bỏ balances, menus, jobs và ledger ngoài phạm vi. Chứng từ giao nhận có thể chứa tên/chi tiết nguồn-đích liên quan đến giao dịch được phép xem; đây không phải mô hình ẩn tuyệt đối mọi metadata của kho đối tác.

Chưa tách pháp nhân/tenant thực thi. Vẫn một doanh nghiệp trong demo. Dữ liệu giá không dùng trong mẫu chứng từV6; giá tham chiếu trong danh mục được kiểm quyền riêng. Không khẳng định các nhãn tài khoản kế toán/thuế đã được cấu hình.

## API mới

GET /api/operations: cần đăng nhập+operations.view, lọc phạm vi.

POST /api/operations:

```json
{"type":"template","payload":{"template":{"id":"TRANSFER","name":"Phiếu chuyển","version":1,"title":"PHIẾU - {{warehouse.to}}","subtitle":"{{document.number}}","header":"{{company.name}}","info":"{{document.reason}}","footer":"Mẫu {{system.templateVersion}}","columns":[{"key":"name","label":"Tên hàng","width":60},{"key":"dispatched","label":"Thực xuất","width":40}],"signatures":["Người lập","Người nhận"],"fontSize":10,"orientation":"portrait"}},"expectedRevision":1,"requestId":"UUID-moi"}
```

expectedRevisionlấy từresponse hiện tại, không dùng1 cố định. requestIdlàUUIDhợp lệ cho mỗi lệnh, retry cùng mã phải cùng nội dung. POSTcần X-Lona-Request: 1 vàOriginđúng nếu có. Lỗi401 hếtphiên;403 thiếumuquyền/phạmvi;409 dữliệu/lịch sử/version;400 kiểudữliệu.

Các lệnh: create, approve, dispatch, receive, cancel; repeat, menus, run; purchase, purchaseReceive; productionIssue; template, company, schedule, scopes, publish. PublishnhậntransferId(hoặcidphiếuxuấtsảnxuất),templateId. Không cóAPIcho sửa/xóa documentsđã phát hành.

Các tệp JSONhỗ trợ backupcho demo, một tiến trình. Không dùng này thay transactionPostgreSQLcho chuỗi thực tế. DDLcompany/warehouse/ledger+templateversions/issued snapshot được giao để triển khaiadapter sau, chưa kết nối trongruntime.

## Kiểm tra đã làm

Reactonline/offlinebuild; .NETbuild;13 nhómJSgồmbiếnlạ, biếnthiếudữliệu, escapeHTML,PDFtiếngViệt/nhiềutrangvàBOM. HTTPthực gồmđăngnhập,scope,điềuchuyển/nhậntừngphần,fullBOM,gatingduyệt,đềnghịmua/nhận,chặnlặp/stale, xuấtsảnxuất,khớploạimẫu,versionmẫuvàsnapshotbấtbiến. Workerđã được kích bằnglịch trongtest. PDFmẫuđãrender3 trangđểkiểmbốcục.

UIpreviewđã thửsửatiêuđềcó{{warehouse.to}},lưuv2 vàxemtrướcgiảibiến. BảnHTMLofflinelưuởtrìnhduyệt,chỉxem/thửmẫu; phát hành và kho đầy đủphảichạycùngserver. Chưa kiểm tải, SQLconcurrency,integrationskếtoán,productionsecurityhoặckịchbảnmấtđiệnnhiềutệp.
