import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs';
import { getPostBySlug, getPosts } from '../api/posts';
import { handleImgError, IMG_PLACEHOLDER, resolveImg } from '../data/productImages';
import './Posts.css';

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

const PostImage = ({ post, className = '' }) => (
  <img
    className={className}
    src={resolveImg(post.image) || IMG_PLACEHOLDER}
    alt=""
    loading="lazy"
    onError={(event) => handleImgError(event, IMG_PLACEHOLDER)}
  />
);

const PostsList = () => {
  const [posts, setPosts] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');

  const loadPosts = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const data = await getPosts();
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setState('ready');
    } catch (requestError) {
      setError(requestError.message);
      setState('error');
    }
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  return (
    <main className="container posts-page">
      <Breadcrumbs items={[{ label: 'Bài viết' }]} />
      <section className="posts-hero">
        <div>
          <p className="eyebrow">Góc chia sẻ</p>
          <h1>Những điều hữu ích trước khi chọn đồ cũ.</h1>
          <p>Gợi ý kiểm tra, chọn món và chăm đồ từ kho Đồ Cũ Quang Huy — đọc nhanh, dùng được ngay.</p>
        </div>
        <div className="posts-hero-mark" aria-hidden="true"><span>QH</span><small>đọc chậm<br />chọn kỹ</small></div>
      </section>

      {state === 'loading' && <div className="posts-grid posts-skeleton" aria-label="Đang tải bài viết" role="status">
        {[1, 2, 3].map((item) => <div className="post-skeleton-card" key={item}><span /><div><i /><i /><i /></div></div>)}
      </div>}
      {state === 'error' && <section className="posts-message" role="alert"><p className="eyebrow">Chưa tải được</p><h2>{error || 'Có lỗi khi tải bài viết.'}</h2><p>Kiểm tra kết nối rồi thử lại để xem các bài chia sẻ mới nhất.</p><button className="btn btn-primary" type="button" onClick={loadPosts}>Thử lại</button></section>}
      {state === 'ready' && posts.length === 0 && <section className="posts-message"><p className="eyebrow">Đang chuẩn bị</p><h2>Chưa có bài viết nào được đăng.</h2><p>Kho chia sẻ sẽ sớm có những mẹo chọn đồ cũ thật thực tế. Bạn có thể xem hàng đang bán trong lúc chờ.</p><Link className="btn btn-primary" to="/san-pham">Xem sản phẩm</Link></section>}
      {state === 'ready' && posts.length > 0 && <div className="posts-grid">
        {posts.map((post) => <article className="post-card reveal" key={post.id}>
          <Link className="post-card-media" to={`/bai-viet/${post.slug}`} aria-label={`Đọc ${post.title}`}><PostImage post={post} /></Link>
          <div className="post-card-body"><div className="post-meta">Bài viết <span>·</span> {formatDate(post.updatedAt || post.createdAt)}</div><h2><Link to={`/bai-viet/${post.slug}`}>{post.title}</Link></h2>{post.excerpt && <p>{post.excerpt}</p>}<Link className="post-read-more" to={`/bai-viet/${post.slug}`}>Đọc bài <span aria-hidden="true">↗</span></Link></div>
        </article>)}
      </div>}
    </main>
  );
};

const PostDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');

  const loadPost = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const data = await getPostBySlug(slug);
      setPost(data.post);
      setState('ready');
    } catch (requestError) {
      setError(requestError.message);
      setState('error');
    }
  }, [slug]);

  useEffect(() => { loadPost(); }, [loadPost]);

  if (state === 'loading') return <main className="container posts-page"><div className="post-detail-loading" role="status">Đang mở bài viết...</div></main>;
  if (state === 'error') return <main className="container posts-page"><Breadcrumbs items={[{ label: 'Bài viết', to: '/bai-viet' }, { label: 'Không tìm thấy' }]} /><section className="posts-message" role="alert"><p className="error-code">404</p><h1>Không tìm thấy bài viết</h1><p>{error || 'Bài viết này không còn được đăng công khai.'}</p><div className="post-actions"><Link className="btn btn-primary" to="/bai-viet">Xem tất cả bài viết</Link><button className="text-link" type="button" onClick={() => navigate(-1)}>Quay lại</button></div></section></main>;

  return <main className="container posts-page"><Breadcrumbs items={[{ label: 'Bài viết', to: '/bai-viet' }, { label: post.title }]} /><article className="post-detail">
    <header className="post-detail-header"><p className="eyebrow">Bài viết <span className="post-detail-date">· {formatDate(post.updatedAt || post.createdAt)}</span></p><h1>{post.title}</h1>{post.excerpt && <p className="post-lead">{post.excerpt}</p>}</header>
    <div className="post-detail-layout"><PostImage post={post} className="post-detail-image" /><div className="post-content">{String(post.content || '').split(/\r?\n/).map((paragraph, index) => paragraph.trim() ? <p key={index}>{paragraph}</p> : <br key={index} />)}</div></div>
    <Link className="post-back" to="/bai-viet">← Về danh sách bài viết</Link>
  </article></main>;
};

const Posts = () => {
  const { slug } = useParams();
  return slug ? <PostDetail /> : <PostsList />;
};

export default Posts;
