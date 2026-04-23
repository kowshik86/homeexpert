const mongoose = require('mongoose');

// Define the schema for shop items
const shopItemsSchema = new mongoose.Schema({
  name: {
    type: [String],
    required: true,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  cost: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    default: 50,
    min: 0,
  },
  category: {
    type: String,
    default: 'uncategorized'
  },
});

const shopItemsModel = mongoose.models.shopItem || mongoose.model('shopItem', shopItemsSchema, 'shopItems');

module.exports = shopItemsModel;