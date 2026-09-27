'use strict';

const { getServices, isReady } = require('../models');
const { databaseUnavailable } = require('./helpers');

const NOT_FOUND = 'Không tìm thấy bài viết.';
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const postsRepository = (res) => {
  const services = getServices();
  if (!services || !services.postsRepository || !isReady()) {
    databaseUnavailable(res);
    return null;
  }
  return services.postsRepository;
};

const listPosts = async (req, res, next) => {
  try {
    const repository = postsRepository(res);
    if (!repository) return;
    const posts = await repository.listPublishedPosts();
    return res.set('Cache-Control', 'public, max-age=30').json({ posts });
  } catch (error) {
    error.isDatabaseError = true;
    return next(error);
  }
};

const getPost = async (req, res, next) => {
  const slug = String(req.params.slug || '');
  if (!SLUG_PATTERN.test(slug) || slug.length > 220) {
    return res.status(400).json({ error: 'Slug bài viết không hợp lệ.' });
  }
  try {
    const repository = postsRepository(res);
    if (!repository) return;
    const post = await repository.getPublishedPostBySlug(slug);
    if (!post) return res.status(404).json({ error: NOT_FOUND });
    return res.set('Cache-Control', 'public, max-age=30').json({ post });
  } catch (error) {
    error.isDatabaseError = true;
    return next(error);
  }
};

module.exports = { listPosts, getPost };

