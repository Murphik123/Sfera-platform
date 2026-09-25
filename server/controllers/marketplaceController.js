// src/controllers/marketplaceController.js
// Маркетплейс: товары реальных пользователей, заказы из корзины.
const mongoose = require('mongoose');
const Listing = require('../models/Listing');
const Order = require('../models/Order');
const redisClient = require('../config/redis');

const CACHE_KEY = 'listings:all';

function normalizeImages(images, image) {
  const list = Array.isArray(images) && images.length ? images : (image ? [image] : []);
  return list
    .map((img) => (typeof img === 'string' ? { url: img.trim() } : img))
    .filter((img) => img && img.url);
}

function canManage(req, listing) {
  return req.user && (req.user.role === 'admin' || String(listing.seller) === String(req.userId));
}

async function clearCache() {
  try { await redisClient.del(CACHE_KEY); } catch (_) { /* noop */ }
}

// GET /api/marketplace — публично
exports.getListings = async (req, res) => {
  try {
    const cached = await redisClient.get(CACHE_KEY);
    if (cached) return res.json(JSON.parse(cached));

    const listings = await Listing.find({ status: 'active' })
      .populate('seller', 'username avatar')
      .sort({ createdAt: -1 });
    await redisClient.set(CACHE_KEY, JSON.stringify(listings), 'EX', 60 * 5);
    res.json(listings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/marketplace — продавец = текущий пользователь (из токена)
exports.createListing = async (req, res) => {
  try {
    const { title, name, description, price, category, segment, image, images, stock } = req.body;

    const listing = await Listing.create({
      seller: req.userId,
      title: String(title || name || '').trim() || 'Без названия',
      description: description || '',
      price: Math.max(0, Number(price) || 0),
      category: category || 'other',
      segment: ['b2c', 'b2b', 'b2g'].includes(segment) ? segment : 'b2c',
      stock: stock === undefined || stock === null || stock === '' ? null : Math.max(0, parseInt(stock, 10) || 0),
      images: normalizeImages(images, image)
    });

    await clearCache();
    const populated = await listing.populate('seller', 'username avatar');
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// DELETE /api/marketplace/:id — только владелец или admin
exports.deleteListing = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });

    const listing = await Listing.findById(id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (!canManage(req, listing)) return res.status(403).json({ message: 'Access denied' });

    await listing.deleteOne();
    await clearCache();
    res.json({ message: 'Listing deleted successfully', id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/marketplace/orders
//   { items: [{ listingId, qty }] }  — вся корзина одним запросом
//   { listingId, qty }               — совместимость со старым клиентом
exports.createOrder = async (req, res) => {
  try {
    const items = Array.isArray(req.body.items)
      ? req.body.items
      : [{ listingId: req.body.listingId, qty: req.body.qty }];

    if (!items.length) return res.status(400).json({ message: 'Cart is empty' });

    const orders = [];
    const errors = [];

    for (const item of items) {
      const qty = Math.max(1, parseInt(item.qty, 10) || 1);
      if (!mongoose.Types.ObjectId.isValid(String(item.listingId))) {
        errors.push({ listingId: item.listingId, message: 'Invalid listing' });
        continue;
      }
      const listing = await Listing.findById(item.listingId);
      if (!listing || listing.status !== 'active') {
        errors.push({ listingId: item.listingId, message: 'Listing not available' });
        continue;
      }
      if (String(listing.seller) === String(req.userId)) {
        errors.push({ listingId: item.listingId, message: 'You cannot buy your own listing' });
        continue;
      }
      if (listing.stock !== null && listing.stock !== undefined && listing.stock < qty) {
        errors.push({ listingId: item.listingId, message: 'Not enough stock' });
        continue;
      }

      const order = await Order.create({
        listing: listing._id,
        buyer: req.userId,
        seller: listing.seller,
        quantity: qty,
        amount: listing.price * qty
      });
      orders.push(order);

      if (listing.stock !== null && listing.stock !== undefined) {
        listing.stock -= qty;
        if (listing.stock <= 0) listing.status = 'sold';
        await listing.save();
      }

      const io = req.app.get('io');
      if (io) {
        io.to(String(listing.seller)).emit('new_order', {
          orderId: String(order._id),
          listing: listing.title,
          quantity: qty,
          amount: order.amount
        });
      }
    }

    await clearCache();

    if (!orders.length) return res.status(400).json({ message: 'No orders created', errors });
    res.status(201).json({ success: true, orders, errors });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/marketplace/orders/my — мои покупки и продажи
exports.getMyOrders = async (req, res) => {
  try {
    const [purchases, sales] = await Promise.all([
      Order.find({ buyer: req.userId }).populate('listing', 'title price').populate('seller', 'username').sort({ createdAt: -1 }),
      Order.find({ seller: req.userId }).populate('listing', 'title price').populate('buyer', 'username').sort({ createdAt: -1 })
    ]);
    res.json({ success: true, purchases, sales });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
