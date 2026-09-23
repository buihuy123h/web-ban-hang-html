import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { sendChat } from '../api/chat';
import { formatPrice } from '../utils/format';
import './ChatWidget.css';

/* ===== Trợ lý AI chat — panel nổi mở từ nút "Hỏi trợ lý AI" của ContactFab =====
 * Gọi POST /api/chat (RAG phía backend): không cần XKIRO_API_KEY server vẫn trả
 * lời rule-based (mode "fallback") — UI hiển thị như nhau, chỉ gắn nhãn nhỏ để
 * chủ shop biết AI chưa được bật. Hội thoại chỉ giữ trong RAM của tab. */

const GREETING = {
  role: 'assistant',
  content: 'Dạ chào bạn! Mình là trợ lý AI của Đồ Cũ Quang Huy — hỏi về món đồ, giá, giao hàng hay thu mua đồ cũ đều được nha.',
};

const SAMPLE_QUESTIONS = [
  'Còn ghế nhựa cho quán không?',
  'Ship về Gò Vấp phí bao nhiêu?',
  'Freeship từ bao nhiêu tiền?',
  'Shop có thu mua đồ cũ không?',
];

const MAX_INPUT_CHARS = 1000; // khớp validate phía backend
const MAX_HISTORY = 20;      // khớp validate phía backend

const ChatWidget = ({ open, onClose }) => {
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  /* Mở panel → focus ô nhập; có tin mới → tự cuộn xuống cuối danh sách. */
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending, error, open]);

  /* Esc → đóng mà không cần chuột. */
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const send = async (rawText) => {
    const content = String(rawText ?? input).trim();
    if (!content || sending) return;

    const nextMessages = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setInput('');
    setError('');
    setSending(true);

    try {
      const history = nextMessages
        .filter((message) => message.content)
        .slice(-MAX_HISTORY)
        .map((message) => ({ role: message.role, content: message.content }));
      const data = await sendChat(history);
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: data.reply,
        products: Array.isArray(data.products) ? data.products : [],
        mode: data.mode,
      }]);
    } catch (err) {
      /* Backend 4xx/5xx/mạng → bong bóng lỗi thân thiện + focus lại ô nhập. */
      setError(err && err.message ? err.message : 'Không gửi được tin nhắn, bạn thử lại nhé.');
      inputRef.current?.focus();
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  const showSuggestions = messages.length === 1 && !sending;

  return (
    <section className="chat-panel" role="dialog" aria-label="Trò chuyện với trợ lý AI">
      <header className="chat-head">
        <span className="chat-head-ic" aria-hidden="true">
          <Icon name="spark" size={22} />
        </span>
        <div className="chat-head-tx">
          <strong>Trợ lý AI</strong>
          <small>Đồ Cũ Quang Huy · trả lời theo dữ liệu shop</small>
        </div>
        <button type="button" className="chat-close" onClick={onClose} aria-label="Đóng trò chuyện">
          <Icon name="close" size={19} strokeWidth={2} />
        </button>
      </header>

      <div className="chat-body" ref={bodyRef} aria-live="polite">
        {messages.map((message, index) => (
          <div key={index} className={`chat-row ${message.role === 'user' ? 'mine' : 'bot'}`}>
            <div className="chat-bubble">
              {message.content}
              {message.mode === 'fallback' ? <span className="chat-mode">chế độ cơ bản</span> : null}
              {Array.isArray(message.products) && message.products.length > 0 ? (
                <div className="chat-chips">
                  {message.products.map((product) => (
                    <Link
                      key={product.id}
                      className="chat-chip"
                      to={`/product/${product.id}`}
                      onClick={onClose}
                    >
                      <span className="chat-chip-name">{product.name}</span>
                      <span className="chat-chip-price">{formatPrice(product.price)}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {sending ? (
          <div className="chat-row bot">
            <div className="chat-bubble chat-typing" role="status" aria-label="Trợ lý đang soạn câu trả lời">
              <span /><span /><span />
            </div>
          </div>
        ) : null}

        {error ? <p className="chat-error" role="alert">{error}</p> : null}
      </div>

      {showSuggestions ? (
        <div className="chat-suggest" aria-label="Câu hỏi gợi ý">
          {SAMPLE_QUESTIONS.map((question) => (
            <button key={question} type="button" onClick={() => send(question)}>
              {question}
            </button>
          ))}
        </div>
      ) : null}

      <form className="chat-form" onSubmit={(event) => { event.preventDefault(); send(); }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          maxLength={MAX_INPUT_CHARS}
          placeholder="Hỏi về món đồ, giá, giao hàng…"
          aria-label="Nội dung câu hỏi"
          disabled={sending}
          onChange={(event) => setInput(event.target.value)}
        />
        <button type="submit" disabled={sending || !input.trim()} aria-label="Gửi câu hỏi">
          <Icon name="send" size={19} />
        </button>
      </form>

      <footer className="chat-foot">
        Trợ lý trả lời theo dữ liệu shop — cần chính xác hơn, nhắn Zalo 0374 034 430.
      </footer>
    </section>
  );
};

export default ChatWidget;