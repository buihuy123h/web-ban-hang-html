
/* =====================================================================
   ĐỒ CŨ QUANG HUY — CSDL SQL Server: cấu trúc + dữ liệu mẫu
   Sinh tự động từ dữ liệu JSON trong thư mục server/data bằng generate-seed.cjs
   CSDL: DoCuQuangHuy  |  Sinh lúc: 2026-09-22T06:47:21.410Z

   NỘI DUNG:
     1. Tạo CSDL nếu chưa có (collation tiếng Việt)
     2. 7 bảng: Categories, Products, ProductImages, ProductSpecs,
        PromoCodes, Orders, OrderItems — khóa ngoại, CHECK, index, ràng buộc chuẩn BCNF
     3. Kiểu bảng dbo.OrderItemType + thủ tục usp_TaoDonHang (tạo đơn
        an toàn: giá lấy từ DB, miễn phí ship từ 500.000đ, mã giảm giá)
     4. 2 VIEW: vw_SanPham, vw_DonHangChiTiet
     5. Dữ liệu mẫu: 6 danh mục, 21 sản phẩm
        (đủ thông số + ảnh), 2 mã giảm giá, 5 đơn hàng mẫu

   CÁCH NẠP (chọn 1):
     - SSMS: File > Open > File... → chọn file này → Execute (F5)
     - sqlcmd: sqlcmd -S .\SQLEXPRESS -E -i do-cu-quang-huy.sql
     - Azure Data Studio: Open File → Run

   LƯU Ý: chạy lại file này sẽ XOÁ toàn bộ bảng & dữ liệu hiện có trong
   CSDL DoCuQuangHuy rồi tạo lại từ đầu.
   ===================================================================== */

USE master;
GO
IF DB_ID(N'DoCuQuangHuy') IS NULL
    CREATE DATABASE [DoCuQuangHuy] COLLATE Vietnamese_100_CI_AI;
/* Collation tiếng Việt: sắp xếp & so sánh chuỗi có dấu đúng chuẩn VN */
GO
USE [DoCuQuangHuy];
/* SET options chuẩn khi tạo bảng có cột computed / làm việc với dữ liệu */
SET ANSI_NULLS ON; SET ANSI_PADDING ON; SET ANSI_WARNINGS ON;
SET ARITHABORT ON; SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON; SET NUMERIC_ROUNDABORT OFF;
GO

/* ============ 2. DỌN ĐỐI TƯỢNG CŨ (để file chạy lại được) ============
   CẢNH BÁO: xoá cả dữ liệu hiện có của các đối tượng dưới đây. */
IF OBJECT_ID(N'dbo.vw_DonHangChiTiet', N'V')  IS NOT NULL DROP VIEW  dbo.vw_DonHangChiTiet;
IF OBJECT_ID(N'dbo.vw_SanPham',        N'V')  IS NOT NULL DROP VIEW  dbo.vw_SanPham;
IF OBJECT_ID(N'dbo.usp_TaoDonHang',    N'P')  IS NOT NULL DROP PROC  dbo.usp_TaoDonHang;
IF TYPE_ID(N'dbo.OrderItemType') IS NOT NULL DROP TYPE dbo.OrderItemType;
IF OBJECT_ID(N'dbo.OrderItems',        N'U')  IS NOT NULL DROP TABLE dbo.OrderItems;
IF OBJECT_ID(N'dbo.Orders',            N'U')  IS NOT NULL DROP TABLE dbo.Orders;
IF OBJECT_ID(N'dbo.ProductSpecs',      N'U')  IS NOT NULL DROP TABLE dbo.ProductSpecs;
IF OBJECT_ID(N'dbo.ProductImages',     N'U')  IS NOT NULL DROP TABLE dbo.ProductImages;
IF OBJECT_ID(N'dbo.PromoCodes',        N'U')  IS NOT NULL DROP TABLE dbo.PromoCodes;
IF OBJECT_ID(N'dbo.Products',          N'U')  IS NOT NULL DROP TABLE dbo.Products;
IF OBJECT_ID(N'dbo.Categories',        N'U')  IS NOT NULL DROP TABLE dbo.Categories;
GO

/* ========================= 3. CẤU TRÚC BẢNG ========================= */
/* Danh mục — khóa là "key" không dấu (ban-ghe, noi-that...) như products.json */
CREATE TABLE dbo.Categories (
    CategoryKey NVARCHAR(50)  NOT NULL,
    Label       NVARCHAR(100) NOT NULL,
    ImageUrl    NVARCHAR(200) NULL,   -- đường dẫn tương đối /images/...
    CONSTRAINT PK_Categories PRIMARY KEY (CategoryKey)
);
GO

/* Sản phẩm — bỏ categoryLabel (lấy qua JOIN, xem vw_SanPham) */
CREATE TABLE dbo.Products (
    ProductId     INT            NOT NULL,
    Name          NVARCHAR(200)  NOT NULL,
    CategoryKey   NVARCHAR(50)   NOT NULL,
    Price         DECIMAL(12,0)  NOT NULL,   -- giá bán (VNĐ)
    OldPrice      DECIMAL(12,0)  NULL,       -- giá gốc nếu đang giảm giá
    Rating        DECIMAL(2,1)   NOT NULL,
    Sold          INT            NOT NULL,   -- số đã bán (sắp xếp "phổ biến")
    Badge         NVARCHAR(10)   NULL,       -- hot / sale / new
    [Description] NVARCHAR(1000) NOT NULL,
    ImageUrl      NVARCHAR(200)  NULL,       -- ảnh riêng; NULL = mượn ảnh danh mục
    CONSTRAINT PK_Products PRIMARY KEY (ProductId),
    CONSTRAINT FK_Products_Categories FOREIGN KEY (CategoryKey)
        REFERENCES dbo.Categories (CategoryKey),
    CONSTRAINT CK_Products_Price    CHECK (Price >= 0),
    CONSTRAINT CK_Products_OldPrice CHECK (OldPrice IS NULL OR OldPrice > Price),   -- giá gốc phải cao hơn giá bán (đơn đang giảm giá)
    CONSTRAINT CK_Products_Rating   CHECK (Rating BETWEEN 0 AND 5),
    CONSTRAINT CK_Products_Sold     CHECK (Sold >= 0),
    CONSTRAINT CK_Products_Badge    CHECK (Badge IN (N'hot', N'sale', N'new'))
);
GO

/* Gallery ảnh (từ mảng images) — SP không có ảnh thật thì không có dòng,
   FE tự fallback về ảnh danh mục (client/src/data/productImages.js).
   Chuẩn BCNF: "ảnh chính" = dòng SortOrder = 1 — KHÔNG lưu cờ IsPrimary riêng
   vì cờ đó suy ra được 100% từ SortOrder (thuộc tính dư thừa, dễ lệch nhau). */
CREATE TABLE dbo.ProductImages (
    ProductId INT           NOT NULL,
    SortOrder INT           NOT NULL,   -- 1 = ảnh chính
    Url       NVARCHAR(200) NOT NULL,   -- /images/products/... (không lưu URL domain)
    CONSTRAINT PK_ProductImages PRIMARY KEY (ProductId, SortOrder),
    CONSTRAINT FK_ProductImages_Products FOREIGN KEY (ProductId)
        REFERENCES dbo.Products (ProductId) ON DELETE CASCADE
);
GO

/* Thông số sản phẩm (từ mảng specs) — gạch đầu dòng ở trang chi tiết */
CREATE TABLE dbo.ProductSpecs (
    ProductId INT           NOT NULL,
    SortOrder INT           NOT NULL,
    SpecText  NVARCHAR(300) NOT NULL,
    CONSTRAINT PK_ProductSpecs PRIMARY KEY (ProductId, SortOrder),
    CONSTRAINT FK_ProductSpecs_Products FOREIGN KEY (ProductId)
        REFERENCES dbo.Products (ProductId) ON DELETE CASCADE
);
GO

/* Mã giảm giá — đồng bộ PROMO_CODES trong server.js */
CREATE TABLE dbo.PromoCodes (
    Code          NVARCHAR(20)  NOT NULL,
    DiscountRate  DECIMAL(4,3)  NOT NULL,   -- 0.100 = giảm 10%
    IsActive      BIT NOT NULL DEFAULT 1,
    [Description] NVARCHAR(200) NULL,
    CONSTRAINT PK_PromoCodes PRIMARY KEY (Code),
    CONSTRAINT CK_PromoCodes_Rate CHECK (DiscountRate > 0 AND DiscountRate <= 1)
);
GO

/* Đơn hàng — khách vãng lai nên customer lưu phẳng vào bảng */
CREATE TABLE dbo.Orders (
    OrderId         INT IDENTITY(1,1) NOT NULL,
    OrderCode       NVARCHAR(20)  NOT NULL,   -- "DI" + 8 chữ số, duy nhất
    DeliveryMethod  NVARCHAR(10)  NOT NULL,   -- standard / express
    PaymentMethod   NVARCHAR(10)  NOT NULL,   -- cod / transfer
    PromoCode       NVARCHAR(20)  NULL,       -- không FK: giữ nguyên mã lịch sử
    Subtotal        DECIMAL(12,0) NOT NULL,
    ShippingFee     DECIMAL(12,0) NOT NULL,
    Discount        DECIMAL(12,0) NOT NULL,
    /* Chuẩn BCNF: Total là giá trị SUY DIỄN (Subtotal - Discount + ShippingFee) —
       dùng cột computed PERSISTED thay vì lưu cứng, SQL Server tự tính nên
       không bao giờ xảy ra lệch số khi UPDATE một trong ba cột nguồn. */
    Total AS (CAST(Subtotal - Discount + ShippingFee AS DECIMAL(12,0))) PERSISTED,
    CustomerName    NVARCHAR(80)  NOT NULL,
    CustomerPhone   NVARCHAR(10)  NOT NULL,
    CustomerAddress NVARCHAR(300) NOT NULL,
    Note            NVARCHAR(500) NULL,
    CreatedAt       DATETIME2(3)  NOT NULL,   -- giờ UTC (giống ISO trong JSON)
    CONSTRAINT PK_Orders PRIMARY KEY (OrderId),
    CONSTRAINT UQ_Orders_OrderCode UNIQUE (OrderCode),
    CONSTRAINT CK_Orders_Delivery CHECK (DeliveryMethod IN (N'standard', N'express')),
    CONSTRAINT CK_Orders_Payment  CHECK (PaymentMethod IN (N'cod', N'transfer')),
    CONSTRAINT CK_Orders_Phone    CHECK (CustomerPhone LIKE '0[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]')
);
GO

/* Dòng hàng trong đơn — ProductName + UnitPrice là SNAPSHOT tại thời điểm đặt,
   có thể khác tên/giá hiện tại của sản phẩm (giữ lịch sử chính xác) */
CREATE TABLE dbo.OrderItems (
    OrderItemId INT IDENTITY(1,1) NOT NULL,
    OrderId     INT            NOT NULL,
    ProductId   INT            NOT NULL,
    ProductName NVARCHAR(200)  NOT NULL,
    UnitPrice   DECIMAL(12,0)  NOT NULL,
    Qty         INT            NOT NULL,
    LineTotal   AS (UnitPrice * Qty) PERSISTED,   -- tự tính thành tiền dòng
    CONSTRAINT PK_OrderItems PRIMARY KEY (OrderItemId),
    CONSTRAINT FK_OrderItems_Orders   FOREIGN KEY (OrderId)
        REFERENCES dbo.Orders (OrderId) ON DELETE CASCADE,
    CONSTRAINT FK_OrderItems_Products FOREIGN KEY (ProductId)
        REFERENCES dbo.Products (ProductId),
    CONSTRAINT CK_OrderItems_Qty CHECK (Qty BETWEEN 1 AND 99),
    /* Một đơn không có 2 dòng cùng sản phẩm (usp_TaoDonHang đã gộp dòng trùng) —
       ép bằng UNIQUE ở mức CSDL để mọi đường ghi đều tuân thủ, không lệ thuộc app. */
    CONSTRAINT UQ_OrderItems_Order_Product UNIQUE (OrderId, ProductId)
);
GO

/* Index phục vụ các truy vấn chính của cửa hàng */
CREATE INDEX IX_Products_Category  ON dbo.Products (CategoryKey);
CREATE INDEX IX_Products_Sold      ON dbo.Products (Sold DESC);
CREATE INDEX IX_Orders_CreatedAt   ON dbo.Orders (CreatedAt DESC);
CREATE INDEX IX_Orders_Promo       ON dbo.Orders (PromoCode) WHERE PromoCode IS NOT NULL;
CREATE INDEX IX_OrderItems_Order   ON dbo.OrderItems (OrderId);
CREATE INDEX IX_OrderItems_Product ON dbo.OrderItems (ProductId);
GO

/* ================= 4. KIỂU BẢNG + THỦ TỤC TẠO ĐƠN HÀNG ================= */
/* Kiểu bảng truyền vào usp_TaoDonHang: danh sách món trong giỏ */
CREATE TYPE dbo.OrderItemType AS TABLE (
    ProductId INT NOT NULL,
    Qty       INT NOT NULL
);
GO

/* usp_TaoDonHang — đồng bộ logic POST /api/orders trong server.js:
   - Giá LẤY TỪ DB theo ProductId, không tin giá client gửi lên.
   - Gộp dòng trùng sản phẩm; mỗi món 1-99; tối đa 50 món/đơn.
   - Vận phí: standard 30.000đ, express 45.000đ; miễn phí khi tạm tính ≥ 500.000đ.
   - Mã giảm giá chỉ nhận khi còn IsActive; giảm = ROUND(tạm tính × tỉ lệ, 0).
   - Mã đơn "DI" + 8 chữ số, sinh ngẫu nhiên đến khi duy nhất.
   Trả về: OrderId, OrderCode và các tổng tiền đã tính. */
CREATE PROCEDURE dbo.usp_TaoDonHang
    @CustomerName    NVARCHAR(80),
    @CustomerPhone   NVARCHAR(10),
    @CustomerAddress NVARCHAR(300),
    @DeliveryMethod  NVARCHAR(10),
    @PaymentMethod   NVARCHAR(10),
    @PromoCode       NVARCHAR(20)  = NULL,
    @Note            NVARCHAR(500) = NULL,
    @Items           dbo.OrderItemType READONLY
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    /* ---- Kiểm tra dữ liệu đầu vào (đồng bộ validateOrder) ---- */
    IF LEN(LTRIM(RTRIM(@CustomerName))) < 2
        THROW 50001, N'Nhập họ tên người nhận.', 1;
    IF @CustomerPhone NOT LIKE '0[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
        THROW 50002, N'Số điện thoại cần 10 số và bắt đầu bằng 0.', 1;
    IF LEN(LTRIM(RTRIM(@CustomerAddress))) < 10
        THROW 50003, N'Nhập địa chỉ giao hàng đầy đủ hơn.', 1;
    IF @DeliveryMethod NOT IN (N'standard', N'express')
        THROW 50004, N'Chọn cách giao hàng hợp lệ.', 1;
    IF @PaymentMethod NOT IN (N'cod', N'transfer')
        THROW 50005, N'Chọn cách thanh toán hợp lệ.', 1;
    IF NOT EXISTS (SELECT 1 FROM @Items)
        THROW 50006, N'Giỏ hàng trống.', 1;
    IF EXISTS (SELECT 1 FROM @Items WHERE Qty < 1 OR Qty > 99)
        THROW 50007, N'Số lượng mỗi món phải từ 1 đến 99.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        /* Gộp các dòng trùng sản phẩm */
        DECLARE @Merged TABLE (ProductId INT NOT NULL PRIMARY KEY, Qty INT NOT NULL);
        INSERT INTO @Merged (ProductId, Qty)
        SELECT ProductId, SUM(Qty) FROM @Items GROUP BY ProductId;

        IF EXISTS (SELECT 1 FROM @Merged WHERE Qty > 99)
            THROW 50007, N'Số lượng mỗi món phải từ 1 đến 99.', 1;

        IF (SELECT COUNT(*) FROM @Merged) > 50
            THROW 50008, N'Tối đa 50 món mỗi đơn.', 1;

        /* Mọi sản phẩm phải tồn tại — giá luôn lấy từ DB */
        IF EXISTS (SELECT 1 FROM @Merged AS m
                   WHERE NOT EXISTS (SELECT 1 FROM dbo.Products AS p WHERE p.ProductId = m.ProductId))
            THROW 50009, N'Có sản phẩm không tồn tại trong cửa hàng.', 1;

        DECLARE @Subtotal DECIMAL(12,0) =
            (SELECT SUM(p.Price * m.Qty) FROM @Merged AS m
             INNER JOIN dbo.Products AS p ON p.ProductId = m.ProductId);

        DECLARE @ShippingFee DECIMAL(12,0) =
            CASE WHEN @DeliveryMethod = N'express' THEN 45000 ELSE 30000 END;
        IF @DeliveryMethod = N'standard' AND @Subtotal >= 500000
            SET @ShippingFee = 0;   -- chỉ giao tiêu chuẩn được miễn phí

        DECLARE @Discount DECIMAL(12,0) = 0;
        DECLARE @AppliedPromo NVARCHAR(20) = NULL;
        IF @PromoCode IS NOT NULL AND LTRIM(RTRIM(@PromoCode)) <> N''
        BEGIN
            DECLARE @Rate DECIMAL(4,3);
            SELECT @Rate = DiscountRate FROM dbo.PromoCodes
            WHERE Code = @PromoCode AND IsActive = 1;
            IF @Rate IS NOT NULL
            BEGIN
                SET @Discount = ROUND(@Subtotal * @Rate, 0);
                SET @AppliedPromo = @PromoCode;
            END
        END

        DECLARE @Total DECIMAL(12,0) = @Subtotal - @Discount + @ShippingFee;   -- chỉ để trả về caller (cột Total của bảng tự tính)

        /* Mã đơn DI + 8 chữ số, sinh đến khi duy nhất */
        DECLARE @Code NVARCHAR(20);
        WHILE 1 = 1
        BEGIN
            SET @Code = N'DI'
                + RIGHT('000000' + CAST(ABS(CHECKSUM(NEWID())) % 1000000 AS VARCHAR(6)), 6)
                + RIGHT('00' + CAST(ABS(CHECKSUM(NEWID())) % 100 AS VARCHAR(2)), 2);
            IF NOT EXISTS (SELECT 1 FROM dbo.Orders WHERE OrderCode = @Code) BREAK;
        END

        /* Không liệt kê Total trong INSERT — cột computed tự tính từ 3 cột nguồn. */
        INSERT INTO dbo.Orders (OrderCode, DeliveryMethod, PaymentMethod, PromoCode,
                                Subtotal, ShippingFee, Discount,
                                CustomerName, CustomerPhone, CustomerAddress, Note, CreatedAt)
        VALUES (@Code, @DeliveryMethod, @PaymentMethod, @AppliedPromo,
                @Subtotal, @ShippingFee, @Discount,
                @CustomerName, @CustomerPhone, @CustomerAddress, @Note, SYSUTCDATETIME());

        DECLARE @OrderId INT = SCOPE_IDENTITY();

        /* Lưu snapshot tên + giá vào dòng đơn hàng */
        INSERT INTO dbo.OrderItems (OrderId, ProductId, ProductName, UnitPrice, Qty)
        SELECT @OrderId, m.ProductId, p.Name, p.Price, m.Qty
        FROM @Merged AS m
        INNER JOIN dbo.Products AS p ON p.ProductId = m.ProductId;

        COMMIT TRANSACTION;

        SELECT o.OrderId, o.OrderCode, o.DeliveryMethod, o.PaymentMethod,
               o.PromoCode, o.Subtotal, o.ShippingFee, o.Discount, o.Total,
               o.CustomerName, o.CustomerPhone, o.CustomerAddress, o.Note, o.CreatedAt
        FROM dbo.Orders AS o WHERE o.OrderId = @OrderId;

        SELECT oi.ProductId, oi.ProductName, oi.UnitPrice, oi.Qty
        FROM dbo.OrderItems AS oi WHERE oi.OrderId = @OrderId
        ORDER BY oi.OrderItemId ASC;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;   -- ném lại lỗi gốc cho ứng dụng
    END CATCH
END;
GO

/* ========================= 5. VIEW ========================= */
CREATE VIEW dbo.vw_SanPham
AS
    /* Sản phẩm kèm tên danh mục + ảnh hiển thị:
       DisplayImageUrl = ảnh riêng (nếu có) → ảnh danh mục (fallback như FE) */
    SELECT  p.ProductId, p.Name, p.CategoryKey,
            c.Label AS CategoryLabel, c.ImageUrl AS CategoryImageUrl,
            p.Price, p.OldPrice, p.Rating, p.Sold, p.Badge,
            p.[Description], p.ImageUrl,
            COALESCE(p.ImageUrl, c.ImageUrl) AS DisplayImageUrl
    FROM dbo.Products AS p
    INNER JOIN dbo.Categories AS c ON c.CategoryKey = p.CategoryKey;
GO

CREATE VIEW dbo.vw_DonHangChiTiet
AS
    /* Mỗi dòng = một món trong đơn, kèm thông tin khách + các tổng tiền */
    SELECT  o.OrderId, o.OrderCode, o.CreatedAt, o.DeliveryMethod, o.PaymentMethod,
            o.PromoCode, o.Subtotal, o.ShippingFee, o.Discount, o.Total,
            o.CustomerName, o.CustomerPhone, o.CustomerAddress, o.Note,
            oi.OrderItemId, oi.ProductId, oi.ProductName, oi.UnitPrice, oi.Qty, oi.LineTotal
    FROM dbo.Orders AS o
    INNER JOIN dbo.OrderItems AS oi ON oi.OrderId = o.OrderId;
GO

/* ========================= 6. DỮ LIỆU MẪU ========================= */
/* Danh mục (6) */
INSERT dbo.Categories (CategoryKey, Label, ImageUrl) VALUES
    (N'ban-ghe', N'Bàn ghế & ghế nhựa', N'/images/catalog/ban-ghe.svg'),
    (N'noi-that', N'Nội thất phòng trọ', N'/images/catalog/noi-that.svg'),
    (N'noi-chao', N'Nồi, chảo quán ăn', N'/images/catalog/noi-chao.jpg'),
    (N'bat-dia', N'Bát đĩa & khay', N'/images/catalog/bat-dia.jpg'),
    (N'dung-cu', N'Dụng cụ bếp', N'/images/catalog/dung-cu.jpg'),
    (N'luu-tru', N'Kệ inox & lưu trữ', N'/images/catalog/luu-tru.jpg');
GO

/* Mã giảm giá: QUANGHUY10 đang hiệu lực, INOX10 là mã cũ (chỉ còn trong đơn lịch sử) */
INSERT dbo.PromoCodes (Code, DiscountRate, IsActive, [Description]) VALUES
    (N'QUANGHUY10', 0.100, 1, N'Giảm 10% toàn đơn — mã đang áp dụng (đồng bộ server.js)'),
    (N'INOX10', 0.100, 0, N'Mã cũ giảm 10% — đã ngừng áp dụng, chỉ còn trong đơn hàng lịch sử');
GO

/* Sản phẩm (21) — id giữ nguyên như products.json */
INSERT dbo.Products (ProductId, Name, CategoryKey, Price, OldPrice, Rating, Sold, Badge, [Description], ImageUrl) VALUES
    (1, N'Ghế nhựa bành lớn (còn như mới)', N'ban-ghe', 85000, 120000, 4.8, 214, N'hot', N'Ghế nhựa bành lớn về nhiều mỗi tuần, tình trạng còn như mới. Ngồi bành thoải mái, chịu tải tốt, hợp quán nhậu và tiệc ngoài trời.', NULL),
    (2, N'Ghế nhựa cao Duy Tân', N'ban-ghe', 95000, 130000, 4.7, 156, N'sale', N'Ghế nhựa cao hàng Duy Tân quen thuộc của các quán bia, quán nhậu. Chân đế chắc chắn, ngồi cao thoải mái cả buổi.', NULL),
    (3, N'Bàn nhựa vuông 60 cm', N'ban-ghe', 150000, NULL, 4.6, 88, N'new', N'Bàn nhựa vuông 60 cm gọn nhẹ, dễ kê và dễ vệ sinh. Kết hợp cùng ghế nhựa là có ngay một góc ngồi cho quán nhỏ.', NULL),
    (4, N'Bộ 4 ghế nhựa đen cho quán ăn', N'ban-ghe', 280000, 340000, 4.7, 132, N'sale', N'Bộ bốn ghế nhựa đen đồng bộ, kiểu dáng giản dị bền bỉ. Lựa chọn tiết kiệm khi mở quán cần nhiều ghế cùng lúc.', NULL),
    (5, N'Giường tầng ngang 1 m cho phòng trọ', N'noi-that', 1450000, 1800000, 4.8, 67, N'hot', N'Giường tầng ngang rộng 1 m, dành riêng cho phòng trọ. Khung sắt chắc chắn, đủ cho hai người nằm thoải mái.', NULL),
    (6, N'Tủ nhựa 4 ngăn cũ (còn mới)', N'noi-that', 380000, NULL, 4.6, 54, N'new', N'Tủ nhựa bốn ngăn còn rất mới, ray kéo êm. Chứa quần áo gọn gàng cho phòng trọ hoặc phòng trẻ em.', NULL),
    (7, N'Quạt đứng cũ (còn chạy êm)', N'noi-that', 120000, NULL, 4.5, 73, N'new', N'Quạt đứng cũ đã được thử chạy đủ mức gió, motor êm, trục không kêu. Tiết kiệm hơn hẳn mua quạt mới cho phòng trọ.', NULL),
    (8, N'Bàn học gỗ cũ, mặt gỗ còn đẹp', N'noi-that', 250000, NULL, 4.6, 41, N'new', N'Bàn học gỗ cũ mặt phẳng ít trầy, chân chắc. Vừa làm góc học tập vừa làm bàn làm việc tại nhà.', NULL),
    (9, N'Bộ nồi inox 5 món (còn như mới)', N'noi-chao', 890000, 1150000, 4.9, 178, N'hot', N'Bộ nồi inox năm món còn như mới, đáy dày bắt nhiệt nhanh. Bộ nấu gia đình hoặc nấu nền quán nhỏ đều ổn.', NULL),
    (10, N'Chảo sâu lòng 28 cm cho quán', N'noi-chao', 220000, 280000, 4.7, 143, N'sale', N'Chảo sâu lòng 28 cm xào gà được, chiên thoải mái. Tay cầm chắc, thành cao không văng dầu khi nấu mạnh.', NULL),
    (11, N'Nồi niêu soup cỡ lớn cho quán', N'noi-chao', 450000, NULL, 4.8, 96, N'new', N'Nồi soup dung tích lớn dùng cho quán ăn, quán nhậu nấu nền. Nồi dày giữ nhiệt tốt, múc canh cả buổi vẫn nóng.', NULL),
    (12, N'Ấm đun nước inox 2,5 lít', N'noi-chao', 185000, NULL, 4.7, 122, N'new', N'Ấm inox đun nước nhanh, có còi báo sôi. Dùng cho quầy pha chế hoặc bếp gia đình đều tiện.', NULL),
    (13, N'Bộ 3 bát inox nguyên khối', N'bat-dia', 120000, NULL, 4.7, 205, N'new', N'Ba bát inox ba kích thước, không đường hàn, không bám mùi. Bếp gia đình hay sơ chế quán đều dùng được.', NULL),
    (14, N'Bộ đĩa inox 6 chiếc', N'bat-dia', 150000, 190000, 4.8, 167, N'sale', N'Sáu đĩa inox vành thấp, hợp bữa ăn hằng ngày và tiếp khách. Không lo vỡ như đĩa sứ, dùng bền cả chục năm.', NULL),
    (15, N'Khay phục vụ inox lớn', N'bat-dia', 135000, NULL, 4.8, 119, N'hot', N'Khay inox to bề rộng, bê đồ nhiều trong một chuyền. Quán nhậu dọn bàn nhanh gấp rưỡi so với khay nhỏ.', NULL),
    (16, N'Bộ dao bếp 5 món', N'dung-cu', 290000, 350000, 4.8, 154, N'sale', N'Năm chiếc dao chuyên dụng cho từng thao tác: thái, chặt, fillet. Lưỡi sắc, cán cân tay, sơ chế nhanh gọn.', NULL),
    (17, N'Thớt gỗ dày hai mặt', N'dung-cu', 95000, NULL, 4.6, 87, N'new', N'Thớt gỗ dày hai mặt dùng xoay vòng: một mặt đập xương, một mặt thái món chín. Dày dặn, không cong vênh.', NULL),
    (18, N'Bộ muỗng nĩa inox 6 món', N'dung-cu', 80000, NULL, 4.7, 231, N'new', N'Sáu chiếc muỗng nĩa inox dày tay, dùng cho gia đình hoặc dự phòng quán. Rẻ mà chắc, mất cũng không tiếc.', NULL),
    (19, N'Kệ inox 4 tầng cho quán & nhà bếp', N'luu-tru', 850000, 990000, 4.9, 138, N'hot', N'Kệ inox bốn tầng chắc chắn, kê dao thớt hay để nguyên liệu đều được. Hàng gửi khách tỉnh về liên tục.', N'/images/products/ke-inox-4-tang.jpg'),
    (20, N'Bộ hộp inox bảo quản, 3 hộp', N'luu-tru', 150000, NULL, 4.7, 176, N'new', N'Ba hộp inox nắp kín ba cỡ, xếp chồng gọn tủ lạnh. Bảo quản thức ăn sơ chế cả ngày vẫn tươi.', NULL),
    (21, N'Rổ inox thoát nước nhanh', N'luu-tru', 100000, NULL, 4.7, 198, N'new', N'Rổ inox đục lỗ đều, rửa rau xong nước thoát liền. Có chân đế kê cao, khỏi ướt mặt bếp.', NULL);
GO

/* Thông số sản phẩm (specs) — 4 gạch đầu dòng mỗi sản phẩm */
/* SP #1 — Ghế nhựa bành lớn (còn như mới) */
INSERT dbo.ProductSpecs (ProductId, SortOrder, SpecText) VALUES
    (1, 1, N'Tình trạng còn như mới, đã vệ sinh sạch sẽ'),
    (1, 2, N'Nhựa dày, chịu tải tốt, không nứt gãy'),
    (1, 3, N'Phù hợp quán ăn, quán nhậu, tiệc ngoài trời'),
    (1, 4, N'Số lượng nhiều — inbox để được báo giá sỉ rẻ nhất');

/* SP #2 — Ghế nhựa cao Duy Tân */
INSERT dbo.ProductSpecs (ProductId, SortOrder, SpecText) VALUES
    (2, 1, N'Hãng Duy Tân — nhựa dẻo dai, bền màu'),
    (2, 2, N'Chân đế ổn định, chống trượt khi quét'),
    (2, 3, N'Dễ xếp chồng khi cần dọn quầy'),
    (2, 4, N'Hàng cũ còn đẹp, giá thanh lý cố định');

/* SP #3 — Bàn nhựa vuông 60 cm */
INSERT dbo.ProductSpecs (ProductId, SortOrder, SpecText) VALUES
    (3, 1, N'Mặt bàn phẳng, lau chùi nhanh'),
    (3, 2, N'Chân bàn tháo lắp gọn khi di chuyển'),
    (3, 3, N'Phù hợp phòng trọ, quán cà phê nhỏ'),
    (3, 4, N'Đã kiểm tra chắc chắn trước khi bán');

/* SP #4 — Bộ 4 ghế nhựa đen cho quán ăn */
INSERT dbo.ProductSpecs (ProductId, SortOrder, SpecText) VALUES
    (4, 1, N'Bốn ghế đồng bộ màu đen, kiểu dáng thống nhất'),
    (4, 2, N'Nhựa nguyên sinh dày dặn, chịu sử dụng mạnh'),
    (4, 3, N'Giá bộ đã rẻ hơn mua lẻ từng chiếc'),
    (4, 4, N'Nhận đơn số lượng lớn cho quán mới mở');

/* SP #5 — Giường tầng ngang 1 m cho phòng trọ */
INSERT dbo.ProductSpecs (ProductId, SortOrder, SpecText) VALUES
    (5, 1, N'Khung sắt chắc chắn, đã siết lại toàn bộ ốc'),
    (5, 2, N'Rộng 1 m — chuẩn cho phòng trọ, khu công nhân'),
    (5, 3, N'Thanh ngang chịu lực tốt, không ọp ẹp'),
    (5, 4, N'Hỗ trợ giao lắp tại Gò Vấp và khu vực lân cận');

/* SP #6 — Tủ nhựa 4 ngăn cũ (còn mới) */
INSERT dbo.ProductSpecs (ProductId, SortOrder, SpecText) VALUES
    (6, 1, N'Bốn ngăn rộng, ray kéo êm không kêu'),
    (6, 2, N'Nhựa dày, không ố vàng nặng'),
    (6, 3, N'Dễ lau chùi, không mối mọt như tủ gỗ'),
    (6, 4, N'Đã vệ sinh khử mùi trước khi bán');

/* SP #7 — Quạt đứng cũ (còn chạy êm) */
INSERT dbo.ProductSpecs (ProductId, SortOrder, SpecText) VALUES
    (7, 1, N'Đã thử đủ 3 mức gió tại cửa hàng'),
    (7, 2, N'Motor êm, cột quạt chắc không rung lắc'),
    (7, 3, N'Đầu quạt quay nhẹ, cánh sạch mới'),
    (7, 4, N'Bảo hành chạy thử 7 ngày tại chỗ');

/* SP #8 — Bàn học gỗ cũ, mặt gỗ còn đẹp */
INSERT dbo.ProductSpecs (ProductId, SortOrder, SpecText) VALUES
    (8, 1, N'Mặt gỗ phẳng, ít trầy xước'),
    (8, 2, N'Chân bàn chắc chắn, không lung lay'),
    (8, 3, N'Kích thước vừa phòng trọ, kê sát tường gọn'),
    (8, 4, N'Có thể xem trực tiếp tại 707 Tân Sơn');

/* SP #9 — Bộ nồi inox 5 món (còn như mới) */
INSERT dbo.ProductSpecs (ProductId, SortOrder, SpecText) VALUES
    (9, 1, N'Inox dày, đáy bắt nhiệt nhanh không khê'),
    (9, 2, N'Còn như mới — đã làm sạch sáng bóng'),
    (9, 3, N'Dùng tốt trên bếp từ và bếp gas'),
    (9, 4, N'Giá thanh lý thấp hơn mua mới gần một nửa');

/* SP #10 — Chảo sâu lòng 28 cm cho quán */
INSERT dbo.ProductSpecs (ProductId, SortOrder, SpecText) VALUES
    (10, 1, N'Sâu lòng — xào, chiên, kho đều tiện'),
    (10, 2, N'Thành cao hạn chế văng dầu'),
    (10, 3, N'Tay cầm chắc, bắt ốc chắn chắn'),
    (10, 4, N'Đã kiểm tra trên bếp gas tại cửa hàng');

/* SP #11 — Nồi niêu soup cỡ lớn cho quán */
INSERT dbo.ProductSpecs (ProductId, SortOrder, SpecText) VALUES
    (11, 1, N'Dung tích lớn — nấu nền cho 50–80 phần'),
    (11, 2, N'Thành nồi dày, giữ nhiệt lâu'),
    (11, 3, N'Quai chắc, bê di chuyển an toàn'),
    (11, 4, N'Nắp đậy kín, hạn chế bay hơi');

/* SP #12 — Ấm đun nước inox 2,5 lít */
INSERT dbo.ProductSpecs (ProductId, SortOrder, SpecText) VALUES
    (12, 1, N'Đun nhanh, còi báo nước sôi rõ'),
    (12, 2, N'Quai cầm cách nhiệt, không bỏng tay'),
    (12, 3, N'Inox sáng, đã làm sạch trước khi bán'),
    (12, 4, N'Dùng tốt trên bếp gas và bếp từ');

/* SP #13 — Bộ 3 bát inox nguyên khối */
INSERT dbo.ProductSpecs (ProductId, SortOrder, SpecText) VALUES
    (13, 1, N'Ba kích thước tiện dùng mỗi ngày'),
    (13, 2, N'Không đường hàn — dễ rửa, không bám dầu'),
    (13, 3, N'Còn sáng đẹp, không móp méo'),
    (13, 4, N'Giá bộ đã rẻ hơn mua lẻ');

/* SP #14 — Bộ đĩa inox 6 chiếc */
INSERT dbo.ProductSpecs (ProductId, SortOrder, SpecText) VALUES
    (14, 1, N'Sáu chiếc đồng bộ, vành thấp thanh lịch'),
    (14, 2, N'Inox dày, không móp, không gỉ'),
    (14, 3, N'An toàn hơn đĩa sứ khi có con nhỏ'),
    (14, 4, N'Rửa máy và lau khô đều được');

/* SP #15 — Khay phục vụ inox lớn */
INSERT dbo.ProductSpecs (ProductId, SortOrder, SpecText) VALUES
    (15, 1, N'Mặt khay rộng, đỡ đi lại nhiều lần'),
    (15, 2, N'Viền chống tràn, khay mâm giữ nước'),
    (15, 3, N'Inox dày không biến dạng khi ép chồng'),
    (15, 4, N'Đã vệ sinh sáng bóng trước khi bán');

/* SP #16 — Bộ dao bếp 5 món */
INSERT dbo.ProductSpecs (ProductId, SortOrder, SpecText) VALUES
    (16, 1, N'Đủ thao tác thái, chặt, cắt, fillet'),
    (16, 2, N'Lưỡi đã mài sắc, cán nắm chắc'),
    (16, 3, N'Cất gọn trong khay/bloc kèm theo'),
    (16, 4, N'Kiểm tra độ sắc và độ chắc tay từng chiếc');

/* SP #17 — Thớt gỗ dày hai mặt */
INSERT dbo.ProductSpecs (ProductId, SortOrder, SpecText) VALUES
    (17, 1, N'Hai mặt dùng riêng sống và chín'),
    (17, 2, N'Gỗ dày, bề mặt phẳng không cong'),
    (17, 3, N'Đã cọ sạch và phơi khô trước khi bán'),
    (17, 4, N'Quét dầu ăn mỏng để giữ bền mặt gỗ');

/* SP #18 — Bộ muỗng nĩa inox 6 món */
INSERT dbo.ProductSpecs (ProductId, SortOrder, SpecText) VALUES
    (18, 1, N'Inox dày, không cong vênh khi múc đồ cứng'),
    (18, 2, N'Sáu chiếc đồng bộ, dễ thay thế từng cái'),
    (18, 3, N'Rửa máy an toàn'),
    (18, 4, N'Giá thanh lý — phù hợp mua dự phòng');

/* SP #19 — Kệ inox 4 tầng cho quán & nhà bếp */
INSERT dbo.ProductSpecs (ProductId, SortOrder, SpecText) VALUES
    (19, 1, N'Bốn tầng chịu lực, ốc vít đủ bộ'),
    (19, 2, N'Chân đế ổn định trên nền gạch trơn'),
    (19, 3, N'Tháo lắp dễ dàng khi chuyển kho'),
    (19, 4, N'Gửi qua nhà xe toàn quốc được');

/* SP #20 — Bộ hộp inox bảo quản, 3 hộp */
INSERT dbo.ProductSpecs (ProductId, SortOrder, SpecText) VALUES
    (20, 1, N'Ba kích thước xếp chồng tiết kiệm chỗ'),
    (20, 2, N'Nắp kín — hạn chế mùi lẫn trong tủ lạnh'),
    (20, 3, N'Inox không bám mùi như hộp nhựa'),
    (20, 4, N'Dùng được cho cả sơ chế lẫn trưng bày');

/* SP #21 — Rổ inox thoát nước nhanh */
INSERT dbo.ProductSpecs (ProductId, SortOrder, SpecText) VALUES
    (21, 1, N'Lỗ đục đều — thoát nước cực nhanh'),
    (21, 2, N'Chân đế ổn định, kê cao thoáng'),
    (21, 3, N'Còn sáng đẹp, không gỉ điểm'),
    (21, 4, N'Vệ sinh ngay dưới vòi nước tiện lợi');

GO

/* Gallery ảnh — chỉ sản phẩm có ảnh thật mới có dòng (hiện tại: SP #19).
   SortOrder 1 = ảnh chính (không cần cờ IsPrimary — xem chú thích ở bảng). */
INSERT dbo.ProductImages (ProductId, SortOrder, Url) VALUES
    (19, 1, N'/images/products/ke-inox-4-tang.jpg');
GO

/* ================== 7. ĐƠN HÀNG MẪU (từ orders.json) ==================
   OrderItems lưu SNAPSHOT tên + giá tại thời điểm đặt — có thể khác tên/giá
   hiện tại của sản phẩm (đúng theo dữ liệu gốc của dự án). */
/* Đơn #1 — DI970382 (2 món + mã INOX10, miễn phí ship) */
SET IDENTITY_INSERT dbo.Orders ON;
INSERT dbo.Orders (OrderId, OrderCode, DeliveryMethod, PaymentMethod, PromoCode, Subtotal, ShippingFee, Discount, CustomerName, CustomerPhone, CustomerAddress, Note, CreatedAt)
VALUES (1, N'DI970382', N'standard', N'cod', N'INOX10', 3530000, 0, 353000,
       N'Nguyen Van A', N'0901234567', N'123 Nguyen Hue, Q1, TP.HCM', NULL, CONVERT(DATETIME2(3), '2026-09-21T12:16:10.383', 126));
SET IDENTITY_INSERT dbo.Orders OFF;
INSERT dbo.OrderItems (OrderId, ProductId, ProductName, UnitPrice, Qty) VALUES
    (1, 1, N'Bộ nồi inox 304, 5 món', 2890000, 1),
    (1, 3, N'Bộ 3 bát inox nguyên khối', 320000, 2);

/* Đơn #2 — DI08592855 (1 món, không mã, miễn phí ship) */
SET IDENTITY_INSERT dbo.Orders ON;
INSERT dbo.Orders (OrderId, OrderCode, DeliveryMethod, PaymentMethod, PromoCode, Subtotal, ShippingFee, Discount, CustomerName, CustomerPhone, CustomerAddress, Note, CreatedAt)
VALUES (2, N'DI08592855', N'standard', N'cod', NULL, 8670000, 0, 0,
       N'Nguyễn Test', N'0901234567', N'12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh', NULL, CONVERT(DATETIME2(3), '2026-09-21T12:51:25.928', 126));
SET IDENTITY_INSERT dbo.Orders OFF;
INSERT dbo.OrderItems (OrderId, ProductId, ProductName, UnitPrice, Qty) VALUES
    (2, 1, N'Bộ nồi inox 304, 5 món', 2890000, 3);

/* Đơn #3 — DI08592242 (2 món + mã INOX10, miễn phí ship) */
SET IDENTITY_INSERT dbo.Orders ON;
INSERT dbo.Orders (OrderId, OrderCode, DeliveryMethod, PaymentMethod, PromoCode, Subtotal, ShippingFee, Discount, CustomerName, CustomerPhone, CustomerAddress, Note, CreatedAt)
VALUES (3, N'DI08592242', N'standard', N'cod', N'INOX10', 6470000, 0, 647000,
       N'Nguyễn Test', N'0901234567', N'12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh', NULL, CONVERT(DATETIME2(3), '2026-09-21T12:51:25.922', 126));
SET IDENTITY_INSERT dbo.Orders OFF;
INSERT dbo.OrderItems (OrderId, ProductId, ProductName, UnitPrice, Qty) VALUES
    (3, 1, N'Bộ nồi inox 304, 5 món', 2890000, 2),
    (3, 2, N'Chảo inox chống dính 28 cm', 690000, 1);

/* Đơn #4 — DI10424677 (2 món + mã QUANGHUY10, vận phí 30.000đ) */
SET IDENTITY_INSERT dbo.Orders ON;
INSERT dbo.Orders (OrderId, OrderCode, DeliveryMethod, PaymentMethod, PromoCode, Subtotal, ShippingFee, Discount, CustomerName, CustomerPhone, CustomerAddress, Note, CreatedAt)
VALUES (4, N'DI10424677', N'standard', N'cod', N'QUANGHUY10', 265000, 30000, 26500,
       N'Nguyễn Test', N'0901234567', N'12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh', NULL, CONVERT(DATETIME2(3), '2026-09-21T18:25:04.246', 126));
SET IDENTITY_INSERT dbo.Orders OFF;
INSERT dbo.OrderItems (OrderId, ProductId, ProductName, UnitPrice, Qty) VALUES
    (4, 1, N'Ghế nhựa bành lớn (còn như mới)', 85000, 2),
    (4, 2, N'Ghế nhựa cao Duy Tân', 95000, 1);

/* Đơn #5 — DI90672646 (5 món, không mã, miễn phí ship) */
SET IDENTITY_INSERT dbo.Orders ON;
INSERT dbo.Orders (OrderId, OrderCode, DeliveryMethod, PaymentMethod, PromoCode, Subtotal, ShippingFee, Discount, CustomerName, CustomerPhone, CustomerAddress, Note, CreatedAt)
VALUES (5, N'DI90672646', N'standard', N'cod', NULL, 3940000, 0, 0,
       N'Nguyen Van A', N'0901234567', N'25 Ly Thuong Kiet, Quan 1, TP.HCM', NULL, CONVERT(DATETIME2(3), '2026-09-21T18:21:46.726', 126));
SET IDENTITY_INSERT dbo.Orders OFF;
INSERT dbo.OrderItems (OrderId, ProductId, ProductName, UnitPrice, Qty) VALUES
    (5, 9, N'Bộ nồi inox 5 món (còn như mới)', 890000, 3),
    (5, 15, N'Khay phục vụ inox lớn', 135000, 2),
    (5, 18, N'Bộ muỗng nĩa inox 6 món', 80000, 3),
    (5, 21, N'Rổ inox thoát nước nhanh', 100000, 2),
    (5, 4, N'Bộ 4 ghế nhựa đen cho quán ăn', 280000, 2);

GO

/* ==================== 8. KIỂM TRA SAU KHI NẠP ==================== */
SELECT N'Danh mục'       AS [Bảng], COUNT(*) AS [Số dòng] FROM dbo.Categories
UNION ALL SELECT N'Sản phẩm',        COUNT(*) FROM dbo.Products
UNION ALL SELECT N'Ảnh sản phẩm',    COUNT(*) FROM dbo.ProductImages
UNION ALL SELECT N'Thông số SP',     COUNT(*) FROM dbo.ProductSpecs
UNION ALL SELECT N'Mã giảm giá',     COUNT(*) FROM dbo.PromoCodes
UNION ALL SELECT N'Đơn hàng',        COUNT(*) FROM dbo.Orders
UNION ALL SELECT N'Dòng đơn hàng',   COUNT(*) FROM dbo.OrderItems;

SELECT TOP (5) ProductId, Name, Price, Sold, Badge FROM dbo.vw_SanPham ORDER BY Sold DESC;

/* Ví dụ tạo đơn hàng qua thủ tục (bỏ chú thích để chạy thử):
DECLARE @i dbo.OrderItemType;
INSERT INTO @i (ProductId, Qty) VALUES (1, 2), (3, 1);
EXEC dbo.usp_TaoDonHang
    @CustomerName    = N'Nguyễn Văn A',
    @CustomerPhone   = N'0901234567',
    @CustomerAddress = N'12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
    @DeliveryMethod  = N'standard',
    @PaymentMethod   = N'cod',
    @PromoCode       = N'QUANGHUY10',
    @Items           = @i;
*/
GO
