# QA — Tối ưu chatbot AI (2026-10-04)

Task: `docs/tasks/2026-10-04-toi-uu-chatbot-ai.md` · Phạm vi: BE only (`server/lib/chat.js`, `server/test/chat.test.js`)

## Đối chiếu acceptance criteria

| AC | Kết quả | Bằng chứng |
|---|---|---|
| AC1 — Ưu tiên câu hỏi hiện tại (hỏi ship sau khi xem quạt → không gợi quạt) | ✅ PASS | test `Hỏi ship sau khi xem quạt → chip KHÔNG còn gợi quạt` |
| AC2 — Ngân sách (ghế dưới 100k → chỉ món ≤ 100.000₫) | ✅ PASS | test `Hỏi ghế dưới 100k → chỉ gợi món giá ≤ 100.000₫` |
| AC3 — Chào hỏi thân thiện | ✅ PASS | test `Khách chỉ chào hỏi → chào lại thân thiện` |
| AC4 — Prompt persona "Quang Huy", temperature 0.6, max_tokens 600 | ✅ PASS | `server/lib/chat.js` (buildAiPrompt, callXkiro) — không gọi mạng trong test |
| AC5 — npm test + npm run verify | ✅ PASS | `npm test` → 86/86 pass (3 test mới) · `npm run verify` → PASS |

## Kiểm thử tay fallback (POST /api/chat, không key)
- `xin chao shop` → chào lại + giới thiệu shop.
- `ban co cai ghe nao duoi 100k khong` → chỉ chip Ghế nhựa bành 85k / Ghế Duy Tân 95k.
- `phi ship ve tan go vap` → đúng 30.000₫/45.000₫/freeship 500.000₫.
- Hợp đồng API không đổi: `{reply, mode, products}` — FE không cần sửa.
