/*
  Chạy bằng db_migrator sau khi thay APP_RUNTIME_USER bằng tên Windows user/login
  đã được duyệt. Script không chứa mật khẩu và có thể chạy lại.
  Ví dụ production: DOMAIN\svc-docu-app (không dùng sa/db_owner).
*/
USE [DoCuQuangHuy];
GO

-- Tạo USER trước bằng công cụ quản trị phù hợp với loại login:
-- CREATE USER [APP_RUNTIME_USER] FOR LOGIN [APP_RUNTIME_USER];

GRANT SELECT ON dbo.Categories TO [APP_RUNTIME_USER];
GRANT SELECT ON dbo.Products TO [APP_RUNTIME_USER];
GRANT SELECT ON dbo.ProductImages TO [APP_RUNTIME_USER];
GRANT SELECT ON dbo.ProductSpecs TO [APP_RUNTIME_USER];
GRANT EXECUTE ON dbo.usp_TaoDonHang TO [APP_RUNTIME_USER];
GRANT EXECUTE, REFERENCES ON TYPE::dbo.OrderItemType TO [APP_RUNTIME_USER];

DENY INSERT, UPDATE, DELETE ON dbo.Orders TO [APP_RUNTIME_USER];
DENY INSERT, UPDATE, DELETE ON dbo.OrderItems TO [APP_RUNTIME_USER];
GO
