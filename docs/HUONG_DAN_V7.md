# LONA V7 — Hướng dẫn demo, import và vận hành kho

Ngày: 27/10/2026. Bản này sửa trực tiếp 5 vấn đề được phản ánh từ giao diện V6.2. Các chức năng mô tả dưới đây đã có trong mã; phần giới hạn ghi rõ cuối tài liệu.

## 1. Những gì thay đổi

| Phản hồi | Cách xử lý |
|---|---|
| Bỏ nhật ký hệ thống | Bỏ menu và trang nhật ký khỏi giao diện. Timeline vẫn đặt trong chi tiết phiếu để theo dõi đúng nghiệp vụ. |
| Mua/nhận/xuất trống, không biết lập ở đâu | Có bộ mẫu liên kết; có nút Lập phiếu, import CSV, nhận từng phần sinh phiếu nhập, xuất trực tiếp hoặc từ BOM. |
| Kho rối | Một trang theo tab, lọc kho/trạng thái; chi tiết mở panel bên phải. Không để form tạo dài luôn nằm trên bảng tồn. |
| Menu phân mảnh | Gom còn 6 mục chính; chức năng cùng nhóm ở các tab. |
| Thiếu chi tiết | Mỗi phiếu có hàng, lượng, trạng thái, nguồn, mốc thực hiện, biến động và bản PDF gắn nguồn. |

Không tự tạo dữ liệu lên service Render đang chạy chỉ bằng tải bản nguồn. Cần cập nhật mã và chủ động nạp mẫu trên môi trường demo.

## 2. Bố cục và vai trò

| Menu | Tab | Người thường thao tác |
|---|---|---|
| Tổng quan | Luồng công việc, số việc chờ, tình huống mẫu | Quản lý |
| Thực đơn & kế hoạch | Bảng thực đơn; kế hoạch D+1/D+2/D+3/7 ngày/tháng sau | Kế hoạch, quản lý |
| Kho & mua hàng | Tồn kho; mua & nhận; điều chuyển; xuất bếp; sổ kho | Mua hàng, thủ kho, quản lý |
| Danh mục | Món & định lượng; nguyên liệu | Người quản lý định mức |
| Chứng từ | Đã phát hành; mẫu chứng từ | Người có quyền chứng từ |
| Quản trị | Người dùng; vai trò; thiết lập | Quản trị viên |

Menu và nút theo quyền. API vẫn kiểm tra quyền và phạm vi kho; không dựa vào việc ẩn nút để bảo mật. Thủ kho CG không được ghi xuất B2. Người yêu cầu chuyển có thể chọn nguồn ngoài phạm vi; người duyệt/xuất phải có phạm vi nguồn, người nhận phải có phạm vi đích.

## 3. Bộ dữ liệu mẫu liền mạch

Bản HTML có sẵn bộ mẫu đã sinh bằng các lệnh .NET thực tế, không chỉ thêm số vào dashboard. Trên seed mới, bộ mẫu gồm:

| Thành phần | Tình huống |
|---|---|
| Thực đơn | Bếp B2, ngày 02–04/11/2026, 6 bữa sáng/chiều đã chốt |
| Kế hoạch | Mốc D = 01/11/2026, D+1 là 02/11; nhu cầu tính theo BOM |
| Mua theo kế hoạch | 10 dòng thiếu mua từ D+1 được lập và nhận đủ |
| Phiếu nhập | 10 phiếu từ nhận mua theo kế hoạch |
| Phiếu xuất bếp | PXK-00001, xuất toàn bộ BOM ngày 02/11, tham chiếu lần tính kế hoạch |
| Mua bổ sung | DM-00011, kho TT, gạo 100 kg, đã nhận 40 kg, còn 60 kg |
| Nhập bổ sung | PNK-00011, nhận 40 kg từ DM-00011 |
| Điều chuyển | DC-00001, TT → B2, gạo 20 kg; đã nhận 8 kg, còn đang đi 12 kg |
| Bản in | 3 snapshot: xuất bếp, nhập bổ sung, điều chuyển |

Số lượng mua khi nạp trên dữ liệu hiện hữu có thể thay đổi theo tồn; các con số trên là bộ seed mới đã kiểm tra. Ngày phiếu nhập là ngày thực hiện nạp mẫu, không tự sửa thành ngày nhận dự kiến. Mốc dự kiến dùng cho tình huống trình diễn, cần phân biệt với ngày thao tác thực tế.

Cách nạp trên .NET: Tổng quan → Nạp bộ mẫu liên kết → đọc mô tả → Xác nhận nạp mẫu. Chỉ admin được nạp, không nạp lần hai. Nếu B2 đã có thực đơn trùng kỳ thì dừng, không ghi đè. Toàn bộ thao tác mẫu nằm trong một lần ghi operations.json; nếu một bước lỗi, bộ mẫu không được lưu dở.

Bộ mẫu bổ sung hàng và giao dịch, làm thay đổi tồn ở TT/B2. Không nạp vào môi trường đang vận hành thật. Muốn xem thử mà không đụng dữ liệu server, dùng file HTML riêng.

## 4. Kịch bản trình khách trong 5 phút

1. Mở Tổng quan, chỉ vào luồng Thực đơn → Nhu cầu → Mua/điều chuyển → Nhập/xuất → Chứng từ.
2. Bấm Xem thực đơn mẫu trong tình huống mẫu. Chọn bếp B2, tháng 11/2026; bảng tuần ngày 02/11. Mỗi ngày có sáng/chiều và nhiều món. Món chay/thay thế tách nhóm.
3. Mở Kế hoạch nguyên liệu, mốc 01/11/2026. Xem NVL để thấy phân rã công thức. Khi tồn/phiếu thay đổi, phải tính lại, tránh dùng kế hoạch cũ.
4. Kho & mua hàng → Mua & nhận. Lọc Nhận một phần, mở DM-00011. Hiện gạo 100 kg, đã nhận 40 kg, còn 60 kg.
5. Nhận thêm 10 kg. Hệ thống tạo PNK mới, số nhận thành 50 kg, còn 50 kg, tồn TT tăng 10 kg. Bấm liên kết PNK để mở đúng phiếu nhập.
6. Điều chuyển → DC-00001. Timeline: yêu cầu → duyệt → xuất chuyển → nhận. Hiện đang đi 12 kg. Nhận thêm 5 kg: còn đang đi 7 kg, tồn B2 tăng 5 kg.
7. Xuất bếp → PXK-00001. Xem nhiều nguyên liệu và bấm các đề nghị mua liên quan cùng ngày/kế hoạch. PDF đã lưu có thể tải lại.
8. Sổ kho: bấm số phiếu để mở lại đúng nguồn. Không sửa số tồn bằng cách sửa dòng sổ kho.

Các số của kịch bản nêu trên là số ban đầu. Sau khi thao tác sẽ thay đổi; tải lại không reset dữ liệu. Nếu trình lại từ đầu, dùng trình duyệt/hồ sơ demo mới cho file HTML hoặc một môi trường test mới, không xóa disk hiện hữu.

## 5. Lập đề nghị mua trực tiếp

Kho & mua hàng → Mua & nhận → Lập đề nghị mua.

| Trường | Cách nhập |
|---|---|
| Kho nhận | Kho có quyền thao tác |
| Nhà cung cấp | Tên nhà cung cấp, không phải tài khoản kế toán |
| Ngày cần | Ngày dự kiến cần hàng |
| Phiếu nguồn | Có thể chọn phiếu nhập trước đó để tham chiếu, hoặc để Lập trực tiếp |
| Nguyên liệu | Mã có trong danh mục; đơn vị lấy theo mã |
| Số lượng | Lớn hơn 0, hỗ trợ thập phân |

Có thể thêm tối đa 100 dòng. Không lặp cùng mã trong một phiếu; gộp lượng trước khi lập. Lập đề nghị chưa tăng tồn. Mở Chi tiết → Nhận hàng ở từng dòng → nhập lượng nhận lần này → Xác nhận nhận. Mỗi lần nhận sinh một PNK có tham chiếu về dòng đề nghị mua. Nhận vượt lượng còn thiếu bị chặn cả ở giao diện và API.

Phiếu nhiều dòng nhập trực tiếp được gom cùng số đề nghị. Dữ liệu mua từ kế hoạch V6 hiện vẫn là các dòng/phiếu riêng; V7 không đổi mã cũ.

## 6. Lập mua từ thực đơn

1. Thực đơn có số suất và được chốt.
2. Công thức đầy đủ, đúng đơn vị, không vòng lặp và đã được duyệt.
3. Kế hoạch nguyên liệu: chọn bếp, mốc D, Tính.
4. Tab D+1: Xem NVL → kiểm tra nhu cầu, khả dụng, hàng đang về, quy cách mua.
5. Lập đề nghị mua D+1 → mở tab Mua & nhận và nhận thực tế.
6. Tính lại sau khi hàng đã nhận → xuất sản xuất nếu đủ nguyên liệu.

Không dùng D+2/D+3/tuần/tháng để tự xuất kho. Các kỳ dài dùng dự trù; hành động mua/xuất hiện gắn D+1. Server từ chối kế hoạch có fingerprint cũ. V7 đưa điều chuyển/giữ chỗ vào fingerprint để tránh tiếp tục dùng kết quả cũ sau khi thay đổi phiếu chuyển.

Bản HTML có sẵn kết quả BOM mẫu nhưng không tính lại BOM hoặc lập mua/xuất từ kế hoạch. Chạy .NET để kiểm thử toàn bộ chuỗi mới từ đầu. Lập/nhận/xuất trực tiếp trong HTML chỉ là dữ liệu cục bộ trình duyệt.

## 7. Lập và theo dõi điều chuyển

Kho & mua hàng → Điều chuyển → Lập điều chuyển.

- Chọn kho xuất, kho nhận, ngày cần và hàng. Hai kho phải khác nhau, chỉ kho vật lý.
- Lập yêu cầu: chưa trừ tồn.
- Duyệt: kiểm tra khả dụng và giữ chỗ.
- Xuất chuyển: trừ kho nguồn, tăng vị trí Hàng đang đi.
- Nhận: giảm Hàng đang đi, tăng kho đích đúng lượng thực nhận.
- Nhận đủ: hoàn tất; không nhận thêm.
- Hủy chỉ khi nháp/đã duyệt. Hàng đã xuất cần nghiệp vụ hoàn/đảo riêng, chưa có trong demo.

Timeline hiển thị bước hiện tại, người/thời điểm thao tác nếu có, các lần nhận và nguồn liên quan. Có animation nhẹ khi mở panel và tại bước hiện tại; tôn trọng chế độ giảm chuyển động.

Nhiều dòng hàng hiện tạo mã DC riêng cho từng dòng trong cùng đợt lập, toàn bộ đợt ghi một lần. Đây chưa phải một chứng từ chuyển kho nhiều dòng; không cộng đơn vị khác nhau thành một số tổng.

## 8. Xuất bếp

Có hai đường:

- Theo BOM: sau tính lại D+1, đủ khả dụng, Xuất sản xuất. Kiểm tra mọi dòng trước khi ghi, chặn xuất trùng cùng bếp/ngày.
- Trực tiếp: tab Xuất bếp → Lập phiếu xuất → chọn kho, ngày, lý do, hàng và lượng. Có thể tham chiếu phiếu nhập. Server kiểm tra mọi dòng đủ khả dụng trước khi ghi.

Xuất trực tiếp là nghiệp vụ riêng, không tự coi là đã xuất đủ kế hoạch D+1. Nếu dùng cả hai đường cho cùng ngày phải tự kiểm soát phạm vi, vì chưa có đối trừ từng dòng xuất trực tiếp vào kế hoạch. Không hỗ trợ tồn âm. Không sửa lượng của phiếu đã ghi sổ bằng cách sửa mẫu PDF.

## 9. Import CSV hàng hóa

Trong form lập phiếu mua/điều chuyển/xuất: Tải mẫu → điền dữ liệu → Chọn CSV → xem kết quả → Lập phiếu.

```csv
itemId,quantity,unit
GAO,20,kg
NEP,5,kg
```

| Quy tắc | Ý nghĩa |
|---|---|
| itemId | Mã nguyên liệu có sẵn, không phải tên tự do |
| quantity | > 0; dùng dấu chấm thập phân, không ghi dấu phân cách hàng nghìn |
| unit | Đúng đơn vị gốc của mã, ví dụ kg; không tự đổi từ g sang kg |
| 100 dòng | Giới hạn cho một lần lập |
| Trùng mã | Báo lỗi để người dùng gộp lượng |
| Sai dòng | Hiện số dòng và lỗi; không cho ghi một phần |
| Nạp lặp | Nội dung import cùng thông tin phiếu được nhận diện để chặn tạo lại |

Kho/ngày/nhà cung cấp nhập ở phần đầu phiếu, không nằm trong từng dòng CSV. Sau import hợp lệ vẫn có thể sửa các dòng; lúc đó được coi là nhập tay. Nếu sửa CSV bị lỗi, chọn lại file sau khi sửa. Các file mẫu và danh sách mã nằm ở samples/import.

Đây là import dòng phiếu, không phải nhập tồn đầu kỳ. Không dùng để ghi trực tiếp đè balances.

## 10. Import thực đơn

Thực đơn & kế hoạch → Thực đơn → Import thực đơn CSV. Tải mẫu và danh sách mã món.

```csv
date,meal,normal,vegetarian,replacement,slot,dishId,scope
2026-12-01,SANG,80,0,0,Món sáng,PHOGA,main
2026-12-01,SANG,80,0,0,Tráng miệng,CHUOI,shared
```

- Ngày yyyy-mm-dd; meal SANG hoặc CHIEU.
- Một dòng là một món; cùng ngày/ca được gom thành một bữa.
- Số suất là tổng của bữa, phải giống nhau ở các dòng cùng bữa, không cộng số suất theo số món.
- normal/vegetarian/replacement là số nguyên không âm. Mẫu dùng thay thế đã nằm trong suất thường.
- slot là vị trí món; không trùng trong cùng bữa.
- dishId phải tồn tại và có recipeId trong danh mục.
- scope: main, normal, shared, vegetarian hoặc replacement. Mẫu CSV chưa hỗ trợ fixed; dùng trình Sửa bữa cho trường hợp riêng.
- Import tạo bữa nháp hoặc thay thế bữa nháp cùng ngày/ca trong bếp đang chọn. Bữa đã chốt không bị ghi đè.
- Tối đa 500 dòng món / 62 bữa mỗi lần. Sau import, chọn tháng/ngày tương ứng để xem và chốt.

Bản này chưa đọc trực tiếp XLSX/XLSM/RAR đối tác hoặc tự đoán đơn vị, mã món, ca ăn. Cần chuyển vào mẫu CSV và đối chiếu trước.

## 11. Chứng từ và liên kết

Mỗi chi tiết phiếu có khu vực Chứng từ → Phát hành bản in → PDF phiên bản tương ứng. Có mẫu mới Phiếu nhập kho (RECEIVE), ngoài phiếu điều chuyển, xuất bếp và đề nghị xuất. Mẫu nhập chỉ dùng nguồn PNK; mẫu xuất chỉ dùng nguồn PXK. API chặn ghép sai loại.

Chi tiết mua liên kết các PNK; PNK liên kết về đề nghị mua. PXK theo BOM liên kết kế hoạch và các đề nghị mua cùng khóa ngày/bếp. Điều chuyển có thể liên kết phiếu nhập nguồn. Sổ kho liên kết đúng chứng từ đã ghi.

Bản phát hành chụp dữ liệu và mẫu tại thời điểm đó; sửa mẫu sau không đổi PDF cũ. Phát hành trước khi nhận đủ sẽ chụp trạng thái nhận dở; muốn in trạng thái mới thì phát hành một snapshot mới. Đây là mẫu chứng từ vận hành demo, không phải hóa đơn hay chữ ký số.

Tab kho có Xuất CSV theo dữ liệu/phạm vi kho của tab. CSV xuất phục vụ tra cứu, không phải tất cả đều là mẫu import; dùng Tải mẫu trong form để nhập lại đúng schema.

## 12. Nâng cấp bản Render đang chạy

1. Sao lưu dữ liệu /var/data theo quy trình của bạn trước khi thay phiên bản.
2. Giải nén mã mới; cập nhật nội dung dự án trong repository GitHub hiện tại. Giữ Dockerfile và render.yaml ở gốc repo.
3. Không upload backend/AppData, .env, mật khẩu hoặc file đối tác gốc.
4. Giữ service và persistent disk hiện tại, không tạo lại hoặc xóa disk. Giữ nguyên DataPath=/var/data/state.json, IdentityPath=/var/data/identity.json, OperationsPath=/var/data/operations.json, DataProtectionPath=/var/data/keys.
5. Push commit. Để Render triển khai hoặc chọn Manual Deploy cho commit mới.
6. Tài khoản/mật khẩu cũ giữ nguyên. LONA_ADMIN_PASSWORD chỉ tạo admin nếu chưa có identity.json; không đặt lại mật khẩu đã lưu.
7. Khi Live, tải lại trang, kiểm tra đăng nhập, 6 menu, phiếu cũ và tồn kho.
8. Chỉ trên môi trường demo: nạp mẫu từ Tổng quan. Không copy samples/demo_operations.json ghi đè /var/data/operations.json của service hiện hữu.

V7 đọc được operations V6: bổ sung collection phiếu nhập và mẫu nhập khi thiếu. Không xóa phiếu cũ. Các lần nhận cũ trước V7 chưa có PNK riêng sẽ không được tự tạo ngược giả lịch sử. Sau nâng cấp, tính lại kế hoạch trước khi lập mua/xuất.

## 13. Kiểm thử đã thực hiện

| Nhóm | Kết quả |
|---|---|
| .NET build | Thành công, không warning/error |
| Frontend build | Thành công |
| Node | 19 nhóm: định mức/suất, quyền, mẫu/PDF, parser CSV, lỗi import, nhận hàng, chặn nhận vượt, snapshot cục bộ |
| API V6 trên V7 | Đăng nhập, scope, giữ/xuất/nhận, BOM, lịch nền, phiên bản mẫu và snapshot vẫn qua |
| API V7 | Bộ mẫu liên kết, nhận mua sinh PNK, xuất BOM, nhận dở, sai đơn vị, batch lỗi không ghi dở, replay/import trùng, import thực đơn, scope kho |
| Browser | 6 menu; mở timeline; từ DC mở PNK rồi DM; nhận thêm 10 kg sinh PNK mới và cập nhật còn thiếu |

Các kiểm tra dùng file tạm. Không thử ghi dữ liệu hoặc triển khai lại service Render của người dùng trong phiên tạo bản này. Không có kiểm thử tải nhiều người hoặc chứng nhận vận hành production.

## 14. Giới hạn còn lại

JSON chỉ dùng một tiến trình, chưa phải PostgreSQL transaction. Chưa có định giá xuất kho, công nợ, hóa đơn, bút toán kế toán, trả hàng/đảo phiếu, lô/hạn dùng hoặc đối soát tài chính. Không gọi nhà cung cấp hoặc gửi đơn mua ra ngoài. Ghi danh mục đồng bộ hai file JSON vẫn có giới hạn khi mất điện giữa hai lần ghi.

Mẫu kế hoạch được tính theo tồn, hàng đang về và định mức demo. Chưa có máy tối ưu lịch giao xe, FEFO hoặc phân bổ nhu cầu từng ngày qua toàn bộ kỳ dài. Những phần này phải thiết kế, triển khai và nghiệm thu riêng nếu đưa vào phạm vi thật.
