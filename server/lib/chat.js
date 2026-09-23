/**
 * BACKEND — Trợ lý AI chat kiểu RAG (Retrieval-Augmented Generation) cho Đồ Cũ Quang Huy.
 *
 * Luồng: POST /api/chat
 *   [1] RETRIEVE  — chấm điểm sản phẩm (products.json) + FAQ (data/chat-knowledge.json)
 *                   theo từ khoá câu hỏi (bỏ dấu tiếng Việt để khớp "ghe nhua" ≈ "Ghế nhựa").
 *   [2] AUGMENT   — ghép persona shop + dữ liệu truy xuất được vào prompt tiếng Việt.
 *   [3] GENERATE  — gọi xKiro (router API chuẩn OpenAI, POST /v1/chat/completions)
 *                   bằng fetch builtin → 0 dependency mới; retry 1 lần khi socket
 *                   bị cắt đột ngột (UND_ERR_SOCKET — lỗi transient hay gặp của undici).
 *
 * An toàn vận hành:
 *   - Không có XKIRO_API_KEY / lỗi mạng / timeout → tự hạ cấp chế độ "fallback"
 *     (trả lời rule-based từ kết quả truy xuất) — web không bao giờ chết vì AI.
 *   - Môi trường test (NODE_ENV=test / npm test) buộc fallback, không gọi mạng ngoài.
 *   - Hội thoại KHÔNG lưu phía server (stateless).
 *
 * Biến môi trường (đặt trong server/.env — xem server/.env.example):
 *   XKIRO_API_KEY · XKIRO_MODEL · XKIRO_API_BASE · XKIRO_TIMEOUT_MS · CHAT_RATE_MAX
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { ConfigError } = require('./db');

/* ===== Cấu hình (đọc 1 lần lúc nạp module) ===== */
const XKIRO_MODEL = process.env.XKIRO_MODEL || 'qwen/qwen3.5-flash:free';
const XKIRO_API_BASE = (process.env.XKIRO_API_BASE || 'https://api.xkiro.com/v1').replace(/\/+$/, '');
const parseTimeout = () => {
  const raw = process.env.XKIRO_TIMEOUT_MS;
  if (raw == null || raw === '') return 20_000;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1000 || value > 120_000) {
    throw new ConfigError('XKIRO_TIMEOUT_MS phải là số nguyên từ 1000 đến 120000.');
  }
  return value;
};
const XKIRO_TIMEOUT_MS = parseTimeout();

/* ===== Giới hạn payload & truy xuất ===== */
const MAX_MESSAGES = 20;          // tối đa số tin khách gửi lên mỗi lượt
const MAX_CONTENT_CHARS = 1000;   // tối đa ký tự mỗi tin
const MAX_PRODUCTS_IN_PROMPT = 6; // món đưa vào context cho AI
const MAX_PRODUCTS_IN_REPLY = 4;  // món trả về cho FE gợi ý chip
const MAX_FAQS_IN_PROMPT = 3;     // mục chính sách đưa vào context
const CHAT_WINDOW_MS = 60_000;
const CHAT_BUCKETS_MAX = 10_000;

/* Test luôn chạy fallback — tuyệt đối không gọi API ngoài khi kiểm thử. */
const isTestRuntime = () =>
  process.env.NODE_ENV === 'test' || process.env.npm_lifecycle_event === 'test';
const aiEnabled = () => Boolean(process.env.XKIRO_API_KEY) && !isTestRuntime();

/* ===== Nguồn kiến thức: thông tin shop + FAQ chính sách ===== */
const KNOWLEDGE_FILE = path.join(__dirname, '..', 'data', 'chat-knowledge.json');
const MINIMAL_KNOWLEDGE = { shop: { name: 'Đồ Cũ Quang Huy', hotline: '0374 034 430' }, faqs: [] };

const knowledge = (() => {
  try {
    const parsed = JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, 'utf8'));
    return {
      shop: parsed && typeof parsed.shop === 'object' && parsed.shop ? parsed.shop : MINIMAL_KNOWLEDGE.shop,
      faqs: Array.isArray(parsed && parsed.faqs)
        ? parsed.faqs.filter((f) => f && f.key && typeof f.a === 'string')
        : [],
    };
  } catch {
    return MINIMAL_KNOWLEDGE; // thiếu/hỏng file → vẫn trả lời được mức tối thiểu
  }
})();

/* ===== [1] RETRIEVE — chuẩn hoá & chấm điểm ===== */

/* Bỏ dấu tiếng Việt: "Ghế nhựa" → "ghe nhua" — khách gõ thiếu dấu vẫn khớp. */
const stripDiacritics = (text) => String(text)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'd');

const normalizeText = (text) => stripDiacritics(String(text)).toLowerCase();

/* Từ vô nghĩa với việc tìm món — bỏ khỏi token khi chấm điểm sản phẩm. */
const STOPWORDS = new Set([
  'va', 'hoac', 'cua', 'voi', 'cho', 'la', 'co', 'con', 'khong', 'duoc', 'bi', 'gi',
  'the', 'nao', 'bao', 'nhieu', 'mot', 'nhung', 'cai', 'may', 'minh', 'toi', 'ta',
  'nguoi', 'o', 'e', 'thi', 'ma', 'roi', 'nay', 'do', 'day', 'vay', 'nhe', 'nua',
  'se', 'da', 'dang', 'tu', 'den', 'trong', 'ngoai', 'ra', 'vao', 'len', 'xuong',
  've', 'khi', 'neu', 'vi', 'nen', 'lam', 'qua', 'xin', 'chao', 'cam', 'on', 'luon',
  'hello', 'hi', 'hey', 'muon', 'u', 'ui', 'oi', 'a', 'da', 'duoc', 'hay', 'hoi',
]);

const tokenize = (text) => normalizeText(text)
  .replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/)
  .filter((token) => token.length >= 2 && !STOPWORDS.has(token));

/**
 * Truy xuất ngữ cảnh theo câu hỏi của khách.
 * @param {{products: Array, knowledge?: {shop: object, faqs: Array}, message: string}} input
 * @returns {{products: Array, faqs: Array}} sản phẩm & FAQ khớp nhất (điểm cao đứng trước).
 */
const retrieveContext = ({ products = [], knowledge: kb = knowledge, message = '' }) => {
  const tokens = tokenize(message);

  /* Chấm điểm sản phẩm: tên ×3 · danh mục ×2 · mô tả/specs ×1 (mỗi token 1 lần mỗi trường). */
  const scored = [];
  if (tokens.length) {
    for (const product of products) {
      const name = normalizeText(product.name || '');
      const category = normalizeText(`${product.categoryLabel || ''} ${product.category || ''}`);
      const body = normalizeText([
        product.description || '',
        ...(Array.isArray(product.specs) ? product.specs : []),
      ].join(' '));
      let score = 0;
      for (const token of tokens) {
        if (name.includes(token)) score += 3;
        if (category.includes(token)) score += 2;
        if (body.includes(token)) score += 1;
      }
      if (score > 0) scored.push({ product, score });
    }
    scored.sort((a, b) => b.score - a.score);
  }

  /* FAQ theo cụm từ khoá (so trên chuỗi đã bỏ dấu — khớp cả "giao hang", "phi ship"). */
  const normalizedMessage = normalizeText(message);
  const faqs = (kb.faqs || [])
    .map((faq) => {
      const keywords = Array.isArray(faq.keywords) ? faq.keywords : [];
      const hits = keywords.filter((keyword) => normalizedMessage.includes(normalizeText(keyword))).length;
      return { faq, hits };
    })
    .filter((item) => item.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, MAX_FAQS_IN_PROMPT)
    .map((item) => item.faq);

  return { products: scored.map((item) => item.product), faqs };
};

/* ===== Validate payload ===== */
const validateChatBody = (body) => {
  const problems = [];
  const messages = body && Array.isArray(body.messages) ? body.messages : null;

  if (!messages || messages.length === 0) problems.push('Chưa có tin nhắn nào.');
  else if (messages.length > MAX_MESSAGES) problems.push(`Chỉ gửi tối đa ${MAX_MESSAGES} tin nhắn gần nhất.`);
  else {
    messages.forEach((item, index) => {
      const role = item && item.role;
      const content = item && typeof item.content === 'string' ? item.content.trim() : '';
      if (role !== 'user' && role !== 'assistant') problems.push(`Tin nhắn ${index + 1}: vai trò chỉ nhận "user" hoặc "assistant".`);
      if (!content) problems.push(`Tin nhắn ${index + 1}: nội dung trống.`);
      else if (content.length > MAX_CONTENT_CHARS) problems.push(`Tin nhắn ${index + 1}: tối đa ${MAX_CONTENT_CHARS} ký tự.`);
    });
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') problems.push('Tin cuối cùng phải là tin của khách.');
  }
  return problems;
};

/* ===== [2] AUGMENT — dựng prompt ===== */
const formatVnd = (value) => `${Number(value).toLocaleString('vi-VN')}₫`;

const productLines = (list) => list.map((product, index) => {
  const specs = Array.isArray(product.specs) ? product.specs.slice(0, 3).join('; ') : '';
  const parts = [`${index + 1}. ${product.name} — ${formatVnd(product.price)}`];
  if (product.oldPrice) parts.push(`(niêm yết cũ ${formatVnd(product.oldPrice)})`);
  if (typeof product.sold === 'number') parts.push(`đã bán ${product.sold}`);
  if (typeof product.rating === 'number') parts.push(`đánh giá ${product.rating}/5`);
  if (product.description) parts.push(`— ${product.description}`);
  if (specs) parts.push(`Ghi chú: ${specs}`);
  return parts.join(' ');
});

const buildAiPrompt = ({ context, messages }) => {
  const shop = knowledge.shop || {};
  const { products, faqs } = context;
  const lines = [];

  lines.push('Bạn là "Trợ lý AI" của cửa hàng đồ cũ Đồ Cũ Quang Huy, đang trả lời tin nhắn của khách trên website.');
  lines.push('');
  lines.push('QUY TẮC TRẢ LỜI:');
  lines.push('- Chỉ dùng thông tin trong KHỐI DỮ LIỆU bên dưới. Tuyệt đối không bịa món hàng, giá hoặc chính sách.');
  lines.push('- Tiếng Việt thân thiện, ngắn gọn (2–5 câu). Khi nhắc món hàng thì ghi đúng giá bằng số trong dữ liệu.');
  lines.push('- Nếu không có món khách cần: nói thật hiện chưa có, gợi ý món gần nhu cầu nhất (nếu có), mời khách nhắn Zalo ' + (shop.hotline || '0374 034 430') + ' để shop hỗ trợ nhanh.');
  lines.push('- Chỉ bàn về cửa hàng và mua bán đồ cũ; câu hỏi ngoài phạm vi thì khéo léo từ chối và đưa về chủ đề shop.');
  lines.push('');
  lines.push('KHỐI DỮ LIỆU:');
  lines.push('[THÔNG TIN CỬA HÀNG]');
  lines.push(`- Tên: ${shop.name || 'Đồ Cũ Quang Huy'}`);
  if (shop.address) lines.push(`- Địa chỉ: ${shop.address}`);
  if (shop.hours) lines.push(`- Giờ mở cửa: ${shop.hours}`);
  if (shop.hotline) lines.push(`- Hotline/Zalo: ${shop.hotline}`);
  if (shop.intro) lines.push(`- Giới thiệu: ${shop.intro}`);

  if (faqs.length) {
    lines.push('');
    lines.push('[CHÍNH SÁCH LIÊN QUAN CÂU HỎI]');
    for (const faq of faqs) lines.push(`Q: ${faq.q || faq.key}\nA: ${faq.a}`);
  }

  lines.push('');
  lines.push('[SẢN PHẨM ĐANG CÓ — TRÍCH THEO CÂU HỎI CỦA KHÁCH]');
  if (products.length) lines.push(...productLines(products.slice(0, MAX_PRODUCTS_IN_PROMPT)));
  else lines.push('(Không có sản phẩm khớp câu hỏi — chỉ trả lời theo thông tin cửa hàng ở trên.)');

  lines.push('');
  lines.push('HỘI THOẠI VỚI KHÁCH (tin cuối là câu hỏi mới nhất cần trả lời):');
  for (const message of messages) {
    lines.push(`${message.role === 'user' ? 'Khách' : 'Trợ lý'}: ${String(message.content).trim()}`);
  }
  lines.push('');
  lines.push('Hãy trả lời tin nhắn cuối cùng của khách theo đúng quy tắc trên.');
  return lines.join('\n');
};

/* ===== [3] GENERATE — gọi xKiro (chuẩn OpenAI: POST /v1/chat/completions) ===== */

/* Rút câu trả lời từ response chuẩn OpenAI: choices[0].message.content. */
const extractReply = (data) => {
  if (!data || typeof data !== 'object') return '';
  const choice = Array.isArray(data.choices) ? data.choices[0] : null;
  const message = choice && choice.message;
  if (!message) return '';
  if (typeof message.content === 'string') return message.content.trim();
  /* Phòng hoả: vài model trả content dạng mảng mảnh {type:"text", text}. */
  if (Array.isArray(message.content)) {
    return message.content
      .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('')
      .trim();
  }
  return '';
};

/**
 * Gọi xKiro sinh câu trả lời.
 * - Thử tối đa 2 lần: undici (fetch builtin của Node) hay gặp lỗi transient
 *   "The socket connection was closed unexpectedly" (UND_ERR_SOCKET) khi kết nối
 *   bị server/proxy chặn giữa chừng — thử lại 1 lần gần như luôn thành công.
 * - Timeout hoặc lỗi 4xx (sai key / hết credit) thì KHÔNG thử lại — vô ích.
 */
const callXkiro = async (prompt) => {
  const url = `${XKIRO_API_BASE}/chat/completions`;
  const payload = {
    model: XKIRO_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,
    max_tokens: 500,
  };
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${process.env.XKIRO_API_KEY}`,
          'User-Agent': 'do-cu-quang-huy-server/1.2',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(XKIRO_TIMEOUT_MS),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = data && data.error && data.error.message ? `: ${data.error.message}` : '';
        const err = new Error(`xKiro trả HTTP ${res.status}${detail}`);
        err.statusCode = res.status;
        throw err;
      }
      const reply = extractReply(data);
      if (reply) return reply;
      throw new Error('xKiro trả về phản hồi rỗng');
    } catch (err) {
      lastError = err;
      const timedOut = err && (err.name === 'TimeoutError' || err.name === 'AbortError');
      const clientError = err && err.statusCode >= 400 && err.statusCode < 500;
      if (timedOut || clientError) break;
      if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  throw lastError || new Error('Không gọi được xKiro');
};

/* ===== Chế độ fallback — trả lời rule-based từ kết quả truy xuất ===== */

const pickProductChips = (list) => list.slice(0, MAX_PRODUCTS_IN_REPLY)
  .map((product) => ({ id: product.id, name: product.name, price: product.price }));

const buildFallbackReply = ({ context }) => {
  const shop = knowledge.shop || {};
  const { products: matched, faqs } = context;
  const lines = [];

  for (const faq of faqs) lines.push(faq.a);

  if (matched.length) {
    if (lines.length) lines.push('');
    lines.push('Món đang có gần nhu cầu của bạn nhất:');
    matched.slice(0, MAX_PRODUCTS_IN_REPLY).forEach((product, index) => {
      lines.push(`${index + 1}. ${product.name} — ${formatVnd(product.price)}`);
    });
    lines.push('Bạn bấm vào món bên dưới để xem chi tiết nha.');
  }

  if (!lines.length) {
    lines.push('Dạ shop chưa tìm được món hoặc thông tin phù hợp câu hỏi này.');
    lines.push(`Bạn xem thêm trong mục Sản phẩm, hoặc nhắn Zalo ${shop.hotline || '0374 034 430'} để shop hỗ trợ nhanh nhé.`);
  }
  return lines.join('\n');
};

/* ===== Rate limit riêng cho /api/chat (song song với rate limit /api) ===== */

const chatBuckets = new Map();
const chatSweeper = setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of chatBuckets) {
    if (bucket.reset <= now) chatBuckets.delete(ip);
  }
}, CHAT_WINDOW_MS);
chatSweeper.unref?.();

const chatRateMax = () => {
  const raw = process.env.CHAT_RATE_MAX;
  if (raw == null || raw === '') return 12;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 1000) {
    throw new ConfigError('CHAT_RATE_MAX phải là số nguyên từ 1 đến 1000.');
  }
  return value;
};

/**
 * Tạo handler POST /api/chat. Factory nhận products từ server.js (products.json
 * chỉ đọc 1 lần ở server, tránh circular require giữa server.js ↔ lib/chat.js).
 */
const createChatHandler = ({ products: catalogProducts, getProducts }) => async (req, res) => {
  res.set('Cache-Control', 'no-store');

  try {
    /* Rate limit trước — chặn spam kể cả payload rác. */
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let bucket = chatBuckets.get(ip);
    if (!bucket || bucket.reset <= now) {
      if (chatBuckets.size >= CHAT_BUCKETS_MAX) {
        for (const [key, value] of chatBuckets) if (value.reset <= now) chatBuckets.delete(key);
        while (chatBuckets.size >= CHAT_BUCKETS_MAX) chatBuckets.delete(chatBuckets.keys().next().value);
      }
      bucket = { count: 0, reset: now + CHAT_WINDOW_MS };
      chatBuckets.set(ip, bucket);
    }
    bucket.count += 1;
    if (bucket.count > chatRateMax()) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.reset - now) / 1000))));
      return res.status(429).json({ error: 'Bạn nhắn hơi nhanh, chờ ít phút rồi hỏi tiếp nhé.' });
    }

    /* Validate payload theo hợp đồng trong docs/tasks/. */
    const problems = validateChatBody(req.body || {});
    if (problems.length) {
      return res.status(400).json({ error: 'Hội thoại chưa hợp lệ.', problems });
    }

    const messages = req.body.messages.map((message) => ({
      role: message.role,
      content: String(message.content).trim(),
    }));
    const lastUser = [...messages].reverse().find((message) => message.role === 'user');
    const currentProducts = typeof getProducts === 'function'
      ? await getProducts()
      : (Array.isArray(catalogProducts) ? catalogProducts : []);
    const context = retrieveContext({
      products: currentProducts,
      message: lastUser ? lastUser.content : '',
    });

    /* Có key + không phải môi trường test → nhờ AI trả lời; lỗi bất kỳ → fallback. */
    if (aiEnabled()) {
      try {
        const reply = await callXkiro(buildAiPrompt({ context, messages }));
        return res.json({ reply, mode: 'ai', products: pickProductChips(context.products) });
      } catch (err) {
        const code = err.statusCode || err.code || err.name || 'PROVIDER_FAILED';
        console.warn(`[chat] xKiro lỗi (${code}) — trả lời bằng chế độ fallback.`);
      }
    }

    return res.json({
      reply: buildFallbackReply({ context }),
      mode: 'fallback',
      products: pickProductChips(context.products),
    });
  } catch (err) {
    if (typeof getProducts === 'function') {
      if (!isTestRuntime()) console.error(`[chat] Không đọc được catalog: ${err.code || 'CATALOG_UNAVAILABLE'}`);
      return res.status(503).json({ error: 'Cơ sở dữ liệu tạm thời không sẵn sàng. Vui lòng thử lại sau.' });
    }
    console.error(`[chat] Lỗi xử lý: ${err.code || err.name || 'CHAT_FAILED'}`);
    return res.status(500).json({ error: 'Trợ lý đang bận, bạn thử lại sau ít phút nhé.' });
  }
};

module.exports = { createChatHandler, validateChatConfig: () => chatRateMax() };
