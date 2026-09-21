import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { categoryImages } from '../data/productImages';
import '../App.css';
import './About.css';

const stats = [
  { icon: 'refresh', n: 'Hàng tuần', l: 'đợt hàng mới về kho' },
  { icon: 'cart', n: '400+', l: 'người theo dõi trên Facebook' },
  { icon: 'grid', n: '300+', l: 'món đồ luân chuyển mỗi tháng' },
  { icon: 'truck', n: '63', l: 'tỉnh thành gửi qua nhà xe' },
];

const promises = [
  'Hình thật, tình trạng thật — món nào vậy nấy',
  'Giá thanh lý rõ ràng, mua nhiều báo giá sỉ',
  'Kiểm tra hàng tại chỗ hoặc qua video trước khi nhận',
  'Nội thành giao trong ngày, tỉnh khác gửi qua nhà xe',
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
  { year: 'Nay', t: 'Kho 707 Tân Sơn — hàng về liên tục mỗi tuần.' },
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
    <section className="page-hero">
      <div>
        <p className="eyebrow">Câu chuyện</p>
        <h1>Đồ cũ còn tốt xứng đáng có cơ hội thứ hai.</h1>
        <p>Đồ Cũ Quang Huy thu mua và thanh lý đồ dùng cho quán ăn, phòng trọ, gia đình — kiểm tra kỹ, giá thật, gửi hàng toàn quốc từ Gò Vấp.</p>
        <div className="about-chips">
          <span className="about-chip">Giá thanh lý tốt</span>
          <span className="about-chip">Gửi hàng 63 tỉnh</span>
          <span className="about-chip">Xem hàng trước khi nhận</span>
        </div>
      </div>
    </section>

    <section className="about-stats" aria-label="Con số của chúng tôi">
      {stats.map((item) => (
        <div className="stat-card reveal" key={item.l}>
          <span className="stat-icon"><Icon name={item.icon} size={19} /></span>
          <strong>{item.n}</strong>
          <span>{item.l}</span>
        </div>
      ))}
    </section>

    <section className="about-story">
      <figure className="about-photo reveal">
        <img src={categoryImages['luu-tru']} alt="Hộp và bình inox 304 dùng để lưu trữ trong bếp" />
        <figcaption className="about-sticker">
          <span className="about-dot" aria-hidden="true" />
          Từ 2015 · hơn 50.000 gia đình
        </figcaption>
      </figure>
      <div className="about-copy">
        <p className="eyebrow">Chúng tôi là ai</p>
        <h2>Nhà bán nhỏ, chọn kỹ từng món.</h2>
        <p>Chúng tôi không bán mọi thứ — chỉ bán những gì đội ngũ tự dùng trong căn bếp của chính mình. Mỗi lô hàng đến đều được mở kiểm tra trước khi lên kệ.</p>
        <ul className="about-promises">
          {promises.map((item) => (
            <li key={item}><Icon name="check" size={15} />{item}</li>
          ))}
        </ul>
        <div className="about-actions">
          <Link to="/" className="btn btn-olive">Xem bộ sưu tập</Link>
          <Link to="/contact" className="text-link">Liên hệ đội tư vấn</Link>
        </div>
      </div>
    </section>

    <section className="about-values">
      <div className="about-intro">
        <p className="eyebrow">Giá trị cốt lõi</p>
        <h2>Điều chúng tôi giữ lại trong từng sản phẩm</h2>
        <p>Không chạy theo số lượng. Chúng tôi ưu tiên vật liệu đúng chuẩn, cấu trúc dễ hiểu và dịch vụ minh bạch.</p>
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