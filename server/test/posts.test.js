'use strict';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { app, configureServices } = require('../app');

let server;
let base;
const stamp = '2026-09-27T08:00:00.000Z';
const published = {
  post_id: 12, title: 'Bài đã đăng', slug: 'bai-da-dang', excerpt: 'Tóm tắt', content: 'Nội dung',
  image_url: '/images/products/post.jpg', created_at: stamp, updated_at: stamp, status: 'published',
};
const draft = { ...published, post_id: 13, title: 'Bản nháp', slug: 'ban-nhap', status: 'draft' };

const configure = (overrides = {}) => configureServices({
  isReady: () => true,
  catalogRepository: { listCategories: async () => [], listProducts: async () => [], getProductById: async () => null, listRelatedProducts: async () => [] },
  orderRepository: { createOrder: async () => null },
  postsRepository: {
    listPublishedPosts: async () => [published].map((post) => ({ id: post.post_id, title: post.title, slug: post.slug, excerpt: post.excerpt, content: post.content, image: post.image_url, createdAt: stamp, updatedAt: stamp })),
    getPublishedPostBySlug: async (slug) => slug === published.slug ? { id: published.post_id, title: published.title, slug, excerpt: published.excerpt, content: published.content, image: published.image_url, createdAt: stamp, updatedAt: stamp } : null,
    ...overrides,
  },
});

before(async () => {
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(() => configure());
after(async () => new Promise((resolve) => server.close(resolve)));

const get = async (path) => {
  const response = await fetch(`${base}${path}`);
  return { response, body: await response.json() };
};

test('public posts chỉ trả published và không cần cookie admin', async () => {
  const list = await get('/api/posts?status=draft');
  assert.equal(list.response.status, 200);
  assert.deepEqual(Object.keys(list.body), ['posts']);
  assert.equal(list.body.posts.length, 1);
  assert.equal(list.body.posts[0].slug, 'bai-da-dang');
  assert.equal(list.body.posts[0].status, undefined);
  const detail = await get('/api/posts/bai-da-dang');
  assert.equal(detail.response.status, 200);
  assert.equal(detail.body.post.content, 'Nội dung');
});

test('draft và slug không tồn tại cùng trả 404', async () => {
  const draftResponse = await get('/api/posts/ban-nhap');
  const missingResponse = await get('/api/posts/khong-ton-tai');
  assert.equal(draftResponse.response.status, 404);
  assert.deepEqual(draftResponse.body, { error: 'Không tìm thấy bài viết.' });
  assert.equal(missingResponse.response.status, 404);
  assert.deepEqual(missingResponse.body, { error: 'Không tìm thấy bài viết.' });
});

test('repository lỗi hoặc chưa sẵn sàng trả 503/no-store', async () => {
  configure({ listPublishedPosts: async () => { throw new Error('secret db'); } });
  const failed = await get('/api/posts');
  assert.equal(failed.response.status, 503);
  assert.equal(failed.response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(failed.body, { error: 'Cơ sở dữ liệu tạm thời không sẵn sàng. Vui lòng thử lại sau.' });

  configureServices({ ...getServicesForTest(), isReady: () => false });
});

function getServicesForTest() {
  return {
    isReady: () => true,
    catalogRepository: { listCategories: async () => [], listProducts: async () => [], getProductById: async () => null, listRelatedProducts: async () => [] },
    orderRepository: { createOrder: async () => null },
    postsRepository: { listPublishedPosts: async () => [], getPublishedPostBySlug: async () => null },
  };
}
