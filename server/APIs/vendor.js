const exp=require('express');
const vendorApp=exp.Router();
const vendorModel=require('../models/vendorModel');
const expressAsyncHandler=require('express-async-handler');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'homeexpert_dev_secret';

const VENDOR_EDITABLE_FIELDS = [
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
  'gstNumber',
  'shopAddress',
];

const sanitizeVendor = (vendorDoc) => {
  const vendor = vendorDoc.toObject ? vendorDoc.toObject() : vendorDoc;
  delete vendor.passwordHash;
  return vendor;
};

vendorApp.post('/auth/register', expressAsyncHandler(async (req, res) => {
  const { password, ...vendorPayload } = req.body || {};

  if (!password || password.length < 6) {
    return res.status(400).send({ message: 'Password must be at least 6 characters' });
  }

  const existingVendor = await vendorModel.findOne({ mobileNumber: vendorPayload.mobileNumber });
  if (existingVendor) {
    return res.status(409).send({ message: 'Vendor already exists with this mobile number' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newVendor = new vendorModel({ ...vendorPayload, passwordHash });
  const savedVendor = await newVendor.save();

  const token = jwt.sign(
    { id: savedVendor._id, role: 'vendor', mobileNumber: savedVendor.mobileNumber },
    JWT_SECRET,
    { expiresIn: '7d' },
  );

  res.status(201).send({
    message: 'Vendor registered successfully',
    token,
    payload: sanitizeVendor(savedVendor),
  });
}));

vendorApp.post('/auth/login', expressAsyncHandler(async (req, res) => {
  const { mobileNumber, password } = req.body || {};

  if (!mobileNumber || !password) {
    return res.status(400).send({ message: 'Mobile number and password are required' });
  }

  const vendor = await vendorModel.findOne({ mobileNumber }).select('+passwordHash');
  if (!vendor || !vendor.passwordHash) {
    return res.status(401).send({ message: 'Invalid credentials' });
  }

  const isPasswordValid = await bcrypt.compare(password, vendor.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).send({ message: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: vendor._id, role: 'vendor', mobileNumber: vendor.mobileNumber },
    JWT_SECRET,
    { expiresIn: '7d' },
  );

  res.status(200).send({
    message: 'Vendor login successful',
    token,
    payload: sanitizeVendor(vendor),
  });
}));
// post the vendor
vendorApp.post('/vendor',expressAsyncHandler(async(req,res)=>{
    //bussiness logic 
     //get vendor or author
     const vendor=req.body;
    //  find vendor by email id
      let newvendor=new vendorModel(vendor);
      let newvendorDoc=await newvendor.save();
      res.status(201).send({message:newvendorDoc.role,payload:newvendorDoc})
}));
// update vendor by id
vendorApp.put('/vendorupdate/:id', expressAsyncHandler(async (req, res) => {
  console.log("Replacing vendor:", req.params.id);
  // Find and replace vendor by vendor id
  const updatedvendor = await vendorModel.findOneAndReplace(
      { _id: req.params.id },  // Find vendor by vendorId
      req.body,  // Replace with full new object
      { new: true }  // Return updated vendor
  );
  if (!updatedvendor) {
      return res.status(404).send({ message: "vendor not found" });
  }
  res.status(200).send({ message: "vendor modified successfully", payload: updatedvendor });
}));

// partially update vendor fields by id
vendorApp.patch('/vendorupdate/:id', expressAsyncHandler(async (req, res) => {
  const updates = req.body || {};
  const filteredUpdates = {};

  Object.keys(updates).forEach((key) => {
    if (VENDOR_EDITABLE_FIELDS.includes(key)) {
      filteredUpdates[key] = updates[key];
    }
  });

  if (Object.keys(filteredUpdates).length === 0) {
    return res.status(400).send({ message: 'No valid fields provided for update' });
  }

  const updatedvendor = await vendorModel.findByIdAndUpdate(
    req.params.id,
    { $set: filteredUpdates },
    { new: true, runValidators: true },
  );

  if (!updatedvendor) {
    return res.status(404).send({ message: 'vendor not found' });
  }

  res.status(200).send({ message: 'vendor fields updated successfully', payload: updatedvendor });
}));

// delete a specific optional field from vendor by id
vendorApp.delete('/vendorfield/:id/:fieldName', expressAsyncHandler(async (req, res) => {
  const { id, fieldName } = req.params;

  if (!VENDOR_EDITABLE_FIELDS.includes(fieldName)) {
    return res.status(400).send({ message: 'Invalid field name' });
  }

  const updatedvendor = await vendorModel.findByIdAndUpdate(
    id,
    { $unset: { [fieldName]: 1 } },
    { new: true },
  );

  if (!updatedvendor) {
    return res.status(404).send({ message: 'vendor not found' });
  }

  res.status(200).send({ message: `Field ${fieldName} deleted successfully`, payload: updatedvendor });
}));



//get all vendors
vendorApp.get('/vendors',expressAsyncHandler(async(req,res)=>{
  const shoppersons=await vendorModel.find();
  res.status(201).send({message:"vendor persons",payload:shoppersons})
  }))

//get vendor by id
vendorApp.get('/vendor/:id',expressAsyncHandler(async(req,res)=>{
  console.log(req.params._id);
  const vendor=await vendorModel.findOne({_id:req.params.id});
  res.status(201).send({message:"vendors",payload:vendor})
}))

//delete vendor by id
vendorApp.delete('/vendorid/:_id',expressAsyncHandler(async(req,res)=>{
  const d_id=await vendorModel.findByIdAndDelete(req.params._id)
  res.status(201).send({message:"Shop Kepper deleted",payload:d_id})
}))

//delete vendor by id
vendorApp.delete('/vendor/:vendorId',expressAsyncHandler(async(req,res)=>{
   const delete_id=await vendorModel.findOneAndDelete({vendorId:req.params.vendorId})
   res.status(201).send({message:"Shop Keeper deleted ",payload:delete_id})
}))

module.exports=vendorApp;