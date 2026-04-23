const mongoose = require('mongoose');

// Define the schema for shop goods
const shopGoodsSchema = new mongoose.Schema({
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

const shopGoodsModel = mongoose.model('shopGood', shopGoodsSchema,"shopGoods");

module.exports = shopGoodsModel;