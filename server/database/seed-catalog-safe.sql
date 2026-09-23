/* INSERT-ONLY / IDEMPOTENT. Backup DB và review trước khi chạy trong SSMS. */
USE [DoCuQuangHuy];
GO
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF NOT EXISTS (SELECT 1 FROM dbo.PromoCodes WHERE Code=N'QUANGHUY10')
  INSERT dbo.PromoCodes(Code,DiscountRate,IsActive,[Description]) VALUES(N'QUANGHUY10',0.100,1,N'Giảm 10% toàn đơn');
IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE CategoryKey=N'ban-ghe')
  INSERT dbo.Categories(CategoryKey,Label,ImageUrl) VALUES(N'ban-ghe',N'Bàn ghế & ghế nhựa',N'/images/catalog/ban-ghe.svg');
IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE CategoryKey=N'noi-that')
  INSERT dbo.Categories(CategoryKey,Label,ImageUrl) VALUES(N'noi-that',N'Nội thất phòng trọ',N'/images/catalog/noi-that.svg');
IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE CategoryKey=N'noi-chao')
  INSERT dbo.Categories(CategoryKey,Label,ImageUrl) VALUES(N'noi-chao',N'Nồi, chảo quán ăn',N'/images/catalog/noi-chao.jpg');
IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE CategoryKey=N'bat-dia')
  INSERT dbo.Categories(CategoryKey,Label,ImageUrl) VALUES(N'bat-dia',N'Bát đĩa & khay',N'/images/catalog/bat-dia.jpg');
IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE CategoryKey=N'dung-cu')
  INSERT dbo.Categories(CategoryKey,Label,ImageUrl) VALUES(N'dung-cu',N'Dụng cụ bếp',N'/images/catalog/dung-cu.jpg');
IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE CategoryKey=N'luu-tru')
  INSERT dbo.Categories(CategoryKey,Label,ImageUrl) VALUES(N'luu-tru',N'Kệ inox & lưu trữ',N'/images/catalog/luu-tru.jpg');
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId=1)
  INSERT dbo.Products(ProductId,Name,CategoryKey,Price,OldPrice,Rating,Sold,Badge,[Description],ImageUrl) VALUES(1,N'Ghế nhựa bành lớn (còn như mới)',N'ban-ghe',85000,120000,4.8,214,N'hot',N'Ghế nhựa bành lớn về nhiều mỗi tuần, tình trạng còn như mới. Ngồi bành thoải mái, chịu tải tốt, hợp quán nhậu và tiệc ngoài trời.',NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=1 AND SortOrder=1) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(1,1,N'Tình trạng còn như mới, đã vệ sinh sạch sẽ');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=1 AND SortOrder=2) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(1,2,N'Nhựa dày, chịu tải tốt, không nứt gãy');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=1 AND SortOrder=3) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(1,3,N'Phù hợp quán ăn, quán nhậu, tiệc ngoài trời');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=1 AND SortOrder=4) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(1,4,N'Số lượng nhiều — inbox để được báo giá sỉ rẻ nhất');
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId=2)
  INSERT dbo.Products(ProductId,Name,CategoryKey,Price,OldPrice,Rating,Sold,Badge,[Description],ImageUrl) VALUES(2,N'Ghế nhựa cao Duy Tân',N'ban-ghe',95000,130000,4.7,156,N'sale',N'Ghế nhựa cao hàng Duy Tân quen thuộc của các quán bia, quán nhậu. Chân đế chắc chắn, ngồi cao thoải mái cả buổi.',NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=2 AND SortOrder=1) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(2,1,N'Hãng Duy Tân — nhựa dẻo dai, bền màu');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=2 AND SortOrder=2) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(2,2,N'Chân đế ổn định, chống trượt khi quét');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=2 AND SortOrder=3) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(2,3,N'Dễ xếp chồng khi cần dọn quầy');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=2 AND SortOrder=4) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(2,4,N'Hàng cũ còn đẹp, giá thanh lý cố định');
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId=3)
  INSERT dbo.Products(ProductId,Name,CategoryKey,Price,OldPrice,Rating,Sold,Badge,[Description],ImageUrl) VALUES(3,N'Bàn nhựa vuông 60 cm',N'ban-ghe',150000,NULL,4.6,88,N'new',N'Bàn nhựa vuông 60 cm gọn nhẹ, dễ kê và dễ vệ sinh. Kết hợp cùng ghế nhựa là có ngay một góc ngồi cho quán nhỏ.',NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=3 AND SortOrder=1) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(3,1,N'Mặt bàn phẳng, lau chùi nhanh');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=3 AND SortOrder=2) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(3,2,N'Chân bàn tháo lắp gọn khi di chuyển');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=3 AND SortOrder=3) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(3,3,N'Phù hợp phòng trọ, quán cà phê nhỏ');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=3 AND SortOrder=4) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(3,4,N'Đã kiểm tra chắc chắn trước khi bán');
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId=4)
  INSERT dbo.Products(ProductId,Name,CategoryKey,Price,OldPrice,Rating,Sold,Badge,[Description],ImageUrl) VALUES(4,N'Bộ 4 ghế nhựa đen cho quán ăn',N'ban-ghe',280000,340000,4.7,132,N'sale',N'Bộ bốn ghế nhựa đen đồng bộ, kiểu dáng giản dị bền bỉ. Lựa chọn tiết kiệm khi mở quán cần nhiều ghế cùng lúc.',NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=4 AND SortOrder=1) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(4,1,N'Bốn ghế đồng bộ màu đen, kiểu dáng thống nhất');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=4 AND SortOrder=2) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(4,2,N'Nhựa nguyên sinh dày dặn, chịu sử dụng mạnh');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=4 AND SortOrder=3) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(4,3,N'Giá bộ đã rẻ hơn mua lẻ từng chiếc');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=4 AND SortOrder=4) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(4,4,N'Nhận đơn số lượng lớn cho quán mới mở');
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId=5)
  INSERT dbo.Products(ProductId,Name,CategoryKey,Price,OldPrice,Rating,Sold,Badge,[Description],ImageUrl) VALUES(5,N'Giường tầng ngang 1 m cho phòng trọ',N'noi-that',1450000,1800000,4.8,67,N'hot',N'Giường tầng ngang rộng 1 m, dành riêng cho phòng trọ. Khung sắt chắc chắn, đủ cho hai người nằm thoải mái.',NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=5 AND SortOrder=1) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(5,1,N'Khung sắt chắc chắn, đã siết lại toàn bộ ốc');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=5 AND SortOrder=2) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(5,2,N'Rộng 1 m — chuẩn cho phòng trọ, khu công nhân');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=5 AND SortOrder=3) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(5,3,N'Thanh ngang chịu lực tốt, không ọp ẹp');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=5 AND SortOrder=4) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(5,4,N'Hỗ trợ giao lắp tại Gò Vấp và khu vực lân cận');
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId=6)
  INSERT dbo.Products(ProductId,Name,CategoryKey,Price,OldPrice,Rating,Sold,Badge,[Description],ImageUrl) VALUES(6,N'Tủ nhựa 4 ngăn cũ (còn mới)',N'noi-that',380000,NULL,4.6,54,N'new',N'Tủ nhựa bốn ngăn còn rất mới, ray kéo êm. Chứa quần áo gọn gàng cho phòng trọ hoặc phòng trẻ em.',NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=6 AND SortOrder=1) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(6,1,N'Bốn ngăn rộng, ray kéo êm không kêu');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=6 AND SortOrder=2) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(6,2,N'Nhựa dày, không ố vàng nặng');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=6 AND SortOrder=3) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(6,3,N'Dễ lau chùi, không mối mọt như tủ gỗ');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=6 AND SortOrder=4) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(6,4,N'Đã vệ sinh khử mùi trước khi bán');
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId=7)
  INSERT dbo.Products(ProductId,Name,CategoryKey,Price,OldPrice,Rating,Sold,Badge,[Description],ImageUrl) VALUES(7,N'Quạt đứng cũ (còn chạy êm)',N'noi-that',120000,NULL,4.5,73,N'new',N'Quạt đứng cũ đã được thử chạy đủ mức gió, motor êm, trục không kêu. Tiết kiệm hơn hẳn mua quạt mới cho phòng trọ.',NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=7 AND SortOrder=1) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(7,1,N'Đã thử đủ 3 mức gió tại cửa hàng');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=7 AND SortOrder=2) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(7,2,N'Motor êm, cột quạt chắc không rung lắc');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=7 AND SortOrder=3) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(7,3,N'Đầu quạt quay nhẹ, cánh sạch mới');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=7 AND SortOrder=4) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(7,4,N'Bảo hành chạy thử 7 ngày tại chỗ');
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId=8)
  INSERT dbo.Products(ProductId,Name,CategoryKey,Price,OldPrice,Rating,Sold,Badge,[Description],ImageUrl) VALUES(8,N'Bàn học gỗ cũ, mặt gỗ còn đẹp',N'noi-that',250000,NULL,4.6,41,N'new',N'Bàn học gỗ cũ mặt phẳng ít trầy, chân chắc. Vừa làm góc học tập vừa làm bàn làm việc tại nhà.',NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=8 AND SortOrder=1) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(8,1,N'Mặt gỗ phẳng, ít trầy xước');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=8 AND SortOrder=2) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(8,2,N'Chân bàn chắc chắn, không lung lay');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=8 AND SortOrder=3) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(8,3,N'Kích thước vừa phòng trọ, kê sát tường gọn');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=8 AND SortOrder=4) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(8,4,N'Có thể xem trực tiếp tại 707 Tân Sơn');
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId=9)
  INSERT dbo.Products(ProductId,Name,CategoryKey,Price,OldPrice,Rating,Sold,Badge,[Description],ImageUrl) VALUES(9,N'Bộ nồi inox 5 món (còn như mới)',N'noi-chao',890000,1150000,4.9,178,N'hot',N'Bộ nồi inox năm món còn như mới, đáy dày bắt nhiệt nhanh. Bộ nấu gia đình hoặc nấu nền quán nhỏ đều ổn.',NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=9 AND SortOrder=1) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(9,1,N'Inox dày, đáy bắt nhiệt nhanh không khê');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=9 AND SortOrder=2) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(9,2,N'Còn như mới — đã làm sạch sáng bóng');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=9 AND SortOrder=3) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(9,3,N'Dùng tốt trên bếp từ và bếp gas');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=9 AND SortOrder=4) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(9,4,N'Giá thanh lý thấp hơn mua mới gần một nửa');
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId=10)
  INSERT dbo.Products(ProductId,Name,CategoryKey,Price,OldPrice,Rating,Sold,Badge,[Description],ImageUrl) VALUES(10,N'Chảo sâu lòng 28 cm cho quán',N'noi-chao',220000,280000,4.7,143,N'sale',N'Chảo sâu lòng 28 cm xào gà được, chiên thoải mái. Tay cầm chắc, thành cao không văng dầu khi nấu mạnh.',NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=10 AND SortOrder=1) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(10,1,N'Sâu lòng — xào, chiên, kho đều tiện');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=10 AND SortOrder=2) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(10,2,N'Thành cao hạn chế văng dầu');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=10 AND SortOrder=3) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(10,3,N'Tay cầm chắc, bắt ốc chắn chắn');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=10 AND SortOrder=4) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(10,4,N'Đã kiểm tra trên bếp gas tại cửa hàng');
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId=11)
  INSERT dbo.Products(ProductId,Name,CategoryKey,Price,OldPrice,Rating,Sold,Badge,[Description],ImageUrl) VALUES(11,N'Nồi niêu soup cỡ lớn cho quán',N'noi-chao',450000,NULL,4.8,96,N'new',N'Nồi soup dung tích lớn dùng cho quán ăn, quán nhậu nấu nền. Nồi dày giữ nhiệt tốt, múc canh cả buổi vẫn nóng.',NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=11 AND SortOrder=1) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(11,1,N'Dung tích lớn — nấu nền cho 50–80 phần');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=11 AND SortOrder=2) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(11,2,N'Thành nồi dày, giữ nhiệt lâu');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=11 AND SortOrder=3) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(11,3,N'Quai chắc, bê di chuyển an toàn');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=11 AND SortOrder=4) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(11,4,N'Nắp đậy kín, hạn chế bay hơi');
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId=12)
  INSERT dbo.Products(ProductId,Name,CategoryKey,Price,OldPrice,Rating,Sold,Badge,[Description],ImageUrl) VALUES(12,N'Ấm đun nước inox 2,5 lít',N'noi-chao',185000,NULL,4.7,122,N'new',N'Ấm inox đun nước nhanh, có còi báo sôi. Dùng cho quầy pha chế hoặc bếp gia đình đều tiện.',NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=12 AND SortOrder=1) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(12,1,N'Đun nhanh, còi báo nước sôi rõ');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=12 AND SortOrder=2) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(12,2,N'Quai cầm cách nhiệt, không bỏng tay');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=12 AND SortOrder=3) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(12,3,N'Inox sáng, đã làm sạch trước khi bán');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=12 AND SortOrder=4) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(12,4,N'Dùng tốt trên bếp gas và bếp từ');
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId=13)
  INSERT dbo.Products(ProductId,Name,CategoryKey,Price,OldPrice,Rating,Sold,Badge,[Description],ImageUrl) VALUES(13,N'Bộ 3 bát inox nguyên khối',N'bat-dia',120000,NULL,4.7,205,N'new',N'Ba bát inox ba kích thước, không đường hàn, không bám mùi. Bếp gia đình hay sơ chế quán đều dùng được.',NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=13 AND SortOrder=1) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(13,1,N'Ba kích thước tiện dùng mỗi ngày');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=13 AND SortOrder=2) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(13,2,N'Không đường hàn — dễ rửa, không bám dầu');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=13 AND SortOrder=3) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(13,3,N'Còn sáng đẹp, không móp méo');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=13 AND SortOrder=4) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(13,4,N'Giá bộ đã rẻ hơn mua lẻ');
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId=14)
  INSERT dbo.Products(ProductId,Name,CategoryKey,Price,OldPrice,Rating,Sold,Badge,[Description],ImageUrl) VALUES(14,N'Bộ đĩa inox 6 chiếc',N'bat-dia',150000,190000,4.8,167,N'sale',N'Sáu đĩa inox vành thấp, hợp bữa ăn hằng ngày và tiếp khách. Không lo vỡ như đĩa sứ, dùng bền cả chục năm.',NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=14 AND SortOrder=1) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(14,1,N'Sáu chiếc đồng bộ, vành thấp thanh lịch');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=14 AND SortOrder=2) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(14,2,N'Inox dày, không móp, không gỉ');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=14 AND SortOrder=3) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(14,3,N'An toàn hơn đĩa sứ khi có con nhỏ');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=14 AND SortOrder=4) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(14,4,N'Rửa máy và lau khô đều được');
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId=15)
  INSERT dbo.Products(ProductId,Name,CategoryKey,Price,OldPrice,Rating,Sold,Badge,[Description],ImageUrl) VALUES(15,N'Khay phục vụ inox lớn',N'bat-dia',135000,NULL,4.8,119,N'hot',N'Khay inox to bề rộng, bê đồ nhiều trong một chuyền. Quán nhậu dọn bàn nhanh gấp rưỡi so với khay nhỏ.',NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=15 AND SortOrder=1) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(15,1,N'Mặt khay rộng, đỡ đi lại nhiều lần');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=15 AND SortOrder=2) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(15,2,N'Viền chống tràn, khay mâm giữ nước');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=15 AND SortOrder=3) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(15,3,N'Inox dày không biến dạng khi ép chồng');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=15 AND SortOrder=4) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(15,4,N'Đã vệ sinh sáng bóng trước khi bán');
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId=16)
  INSERT dbo.Products(ProductId,Name,CategoryKey,Price,OldPrice,Rating,Sold,Badge,[Description],ImageUrl) VALUES(16,N'Bộ dao bếp 5 món',N'dung-cu',290000,350000,4.8,154,N'sale',N'Năm chiếc dao chuyên dụng cho từng thao tác: thái, chặt, fillet. Lưỡi sắc, cán cân tay, sơ chế nhanh gọn.',NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=16 AND SortOrder=1) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(16,1,N'Đủ thao tác thái, chặt, cắt, fillet');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=16 AND SortOrder=2) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(16,2,N'Lưỡi đã mài sắc, cán nắm chắc');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=16 AND SortOrder=3) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(16,3,N'Cất gọn trong khay/bloc kèm theo');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=16 AND SortOrder=4) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(16,4,N'Kiểm tra độ sắc và độ chắc tay từng chiếc');
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId=17)
  INSERT dbo.Products(ProductId,Name,CategoryKey,Price,OldPrice,Rating,Sold,Badge,[Description],ImageUrl) VALUES(17,N'Thớt gỗ dày hai mặt',N'dung-cu',95000,NULL,4.6,87,N'new',N'Thớt gỗ dày hai mặt dùng xoay vòng: một mặt đập xương, một mặt thái món chín. Dày dặn, không cong vênh.',NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=17 AND SortOrder=1) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(17,1,N'Hai mặt dùng riêng sống và chín');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=17 AND SortOrder=2) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(17,2,N'Gỗ dày, bề mặt phẳng không cong');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=17 AND SortOrder=3) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(17,3,N'Đã cọ sạch và phơi khô trước khi bán');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=17 AND SortOrder=4) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(17,4,N'Quét dầu ăn mỏng để giữ bền mặt gỗ');
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId=18)
  INSERT dbo.Products(ProductId,Name,CategoryKey,Price,OldPrice,Rating,Sold,Badge,[Description],ImageUrl) VALUES(18,N'Bộ muỗng nĩa inox 6 món',N'dung-cu',80000,NULL,4.7,231,N'new',N'Sáu chiếc muỗng nĩa inox dày tay, dùng cho gia đình hoặc dự phòng quán. Rẻ mà chắc, mất cũng không tiếc.',NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=18 AND SortOrder=1) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(18,1,N'Inox dày, không cong vênh khi múc đồ cứng');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=18 AND SortOrder=2) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(18,2,N'Sáu chiếc đồng bộ, dễ thay thế từng cái');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=18 AND SortOrder=3) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(18,3,N'Rửa máy an toàn');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=18 AND SortOrder=4) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(18,4,N'Giá thanh lý — phù hợp mua dự phòng');
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId=19)
  INSERT dbo.Products(ProductId,Name,CategoryKey,Price,OldPrice,Rating,Sold,Badge,[Description],ImageUrl) VALUES(19,N'Kệ inox 4 tầng cho quán & nhà bếp',N'luu-tru',850000,990000,4.9,138,N'hot',N'Kệ inox bốn tầng chắc chắn, kê dao thớt hay để nguyên liệu đều được. Hàng gửi khách tỉnh về liên tục.',N'/images/products/ke-inox-4-tang.jpg');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=19 AND SortOrder=1) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(19,1,N'Bốn tầng chịu lực, ốc vít đủ bộ');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=19 AND SortOrder=2) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(19,2,N'Chân đế ổn định trên nền gạch trơn');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=19 AND SortOrder=3) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(19,3,N'Tháo lắp dễ dàng khi chuyển kho');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=19 AND SortOrder=4) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(19,4,N'Gửi qua nhà xe toàn quốc được');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductImages WHERE ProductId=19 AND SortOrder=1) INSERT dbo.ProductImages(ProductId,SortOrder,Url) VALUES(19,1,N'/images/products/ke-inox-4-tang.jpg');
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId=20)
  INSERT dbo.Products(ProductId,Name,CategoryKey,Price,OldPrice,Rating,Sold,Badge,[Description],ImageUrl) VALUES(20,N'Bộ hộp inox bảo quản, 3 hộp',N'luu-tru',150000,NULL,4.7,176,N'new',N'Ba hộp inox nắp kín ba cỡ, xếp chồng gọn tủ lạnh. Bảo quản thức ăn sơ chế cả ngày vẫn tươi.',NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=20 AND SortOrder=1) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(20,1,N'Ba kích thước xếp chồng tiết kiệm chỗ');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=20 AND SortOrder=2) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(20,2,N'Nắp kín — hạn chế mùi lẫn trong tủ lạnh');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=20 AND SortOrder=3) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(20,3,N'Inox không bám mùi như hộp nhựa');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=20 AND SortOrder=4) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(20,4,N'Dùng được cho cả sơ chế lẫn trưng bày');
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId=21)
  INSERT dbo.Products(ProductId,Name,CategoryKey,Price,OldPrice,Rating,Sold,Badge,[Description],ImageUrl) VALUES(21,N'Rổ inox thoát nước nhanh',N'luu-tru',100000,NULL,4.7,198,N'new',N'Rổ inox đục lỗ đều, rửa rau xong nước thoát liền. Có chân đế kê cao, khỏi ướt mặt bếp.',NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=21 AND SortOrder=1) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(21,1,N'Lỗ đục đều — thoát nước cực nhanh');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=21 AND SortOrder=2) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(21,2,N'Chân đế ổn định, kê cao thoáng');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=21 AND SortOrder=3) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(21,3,N'Còn sáng đẹp, không gỉ điểm');
IF NOT EXISTS (SELECT 1 FROM dbo.ProductSpecs WHERE ProductId=21 AND SortOrder=4) INSERT dbo.ProductSpecs(ProductId,SortOrder,SpecText) VALUES(21,4,N'Vệ sinh ngay dưới vòi nước tiện lợi');
SELECT @@ROWCOUNT AS LastStatementRows;
COMMIT TRANSACTION;
GO
