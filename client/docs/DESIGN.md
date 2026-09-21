# Editorial Circular Commerce — Earth Edition

## Direction

Warm Architectural Minimalism cho một storefront đồ inox gia dụng, kế thừa bố cục
của bộ tham khảo "Editorial Circular Commerce" (hero split + search console, thẻ
sản phẩm mặt trắng, numbered trust cards, CTA banner tối) nhưng thay toàn bộ bảng
màu bằng palette **Earth**: olive làm màu tương tác, graphite-olive cho nút hành
động, đất nung chỉ dành cho khuyến mãi.

Phiên bản **soft/cute** (hiện tại): bo góc lớn + mọi control dạng pill, bóng ấm
kiểu sticker, chấm bi siêu nhẹ trên nền kem, hero-seal nghiêng như tem dán,
eyebrow thành chip olive tròn, navbar "đảo nổi" — giữ nguyên hệ màu và bố cục
editorial.

## Tokens

- Bảng màu gốc: Coolors trending "Earth" (`#606C38` olive, `#283618` olive đậm, `#FEFAE0` kem, `#DDA15E` ochre, `#BC6C25` đất nung); một số giá trị được đậm hóa để đạt WCAG AA trên nền kem.
- Canvas: `#f7f4e9` (kem đá ấm); surface: `#fffdf6`; surface-low: `#efe9d8`; surface-high: `#e9e2cc`; ink: `#283618`; muted: `#5f6553`; line: `#e4decb`.
- Primary (olive) `#606c38` dùng cho: giá, link, icon, focus ring, badge rating, nút chính (`.btn-primary`, "Thêm vào giỏ", áp mã). Hover `#4f5a2c`; soft `#e0e5c9`.
- CTA tối phụ: graphite-olive `#222c16` nền + `#f5f4e6` chữ cho cart-btn header, toast, CTA banner, footer; hover `#31411f`.
- Accent đất nung `#a8581c` + soft `#f4e3d3` chỉ dành cho giảm giá/khuyến mãi, không dùng cho hành động chính.
- Success `#356138`; error `#b3261e`; inverse dark `#222c16` cho CTA banner, widget hero, footer.
- Display: Quicksand (tròn, hỗ trợ tiếng Việt; fallback Plus Jakarta Sans); body: Nunito (fallback Be Vietnam Pro); số liệu/eyebrow: mono hệ thống.
- Radius "soft edition": 10px controls, 16px media/panel/card, 22px banner/plate/empty-state, 28px khối lớn (CTA banner, category band, footer); `--r-pill` 999px cho control viên thuốc (nút, chip, badge, toast, search console).
- Shadow "sticker" ấm (tông nâu-olive thay vì xám đen): `--shadow-card` cho thẻ tĩnh, `--shadow-ambient` cho hover + phần tử nổi (toast, sticky summary, seal), `--shadow-float` cho toast; không dùng bóng đậm gắt.

## Composition

- Maximum content width 1440px, margin 48px desktop / 20px mobile; chiều sâu bằng
  tách lớp sắc độ (tonal layering) + hairline 1px, không viền kín dày.
- Hero split: cột trái eyebrow chip pill + display headline + search console capsule
  (input + select danh mục + nút tìm, field pill tonal → focus trắng + ring nét đôi) +
  quick chips pill; cột phải photo card kèm seal sticker nghiêng + widget metric tối.
- Navbar: "đảo nổi" pill trôi trên nền chấm bi (desktop); dock nổi bo tròn cạnh đáy (mobile).
- Thẻ sản phẩm: mặt trắng, padding 10px, ảnh 4:3 hover zoom, badge tối góc trái,
  score trắng góc phải, bookmark icon; dải giá tonal `surface-low` ở đáy với giá
  olive + giá gạch + badge −%; nút "Thêm vào giỏ" olive pill 38px.
- Toast capsule tối + icon check olive; back-to-top hình tròn, chỉ hiện khi cuộn > 640px.
- Trust strip 3 icon tròn dưới hero; standards 01/02/03 với số trong vòng tròn olive
  soft; testimonial card bo 22px hover nâng; CTA banner tối bo 28px kèm chấm bi + glow olive blur.
- Story strip trên trang chủ: ảnh kèm pill sticker nghiêng + checklist cam kết (check
  trong vòng tròn olive-soft) + nút dẫn sang `/about`.
- About: band số liệu bo 28px nền chấm bi với thẻ trắng hover lift; story 2 cột ảnh +
  sticker nghiêng + promise pills; số thứ tự giá trị nằm trong vòng tròn olive-soft
  (hover đổ đầy olive); timeline chấm bi nối đường đứt nét, năm dạng pill chip;
  chips pill dưới page-hero.
- FAQ accordion pill trên trang chủ (icon +/– trong vòng tròn, mở chuyển nền olive,
  đáp án fade-in, hàng dẫn sang `/contact`); About thêm quy trình 4 bước (số vòng
  tròn olive-soft hover đổ đầy) và team card với avatar chữ cái tròn + role mono.
- Motion tiết chế: hero reveal một lần, hover nâng 1–3px, tôn trọng `prefers-reduced-motion`.