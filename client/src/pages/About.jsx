import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { categoryImages } from '../data/productImages';
import '../App.css';
import './About.css';

const stats = [
  { icon: 'refresh', n: '10+', l: 'năm kinh nghiệm' },
  { icon: 'cart', n: '50K+', l: 'gia đình đã lựa chọn' },
  { icon: 'grid', n: '500+', l: 'thiết kế trong danh mục' },
  { icon: 'truck', n: '63', l: 'tỉnh thành giao hàng' },
];

const promises = [
  'Inox 304 kiểm định an toàn thực phẩm theo từng lô',
  'Giá niêm yết rõ ràng, không phụ phí ẩn',
  'Đổi trả 30 ngày, bảo hành lỗi sản xuất 24 tháng',
  'Giao nhanh nội thành 2 giờ, toàn quốc 2–4 ngày',
];

const values = [
  { num: '01', t: 'Chất lượng có thể kiểm chứng', d: 'Mỗi sản phẩm được kiểm tra vật liệu, bề mặt và độ hoàn thiện trước khi xuất kho. Danh mục nhỏ giúp chúng tôi kiểm soát chặt từng món đồ.' },
  { num: '02', t: 'Tư vấn vừa đủ', d: 'Chúng tôi giúp bạn chọn đúng kích thước và công năng, không tạo áp lực mua thêm. Món đồ phù hợp quan trọng hơn hóa đơn lớn hơn.' },
  { num: '03', t: 'Vòng đời dài hơn', d: 'Inox bền, dễ vệ sinh và có thể tái chế, giảm nhu cầu thay mới thường xuyên. Một vật dụng dùng mười năm tốt hơn năm món dùng hai năm.' },
  { num: '04', t: 'Thiết kế để dùng mỗi ngày', d: 'Hình thức gọn gàng đi cùng thao tác cầm nắm, làm sạch và lưu trữ thuận tiện cho nhịp bếp Việt.' },
];

const timeline = [
  { year: '2015', t: 'Cửa hàng đầu tiên mở tại TP. Hồ Chí Minh.' },
  { year: '2018', t: 'Hợp tác trực tiếp với nhà máy inox 304.' },
  { year: '2021', t: 'Bắt đầu giao hàng trên toàn quốc.' },
  { year: '2026', t: 'Đồng hành cùng hơn 50.000 gia đình.' },
];

const process = [
  { num: '01', icon: 'grid', t: 'Chọn xưởng', d: 'Ghé thăm và đánh giá nhà máy đối tác theo bộ tiêu chuẩn vật liệu inox 304 trước khi ký đơn hàng đầu tiên.' },
  { num: '02', icon: 'shield', t: 'Kiểm định lô', d: 'Mỗi lô về đến kho được thử độ dày đáy, xử lý bề mặt và đối chiếu chứng nhận an toàn thực phẩm.' },
  { num: '03', icon: 'bookmark', t: 'Đóng gói kỹ', d: 'Bọc mềm từng món, cố định góc thùng để chặng đường dài không làm trầy xước sản phẩm.' },
  { num: '04', icon: 'truck', t: 'Giao & đồng hành', d: 'Giao đến tay bạn kèm hướng dẫn sử dụng, bảo hành lỗi sản xuất đến 24 tháng.' },
];

const team = [
  { initial: 'M', name: 'Anh Minh', role: 'Đồng sáng lập · Vật liệu', note: 'Người trả lời câu hỏi khó nhất: "Món này dùng được 10 năm không?"' },
  { initial: 'T', name: 'Chị Trâm', role: 'Đồng sáng lập · Trải nghiệm', note: 'Giữ tin nhắn của bạn luôn được trả lời nhẹ nhàng, không ép mua thêm.' },
  { initial: 'H', name: 'Anh Hoàng', role: 'Vận hành kho', note: 'Tự tay kiểm từng món trước khi đóng thùng gửi đi.' },
  { initial: 'L', name: 'Chị Lan', role: 'Chăm sóc sau bán hàng', note: 'Đồng hành đổi trả và bảo hành suốt vòng đời sản phẩm.' },
];

const About = () => (
  <div className="container">
    <section className="page-hero">
      <div>
        <p className="eyebrow">Câu chuyện</p>
        <h1>Một món đồ tốt xứng đáng có vòng đời dài.</h1>
        <p>Từ năm 2015, chúng tôi chọn những vật dụng inox bền, an toàn và đủ tinh gọn để hiện diện trong căn bếp Việt mỗi ngày.</p>
        <div className="about-chips">
          <span className="about-chip">Inox 304 kiểm định</span>
          <span className="about-chip">Giao hàng 63 tỉnh thành</span>
          <span className="about-chip">Đổi trả 30 ngày</span>
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
        <h2 id="process-title">Từ nhà máy đến căn bếp của bạn</h2>
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
      <h2>Từ một cửa hàng nhỏ đến mọi căn bếp</h2>
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
        <p className="cta-badge"><Icon name="spark" size={13} /><span>Bắt đầu từ căn bếp của bạn</span></p>
        <h3>Chọn một món đồ dùng thật lâu.</h3>
        <p>Bộ sưu tập inox 304 của chúng tôi luôn sẵn sàng cho nhịp bếp hằng ngày của bạn.</p>
      </div>
      <div className="cta-actions">
        <Link to="/" className="btn btn-light">Xem bộ sưu tập</Link>
      </div>
    </section>
  </div>
);

export default About;