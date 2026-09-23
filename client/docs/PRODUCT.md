# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Người mua tại Việt Nam đang tìm đồ dùng bếp và gia dụng inox bền, an toàn, dễ so sánh và dễ đặt mua trên cả điện thoại lẫn máy tính.

## Product Purpose

Website giới thiệu, lọc, xem chi tiết và đặt mua các sản phẩm inox gia đình. Thành công là giúp người mua hiểu rõ chất liệu, giá, tình trạng sẵn hàng và hoàn tất giỏ hàng với ít ma sát.

## Positioning

Một cửa hàng đồ inox được trình bày như catalogue tuyển chọn: thông tin vật liệu rõ ràng, hình ảnh sạch, ít khuyến mại gây nhiễu và nhấn mạnh độ bền lâu dài.

## Capabilities and Constraints

- React 18, Vite và React Router.
- Lọc, tìm kiếm, sắp xếp sản phẩm; trang chi tiết; giỏ hàng lưu bằng localStorage; form liên hệ.
- Giữ nguyên cấu trúc route và hành vi hiện có.
- Nội dung, giá và số liệu hiện có là dữ liệu minh họa của dự án, không bổ sung chứng thực bên ngoài.

## Brand Commitments

- Tên hiện có: Đồ Inox Gia Đình.
- Thiết kế kế thừa ngôn ngữ "Editorial Circular Commerce — Earth Edition" đã chuẩn hoá trong `client/docs/DESIGN.md`: nền kem ấm, olive làm màu tương tác, lưới thoáng và bo góc nhỏ.
- Ngôn ngữ chính: tiếng Việt.

## Evidence on Hand

- Danh mục và dữ liệu sản phẩm trong SQL Server `DoCuQuangHuy` (backend cung cấp qua REST API `/api/products`; `server/data/products.json` chỉ là fixture test/seed).
- Hệ thống thiết kế (token màu, typography, layout) tại `client/docs/DESIGN.md`.
- Ảnh catalogue phục vụ từ backend tại `server/public/images/` (`catalog/` + `products/`).

## Product Principles

- Sản phẩm và vật liệu là trọng tâm.
- Thông tin mua hàng phải dễ quét và dễ tin cậy.
- Mỗi hành động chính phải rõ ràng trên màn hình nhỏ.
- Hạn chế hiệu ứng và màu sắc không phục vụ quyết định mua.

## Accessibility & Inclusion

Giao diện cần hỗ trợ bàn phím, focus rõ, tương phản tối thiểu WCAG AA và tôn trọng `prefers-reduced-motion`.
