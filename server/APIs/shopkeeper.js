const exp=require('express');
const shopKeeperApp=exp.Router();
const shopKeeperModel=require('../models/shopKeeperModel');
const shopItemsModel = require('../models/shopItemsModel');
const expressAsyncHandler=require('express-async-handler');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const mongoose = require('mongoose');

const JWT_SECRET = process.env.JWT_SECRET || 'homeexpert_dev_secret';

const SHOPKEEPER_EDITABLE_FIELDS = [
  'profileImg',
  'mobileNumber',
  'firstName',
  'lastName',
  'email',
  'shopName',
  'shopImage',
  'businessCategory',
  'yearsInBusiness',
  'acceptsOnlinePayments',
  'minOrderValue',
  'shopDescription',
  'openingTime',
  'closingTime',
  'isShopOpen',
  'gstNumber',
  'shopAddress',
  'products',
];

const sanitizeShopkeeper = (shopkeeperDoc) => {
  const shopkeeper = shopkeeperDoc.toObject ? shopkeeperDoc.toObject() : shopkeeperDoc;
  delete shopkeeper.passwordHash;
  return shopkeeper;
};

const toPositiveInteger = (value) => {
  const parsedValue = Number(value);
  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
};

const toNonNegativeInteger = (value) => {
  const parsedValue = Number(value);
  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    return null;
  }

  return parsedValue;
};

const toNonNegativeNumber = (value) => {
  const parsedValue = Number(value);
  if (Number.isNaN(parsedValue) || parsedValue < 0) {
    return null;
  }

  return parsedValue;
};

const toPositiveNumber = (value) => {
  const parsedValue = Number(value);
  if (Number.isNaN(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
};

const getPrimaryProductName = (product) => {
  const primaryName = Array.isArray(product?.name) ? product.name[0] : product?.name;
  return String(primaryName || '').trim();
};

const getResolvedProductPrice = ({ requestedPrice, existingPrice, legacyCost, catalogCost }) => {
  const requestedPositivePrice = toPositiveNumber(requestedPrice);
  if (requestedPositivePrice !== null) {
    return requestedPositivePrice;
  }

  const existingPositivePrice = toPositiveNumber(existingPrice);
  if (existingPositivePrice !== null) {
    return existingPositivePrice;
  }

  const catalogPositivePrice = toPositiveNumber(catalogCost);
  if (catalogPositivePrice !== null) {
    return catalogPositivePrice;
  }

  const legacyPositiveCost = toPositiveNumber(legacyCost);
  if (legacyPositiveCost !== null) {
    return legacyPositiveCost;
  }

  const nonNegativeRequestedPrice = toNonNegativeNumber(requestedPrice);
  if (nonNegativeRequestedPrice !== null) {
    return nonNegativeRequestedPrice;
  }

  const nonNegativeExistingPrice = toNonNegativeNumber(existingPrice);
  if (nonNegativeExistingPrice !== null) {
    return nonNegativeExistingPrice;
  }

  const nonNegativeCatalogPrice = toNonNegativeNumber(catalogCost);
  if (nonNegativeCatalogPrice !== null) {
    return nonNegativeCatalogPrice;
  }

  const nonNegativeLegacyCost = toNonNegativeNumber(legacyCost);
  if (nonNegativeLegacyCost !== null) {
    return nonNegativeLegacyCost;
  }

  return 0;
};

const normalizeCatalogItemId = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsedValue = String(value).trim();
  if (!mongoose.Types.ObjectId.isValid(parsedValue)) {
    return null;
  }

  return parsedValue;
};

const adjustCatalogItemStock = async ({ catalogItemId, delta }) => {
  if (!catalogItemId || !delta) {
    return;
  }

  if (delta > 0) {
    await shopItemsModel.updateOne(
      { _id: catalogItemId },
      { $inc: { quantity: Number(delta) } },
    );
    return;
  }

  const decrementBy = Math.abs(Number(delta));
  const updateResult = await shopItemsModel.updateOne(
    { _id: catalogItemId, quantity: { $gte: decrementBy } },
    { $inc: { quantity: -decrementBy } },
  );

  if (!updateResult.modifiedCount) {
    throw new Error('Not enough stock available to reduce this quantity.');
  }
};

const resolveCatalogItemIdFromProduct = async (product) => {
  const directCatalogItemId = normalizeCatalogItemId(product?.catalogItemId);
  if (directCatalogItemId) {
    return directCatalogItemId;
  }

  const primaryName = getPrimaryProductName(product);
  const productImageUrl = String(product?.imageUrl || '').trim();

  let catalogItem = null;

  if (primaryName) {
    catalogItem = await shopItemsModel.findOne({ name: { $in: [primaryName] } }).select('_id');
  }

  if (!catalogItem && productImageUrl) {
    catalogItem = await shopItemsModel.findOne({ imageUrl: productImageUrl }).select('_id');
  }

  if (!catalogItem) {
    return null;
  }

  return String(catalogItem._id);
};

const syncShopkeeperProductPricesFromCatalog = async (shopkeeperDoc) => {
  if (!shopkeeperDoc || !Array.isArray(shopkeeperDoc.products) || shopkeeperDoc.products.length === 0) {
    return shopkeeperDoc;
  }

  let hasChanges = false;

  for (const product of shopkeeperDoc.products) {
    const currentPrice = toPositiveNumber(product?.price);
    if (currentPrice !== null) {
      continue;
    }

    const resolvedCatalogItemId = await resolveCatalogItemIdFromProduct(product);
    if (!resolvedCatalogItemId) {
      continue;
    }

    const catalogItem = await shopItemsModel.findById(resolvedCatalogItemId).select('_id cost');
    if (!catalogItem) {
      continue;
    }

    const resolvedPrice = getResolvedProductPrice({
      requestedPrice: product?.price,
      existingPrice: product?.price,
      legacyCost: product?.cost,
      catalogCost: catalogItem?.cost,
    });

    if (!product.catalogItemId) {
      product.catalogItemId = catalogItem._id;
      hasChanges = true;
    }

    if (Number(product.price || 0) !== Number(resolvedPrice || 0)) {
      product.price = resolvedPrice;
      hasChanges = true;
    }
  }

  if (hasChanges) {
    await shopkeeperDoc.save();
  }

  return shopkeeperDoc;
};

shopKeeperApp.post('/auth/register', expressAsyncHandler(async (req, res) => {
  const { password, ...shopkeeperPayload } = req.body || {};

  if (!password || password.length < 6) {
    return res.status(400).send({ message: 'Password must be at least 6 characters' });
  }

  const existingShopkeeper = await shopKeeperModel.findOne({ mobileNumber: shopkeeperPayload.mobileNumber });
  if (existingShopkeeper) {
    return res.status(409).send({ message: 'Shopkeeper already exists with this mobile number' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newShopkeeper = new shopKeeperModel({ ...shopkeeperPayload, passwordHash });
  const savedShopkeeper = await newShopkeeper.save();

  const token = jwt.sign(
    { id: savedShopkeeper._id, role: 'shopkeeper', mobileNumber: savedShopkeeper.mobileNumber },
    JWT_SECRET,
    { expiresIn: '7d' },
  );

  res.status(201).send({
    message: 'Shopkeeper registered successfully',
    token,
    payload: sanitizeShopkeeper(savedShopkeeper),
  });
}));

shopKeeperApp.post('/auth/login', expressAsyncHandler(async (req, res) => {
  const { mobileNumber, password } = req.body || {};

  if (!mobileNumber || !password) {
    return res.status(400).send({ message: 'Mobile number and password are required' });
  }

  const shopkeeper = await shopKeeperModel.findOne({ mobileNumber }).select('+passwordHash');
  if (!shopkeeper || !shopkeeper.passwordHash) {
    return res.status(401).send({ message: 'Invalid credentials' });
  }

  const isPasswordValid = await bcrypt.compare(password, shopkeeper.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).send({ message: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: shopkeeper._id, role: 'shopkeeper', mobileNumber: shopkeeper.mobileNumber },
    JWT_SECRET,
    { expiresIn: '7d' },
  );

  res.status(200).send({
    message: 'Shopkeeper login successful',
    token,
    payload: sanitizeShopkeeper(shopkeeper),
  });
}));
// post the shopKeeper
shopKeeperApp.post('/shopkeeper',expressAsyncHandler(async(req,res)=>{
    //bussiness logic 
     //get shopKeeper or author
     const shopKeeper=req.body;
    //  find shopKeeper by email id
      let newshopKeeper=new shopKeeperModel(shopKeeper);
      let newshopKeeperDoc=await newshopKeeper.save();
      res.status(201).send({message:newshopKeeperDoc.role,payload:newshopKeeperDoc})
}));
// update shopkeeper by id
shopKeeperApp.put('/shopKeeperupdate/:id', expressAsyncHandler(async (req, res) => {
  console.log("Replacing shopKeeper:", req.params.id);
  // Find and replace shopKeeper by shopKeeper id
  const updatedshopKeeper = await shopKeeperModel.findOneAndReplace(
      { _id: req.params.id },  // Find shopKeeper by shopKeeperId
      req.body,  // Replace with full new object
      { new: true }  // Return updated shopKeeper
  );
  if (!updatedshopKeeper) {
      return res.status(404).send({ message: "shopKeeper not found" });
  }
  res.status(200).send({ message: "shopKeeper modified successfully", payload: updatedshopKeeper });
}));

// partially update shopKeeper fields by id
shopKeeperApp.patch('/shopKeeperupdate/:id', expressAsyncHandler(async (req, res) => {
  const updates = req.body || {};
  const filteredUpdates = {};

  Object.keys(updates).forEach((key) => {
    if (SHOPKEEPER_EDITABLE_FIELDS.includes(key)) {
      filteredUpdates[key] = updates[key];
    }
  });

  if (Object.keys(filteredUpdates).length === 0) {
    return res.status(400).send({ message: 'No valid fields provided for update' });
  }

  const updatedshopKeeper = await shopKeeperModel.findByIdAndUpdate(
    req.params.id,
    { $set: filteredUpdates },
    { new: true, runValidators: true },
  );

  if (!updatedshopKeeper) {
    return res.status(404).send({ message: 'shopKeeper not found' });
  }

  res.status(200).send({ message: 'shopKeeper fields updated successfully', payload: updatedshopKeeper });
}));

// delete a specific optional field from shopKeeper by id
shopKeeperApp.delete('/shopKeeperfield/:id/:fieldName', expressAsyncHandler(async (req, res) => {
  const { id, fieldName } = req.params;

  if (!SHOPKEEPER_EDITABLE_FIELDS.includes(fieldName)) {
    return res.status(400).send({ message: 'Invalid field name' });
  }

  const updatedshopKeeper = await shopKeeperModel.findByIdAndUpdate(
    id,
    { $unset: { [fieldName]: 1 } },
    { new: true },
  );

  if (!updatedshopKeeper) {
    return res.status(404).send({ message: 'shopKeeper not found' });
  }

  res.status(200).send({ message: `Field ${fieldName} deleted successfully`, payload: updatedshopKeeper });
}));


//get all shopkeepers
shopKeeperApp.get('/shopkeepers',expressAsyncHandler(async(req,res)=>{
  const shoppersons=await shopKeeperModel.find();
  res.status(201).send({message:"shopkeeper persons",payload:shoppersons})
  }))

//get shopkeeper by id
shopKeeperApp.get('/shopkeeper/:id',expressAsyncHandler(async(req,res)=>{
  console.log(req.params.id);
  const shopkeeper=await shopKeeperModel.findOne({_id:req.params.id});
  await syncShopkeeperProductPricesFromCatalog(shopkeeper);
  res.status(201).send({message:"shopkeepers",payload:shopkeeper})
}))

//delete shopkeeper by id
shopKeeperApp.delete('/shopkeeperid/:_id',expressAsyncHandler(async(req,res)=>{
  const d_id=await shopKeeperModel.findByIdAndDelete(req.params._id)
  res.status(201).send({message:"Shop Kepper deleted",payload:d_id})
}))

// post a new product details 

shopKeeperApp.post('/product/:shopKeeperId', expressAsyncHandler(async (req, res) => {
    const shopKeeperId = req.params.shopKeeperId;
    const newProduct = req.body || {};
    console.log(shopKeeperId, newProduct)

    const parsedQuantity = toPositiveInteger(newProduct.quantity);
    const parsedPrice = toNonNegativeNumber(newProduct.price);
    const catalogItemId = normalizeCatalogItemId(newProduct.catalogItemId);

    if (parsedQuantity === null) {
      return res.status(400).send({ message: 'Quantity must be a positive whole number.' });
    }

    if (parsedPrice === null) {
      return res.status(400).send({ message: 'Price must be zero or greater.' });
    }

    if (newProduct.catalogItemId && !catalogItemId) {
      return res.status(400).send({ message: 'Invalid catalog item id.' });
    }

    let linkedCatalogItem = null;
    if (catalogItemId) {
      linkedCatalogItem = await shopItemsModel.findById(catalogItemId).select('_id cost');
      if (!linkedCatalogItem) {
        return res.status(404).send({ message: 'Catalog item not found.' });
      }
    }

    let shopKeeper = await shopKeeperModel.findById(shopKeeperId);
    if (!shopKeeper) {
        return res.status(404).send({ message: "ShopKeeper not found" });
    }

    const products = Array.isArray(shopKeeper.products) ? shopKeeper.products : [];

    // Check if product with the same catalog link or image already exists
    const isDuplicate = products.some((product) => {
      const sameCatalogItem = catalogItemId && String(product.catalogItemId || '') === catalogItemId;
      const sameImage = product.imageUrl === newProduct.imageUrl;
      return Boolean(sameCatalogItem || sameImage);
    });

    if (isDuplicate) {
        return res.status(400).send({ message: "Duplicate product already exists." });
    }

    const resolvedPrice = getResolvedProductPrice({
      requestedPrice: parsedPrice,
      existingPrice: null,
      legacyCost: newProduct?.cost,
      catalogCost: linkedCatalogItem?.cost,
    });

    // Add the new product
    shopKeeper.products.push({
      ...newProduct,
      quantity: parsedQuantity,
      price: resolvedPrice,
      ...(catalogItemId ? { catalogItemId } : {}),
    });

    // Save updated shopKeeper document
    await shopKeeper.save();

    if (catalogItemId) {
      await adjustCatalogItemStock({ catalogItemId, delta: parsedQuantity });
    }

    res.status(201).send({ message: "Product posted successfully", payload: shopKeeper.products[shopKeeper.products.length - 1] });
}));
//update product details
shopKeeperApp.put('/productChange/:shopKeeperId/:productId/:quantity/:price', expressAsyncHandler(async (req, res) => {
  const { shopKeeperId, productId, quantity, price } = req.params;

  const parsedQuantity = toNonNegativeInteger(quantity);
  const parsedPrice = toNonNegativeNumber(price);

  if (parsedQuantity === null) {
    return res.status(400).send({ message: 'Quantity must be a whole number greater than or equal to zero.' });
  }

  if (parsedPrice === null) {
    return res.status(400).send({ message: 'Price must be zero or greater.' });
  }

  let shopKeeper = await shopKeeperModel.findById(shopKeeperId);
  
  if (!shopKeeper) {
      return res.status(404).send({ message: "ShopKeeper not found" });
  }

  // Find the product inside the shopKeeper's products array
  const productIndex = shopKeeper.products.findIndex(product => product._id.toString() === productId);
  
  if (productIndex === -1) {
      return res.status(404).send({ message: "Product not found" });
  }

  const targetProduct = shopKeeper.products[productIndex];
  const previousQuantity = Number(targetProduct.quantity || 0);
  const quantityDelta = parsedQuantity - previousQuantity;
  const resolvedCatalogItemId = await resolveCatalogItemIdFromProduct(targetProduct);
  let linkedCatalogItem = null;

  if (resolvedCatalogItemId) {
    linkedCatalogItem = await shopItemsModel.findById(resolvedCatalogItemId).select('_id cost');
  }

  if (resolvedCatalogItemId) {
    targetProduct.catalogItemId = resolvedCatalogItemId;
  }

  const resolvedPrice = getResolvedProductPrice({
    requestedPrice: parsedPrice,
    existingPrice: targetProduct?.price,
    legacyCost: targetProduct?.cost,
    catalogCost: linkedCatalogItem?.cost,
  });

  if (quantityDelta !== 0 && resolvedCatalogItemId) {
    try {
      await adjustCatalogItemStock({
        catalogItemId: resolvedCatalogItemId,
        delta: quantityDelta,
      });
    } catch (stockError) {
      return res.status(409).send({ message: stockError.message || 'Unable to update stock.' });
    }
  }

  // Update product details
  targetProduct.quantity = parsedQuantity;
  targetProduct.price = resolvedPrice;

  // Save the updated shopKeeper document
  try {
    await shopKeeper.save();
  } catch (saveError) {
    if (quantityDelta !== 0 && resolvedCatalogItemId) {
      await adjustCatalogItemStock({
        catalogItemId: resolvedCatalogItemId,
        delta: -quantityDelta,
      }).catch(() => null);
    }

    throw saveError;
  }

  res.status(200).send({ message: "Product updated successfully", payload: targetProduct });
}));



module.exports=shopKeeperApp;