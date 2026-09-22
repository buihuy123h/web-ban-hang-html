import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import Icon from '../components/Icon';
import '../App.css';
import './Contact.css';

const services = [
  { icon: 'spark', title: 'Tư vấn & báo giá', desc: 'Gửi ảnh hoặc danh sách món cần, báo giá nhanh trong ít phút.' },
  { icon: 'truck', title: 'Giao & gửi xe', desc: 'Nội thành giao trong ngày, tỉnh khác gửi qua nhà xe giá rẻ.' },
  { icon: 'refresh', title: 'Thu mua & thanh lý', desc: 'Thu mua đồ cũ quán xá, nhà trọ — trả giá tốt, dọn sạch nơi giao.' },
  { icon: 'shield', title: 'Kiểm tra tại chỗ', desc: 'Xem hàng trực tiếp hoặc nhận video thử hàng trước khi chốt.' },
];

const channels = [
  { icon: 'phone', label: 'Gọi điện', value: '0374 034 430', href: 'tel:0374034430', note: 'Gọi trực tiếp từ 08:00 đến 21:00 mỗi ngày' },
  { icon: 'zalo', label: 'Zalo', value: '0374 034 430', href: 'https://zalo.me/0374034430', note: 'Nhắn tin Zalo — báo giá nhanh trong ít phút' },
  { icon: 'messenger', label: 'Messenger', value: 'Chat với shop', href: 'https://m.me/100090912844650', note: 'Nhắn tin Facebook, xem hàng mới về mỗi tuần' },
  { icon: 'facebook', label: 'Facebook', value: 'Đồ Cũ Quang Huy · Fanpage', href: 'https://www.facebook.com/profile.php?id=100090912844650', note: 'Theo dõi fanpage để không lỡ đợt hàng mới' },
  { icon: 'tiktok', label: 'TikTok', value: '@cquanghuy8', href: 'https://www.tiktok.com/@cquanghuy8', note: 'Video hàng mới về trong kho mỗi tuần' },
  { icon: 'tiktok', label: 'TikTok', value: '@nguyn.loi49', href: 'https://www.tiktok.com/@nguyn.loi49', note: 'Kênh phụ — quay hàng thật, chốt giá nhanh' },
  { icon: 'pin', label: 'Showroom', value: '707 Tân Sơn, P. An Hội Tây, Gò Vấp, TP.HCM', note: 'Mở cửa 08:00 đến 21:00, có chỗ để xe' },
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
    <main className="container">
      <section className="page-hero">
        <div>
          <p className="eyebrow">Liên hệ &amp; hỗ trợ</p>
          <h1>Cần đồ cũ giá tốt? Nhắn một tiếng, báo giá liền.</h1>
          <p>Chúng tôi hỗ trợ chọn món, báo giá sỉ cho quán ăn — phòng trọ, kiểm tra đơn và gửi hàng qua nhà xe toàn quốc.</p>
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
            <div className="channel" key={`${channel.label}-${channel.value}`}>
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

      <section className="map-section" aria-labelledby="map-title">
        <div className="map-info">
          <span className="eyebrow">Đến tận nơi</span>
          <h2 id="map-title">Ghé kho đồ cũ tại Gò Vấp</h2>
          <p>Sẵn sàng cho bạn xem trực tiếp từng món trước khi chốt. Hàng về liên tục mỗi tuần, số lượng mỗi đợt có hạn — đến sớm kẻo lỡ món ưng ý.</p>
          <ul className="map-points">
            <li><Icon name="pin" size={15} />707 Tân Sơn, P. An Hội Tây, Gò Vấp, TP.HCM</li>
            <li><Icon name="clock" size={15} />Mở cửa 08:00 đến 21:00 mỗi ngày</li>
            <li><Icon name="truck" size={15} />Gửi hàng qua nhà xe toàn quốc</li>
          </ul>
          <a
            className="btn btn-olive"
            href="https://www.google.com/maps/dir/?api=1&destination=707%20T%C3%A2n%20S%C6%A1n%2C%20G%C3%B2%20V%E1%BA%A5p%2C%20TP.HCM"
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="pin" size={16} />
            Chỉ đường trên Google Maps
          </a>
        </div>
        <iframe
          className="map-embed"
          title="Bản đồ kho Đồ Cũ Quang Huy tại 707 Tân Sơn, Gò Vấp"
          src="https://www.google.com/maps?q=707%20T%C3%A2n%20S%C6%A1n%2C%20ph%C6%B0%E1%BB%9Dng%20An%20H%E1%BB%99i%20T%C3%A2y%2C%20G%C3%B2%20V%E1%BA%A5p%2C%20TP.%20HCM&z=16&output=embed"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </section>
    </main>
  );
};

export default Contact;