'use strict';

const mapPost = (row) => ({
  id: Number(row.post_id ?? row.id),
  title: row.title,
  slug: row.slug,
  excerpt: row.excerpt || '',
  content: row.content,
  image: row.image_url ?? row.image ?? null,
  createdAt: new Date(row.created_at ?? row.createdAt).toISOString(),
  updatedAt: new Date(row.updated_at ?? row.updatedAt).toISOString(),
});

const createPostsRepository = ({ pool }) => ({
  async listPublishedPosts() {
    const { rows } = await pool.query(`
      SELECT post_id, title, slug, excerpt, content, image_url, created_at, updated_at
      FROM app.admin_posts
      WHERE status = $1
      ORDER BY updated_at DESC, post_id DESC`, ['published']);
    return rows.map(mapPost);
  },
  async getPublishedPostBySlug(slug) {
    const { rows } = await pool.query(`
      SELECT post_id, title, slug, excerpt, content, image_url, created_at, updated_at
      FROM app.admin_posts
      WHERE slug = $1 AND status = $2
      LIMIT 1`, [slug, 'published']);
    return rows[0] ? mapPost(rows[0]) : null;
  },
});

module.exports = { createPostsRepository, mapPost };

