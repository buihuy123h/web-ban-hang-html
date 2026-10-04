'use strict';

const { getServices } = require('../models');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { IMAGES_DIR } = require('../config');
const { databaseUnavailable } = require('./helpers');
const { adminCredentials, timingSafeEqual, createSession, setSessionCookie, clearSessionCookie, getSession } = require('../middleware/admin-auth');

const repo = (res) => { const services = getServices(); if (!services || !services.adminRepository) { databaseUnavailable(res); return null; } return services.adminRepository; };
const input = (body) => ({ name: String(body.name || '').trim(), category: String(body.category || '').trim(), price: Number(body.price), oldPrice: body.oldPrice == null ? null : Number(body.oldPrice), costPrice: body.costPrice == null || body.costPrice === '' ? null : Number(body.costPrice), rating: Number(body.rating || 0), badge: body.badge || null, description: String(body.description || '').trim(), image: body.image || null });
const postInput = (body) => ({ title: String(body.title || '').trim(), slug: String(body.slug || '').trim(), excerpt: String(body.excerpt || '').trim(), content: String(body.content || '').trim(), status: body.status === 'published' ? 'published' : 'draft', image: body.image || null });
const validateProduct = (value) => (!value.name || !value.category || !value.description || !Number.isFinite(value.price) || value.price < 0 || (value.oldPrice != null && (!Number.isFinite(value.oldPrice) || value.oldPrice <= value.price)) || (value.costPrice != null && (!Number.isFinite(value.costPrice) || value.costPrice < 0)) || !Number.isFinite(value.rating) || value.rating < 0 || value.rating > 5 || (value.image && !String(value.image).startsWith('/images/')) ? 'Sản phẩm cần tên, danh mục, giá hợp lệ, mô tả và đường dẫn ảnh đúng định dạng.' : null);
const validatePost = (value) => (!value.title || !value.slug || !value.content ? 'Bài viết cần tiêu đề, đường dẫn và nội dung.' : null);

const slugify = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const categoryInput = (body) => ({ key: slugify(String(body.key || '')), label: String(body.label || '').trim(), image: body.image ? String(body.image).trim() : null });
const validateCategory = (value, requireKey) => {
  if (!value.label || value.label.length > 60) return 'Danh mục cần tên hiển thị tối đa 60 ký tự.';
  if (requireKey && !/^[a-z0-9-]{2,40}$/.test(value.key)) return 'Mã danh mục cần 2–40 ký tự (chữ thường, số, gạch ngang).';
  if (value.image && !/^\/images\//.test(value.image) && !/^https?:\/\//.test(value.image)) return 'Ảnh danh mục phải là đường dẫn /images/… hoặc URL http(s).';
  return null;
};

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
  setSessionCookie(req, res, createSession(credentials.username)); return res.json({ admin: { username: credentials.username } });
};
const logout = (req, res) => { const session = getSession(req); if (session) require('../middleware/admin-auth').sessions.delete(session.token); clearSessionCookie(req, res); return res.status(204).end(); };
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

const listCategories = async (req, res, next) => { try { const r = repo(res); if (r) res.json({ categories: await r.listAdminCategories() }); } catch (e) { e.isDatabaseError = true; next(e); } };
const saveCategory = async (req, res, next) => { const value = categoryInput(req.body || {}); const error = validateCategory(value, !req.params.key); if (error) return res.status(400).json({ error }); try { const r = repo(res); if (!r) return; const category = req.params.key ? await r.updateCategory(req.params.key, value) : await r.createCategory(value); if (!category) return res.status(404).json({ error: 'Không tìm thấy danh mục.' }); res.status(req.params.key ? 200 : 201).json({ category }); } catch (e) { if (e.code === '23505') return res.status(400).json({ error: 'Mã danh mục đã tồn tại.' }); e.isDatabaseError = true; next(e); } };
const deleteCategory = async (req, res, next) => { try { const r = repo(res); if (r && await r.deleteCategory(req.params.key)) res.status(204).end(); else if (r) res.status(404).json({ error: 'Không tìm thấy danh mục.' }); } catch (e) { if (e.isBusinessError) return res.status(e.status || 409).json({ error: e.message }); e.isDatabaseError = true; next(e); } };

const FEEDBACK_STATUSES = ['new', 'read', 'replied'];
const feedbackInput = (body) => ({ customerName: String(body.customerName || '').trim(), phone: String(body.phone || '').trim(), message: String(body.message || '').trim(), rating: Number(body.rating || 5) });
const validateFeedback = (value) => (!value.customerName || value.customerName.length > 120 || !value.message || value.message.length > 1000 || !Number.isFinite(value.rating) || value.rating < 1 || value.rating > 5 ? 'Phản hồi cần tên khách (≤120 ký tự), nội dung (≤1000 ký tự) và điểm đánh giá 1–5.' : null);
const systemInput = (body) => ({ shippingFee: Number(body.shippingFee), freeShippingThreshold: Number(body.freeShippingThreshold), maintenanceMode: !!body.maintenanceMode, announcement: String(body.announcement || '').trim() });
const validateSystem = (value) => (!Number.isFinite(value.shippingFee) || value.shippingFee < 0 || !Number.isFinite(value.freeShippingThreshold) || value.freeShippingThreshold < 0 ? 'Phí ship và ngưỡng miễn phí ship phải là số không âm.' : null);
const mapSystem = (row) => ({ shippingFee: Number(row.shipping_fee), freeShippingThreshold: Number(row.free_shipping_threshold), maintenanceMode: !!row.maintenance_mode, announcement: row.announcement || '', updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null });

const listCustomers = async (req, res, next) => { try { const r = repo(res); if (r) res.json({ customers: await r.listCustomers() }); } catch (e) { e.isDatabaseError = true; next(e); } };
const listFeedback = async (req, res, next) => { try { const r = repo(res); if (r) res.json({ feedback: await r.listFeedback() }); } catch (e) { e.isDatabaseError = true; next(e); } };
const saveFeedback = async (req, res, next) => { const value = feedbackInput(req.body || {}); const error = validateFeedback(value); if (error) return res.status(400).json({ error }); try { const r = repo(res); if (r) res.status(201).json({ feedback: await r.createFeedback(value) }); } catch (e) { e.isDatabaseError = true; next(e); } };
const updateFeedbackStatus = async (req, res, next) => { if (!FEEDBACK_STATUSES.includes(req.body && req.body.status)) return res.status(400).json({ error: 'Trạng thái phản hồi không hợp lệ.' }); try { const r = repo(res); const item = r && await r.updateFeedbackStatus(req.params.id, req.body.status); if (!item) return res.status(404).json({ error: 'Không tìm thấy phản hồi.' }); res.json({ feedback: item }); } catch (e) { e.isDatabaseError = true; next(e); } };
const deleteFeedback = async (req, res, next) => { try { const r = repo(res); if (r && await r.deleteFeedback(req.params.id)) res.status(204).end(); else if (r) res.status(404).json({ error: 'Không tìm thấy phản hồi.' }); } catch (e) { e.isDatabaseError = true; next(e); } };
const profitReport = async (req, res, next) => { try { const r = repo(res); if (r) res.json({ report: await r.getProfitReport() }); } catch (e) { e.isDatabaseError = true; next(e); } };
const getSystem = async (req, res, next) => { try { const r = repo(res); if (!r) return; const row = await r.getSystem(); if (!row) return res.status(404).json({ error: 'Chưa có cấu hình hệ thống.' }); res.json({ settings: mapSystem(row) }); } catch (e) { e.isDatabaseError = true; next(e); } };
const updateSystem = async (req, res, next) => { const value = systemInput(req.body || {}); const error = validateSystem(value); if (error) return res.status(400).json({ error }); try { const r = repo(res); if (r) res.json({ settings: mapSystem(await r.updateSystem(value)) }); } catch (e) { e.isDatabaseError = true; next(e); } };

module.exports = { login, logout, me, listProducts, saveProduct, deleteProduct, uploadImage, listPosts, savePost, deletePost, listOrders, getOrder, updateOrderStatus, getStore, updateStore, listCategories, saveCategory, deleteCategory, listCustomers, listFeedback, saveFeedback, updateFeedbackStatus, deleteFeedback, profitReport, getSystem, updateSystem };