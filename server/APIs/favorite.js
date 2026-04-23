const express = require('express');
const favoriteApp = express.Router();
const favoriteModel = require('../models/favoriteModel');
const userModel = require('../models/userModel');
const shopItemsModel = require('../models/shopItemsModel');
const shopGoodsModel = require('../models/shopGoodsModel');
const expressAsyncHandler = require('express-async-handler');

// Add a product to favorites
favoriteApp.post('/favorite', expressAsyncHandler(async (req, res) => {
  try {
    const { userId, productId, productType } = req.body;
    
    // Validate user exists
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }
    
    // Check if product exists
    let product;
    if (productType === 'shopItem') {
      product = await shopItemsModel.findById(productId);
    } else if (productType === 'shopGood') {
      product = await shopGoodsModel.findById(productId);
    }
    
    if (!product) {
      return res.status(404).send({ message: "Product not found" });
    }
    
    // Check if already in favorites
    const existingFavorite = await favoriteModel.findOne({ userId, productId });
    if (existingFavorite) {
      return res.status(400).send({ message: "Product already in favorites" });
    }
    
    // Create new favorite
    const newFavorite = new favoriteModel({
      userId,
      productId,
      productType,
      name: Array.isArray(product.name) ? product.name[0] : product.name,
      imageUrl: product.imageUrl,
      price: product.cost
    });
    
    const savedFavorite = await newFavorite.save();
    
    res.status(201).send({ 
      message: "Product added to favorites successfully", 
      payload: savedFavorite 
    });
  } catch (error) {
    res.status(500).send({ 
      message: "Failed to add product to favorites", 
      error: error.message 
    });
  }
}));

// Get all favorites for a user
favoriteApp.get('/favorites/:userId', expressAsyncHandler(async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Find all favorites for the user
    const favorites = await favoriteModel.find({ userId }).sort({ addedAt: -1 });
    
    res.status(200).send({ 
      message: "Favorites fetched successfully", 
      payload: favorites 
    });
  } catch (error) {
    res.status(500).send({ 
      message: "Failed to fetch favorites", 
      error: error.message 
    });
  }
}));

// Check if a product is in favorites
favoriteApp.get('/favorite/check', expressAsyncHandler(async (req, res) => {
  try {
    const { userId, productId } = req.query;
    
    // Check if in favorites
    const favorite = await favoriteModel.findOne({ userId, productId });
    
    res.status(200).send({ 
      message: "Favorite status checked successfully", 
      isFavorite: !!favorite,
      payload: favorite 
    });
  } catch (error) {
    res.status(500).send({ 
      message: "Failed to check favorite status", 
      error: error.message 
    });
  }
}));

// Remove a product from favorites
favoriteApp.delete('/favorite/:favoriteId', expressAsyncHandler(async (req, res) => {
  try {
    const favoriteId = req.params.favoriteId;
    
    // Find and delete the favorite
    const deletedFavorite = await favoriteModel.findByIdAndDelete(favoriteId);
    
    if (!deletedFavorite) {
      return res.status(404).send({ message: "Favorite not found" });
    }
    
    res.status(200).send({ 
      message: "Product removed from favorites successfully", 
      payload: deletedFavorite 
    });
  } catch (error) {
    res.status(500).send({ 
      message: "Failed to remove product from favorites", 
      error: error.message 
    });
  }
}));

// Remove a product from favorites by product ID
favoriteApp.delete('/favorite/product/:userId/:productId', expressAsyncHandler(async (req, res) => {
  try {
    const { userId, productId } = req.params;
    
    // Find and delete the favorite
    const deletedFavorite = await favoriteModel.findOneAndDelete({ userId, productId });
    
    if (!deletedFavorite) {
      return res.status(404).send({ message: "Favorite not found" });
    }
    
    res.status(200).send({ 
      message: "Product removed from favorites successfully", 
      payload: deletedFavorite 
    });
  } catch (error) {
    res.status(500).send({ 
      message: "Failed to remove product from favorites", 
      error: error.message 
    });
  }
}));

module.exports = favoriteApp;
