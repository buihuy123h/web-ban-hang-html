import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import Breadcrumbs from '../components/Breadcrumbs';
import CountUp from '../components/CountUp';
import { categoryImages } from '../data/productImages';
import '../App.css';
import './About.css';

const stats = [
  { icon: 'refresh', text: 'Hàng tuần', l: 'đợt hàng mới về kho' },
  { icon: 'cart', count: 421, suffix: '', l: 'người theo dõi Facebook khi quét' },
  { icon: 'pin', text: 'Gò Vấp', l: 'khu vực hoạt động công khai' },
  { icon: 'phone', text: '0374 034 430', l: 'số liên hệ được đăng công khai' },
];

const promises = [
  'Hình thật, tình trạng thật — món nào vậy nấy',
  'Giá thanh lý rõ ràng, mua nhiều báo giá sỉ',
  'Kiểm tra hàng tại chỗ hoặc qua video trước khi nhận',
  'Hỏi shop cách nhận hàng phù hợp với từng món',
];

const values = [
  { num: '01', t: 'Chất lượng có thể kiểm chứng', d: 'Mỗi món được thử tại chỗ: ghế chịu tải, quạt chạy êm, nồi dùng được trên bếp. Không đạt thì không lên web.' },
  { num: '02', t: 'Tư vấn vừa đủ', d: 'Bạn mô tả nhu cầu, bên mình gợi ý món phù hợp và báo giá thật. Không ép mua thêm món nào.' },
  { num: '03', t: 'Đồ cũ cũng phải sạch', d: 'Mọi món được vệ sinh, khử mùi trước khi giao. Đồ dùng ăn uống được cọ kỹ hơn nữa trước khi bàn giao.' },
  { num: '04', t: 'Giá cho người mở quán', d: 'Trọng tâm là đồ dùng quán ăn và phòng trọ: mua càng nhiều giá càng tốt, hỗ trợ giao tận nơi trong nội thành.' },
];

const timeline = [
  { year: 'Khởi đầu', t: 'Nhận thanh lý quán xá, nhà trọ quanh Gò Vấp.' },
  { year: 'Mở rộng', t: 'Đủ đồ cho quán ăn, nhà hàng, trà sữa mới mở.' },
  { year: 'Online', t: 'Bán qua Facebook, gửi hàng qua nhà xe toàn quốc.' },
  { year: 'Nay', t: 'Shop công khai địa chỉ 707 Tân Sơn, phường An Hội Tây, Gò Vấp và cập nhật hàng trên Facebook.' },
];

const process = [
  { num: '01', icon: 'grid', t: 'Thu mua chắt lọc', d: 'Duyệt từng đợt thanh lý từ quán xá, nhà trọ. Chỉ chọn món còn dùng tốt, giá mua hợp lý để bán ra cũng hợp lý.' },
  { num: '02', icon: 'shield', t: 'Kiểm tra & vệ sinh', d: 'Thử hoạt động tại chỗ, vệ sinh sạch sẽ rồi chụp ảnh thật — món nào đăng đúng món đó.' },
  { num: '03', icon: 'bookmark', t: 'Niêm yết & chốt đơn', d: 'Giá rõ ràng trên web và fanpage. Ở xa có thể xin video thử hàng trước khi chốt.' },
  { num: '04', icon: 'truck', t: 'Đóng gói & gửi xe', d: 'Bọc kỹ, đóng thùng chắc. Nội thành giao trong ngày, tỉnh khác gửi qua nhà xe kèm mã bến.' },
];

const team = [
  { initial: 'H', name: 'Anh Huy', role: 'Chủ shop · Báo giá', note: 'Người trả lời tin nhắn và chốt giá — nhanh, gọn, nhiệt tình.' },
  { initial: 'L', name: 'Anh Lợi', role: 'Thu mua · Đi hàng', note: 'Duyệt từng đợt thanh lý, chọn ra món đáng tiền nhất.' },
  { initial: 'V', name: 'Anh Vinh', role: 'Kiểm tra · Vệ sinh', note: 'Thử đồ tay trước, lau chùi sạch sẽ sau.' },
  { initial: 'T', name: 'Chị Trang', role: 'Đơn hàng · Gửi xe', note: 'Đóng gói, ghi mã bến và theo đơn đến khi khách nhận hàng.' },
];

const About = () => (
  <main className="container">
    <Breadcrumbs items={[{ label: 'Câu chuyện' }]} />
    <section className="page-hero">
      <div>
        <p className="eyebrow">Câu chuyện</p>
        <h1>Đồ cũ còn tốt xứng đáng có cơ hội thứ hai.</h1>
        <p>Đồ Cũ Quang Huy chuyên mua và bán đồ cũ: đi thu mua từng đợt thanh lý quán xá, nhà trọ — rồi kiểm tra, vệ sinh và bán lại với giá thật cho người cần mở quán, thuê trọ. Kho tại Gò Vấp, gửi hàng qua nhà xe toàn quốc.</p>
        <div className="about-chips">
          <span className="about-chip">Chuyên mua &amp; bán đồ cũ</span>
          <span className="about-chip">Kho 707 Tân Sơn, Gò Vấp</span>
          <span className="about-chip">Gửi hàng 63 tỉnh</span>
          <span className="about-chip">Xem hàng trước khi nhận</span>
        </div>
      </div>
    </section>

    <section className="about-stats" aria-label="Con số của chúng tôi">
      {stats.map((item) => (
        <div className="stat-card reveal" key={item.l}>
          <span className="stat-icon"><Icon name={item.icon} size={19} /></span>
          <strong>{item.count === undefined ? item.text : <CountUp end={item.count} suffix={item.suffix} />}</strong>
          <span>{item.l}</span>
        </div>
      ))}
    </section>

    <section className="about-story">
      <figure className="about-photo reveal">
        <img src={categoryImages['luu-tru']} alt="Kệ inox và đồ dùng quán ăn tại kho Đồ Cũ Quang Huy, Gò Vấp" />
        <figcaption className="about-sticker">
          <span className="about-dot" aria-hidden="true" />
          Kho 707 Tân Sơn · Gò Vấp, TP.HCM
        </figcaption>
      </figure>
      <div className="about-copy">
        <p className="eyebrow">Chúng tôi là ai</p>
        <h2>Mua tận nơi, bán bằng giá thật.</h2>
        <p>Bên mình đi từng quán xá đóng cửa, nhà trọ trả phòng để thu mua đồ. Món nào còn dùng tốt được giữ lại, vệ sinh sạch rồi mới đăng bán — món nào hư nặng thì bỏ, không bán gửi ai. Mở quán, mở trọ cần gì cứ nhắn: ghế nhựa, kệ inox, giường tầng, nồi chảo... hầu hết có sẵn ở kho.</p>
        <ul className="about-promises">
          {promises.map((item) => (
            <li key={item}><Icon name="check" size={15} />{item}</li>
          ))}
        </ul>
        <div className="about-actions">
          <Link to="/san-pham" className="btn btn-olive">Xem hàng đang bán</Link>
          <Link to="/contact" className="text-link">Liên hệ đội tư vấn</Link>
          <a href="https://www.facebook.com/profile.php?id=100090912844650" target="_blank" rel="noreferrer" className="text-link">Fanpage Facebook</a>
        </div>
      </div>
    </section>

    <section className="about-values">
      <div className="about-intro">
        <p className="eyebrow">Giá trị cốt lõi</p>
        <h2>Điều chúng tôi giữ lại trong từng sản phẩm</h2>
        <p>Không đếm số món bán được — chỉ cần bạn lấy về dùng thật, dùng bền, rồi quay lại mua tiếp. Đó là cách một shop đồ cũ sống lâu.</p>
      </div>
      <div className="value-list">
        {values.map((value) => (
          <article className="value-card" key={value.num}>
            <span className="value-num">{value.num}</span>
            <div>
              <h3>{value.t}</h3>
              <p>{value.d}</p>
            </div>
          </article>
        ))}
      </div>
    </section>

    <section className="about-process" aria-labelledby="process-title">
      <div className="section-head">
        <p className="eyebrow">Quy trình</p>
        <h2 id="process-title">Từ nguồn thanh lý đến tay bạn</h2>
        <p>Cùng một quy trình cho mọi món đồ — không có ngoại lệ.</p>
      </div>
      <div className="process-grid">
        {process.map((step) => (
          <article className="pr-card reveal" key={step.num}>
            <div className="pr-head">
              <span className="pr-num">{step.num}</span>
              <span className="pr-icon"><Icon name={step.icon} size={19} /></span>
            </div>
            <h3>{step.t}</h3>
            <p>{step.d}</p>
          </article>
        ))}
      </div>
    </section>

    <section className="about-journey">
      <p className="eyebrow">Hành trình</p>
      <h2>Từ vài món thanh lý đến kho luôn đầy</h2>
      <div className="timeline">
        {timeline.map((item) => (
          <div className="tl-item" key={item.year}>
            <span className="tl-year">{item.year}</span>
            <p>{item.t}</p>
          </div>
        ))}
      </div>
    </section>

    <section className="about-team-wrap" aria-labelledby="team-title">
      <div className="section-head">
        <p className="eyebrow">Đội ngũ</p>
        <h2 id="team-title">Những người đứng sau từng món đồ</h2>
        <p>Một nhóm nhỏ đảm nhận mọi việc, từ chọn hàng đến trả lời tin nhắn của bạn.</p>
      </div>
      <div className="about-team">
        {team.map((member) => (
          <article className="team-card" key={member.name}>
            <span className="team-avatar">{member.initial}</span>
            <h3>{member.name}</h3>
            <span className="team-role">{member.role}</span>
            <p>{member.note}</p>
          </article>
        ))}
      </div>
    </section>

    <section className="cta-banner">
      <div className="cta-glow" aria-hidden="true" />
      <div className="cta-content">
        <p className="cta-badge"><Icon name="spark" size={13} /><span>Đợt hàng mới đã về kho</span></p>
        <h3>Chọn một món đồ cũ còn thật tốt.</h3>
        <p>Kho đồ cũ tại Gò Vấp luôn sẵn hàng cho quán và gia đình — ghé xem trực tiếp hoặc nhắn để được báo giá ngay.</p>
      </div>
      <div className="cta-actions">
        <Link to="/" className="btn btn-light">Xem bộ sưu tập</Link>
      </div>
    </section>
  </main>
);

export default About;