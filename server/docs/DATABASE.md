# 🗃 Database & ảnh sản phẩm — tổ chức để "lên mạng không lỗi ảnh"

Tài liệu này trả lời hai câu hỏi: **sản phẩm có ảnh thì hiển thị thế nào?** và **tổ chức DB ra sao để khi đưa lên Internet ảnh vẫn chạy, không 404, không vỡ giao diện?**

## 1. Cấu trúc thư mục

```
server/
├── data/
│   └── products.json        ← DATABASE (sản phẩm + danh mục)
└── public/
    └── images/
        ├── catalog/         ← ảnh danh mục & ảnh hero (dùng chung)
        │   ├── ban-ghe.svg   ├── noi-that.svg
        │   ├── noi-chao.jpg  ├── bat-dia.jpg
        │   └── dung-cu.jpg   └── luu-tru.jpg
        └── products/        ← ảnh RIÊNG của từng sản phẩm
            └── ke-inox-4-tang.jpg   (ví dụ mẫu)
```

Server tự phục vụ thư mục này tại `/images/*` với header `Cache-Control: public, max-age=2592000, immutable`.

## 2. Schema `server/data/products.json`

### Danh mục
```json
{ "key": "luu-tru", "label": "Kệ inox & lưu trữ", "image": "/images/catalog/luu-tru.jpg" }
```

### Sản phẩm
| Trường | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| `id` | number | ✓ | Khóa chính, duy nhất |
| `name` | string | ✓ | Tên hiển thị |
| `category` | string | ✓ | Khóa danh mục (phải có trong `categories`) |
| `categoryLabel` | string | ✓ | Tên danh mục hiển thị |
| `price` / `oldPrice` | number / null | ✓ | Giá bán / giá gốc (`null` nếu không giảm) |
| `rating` / `sold` | number | ✓ | Điểm & số đã bán (cơ sở sắp xếp "phổ biến") |
| `badge` | string | | `hot` · `sale` · `new` |
| `image` | string / null | | **Ảnh đại diện riêng** — đường dẫn tương đối `/images/products/...`; `null` = mượn ảnh danh mục |
| `images` | string[] | | Gallery ảnh phụ (cùng loại đường dẫn) — FE tự sinh các "góc ảnh" |
| `description` | string | ✓ | Mô tả |
| `specs` | string[] | ✓ | Các gạch đầu dòng thông số |

Ví dụ sản phẩm có ảnh thật (sản phẩm #19 trong DB hiện tại):
```json
{
  "id": 19,
  "name": "Kệ inox 4 tầng cho quán & nhà bếp",
  "category": "luu-tru",
  "price": 850000,
  "oldPrice": 990000,
  "image": "/images/products/ke-inox-4-tang.jpg",
  "images": ["/images/products/ke-inox-4-tang.jpg"]
}
```

## 3. Bốn nguyên tắc chống lỗi ảnh khi deploy

1. **DB chỉ lưu đường dẫn TƯƠNG ĐỐI** bắt đầu bằng `/images/...` — **không lưu URL có domain** (`http://localhost:3000/...`, `https://tenmien.com/...`). Đổi tên miền, deploy máy khác, test localhost → trình duyệt tự ghép vào domain hiện tại, ảnh luôn chạy, không phải sửa DB.
2. **Ảnh là dữ liệu, không phải code.** File ảnh nằm trong `server/public/images/` và được deploy copy kèm (như thư mục `data/`). Không nhét ảnh vào bundle FE — thêm/đổi ảnh không phải build lại client.
3. **Cache 30 ngày `immutable`** cho `/images/*` (server tự gắn header). An toàn vì quy ước: *thay ảnh = thêm file mới + sửa đường dẫn trong DB*, không ghi đè file cũ. Trình duyệt không tải lại ảnh đã xem → tiết kiệm băng thông.
4. **Fallback nhiều tầng ở FE** (`client/src/data/productImages.js`): ảnh riêng trong DB → ảnh danh mục → placeholder. Thiếu 1 file không vỡ layout, chỉ hiện ảnh dự phòng. Server khi khởi động quét DB và **cảnh báo `[images]`** nếu thiếu file; test CI (`server/test/api.test.js`) chặn luôn deploy thiếu ảnh.

## 4. Thêm sản phẩm có ảnh — 3 bước

1. Chép file ảnh vào `server/public/images/products/`, đặt tên không dấu, gợi ý `ten-mon.jpg` (vd `ban-nhua-vuong-60.jpg`).
2. Thêm object vào mảng `products` trong `server/data/products.json`:
   ```json
   {
     "id": 22,
     "name": "Bàn nhựa vuông 60 cm",
     "category": "ban-ghe",
     "categoryLabel": "Bàn ghế & ghế nhựa",
     "price": 150000,
     "oldPrice": null,
     "rating": 4.6,
     "sold": 0,
     "badge": "new",
     "image": "/images/products/ban-nhua-vuong-60.jpg",
     "images": ["/images/products/ban-nhua-vuong-60.jpg"],
     "description": "Mô tả ngắn về tình trạng món đồ…",
     "specs": ["Thông số 1", "Thông số 2"]
   }
   ```
3. `npm run dev` lại (hoặc `npm run deploy` khi production). **Không cần build lại FE.**

> Gallery nhiều góc ảnh: liệt kê thêm đường dẫn trong `images` — trang chi tiết tự sinh đủ thumbnail "Góc 1, Góc 2, …". Nếu `images` rỗng, FE dùng ảnh chính + các góc crop như thiết kế cũ.

## 5. Thay ảnh — đừng ghi đè file cũ

Vì trình duyệt cache ảnh 30 ngày, muốn thay ảnh hãy **thêm file mới với tên mới** (vd `ke-inox-4-tang-2.jpg`) rồi sửa đường dẫn trong DB. Ghi đè cùng tên → khách đã vào trang trước đó tiếp tục thấy ảnh cũ đến khi cache hết hạn.

## 6. Khi lên Internet thật

- **Deploy 1 máy (mô hình hiện tại):** chạy `npm run deploy` ở `server/`. Nhớ copy cả `server/public/images/` lên máy chủ — đó là "database ảnh".
- **FE và BE tách origin** (`VITE_API_URL=https://api...`): FE tự ghép domain API vào mọi ảnh `/images/...` qua `resolveImg()` trong `client/src/data/productImages.js` — không cần sửa DB.
- **Muốn dùng CDN/cloud (Cloudinary, PicGo, S3…) sau này:** chỉ cần điền URL đầy đủ `https://cdn.../anh.jpg` vào `image`/`images` — FE nhận diện và giữ nguyên URL. Đây là lý do DB lưu chuỗi đường dẫn thay vì khóa file.

## 7. Dev & kiểm tra

- **Dev:** Vite proxy `/images` → cổng 3000 (`client/vite.config.js`), nên ảnh hiện bình thường tại `localhost:5173`.
- **Test:** `cd server && npm test` — có test đối chiếu DB ↔ file trên đĩa, chặn deploy thiếu ảnh.
- **Khởi động:** server in cảnh báo `[images] ... thiếu file` nếu DB khai báo ảnh không tồn tại.
- **API:** `/api/products` và `/api/products/:id` luôn trả `image` (string/null) và `images` (mảng) — FE dựa vào đó hiển thị.