'use strict';

/* ============================================================================
 * generate-seed.cjs — Sinh file SQL Server (schema + dữ liệu mẫu) cho dự án
 * "Đồ Cũ Quang Huy" từ dữ liệu JSON hiện có của backend:
 *
 *   Nguồn : ../data/products.json  → 6 danh mục + 21 sản phẩm (đủ specs/ảnh)
 *           ../data/orders.json    → chọn vài đơn hàng mẫu (dữ liệu runtime)
 *   Đích  : do-cu-quang-huy.sql    → nạp bằng SSMS / sqlcmd / Azure Data Studio
 *
 *   Chạy  : node generate-seed.cjs
 *   Lưu ý : file SQL sinh ra, khi được chạy lại, sẽ XOÁ & tạo lại CSDL
 *           DoCuQuangHuy từ đầu (mọi sửa đổi tay trên CSDL sẽ mất).
 * ============================================================================ */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT_FILE = path.join(__dirname, 'do-cu-quang-huy.sql');

const DB_NAME = 'DoCuQuangHuy';

/* Hằng số nghiệp vụ — giữ đồng bộ với server.js */
const FREE_SHIP_THRESHOLD = 500000; // ≥ 500.000đ → miễn phí vận chuyển
const SHIPPING_FEES = { standard: 30000, express: 45000 };
const PROMO_ACTIVE = { QUANGHUY10: 0.1 }; // mã giảm giá đang hiệu lực
const PROMO_RETIRED = { INOX10: 0.1 }; // mã cũ, chỉ còn trong đơn hàng lịch sử
const MAX_ITEMS_PER_ORDER = 50;
const MAX_QTY_PER_ITEM = 99;

/* Đơn hàng mẫu đưa vào seed — đủ nhiều dạng: 1/nhiều món, có/không mã giảm,
 * miễn phí/có vận phí. Đơn thật của khách là dữ liệu runtime, không nạp hết. */
const SAMPLE_ORDER_CODES = [
  'DI970382', // 2 món + mã INOX10 (cũ) + miễn phí ship
  'DI08592855', // 1 món, không mã + miễn phí ship
  'DI08592242', // 2 món + mã INOX10 (cũ) + miễn phí ship
  'DI10424677', // 2 món + mã QUANGHUY10 + có vận phí 30.000đ
  'DI90672646', // 5 món, không mã + miễn phí ship
];

/* ------------------------------ Đọc dữ liệu nguồn ------------------------------ */
const catalog = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'products.json'), 'utf8'));
const allOrders = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'orders.json'), 'utf8'));

const categories = Array.isArray(catalog.categories) ? catalog.categories : [];
const products = Array.isArray(catalog.products) ? catalog.products : [];
if (!categories.length || !products.length) throw new Error('products.json rỗng hoặc sai cấu trúc.');

const orderByCode = new Map(allOrders.map((o) => [o.code, o]));
const sampleOrders = SAMPLE_ORDER_CODES.map((code) => {
  const order = orderByCode.get(code);
  if (!order) throw new Error(`Không tìm thấy đơn mẫu ${code} trong orders.json`);
  return order;
});

/* ------------------------------ Kiểm tra dữ liệu nguồn ------------------------------ */
const categoryKeys = new Set(categories.map((c) => c.key));
for (const p of products) {
  if (!categoryKeys.has(p.category)) throw new Error(`SP #${p.id}: danh mục "${p.category}" không tồn tại.`);
  if (!Array.isArray(p.specs) || p.specs.length === 0) throw new Error(`SP #${p.id}: thiếu specs.`);
}
const productIds = new Set(products.map((p) => p.id));
for (const order of sampleOrders) {
  const calcSubtotal = order.items.reduce((sum, it) => sum + it.price * it.qty, 0);
  if (calcSubtotal !== order.subtotal) throw new Error(`Đơn ${order.code}: subtotal không khớp dòng hàng.`);
  if (order.total !== order.subtotal - order.discount + order.shippingFee) throw new Error(`Đơn ${order.code}: total không khớp.`);
  for (const it of order.items) {
    if (!productIds.has(it.id)) throw new Error(`Đơn ${order.code}: SP #${it.id} không có trong products.json.`);
  }
}

/* ------------------------------ Tiện ích escape ------------------------------ */
const esc = (v) => `N'${String(v).replace(/'/g, "''")}'`; // chuỗi Unicode an toàn cho T-SQL
const str = (v) => (v == null || v === '' ? 'NULL' : esc(v)); // chuỗi rỗng → NULL
const num = (v) => (v == null ? 'NULL' : String(Number(v))); // số, null → NULL
const isoToSql = (iso) => `CONVERT(DATETIME2(3), '${String(iso).replace(/Z$/, '')}', 126)`;
const galleryOf = (p) => (Array.isArray(p.images) && p.images.length ? p.images : p.image ? [p.image] : []);

/* ------------------------------ Bộ đệm xuất file ------------------------------ */
const out = [];
const w = (line = '') => out.push(line);
const go = () => out.push('GO');
const blank = () => out.push('');

/* ============================ 1. Tiêu đề + khởi tạo CSDL ============================ */
blank();
w('/* =====================================================================');
w('   ĐỒ CŨ QUANG HUY — CSDL SQL Server: cấu trúc + dữ liệu mẫu');
w('   Sinh tự động từ dữ liệu JSON trong thư mục server/data bằng generate-seed.cjs');
w(`   CSDL: ${DB_NAME}  |  Sinh lúc: ${new Date().toISOString()}`);
w('');
w('   NỘI DUNG:');
w('     1. Tạo CSDL nếu chưa có (collation tiếng Việt)');
w('     2. 7 bảng: Categories, Products, ProductImages, ProductSpecs,');
w('        PromoCodes, Orders, OrderItems — khóa ngoại, CHECK, index');
w('     3. Kiểu bảng dbo.OrderItemType + thủ tục usp_TaoDonHang (tạo đơn');
w('        an toàn: giá lấy từ DB, miễn phí ship từ 500.000đ, mã giảm giá)');
w('     4. 2 VIEW: vw_SanPham, vw_DonHangChiTiet');
w(`     5. Dữ liệu mẫu: ${categories.length} danh mục, ${products.length} sản phẩm`);
w(`        (đủ thông số + ảnh), 2 mã giảm giá, ${sampleOrders.length} đơn hàng mẫu`);
w('');
w('   CÁCH NẠP (chọn 1):');
w('     - SSMS: File > Open > File... → chọn file này → Execute (F5)');
w('     - sqlcmd: sqlcmd -S .\\SQLEXPRESS -E -i do-cu-quang-huy.sql');
w('     - Azure Data Studio: Open File → Run');
w('');
w('   LƯU Ý: chạy lại file này sẽ XOÁ toàn bộ bảng & dữ liệu hiện có trong');
w(`   CSDL ${DB_NAME} rồi tạo lại từ đầu.`);
w('   ===================================================================== */');
blank();
w('USE master;');
go();
w(`IF DB_ID(N'${DB_NAME}') IS NULL`);
w(`    CREATE DATABASE [${DB_NAME}] COLLATE Vietnamese_100_CI_AI;`);
w('/* Collation tiếng Việt: sắp xếp & so sánh chuỗi có dấu đúng chuẩn VN */');
go();
w(`USE [${DB_NAME}];`);
w('/* SET options chuẩn khi tạo bảng có cột computed / làm việc với dữ liệu */');
w('SET ANSI_NULLS ON; SET ANSI_PADDING ON; SET ANSI_WARNINGS ON;');
w('SET ARITHABORT ON; SET CONCAT_NULL_YIELDS_NULL ON;');
w('SET QUOTED_IDENTIFIER ON; SET NUMERIC_ROUNDABORT OFF;');
go();

/* ============================ 2. Dọn đối tượng cũ ============================ */
blank();
w('/* ============ 2. DỌN ĐỐI TƯỢNG CŨ (để file chạy lại được) ============');
w('   CẢNH BÁO: xoá cả dữ liệu hiện có của các đối tượng dưới đây. */');
w("IF OBJECT_ID(N'dbo.vw_DonHangChiTiet', N'V')  IS NOT NULL DROP VIEW  dbo.vw_DonHangChiTiet;");
w("IF OBJECT_ID(N'dbo.vw_SanPham',        N'V')  IS NOT NULL DROP VIEW  dbo.vw_SanPham;");
w("IF OBJECT_ID(N'dbo.usp_TaoDonHang',    N'P')  IS NOT NULL DROP PROC  dbo.usp_TaoDonHang;");
w("IF TYPE_ID(N'dbo.OrderItemType') IS NOT NULL DROP TYPE dbo.OrderItemType;");
w("IF OBJECT_ID(N'dbo.OrderItems',        N'U')  IS NOT NULL DROP TABLE dbo.OrderItems;");
w("IF OBJECT_ID(N'dbo.Orders',            N'U')  IS NOT NULL DROP TABLE dbo.Orders;");
w("IF OBJECT_ID(N'dbo.ProductSpecs',      N'U')  IS NOT NULL DROP TABLE dbo.ProductSpecs;");
w("IF OBJECT_ID(N'dbo.ProductImages',     N'U')  IS NOT NULL DROP TABLE dbo.ProductImages;");
w("IF OBJECT_ID(N'dbo.PromoCodes',        N'U')  IS NOT NULL DROP TABLE dbo.PromoCodes;");
w("IF OBJECT_ID(N'dbo.Products',          N'U')  IS NOT NULL DROP TABLE dbo.Products;");
w("IF OBJECT_ID(N'dbo.Categories',        N'U')  IS NOT NULL DROP TABLE dbo.Categories;");
go();

/* ============================ 3. Cấu trúc bảng ============================ */
blank();
w('/* ========================= 3. CẤU TRÚC BẢNG ========================= */');
w('/* Danh mục — khóa là "key" không dấu (ban-ghe, noi-that...) như products.json */');
w(`CREATE TABLE dbo.Categories (
    CategoryKey NVARCHAR(50)  NOT NULL,
    Label       NVARCHAR(100) NOT NULL,
    ImageUrl    NVARCHAR(200) NULL,   -- đường dẫn tương đối /images/...
    CONSTRAINT PK_Categories PRIMARY KEY (CategoryKey)
);`);
go();
blank();
w('/* Sản phẩm — bỏ categoryLabel (lấy qua JOIN, xem vw_SanPham) */');
w(`CREATE TABLE dbo.Products (
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
    CONSTRAINT CK_Products_OldPrice CHECK (OldPrice IS NULL OR OldPrice >= 0),
    CONSTRAINT CK_Products_Rating   CHECK (Rating BETWEEN 0 AND 5),
    CONSTRAINT CK_Products_Sold     CHECK (Sold >= 0),
    CONSTRAINT CK_Products_Badge    CHECK (Badge IN (N'hot', N'sale', N'new'))
);`);
go();
blank();
w('/* Gallery ảnh (từ mảng images) — SP không có ảnh thật thì không có dòng,');
w('   FE tự fallback về ảnh danh mục (client/src/data/productImages.js) */');
w(`CREATE TABLE dbo.ProductImages (
    ProductId INT           NOT NULL,
    SortOrder INT           NOT NULL,   -- 1 = ảnh chính
    Url       NVARCHAR(200) NOT NULL,   -- /images/products/... (không lưu URL domain)
    IsPrimary BIT NOT NULL DEFAULT 0,
    CONSTRAINT PK_ProductImages PRIMARY KEY (ProductId, SortOrder),
    CONSTRAINT FK_ProductImages_Products FOREIGN KEY (ProductId)
        REFERENCES dbo.Products (ProductId) ON DELETE CASCADE
);`);
go();
blank();
w('/* Thông số sản phẩm (từ mảng specs) — gạch đầu dòng ở trang chi tiết */');
w(`CREATE TABLE dbo.ProductSpecs (
    ProductId INT           NOT NULL,
    SortOrder INT           NOT NULL,
    SpecText  NVARCHAR(300) NOT NULL,
    CONSTRAINT PK_ProductSpecs PRIMARY KEY (ProductId, SortOrder),
    CONSTRAINT FK_ProductSpecs_Products FOREIGN KEY (ProductId)
        REFERENCES dbo.Products (ProductId) ON DELETE CASCADE
);`);
go();
blank();
w('/* Mã giảm giá — đồng bộ PROMO_CODES trong server.js */');
w(`CREATE TABLE dbo.PromoCodes (
    Code          NVARCHAR(20)  NOT NULL,
    DiscountRate  DECIMAL(4,3)  NOT NULL,   -- 0.100 = giảm 10%
    IsActive      BIT NOT NULL DEFAULT 1,
    [Description] NVARCHAR(200) NULL,
    CONSTRAINT PK_PromoCodes PRIMARY KEY (Code),
    CONSTRAINT CK_PromoCodes_Rate CHECK (DiscountRate > 0 AND DiscountRate <= 1)
);`);
go();

blank();
w('/* Đơn hàng — khách vãng lai nên customer lưu phẳng vào bảng */');
w(`CREATE TABLE dbo.Orders (
    OrderId         INT IDENTITY(1,1) NOT NULL,
    OrderCode       NVARCHAR(20)  NOT NULL,   -- "DI" + 8 chữ số, duy nhất
    DeliveryMethod  NVARCHAR(10)  NOT NULL,   -- standard / express
    PaymentMethod   NVARCHAR(10)  NOT NULL,   -- cod / transfer
    PromoCode       NVARCHAR(20)  NULL,       -- không FK: giữ nguyên mã lịch sử
    Subtotal        DECIMAL(12,0) NOT NULL,
    ShippingFee     DECIMAL(12,0) NOT NULL,
    Discount        DECIMAL(12,0) NOT NULL,
    Total           DECIMAL(12,0) NOT NULL,   -- = Subtotal - Discount + ShippingFee
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
);`);
go();
blank();
w('/* Dòng hàng trong đơn — ProductName + UnitPrice là SNAPSHOT tại thời điểm đặt,');
w('   có thể khác tên/giá hiện tại của sản phẩm (giữ lịch sử chính xác) */');
w(`CREATE TABLE dbo.OrderItems (
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
    CONSTRAINT CK_OrderItems_Qty CHECK (Qty BETWEEN 1 AND 99)
);`);
go();
blank();
w('/* Index phục vụ các truy vấn chính của cửa hàng */');
w('CREATE INDEX IX_Products_Category  ON dbo.Products (CategoryKey);');
w('CREATE INDEX IX_Products_Sold      ON dbo.Products (Sold DESC);');
w('CREATE INDEX IX_Orders_CreatedAt   ON dbo.Orders (CreatedAt DESC);');
w('CREATE INDEX IX_Orders_Promo       ON dbo.Orders (PromoCode) WHERE PromoCode IS NOT NULL;');
w('CREATE INDEX IX_OrderItems_Order   ON dbo.OrderItems (OrderId);');
w('CREATE INDEX IX_OrderItems_Product ON dbo.OrderItems (ProductId);');
go();

/* ============================ 4. Kiểu bảng + thủ tục ============================ */
blank();
w('/* ================= 4. KIỂU BẢNG + THỦ TỤC TẠO ĐƠN HÀNG ================= */');
w('/* Kiểu bảng truyền vào usp_TaoDonHang: danh sách món trong giỏ */');
w(`CREATE TYPE dbo.OrderItemType AS TABLE (
    ProductId INT NOT NULL,
    Qty       INT NOT NULL
);`);
go();
blank();
w('/* usp_TaoDonHang — đồng bộ logic POST /api/orders trong server.js:');
w('   - Giá LẤY TỪ DB theo ProductId, không tin giá client gửi lên.');
w('   - Gộp dòng trùng sản phẩm; mỗi món 1-99; tối đa 50 món/đơn.');
w('   - Vận phí: standard 30.000đ, express 45.000đ; miễn phí khi tạm tính ≥ 500.000đ.');
w('   - Mã giảm giá chỉ nhận khi còn IsActive; giảm = ROUND(tạm tính × tỉ lệ, 0).');
w('   - Mã đơn "DI" + 8 chữ số, sinh ngẫu nhiên đến khi duy nhất.');
w('   Trả về: OrderId, OrderCode và các tổng tiền đã tính. */');
w(`CREATE PROCEDURE dbo.usp_TaoDonHang
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
        IF @Subtotal >= 500000
            SET @ShippingFee = 0;   -- miễn phí vận chuyển

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

        DECLARE @Total DECIMAL(12,0) = @Subtotal - @Discount + @ShippingFee;

        /* Mã đơn DI + 8 chữ số, sinh đến khi duy nhất */
        DECLARE @Code NVARCHAR(20);
        WHILE 1 = 1
        BEGIN
            SET @Code = N'DI'
                + RIGHT('000000' + CAST(ABS(CHECKSUM(NEWID())) % 1000000 AS VARCHAR(6)), 6)
                + RIGHT('00' + CAST(ABS(CHECKSUM(NEWID())) % 100 AS VARCHAR(2)), 2);
            IF NOT EXISTS (SELECT 1 FROM dbo.Orders WHERE OrderCode = @Code) BREAK;
        END

        INSERT INTO dbo.Orders (OrderCode, DeliveryMethod, PaymentMethod, PromoCode,
                                Subtotal, ShippingFee, Discount, Total,
                                CustomerName, CustomerPhone, CustomerAddress, Note, CreatedAt)
        VALUES (@Code, @DeliveryMethod, @PaymentMethod, @AppliedPromo,
                @Subtotal, @ShippingFee, @Discount, @Total,
                @CustomerName, @CustomerPhone, @CustomerAddress, @Note, SYSUTCDATETIME());

        DECLARE @OrderId INT = SCOPE_IDENTITY();

        /* Lưu snapshot tên + giá vào dòng đơn hàng */
        INSERT INTO dbo.OrderItems (OrderId, ProductId, ProductName, UnitPrice, Qty)
        SELECT @OrderId, m.ProductId, p.Name, p.Price, m.Qty
        FROM @Merged AS m
        INNER JOIN dbo.Products AS p ON p.ProductId = m.ProductId;

        COMMIT TRANSACTION;

        SELECT @OrderId AS OrderId, @Code AS OrderCode,
               @Subtotal AS Subtotal, @ShippingFee AS ShippingFee,
               @Discount AS Discount, @Total AS Total;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;   -- ném lại lỗi gốc cho ứng dụng
    END CATCH
END;`);
go();

/* ============================ 5. VIEW ============================ */
blank();
w('/* ========================= 5. VIEW ========================= */');
w(`CREATE VIEW dbo.vw_SanPham
AS
    /* Sản phẩm kèm tên danh mục + ảnh hiển thị:
       DisplayImageUrl = ảnh riêng (nếu có) → ảnh danh mục (fallback như FE) */
    SELECT  p.ProductId, p.Name, p.CategoryKey,
            c.Label AS CategoryLabel, c.ImageUrl AS CategoryImageUrl,
            p.Price, p.OldPrice, p.Rating, p.Sold, p.Badge,
            p.[Description], p.ImageUrl,
            COALESCE(p.ImageUrl, c.ImageUrl) AS DisplayImageUrl
    FROM dbo.Products AS p
    INNER JOIN dbo.Categories AS c ON c.CategoryKey = p.CategoryKey;`);
go();
blank();
w(`CREATE VIEW dbo.vw_DonHangChiTiet
AS
    /* Mỗi dòng = một món trong đơn, kèm thông tin khách + các tổng tiền */
    SELECT  o.OrderId, o.OrderCode, o.CreatedAt, o.DeliveryMethod, o.PaymentMethod,
            o.PromoCode, o.Subtotal, o.ShippingFee, o.Discount, o.Total,
            o.CustomerName, o.CustomerPhone, o.CustomerAddress, o.Note,
            oi.OrderItemId, oi.ProductId, oi.ProductName, oi.UnitPrice, oi.Qty, oi.LineTotal
    FROM dbo.Orders AS o
    INNER JOIN dbo.OrderItems AS oi ON oi.OrderId = o.OrderId;`);
go();

/* ============================ 6. Dữ liệu mẫu ============================ */
blank();
w('/* ========================= 6. DỮ LIỆU MẪU ========================= */');
w(`/* Danh mục (${categories.length}) */`);
w('INSERT dbo.Categories (CategoryKey, Label, ImageUrl) VALUES');
w(categories.map((c) => `    (${esc(c.key)}, ${esc(c.label)}, ${str(c.image)})`).join(',\n') + ';');
go();
blank();
w('/* Mã giảm giá: QUANGHUY10 đang hiệu lực, INOX10 là mã cũ (chỉ còn trong đơn lịch sử) */');
w('INSERT dbo.PromoCodes (Code, DiscountRate, IsActive, [Description]) VALUES');
w(`    (${esc('QUANGHUY10')}, ${PROMO_ACTIVE.QUANGHUY10.toFixed(3)}, 1, N'Giảm 10% toàn đơn — mã đang áp dụng (đồng bộ server.js)'),`);
w(`    (${esc('INOX10')}, ${PROMO_RETIRED.INOX10.toFixed(3)}, 0, N'Mã cũ giảm 10% — đã ngừng áp dụng, chỉ còn trong đơn hàng lịch sử');`);
go();
blank();
w(`/* Sản phẩm (${products.length}) — id giữ nguyên như products.json */`);
w('INSERT dbo.Products (ProductId, Name, CategoryKey, Price, OldPrice, Rating, Sold, Badge, [Description], ImageUrl) VALUES');
w(products
  .map((p) => `    (${p.id}, ${esc(p.name)}, ${esc(p.category)}, ${p.price}, ${num(p.oldPrice)}, ${p.rating}, ${p.sold}, ${str(p.badge)}, ${esc(p.description)}, ${str(p.image)})`)
  .join(',\n') + ';');
go();

blank();
w('/* Thông số sản phẩm (specs) — 4 gạch đầu dòng mỗi sản phẩm */');
for (const p of products) {
  w(`/* SP #${p.id} — ${p.name} */`);
  w('INSERT dbo.ProductSpecs (ProductId, SortOrder, SpecText) VALUES');
  w(p.specs.map((s, i) => `    (${p.id}, ${i + 1}, ${esc(s)})`).join(',\n') + ';');
  blank();
}
go();
blank();
w('/* Gallery ảnh — chỉ sản phẩm có ảnh thật mới có dòng (hiện tại: SP #19) */');
{
  const rows = [];
  for (const p of products) {
    galleryOf(p).forEach((url, i) => rows.push(`    (${p.id}, ${i + 1}, ${esc(url)}, ${p.image === url ? 1 : 0})`));
  }
  if (rows.length) {
    w('INSERT dbo.ProductImages (ProductId, SortOrder, Url, IsPrimary) VALUES');
    w(rows.join(',\n') + ';');
  }
}
go();
blank();
w('/* ================== 7. ĐƠN HÀNG MẪU (từ orders.json) ==================');
w('   OrderItems lưu SNAPSHOT tên + giá tại thời điểm đặt — có thể khác tên/giá');
w('   hiện tại của sản phẩm (đúng theo dữ liệu gốc của dự án). */');
sampleOrders.forEach((order, i) => {
  const id = i + 1;
  const promo = order.promoCode ? ` + mã ${order.promoCode}` : ', không mã';
  const ship = order.shippingFee > 0 ? `vận phí ${order.shippingFee.toLocaleString('vi-VN')}đ` : 'miễn phí ship';
  w(`/* Đơn #${id} — ${order.code} (${order.items.length} món${promo}, ${ship}) */`);
  w('SET IDENTITY_INSERT dbo.Orders ON;');
  w(`INSERT dbo.Orders (OrderId, OrderCode, DeliveryMethod, PaymentMethod, PromoCode, Subtotal, ShippingFee, Discount, Total, CustomerName, CustomerPhone, CustomerAddress, Note, CreatedAt)`);
  w(`VALUES (${id}, ${esc(order.code)}, ${esc(order.delivery)}, ${esc(order.payment)}, ${str(order.promoCode)}, ${order.subtotal}, ${order.shippingFee}, ${order.discount}, ${order.total},`);
  w(`       ${esc(order.customer.name)}, ${esc(order.customer.phone)}, ${esc(order.customer.address)}, ${str(order.customer.note)}, ${isoToSql(order.createdAt)});`);
  w('SET IDENTITY_INSERT dbo.Orders OFF;');
  w('INSERT dbo.OrderItems (OrderId, ProductId, ProductName, UnitPrice, Qty) VALUES');
  w(order.items.map((it) => `    (${id}, ${it.id}, ${esc(it.name)}, ${it.price}, ${it.qty})`).join(',\n') + ';');
  blank();
});
go();
blank();
w('/* ==================== 8. KIỂM TRA SAU KHI NẠP ==================== */');
w("SELECT N'Danh mục'       AS [Bảng], COUNT(*) AS [Số dòng] FROM dbo.Categories");
w("UNION ALL SELECT N'Sản phẩm',        COUNT(*) FROM dbo.Products");
w("UNION ALL SELECT N'Ảnh sản phẩm',    COUNT(*) FROM dbo.ProductImages");
w("UNION ALL SELECT N'Thông số SP',     COUNT(*) FROM dbo.ProductSpecs");
w("UNION ALL SELECT N'Mã giảm giá',     COUNT(*) FROM dbo.PromoCodes");
w("UNION ALL SELECT N'Đơn hàng',        COUNT(*) FROM dbo.Orders");
w("UNION ALL SELECT N'Dòng đơn hàng',   COUNT(*) FROM dbo.OrderItems;");
w('');
w('SELECT TOP (5) ProductId, Name, Price, Sold, Badge FROM dbo.vw_SanPham ORDER BY Sold DESC;');
w('');
w('/* Ví dụ tạo đơn hàng qua thủ tục (bỏ chú thích để chạy thử):');
w('DECLARE @i dbo.OrderItemType;');
w('INSERT INTO @i (ProductId, Qty) VALUES (1, 2), (3, 1);');
w('EXEC dbo.usp_TaoDonHang');
w("    @CustomerName    = N'Nguyễn Văn A',");
w("    @CustomerPhone   = N'0901234567',");
w("    @CustomerAddress = N'12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',");
w("    @DeliveryMethod  = N'standard',");
w("    @PaymentMethod   = N'cod',");
w("    @PromoCode       = N'QUANGHUY10',");
w('    @Items           = @i;');
w('*/');
go();

/* ============================ Ghi file ============================ */
const sql = '\ufeff' + out.join('\r\n') + '\r\n'; // UTF-8 BOM để SSMS nhận đúng tiếng Việt
fs.writeFileSync(OUT_FILE, sql, 'utf8');
const kb = (fs.statSync(OUT_FILE).size / 1024).toFixed(1);
console.log(`✓ Đã sinh ${OUT_FILE} (${kb} KB)`);
console.log(`  ${categories.length} danh mục · ${products.length} sản phẩm · ${products.reduce((s, p) => s + p.specs.length, 0)} thông số · ${sampleOrders.length} đơn mẫu`);
console.log('  Nạp bằng: sqlcmd -S .\\SQLEXPRESS -E -i do-cu-quang-huy.sql (hoặc SSMS → F5)');






