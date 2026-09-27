import { request } from './client';

export const getPosts = () => request('/posts');

export const getPostBySlug = (slug) => request(`/posts/${encodeURIComponent(slug)}`);
