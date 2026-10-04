# Nâng cấp trợ lý AI chat với `openai/gpt-5.6-sol`

## Mục tiêu & bối cảnh

Trợ lý chat hiện đã có RAG sản phẩm/FAQ và fallback, nhưng câu trả lời còn kém thông minh do retrieval chỉ dựa trên khớp từ khóa và prompt chưa khai thác tốt lịch sử hội thoại. Nâng cấp backend để hiểu ngữ cảnh tiếng Việt tốt hơn, trả lời dựa trên dữ liệu shop, không bịa thông tin và dùng model `openai/gpt-5.6-sol` qua router OpenAI-compatible hiện có.

## User story

Là khách hàng, tôi muốn hỏi tự nhiên về sản phẩm, ngân sách, số lượng, giao hàng và hỏi tiếp dựa trên câu trước để nhận được câu trả lời tiếng Việt chính xác, ngắn gọn và có gợi ý sản phẩm phù hợp.

## Luật nghiệp vụ

- Chỉ khẳng định tên, giá, tồn tại, thông số và chính sách có trong context được truy xuất.
- Không có dữ liệu phù hợp thì nói rõ chưa tìm thấy và hướng khách liên hệ shop; không tự bịa.
- Hỗ trợ tiếng Việt có dấu/không dấu, từ đồng nghĩa phổ biến và câu hỏi nối tiếp.
- Có thể đề xuất nhiều sản phẩm; ưu tiên phù hợp từ khóa, danh mục, khoảng giá và số lượng nếu khách nêu.
- API vẫn fallback khi thiếu key, timeout, lỗi provider hoặc môi trường test; web không phụ thuộc dịch vụ AI.
- Không log API key, nội dung nhạy cảm hoặc toàn bộ hội thoại.
- Giữ nguyên endpoint và response hiện tại để frontend không phải đổi hợp đồng.

## Hợp đồng API

`POST /api/chat`

Request:

```json
{"messages":[{"role":"user","content":"Tìm ghế nhựa dưới 200 nghìn"}]}
```

- `messages`: 1–20 phần tử, role `user`/`assistant`, tin cuối phải là `user`, mỗi content tối đa 1000 ký tự.

Response 200:

```json
{"reply":"...","mode":"ai","products":[{"id":1,"name":"...","price":150000}]}
```

`mode` là `ai` hoặc `fallback`; `products` tối đa 4. Lỗi validation là 400, rate limit là 429, database unavailable là 503.

## Phạm vi

- Backend `server/lib/chat.js`: retrieval có intent/ngữ cảnh/lọc ngân sách và prompt có cấu trúc.
- Cấu hình tài liệu/env: model mặc định `openai/gpt-5.6-sol`, giữ router `XKIRO_API_BASE` tương thích.
- Không đổi schema DB, endpoint hoặc dependency.
- Không đổi UI.

## Acceptance criteria

- Given model chưa cấu hình key, When gửi câu hỏi, Then API trả fallback 200 và không gọi mạng ngoài trong test.
- Given model/key hợp lệ, When khách hỏi sản phẩm tự nhiên hoặc không dấu, Then prompt chứa context sản phẩm/FAQ liên quan và model `openai/gpt-5.6-sol` được gửi đi.
- Given khách nêu ngân sách hoặc số lượng, When truy xuất sản phẩm, Then sản phẩm vượt ngân sách bị loại/ưu tiên thấp và prompt nêu rõ tiêu chí.
- Given câu hỏi nối tiếp, When có lịch sử hội thoại, Then retrieval dùng cả ngữ cảnh liên quan nhưng câu trả lời bám tin cuối.
- Given prompt injection hoặc câu hỏi ngoài dữ liệu, When model trả lời, Then system rules yêu cầu bỏ qua chỉ dẫn trái phép và không bịa dữ liệu.
- Given provider lỗi/timeout, When gửi chat, Then fallback thân thiện vẫn trả response hợp đồng.
- `npm test`, `npm run build`, `npm run verify` pass.