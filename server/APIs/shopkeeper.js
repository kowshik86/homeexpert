const exp=require('express');
const shopKeeperApp=exp.Router();
const shopKeeperModel=require('../models/shopKeeperModel');
const expressAsyncHandler=require('express-async-handler');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');

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
    const newProduct = req.body;
    console.log(shopKeeperId, newProduct)

    let shopKeeper = await shopKeeperModel.findById(shopKeeperId);
    if (!shopKeeper) {
        return res.status(404).send({ message: "ShopKeeper not found" });
    }

    // Check if product with the same imageUrl already exists
    const isDuplicate = shopKeeper.products.some(product => product.imageUrl === newProduct.imageUrl);

    if (isDuplicate) {
        return res.status(400).send({ message: "Duplicate product already exists." });
    }

    // Add the new product
    shopKeeper.products.push(newProduct);

    // Save updated shopKeeper document
    await shopKeeper.save();

    res.status(201).send({ message: "Product posted successfully", payload: newProduct });
}));
//update product details
shopKeeperApp.put('/productChange/:shopKeeperId/:productId/:quantity/:price', expressAsyncHandler(async (req, res) => {
  const { shopKeeperId, productId, quantity, price } = req.params;

  let shopKeeper = await shopKeeperModel.findById(shopKeeperId);
  
  if (!shopKeeper) {
      return res.status(404).send({ message: "ShopKeeper not found" });
  }

  // Find the product inside the shopKeeper's products array
  const productIndex = shopKeeper.products.findIndex(product => product._id.toString() === productId);
  
  if (productIndex === -1) {
      return res.status(404).send({ message: "Product not found" });
  }

  // Update product details
  shopKeeper.products[productIndex].quantity = parseInt(quantity, 10);
  shopKeeper.products[productIndex].price = parseFloat(price);

  // Save the updated shopKeeper document
  await shopKeeper.save();

  res.status(200).send({ message: "Product updated successfully", payload: shopKeeper.products[productIndex] });
}));



module.exports=shopKeeperApp;