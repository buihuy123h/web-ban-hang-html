import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import Icon from '../components/Icon';
import '../App.css';
import './Contact.css';

const services = [
  { icon: 'spark', title: 'Tư vấn chọn đồ', desc: 'Chọn đúng kích thước và chất liệu cho nhu cầu của bạn.' },
  { icon: 'truck', title: 'Kiểm tra đơn hàng', desc: 'Cập nhật tình trạng giao nhận theo từng đơn.' },
  { icon: 'shield', title: 'Bảo hành', desc: 'Tiếp nhận yêu cầu bảo hành trong 24 tháng.' },
  { icon: 'refresh', title: 'Đổi trả', desc: 'Xử lý đổi trả trong 30 ngày theo điều khoản.' },
];

const channels = [
  { icon: 'phone', label: 'Hotline', value: '1900 1234', href: 'tel:19001234', note: '08:00 đến 21:00 mỗi ngày' },
  { icon: 'mail', label: 'Email', value: 'hello@doinox.vn', href: 'mailto:hello@doinox.vn', note: 'Phản hồi trong vòng 24 giờ' },
  { icon: 'pin', label: 'Showroom', value: '123 Nguyễn Văn Cừ, Quận 1, TP.HCM', note: 'Mở cửa 08:00 đến 21:00' },
];

const Contact = () => {
  const [form, setForm] = useState({ name: '', phone: '', message: '' });
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);
  const { showToast } = useCart();
  const set = (key) => (event) => { setForm({ ...form, [key]: event.target.value }); setErrors({ ...errors, [key]: undefined }); };
  const submit = (event) => {
    event.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'Vui lòng nhập họ tên.';
    if (!/^0\d{9}$/.test(form.phone.trim())) next.phone = 'Nhập số điện thoại 10 số, bắt đầu bằng 0.';
    if (form.message.trim().length < 10) next.message = 'Nội dung cần ít nhất 10 ký tự.';
    setErrors(next);
    if (Object.keys(next).length) {
      requestAnimationFrame(() => document.querySelector('.contact-form [aria-invalid="true"]')?.focus());
      return;
    }
    setSent(true);
    showToast('Tin nhắn đã được gửi.');
  };

  return (
    <div className="container">
      <section className="page-hero">
        <div>
          <p className="eyebrow">Liên hệ &amp; hỗ trợ</p>
          <h1>Cùng tìm món đồ phù hợp cho căn bếp của bạn.</h1>
          <p>Đội ngũ của chúng tôi hỗ trợ chọn kích thước, chất liệu, kiểm tra đơn hàng và chính sách bảo hành.</p>
        </div>
      </section>

      <section className="service-cards" aria-label="Dịch vụ hỗ trợ">
        {services.map((service) => (
          <article className="service-card reveal" key={service.title}>
            <span className="sc-icon"><Icon name={service.icon} size={19} /></span>
            <div>
              <strong>{service.title}</strong>
              <span>{service.desc}</span>
            </div>
          </article>
        ))}
      </section>

      <div className="contact-grid">
        <div className="contact-form-wrap">
          <span className="eyebrow">Gửi lời nhắn</span>
          <h2>Bạn đang cần tư vấn điều gì?</h2>
          <p>Điền thông tin bên dưới, chúng tôi sẽ liên hệ lại trong vòng 24 giờ làm việc.</p>
          <form className="contact-form panel" onSubmit={submit} noValidate>
            {sent ? (
              <div className="form-success">
                <span className="success-mark"><Icon name="check" size={22} strokeWidth={2.4} /></span>
                <h3>Đã gửi thành công</h3>
                <p>Cảm ơn {form.name}. Chúng tôi sẽ liên hệ lại trong vòng 24 giờ.</p>
                <button type="button" className="btn btn-outline" onClick={() => { setSent(false); setForm({ name: '', phone: '', message: '' }); }}>Gửi tin nhắn khác</button>
              </div>
            ) : (
              <>
                <label>Họ và tên
                  <input type="text" value={form.name} onChange={set('name')} autoComplete="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'contact-name-error' : undefined} />
                  {errors.name && <em className="err" id="contact-name-error">{errors.name}</em>}
                </label>
                <label>Số điện thoại
                  <input type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" inputMode="numeric" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'contact-phone-error' : undefined} />
                  {errors.phone && <em className="err" id="contact-phone-error">{errors.phone}</em>}
                </label>
                <label>Nội dung
                  <textarea rows="6" value={form.message} onChange={set('message')} placeholder="Bạn đang cần tư vấn sản phẩm nào?" aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'contact-message-error' : undefined} />
                  {errors.message && <em className="err" id="contact-message-error">{errors.message}</em>}
                </label>
                <button type="submit" className="btn btn-primary">
                  <Icon name="send" size={16} />
                  Gửi tin nhắn
                </button>
              </>
            )}
          </form>
        </div>

        <aside className="contact-info" aria-label="Kênh hỗ trợ trực tiếp">
          <span className="eyebrow">Kênh hỗ trợ trực tiếp</span>
          {channels.map((channel) => (
            <div className="channel" key={channel.label}>
              <span className="ch-icon"><Icon name={channel.icon} size={19} /></span>
              <div>
                <span className="ch-label">{channel.label}</span>
                {channel.href
                  ? <a href={channel.href}>{channel.value}</a>
                  : <p>{channel.value}</p>}
                <small>{channel.note}</small>
              </div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
};

export default Contact;