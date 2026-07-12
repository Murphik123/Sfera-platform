const Product = require('../models/Product');

exports.getProducts = async (req, res) => {
  const { category } = req.query;
  const filter = category ? { category } : {};
  try {
    const products = await Product.find(filter).populate('sellerId', 'name');
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

exports.createProduct = async (req, res) => {
  const { name, retailPrice, wholesalePrice, image, category } = req.body;
  if (!req.user.role === 'seller' && req.user.role !== 'admin' && req.user.role !== 'both') {
    return res.status(403).json({ message: 'Недостаточно прав' });
  }
  try {
    const product = new Product({
      name,
      retailPrice,
      wholesalePrice,
      image,
      category,
      sellerId: req.user._id,
    });
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, retailPrice, wholesalePrice, image, category } = req.body;
  try {
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Товар не найден' });
    if (req.user.role !== 'admin' && product.sellerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Вы не можете редактировать этот товар' });
    }
    product.name = name || product.name;
    product.retailPrice = retailPrice || product.retailPrice;
    product.wholesalePrice = wholesalePrice || product.wholesalePrice;
    product.image = image || product.image;
    product.category = category || product.category;
    await product.save();
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

exports.deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Товар не найден' });
    if (req.user.role !== 'admin' && product.sellerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Вы не можете удалить этот товар' });
    }
    await product.deleteOne();
    res.json({ message: 'Товар удалён' });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};
