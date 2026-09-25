const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Укажите название товара/услуги'],
      trim: true,
      maxlength: [120, 'Название не может превышать 120 символов']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Описание не может превышать 2000 символов']
    },
    price: {
      type: Number,
      required: [true, 'Укажите цену'],
      min: [0, 'Цена не может быть отрицательной']
    },
    currency: {
      type: String,
      default: 'TMT',
      enum: ['TMT', 'RUB', 'USD', 'EUR', 'TMPAY']
    },
    category: {
      type: String,
      trim: true,
      default: 'other'
    },
    segment: {
      type: String,
      enum: ['b2c', 'b2b', 'b2g'],
      default: 'b2c'
    },
    // null — без ограничения количества
    stock: {
      type: Number,
      default: null,
      min: 0
    },
    images: [
      {
        url: { type: String, required: true },
        public_id: { type: String }
      }
    ],
    status: {
      type: String,
      enum: ['active', 'sold', 'archived'],
      default: 'active'
    },
    viewsCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

listingSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Listing', listingSchema);
