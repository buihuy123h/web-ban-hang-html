# Tối ưu chất lượng chatbot AI (thông minh hơn, trả lời hay & đúng hơn)

## Mục tiêu & bối cảnh
Chatbot RAG tại `POST /api/chat` (engine `server/lib/chat.js`) đang hoạt động đúng hợp đồng nhưng chất lượng trả lời còn hạn chế: retrieval gộp lịch sử hội thoại với câu hỏi hiện tại gây lệch món hàng, FAQ chỉ khớp nguyên cụm từ khoá, không hiểu ngân sách, prompt AI và fallback khô cứng.

## User story
- Là khách hàng, tôi muốn trợ lý hiểu đúng câu hỏi tôi đang hỏi (kể cả câu nối tiếp, gõ thiếu dấu, có nhắc ngân sách) để nhận món hàng & chính sách đúng nhu cầu.
- Là chủ shop, tôi muốn giọng trợ lý thân thiện, duyên dáng kiểu nhân viên Sài Gòn để khách thoải mái mua hàng.

## Luật nghiệp vụ
- KHÔNG đổi hợp đồng API (method/path/body/response: `{reply, mode, products}`) — FE không phải sửa gì.
- Không bao giờ bịa món hàng/giá/chính sách; chỉ dùng dữ liệu truy xuất.
- Môi trường test vẫn bắt buộc fallback, không gọi mạng ngoài.
- Lịch sử hội thoại chỉ bổ trợ, câu hỏi hiện tại phải ưu tiên tuyệt đối khi chọn sản phẩm.
- Fallback trả lời phải giữ nguyên khả năng pass các assertion hiện có (phí ship 30.000/45.000/500.000, địa chỉ 707 Tân Sơn, luôn có reply chuỗi).

## Phạm vi (BE only)
- `server/lib/chat.js`: retrieveContext, parse ngân sách, buildAiPrompt, callXkiro (temperature/max_tokens), buildFallbackReply.
- `server/data/chat-knowledge.json`: bổ sung keywords FAQ.
- `server/test/chat.test.js`: thêm test hành vi mới (ưu tiên câu hỏi hiện tại, ngân sách).

## Acceptance criteria (Given/When/Then)
- AC1: Given lượt trước khách hỏi "quạt", When lượt sau hỏi "phi ship bao nhieu", Then chip sản phẩm không còn gợi quạt (ưu tiên câu hỏi hiện tại; câu này khớp FAQ phi-ship).
- AC2: Given khách hỏi "ban cho xin cai ghe duoi 300k", Then các chip gợi ý ưu tiên món giá ≤ 300.000₫.
- AC3: Given khách chỉ chào "xin chao", Then fallback trả lời chào lại + mời hỏi, không phải câu "không tìm thấy".
- AC4: Khi có XKIRO_API_KEY, prompt gồm persona "Quang Huy", quy tắc trả đúng trọng tâm, temperature 0.6, max_tokens 600.
- AC5: `npm test` (server) pass toàn bộ, gồm test cũ và test mới; `npm run verify` pass.
