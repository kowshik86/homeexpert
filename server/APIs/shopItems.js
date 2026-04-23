const express = require('express');
const shopItemsApp = express.Router();
const shopItemsModel = require('../models/shopItemsModel');
const expressAsyncHandler = require('express-async-handler');

const DEFAULT_ITEM_QUANTITY = 50;

const SHOP_ITEM_EDITABLE_FIELDS = [
  'name',
  'imageUrl',
  'cost',
  'description',
  'quantity',
  'category',
];

// GET all shop items
shopItemsApp.get('/shopitems', expressAsyncHandler(async (req, res) => {
  // Fetch all shop items from the database
  const shopItems = await shopItemsModel.find();
  res.status(200).send({ message: "Shop items fetched successfully", payload: shopItems });
}));

// POST a new shop item
shopItemsApp.post('/shopitem', expressAsyncHandler(async (req, res) => {
  const { name, imageUrl, cost, description, quantity, category } = req.body || {};

  if (!name || !imageUrl || !description) {
    return res.status(400).send({ message: 'Name, imageUrl, and description are required' });
  }

  const parsedCost = Number(cost);
  const hasQuantityInput = quantity !== undefined && quantity !== null && `${quantity}`.trim() !== '';
  const parsedQuantity = hasQuantityInput ? Number(quantity) : DEFAULT_ITEM_QUANTITY;

  if (Number.isNaN(parsedCost) || parsedCost < 0) {
    return res.status(400).send({ message: 'Cost must be zero or greater' });
  }

  if (Number.isNaN(parsedQuantity) || parsedQuantity < 0) {
    return res.status(400).send({ message: 'Quantity must be zero or greater' });
  }

  const newShopItem = new shopItemsModel({
    name: Array.isArray(name) ? name : [name],
    imageUrl,
    cost: parsedCost,
    description,
    quantity: parsedQuantity,
    category: category || 'uncategorized',
  });

  const savedShopItem = await newShopItem.save();
  res.status(201).send({ message: 'Shop item created successfully', payload: savedShopItem });
}));

// GET a single shop item by ID
shopItemsApp.get('/shopitem/:_id',expressAsyncHandler(async(req,res)=>{
    console.log(req.params._id);
    const shopItem=await shopItemsModel.findOne({_id:req.params._id});
    res.status(201).send({message:"Shop item fetched successfully ",payload:shopItem})
}))

// PATCH a shop item
shopItemsApp.patch('/shopitem/:_id', expressAsyncHandler(async (req, res) => {
  const updates = req.body || {};
  const filteredUpdates = {};

  Object.keys(updates).forEach((key) => {
    if (SHOP_ITEM_EDITABLE_FIELDS.includes(key)) {
      filteredUpdates[key] = updates[key];
    }
  });

  if (Object.keys(filteredUpdates).length === 0) {
    return res.status(400).send({ message: 'No valid fields provided for update' });
  }

  if (filteredUpdates.cost !== undefined) {
    const parsedCost = Number(filteredUpdates.cost);
    if (Number.isNaN(parsedCost) || parsedCost < 0) {
      return res.status(400).send({ message: 'Cost must be zero or greater' });
    }
    filteredUpdates.cost = parsedCost;
  }

  if (filteredUpdates.quantity !== undefined) {
    const parsedQuantity = Number(filteredUpdates.quantity);
    if (Number.isNaN(parsedQuantity) || parsedQuantity < 0) {
      return res.status(400).send({ message: 'Quantity must be zero or greater' });
    }
    filteredUpdates.quantity = parsedQuantity;
  }

  if (filteredUpdates.name && !Array.isArray(filteredUpdates.name)) {
    filteredUpdates.name = [filteredUpdates.name];
  }

  const updatedShopItem = await shopItemsModel.findByIdAndUpdate(
    req.params._id,
    { $set: filteredUpdates },
    { new: true, runValidators: true },
  );

  if (!updatedShopItem) {
    return res.status(404).send({ message: 'Shop item not found' });
  }

  res.status(200).send({ message: 'Shop item updated successfully', payload: updatedShopItem });
}));

// GET a single shop item by NAME (from the name array)
shopItemsApp.get('/shopItem/name/:name', expressAsyncHandler(async (req, res) => {
    const itemName = req.params.name;
    const shopItem = await shopItemsModel.findOne({ name: { $in: [itemName] } });
    if (!shopItem) {
      return res.status(404).send({ message: "Shop item not found" });
    }
    res.status(201).send({ message: "Shop item fetched successfully", payload: shopItem });
}));

//GET items based on catogery
shopItemsApp.get('/shopItem/category/:category',expressAsyncHandler(async(req,res)=>{
    const categoryName=req.params.category;
    const shopItems= await shopItemsModel.find({category:categoryName})
    if (!shopItems) {
        return res.status(404).send({ message: "Shop item's not found" });
      }
      res.status(201).send({ message: "Shop item's fetched successfully", payload: shopItems });
}))

module.exports = shopItemsApp;