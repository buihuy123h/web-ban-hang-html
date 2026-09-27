'use strict';

const { getServices } = require('../models');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { IMAGES_DIR } = require('../config');
const { databaseUnavailable } = require('./helpers');
const { adminCredentials, timingSafeEqual, createSession, setSessionCookie, clearSessionCookie, getSession } = require('../middleware/admin-auth');

const repo = (res) => { const services = getServices(); if (!services || !services.adminRepository) { databaseUnavailable(res); return null; } return services.adminRepository; };
const input = (body) => ({ name: String(body.name || '').trim(), category: String(body.category || '').trim(), price: Number(body.price), oldPrice: body.oldPrice == null ? null : Number(body.oldPrice), rating: Number(body.rating || 0), badge: body.badge || null, description: String(body.description || '').trim(), image: body.image || null });
const postInput = (body) => ({ title: String(body.title || '').trim(), slug: String(body.slug || '').trim(), excerpt: String(body.excerpt || '').trim(), content: String(body.content || '').trim(), status: body.status === 'published' ? 'published' : 'draft', image: body.image || null });
const validateProduct = (value) => (!value.name || !value.category || !value.description || !Number.isFinite(value.price) || value.price < 0 || (value.oldPrice != null && (!Number.isFinite(value.oldPrice) || value.oldPrice <= value.price)) || !Number.isFinite(value.rating) || value.rating < 0 || value.rating > 5 || (value.image && !String(value.image).startsWith('/images/')) ? 'Sản phẩm cần tên, danh mục, giá hợp lệ, mô tả và đường dẫn ảnh đúng định dạng.' : null);
const validatePost = (value) => (!value.title || !value.slug || !value.content ? 'Bài viết cần tiêu đề, đường dẫn và nội dung.' : null);

const uploadImage = async (req, res, next) => {
  try {
    const match = String(req.body?.dataUrl || '').match(/^data:(image\/(jpeg|png|webp|gif));base64,([a-z0-9+/=]+)$/i);
    if (!match) return res.status(400).json({ error: 'Ảnh không hợp lệ. Chỉ nhận JPG, PNG, WEBP hoặc GIF.' });
    const mime = match[1].toLowerCase();
    const buffer = Buffer.from(match[3], 'base64');
    if (!buffer.length || buffer.length > 5 * 1024 * 1024) return res.status(413).json({ error: 'Ảnh phải có dung lượng tối đa 5 MB.' });
    const signatures = {
      'image/jpeg': buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
      'image/png': buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      'image/webp': buffer.subarray(0, 12).toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP',
      'image/gif': buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a',
    };
    if (!signatures[mime]) return res.status(400).json({ error: 'Nội dung file không khớp định dạng ảnh.' });
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[mime];
    const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${extension}`;
    const directory = path.join(IMAGES_DIR, 'products');
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, filename), buffer, { flag: 'wx' });
    return res.status(201).json({ image: `/images/products/${filename}` });
  } catch (error) { return next(error); }
};

const login = (req, res) => {
  const body = req.body || {}; const credentials = adminCredentials();
  if (!credentials.password || !timingSafeEqual(body.username, credentials.username) || !timingSafeEqual(body.password, credentials.password)) return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
  setSessionCookie(res, createSession(credentials.username)); return res.json({ admin: { username: credentials.username } });
};
const logout = (req, res) => { const session = getSession(req); if (session) require('../middleware/admin-auth').sessions.delete(session.token); clearSessionCookie(res); return res.status(204).end(); };
const me = (req, res) => res.json({ admin: req.admin });
const listProducts = async (req, res, next) => { try { const r = repo(res); if (r) res.json({ products: await r.listProducts() }); } catch (e) { e.isDatabaseError = true; next(e); } };
const saveProduct = async (req, res, next) => { const value = input(req.body || {}); const error = validateProduct(value); if (error) return res.status(400).json({ error }); try { const r = repo(res); if (r) { const product = req.params.id ? await r.updateProduct(req.params.id, value) : await r.createProduct(value); if (!product) return res.status(404).json({ error: 'Không tìm thấy sản phẩm.' }); res.status(req.params.id ? 200 : 201).json({ product }); } } catch (e) { e.isDatabaseError = true; next(e); } };
const deleteProduct = async (req, res, next) => { try { const r = repo(res); if (r && await r.deleteProduct(req.params.id)) res.status(204).end(); else if (r) res.status(404).json({ error: 'Không tìm thấy sản phẩm.' }); } catch (e) { if (e.isBusinessError) return res.status(e.status || 409).json({ error: e.message }); e.isDatabaseError = true; next(e); } };
const listPosts = async (req, res, next) => { try { const r = repo(res); if (r) res.json({ posts: await r.listPosts() }); } catch (e) { e.isDatabaseError = true; next(e); } };
const savePost = async (req, res, next) => { const value = postInput(req.body || {}); const error = validatePost(value); if (error) return res.status(400).json({ error }); try { const r = repo(res); if (r) { const post = req.params.id ? await r.updatePost(req.params.id, value) : await r.createPost(value); if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết.' }); res.status(req.params.id ? 200 : 201).json({ post }); } } catch (e) { if (e.code === '23505') return res.status(400).json({ error: 'Slug bài viết đã tồn tại.' }); e.isDatabaseError = true; next(e); } };
const deletePost = async (req, res, next) => { try { const r = repo(res); if (r && await r.deletePost(req.params.id)) res.status(204).end(); else if (r) res.status(404).json({ error: 'Không tìm thấy bài viết.' }); } catch (e) { e.isDatabaseError = true; next(e); } };
const listOrders = async (req, res, next) => { try { const r = repo(res); if (r) res.json({ orders: await r.listOrders() }); } catch (e) { e.isDatabaseError = true; next(e); } };
const getOrder = async (req, res, next) => { try { const r = repo(res); const order = r && await r.getOrder(req.params.id); if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' }); res.json({ order }); } catch (e) { e.isDatabaseError = true; next(e); } };
const updateOrderStatus = async (req, res, next) => { const allowed = ['new', 'confirmed', 'shipping', 'completed', 'cancelled']; if (!allowed.includes(req.body && req.body.status)) return res.status(400).json({ error: 'Trạng thái đơn hàng không hợp lệ.' }); try { const r = repo(res); const order = r && await r.updateOrderStatus(req.params.id, req.body.status); if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' }); res.json({ order }); } catch (e) { e.isDatabaseError = true; next(e); } };
const getStore = async (req, res, next) => { try { const r = repo(res); if (r) res.json({ store: await r.getStore() }); } catch (e) { e.isDatabaseError = true; next(e); } };
const updateStore = async (req, res, next) => { const body = req.body || {}; if (!String(body.name || '').trim()) return res.status(400).json({ error: 'Tên cửa hàng không được để trống.' }); try { const r = repo(res); if (r) res.json({ store: await r.updateStore({ name: String(body.name).trim(), phone: String(body.phone || '').trim(), address: String(body.address || '').trim(), description: String(body.description || '').trim(), openingHours: String(body.openingHours || '').trim(), facebookUrl: String(body.facebookUrl || '').trim() }) }); } catch (e) { e.isDatabaseError = true; next(e); } };

module.exports = { login, logout, me, listProducts, saveProduct, deleteProduct, uploadImage, listPosts, savePost, deletePost, listOrders, getOrder, updateOrderStatus, getStore, updateStore };