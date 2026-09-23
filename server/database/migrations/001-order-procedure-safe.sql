/* Migration không phá dữ liệu. Backup DoCuQuangHuy trước khi chạy trong SSMS.
   Script này không DROP bảng, không xóa/reseed dữ liệu. */
USE [DoCuQuangHuy];
GO

IF TYPE_ID(N'dbo.OrderItemType') IS NULL
    EXEC(N'CREATE TYPE dbo.OrderItemType AS TABLE (ProductId INT NOT NULL, Qty INT NOT NULL)');
GO

CREATE OR ALTER PROCEDURE dbo.usp_TaoDonHang
    @CustomerName NVARCHAR(80), @CustomerPhone NVARCHAR(10),
    @CustomerAddress NVARCHAR(300), @DeliveryMethod NVARCHAR(10),
    @PaymentMethod NVARCHAR(10), @PromoCode NVARCHAR(20) = NULL,
    @Note NVARCHAR(500) = NULL, @Items dbo.OrderItemType READONLY
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    IF NOT EXISTS (SELECT 1 FROM @Items) THROW 50006, N'Giỏ hàng trống.', 1;
    IF EXISTS (SELECT 1 FROM @Items WHERE Qty < 1 OR Qty > 99) THROW 50007, N'Số lượng mỗi món phải từ 1 đến 99.', 1;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @Merged TABLE (ProductId INT NOT NULL PRIMARY KEY, Qty INT NOT NULL);
        INSERT @Merged SELECT ProductId, SUM(Qty) FROM @Items GROUP BY ProductId;
        IF EXISTS (SELECT 1 FROM @Merged WHERE Qty > 99) THROW 50007, N'Số lượng mỗi món phải từ 1 đến 99.', 1;
        IF (SELECT COUNT(*) FROM @Merged) > 50 THROW 50008, N'Tối đa 50 món mỗi đơn.', 1;
        IF EXISTS (SELECT 1 FROM @Merged m WHERE NOT EXISTS (SELECT 1 FROM dbo.Products p WITH (UPDLOCK, HOLDLOCK) WHERE p.ProductId=m.ProductId))
            THROW 50009, N'Có sản phẩm không tồn tại trong cửa hàng.', 1;

        DECLARE @Subtotal DECIMAL(12,0) = (SELECT SUM(p.Price*m.Qty) FROM @Merged m JOIN dbo.Products p WITH (UPDLOCK, HOLDLOCK) ON p.ProductId=m.ProductId);
        DECLARE @ShippingFee DECIMAL(12,0) = CASE WHEN @DeliveryMethod=N'express' THEN 45000 WHEN @Subtotal>=500000 THEN 0 ELSE 30000 END;
        DECLARE @Discount DECIMAL(12,0)=0, @AppliedPromo NVARCHAR(20)=NULL, @Rate DECIMAL(4,3);
        SELECT @Rate=DiscountRate FROM dbo.PromoCodes WHERE Code=UPPER(LTRIM(RTRIM(@PromoCode))) AND IsActive=1;
        IF @Rate IS NOT NULL BEGIN SET @AppliedPromo=UPPER(LTRIM(RTRIM(@PromoCode))); SET @Discount=ROUND(@Subtotal*@Rate,0); END;
        DECLARE @Code NVARCHAR(20), @Attempt INT=0;
        WHILE @Attempt < 20 BEGIN
          SET @Code=N'DI'+RIGHT('00000000'+CAST(ABS(CONVERT(BIGINT,CHECKSUM(NEWID())))%100000000 AS VARCHAR(8)),8);
          IF NOT EXISTS(SELECT 1 FROM dbo.Orders WITH(UPDLOCK,HOLDLOCK) WHERE OrderCode=@Code) BREAK;
          SET @Attempt+=1;
        END;
        IF @Attempt>=20 THROW 50010, N'Không tạo được mã đơn duy nhất.', 1;
        INSERT dbo.Orders(OrderCode,DeliveryMethod,PaymentMethod,PromoCode,Subtotal,ShippingFee,Discount,CustomerName,CustomerPhone,CustomerAddress,Note,CreatedAt)
        VALUES(@Code,@DeliveryMethod,@PaymentMethod,@AppliedPromo,@Subtotal,@ShippingFee,@Discount,LTRIM(RTRIM(@CustomerName)),@CustomerPhone,LTRIM(RTRIM(@CustomerAddress)),NULLIF(LTRIM(RTRIM(@Note)),N''),SYSUTCDATETIME());
        DECLARE @OrderId INT=SCOPE_IDENTITY();
        INSERT dbo.OrderItems(OrderId,ProductId,ProductName,UnitPrice,Qty)
          SELECT @OrderId,m.ProductId,p.Name,p.Price,m.Qty FROM @Merged m JOIN dbo.Products p ON p.ProductId=m.ProductId;
        COMMIT;
        SELECT o.OrderId,o.OrderCode,o.DeliveryMethod,o.PaymentMethod,o.PromoCode,o.Subtotal,o.ShippingFee,o.Discount,o.Total,o.CustomerName,o.CustomerPhone,o.CustomerAddress,o.Note,o.CreatedAt
          FROM dbo.Orders o WHERE o.OrderId=@OrderId;
        SELECT ProductId,ProductName,UnitPrice,Qty FROM dbo.OrderItems WHERE OrderId=@OrderId ORDER BY OrderItemId;
    END TRY
    BEGIN CATCH
      IF @@TRANCOUNT>0 ROLLBACK;
      THROW;
    END CATCH
END;
GO
