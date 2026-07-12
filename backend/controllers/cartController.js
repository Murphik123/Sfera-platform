const Cart = require('../models/Cart');
const Product = require('../models/Product');

exports.getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');
    if (!cart) {
      cart = new Cart({ userId: req.user._id, items: [] });
      await cart.save();
    }
    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

exports.addToCart = async (req, res) => {
  const { productId, purchaseType, quantity } = req.body;
  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Товар не найден' });
    let cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) {
      cart = new Cart({ userId: req.user._id, items: [] });
    }
    const price = purchaseType === 'retail' ? product.retailPrice : product.wholesalePrice;
    const existingItem = cart.items.find(item => item.productId.toString() === productId && item.purchaseType === purchaseType);
    if (existingItem) {
      existingItem.quantity += quantity || 1;
    } else {
      cart.items.push({
        productId,
        name: product.name,
        price,
        purchaseType,
        quantity: quantity || 1,
      });
    }
    cart.updatedAt = Date.now();
    await cart.save();
    await cart.populate('items.productId');
    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

exports.clearCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ userId: req.user._id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }
    res.json({ message: 'Корзина очищена' });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};
