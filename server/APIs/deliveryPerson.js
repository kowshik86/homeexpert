const exp=require('express');
const deliveryPersonApp=exp.Router();
const deliveryPersonModel=require('../models/deliveryPersonModel');
const expressAsyncHandler=require('express-async-handler');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'homeexpert_dev_secret';

const DELIVERY_EDITABLE_FIELDS = [
  'profileImg',
  'mobileNumber',
  'firstName',
  'lastName',
  'email',
  'dob',
  'vechicle',
  'vehicleNumber',
  'vehicleImage',
  'vehicleType',
  'emergencyContact',
  'preferredShift',
  'licenseNumber',
  'isAvailable',
  'serviceAreas',
  'rating',
];

const sanitizeDeliveryPerson = (deliveryPersonDoc) => {
  const deliveryPerson = deliveryPersonDoc.toObject ? deliveryPersonDoc.toObject() : deliveryPersonDoc;
  delete deliveryPerson.passwordHash;
  return deliveryPerson;
};

deliveryPersonApp.post('/auth/register', expressAsyncHandler(async (req, res) => {
  const { password, ...deliveryPayload } = req.body || {};

  if (!password || password.length < 6) {
    return res.status(400).send({ message: 'Password must be at least 6 characters' });
  }

  const existingDeliveryPerson = await deliveryPersonModel.findOne({ mobileNumber: deliveryPayload.mobileNumber });
  if (existingDeliveryPerson) {
    return res.status(409).send({ message: 'Delivery person already exists with this mobile number' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newDeliveryPerson = new deliveryPersonModel({ ...deliveryPayload, passwordHash });
  const savedDeliveryPerson = await newDeliveryPerson.save();

  const token = jwt.sign(
    { id: savedDeliveryPerson._id, role: 'delivery', mobileNumber: savedDeliveryPerson.mobileNumber },
    JWT_SECRET,
    { expiresIn: '7d' },
  );

  res.status(201).send({
    message: 'Delivery person registered successfully',
    token,
    payload: sanitizeDeliveryPerson(savedDeliveryPerson),
  });
}));

deliveryPersonApp.post('/auth/login', expressAsyncHandler(async (req, res) => {
  const { mobileNumber, password } = req.body || {};

  if (!mobileNumber || !password) {
    return res.status(400).send({ message: 'Mobile number and password are required' });
  }

  const deliveryPerson = await deliveryPersonModel.findOne({ mobileNumber }).select('+passwordHash');
  if (!deliveryPerson || !deliveryPerson.passwordHash) {
    return res.status(401).send({ message: 'Invalid credentials' });
  }

  const isPasswordValid = await bcrypt.compare(password, deliveryPerson.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).send({ message: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: deliveryPerson._id, role: 'delivery', mobileNumber: deliveryPerson.mobileNumber },
    JWT_SECRET,
    { expiresIn: '7d' },
  );

  res.status(200).send({
    message: 'Delivery person login successful',
    token,
    payload: sanitizeDeliveryPerson(deliveryPerson),
  });
}));
// post the deliveryPerson
deliveryPersonApp.post('/deliveryPerson',expressAsyncHandler(async(req,res)=>{
    //bussiness logic 
     //get deliveryPerson or author
     const deliveryPerson=req.body;
    //  find deliveryPerson by email id
      let newdeliveryPerson=new deliveryPersonModel(deliveryPerson);
      let newdeliveryPersonDoc=await newdeliveryPerson.save();
      res.status(201).send({message:newdeliveryPersonDoc.role,payload:newdeliveryPersonDoc})
}));
// update deliveryPerson by id
deliveryPersonApp.put('/deliveryPersonupdate/:id', expressAsyncHandler(async (req, res) => {
  console.log("Replacing deliveryPerson:", req.params.id);
  // Find and replace deliveryPerson by deliveryPerson id
  const updateddeliveryPerson = await deliveryPersonModel.findOneAndReplace(
      { _id: req.params.id},  // Find deliveryPerson by deliveryPersonId
      req.body,  // Replace with full new object
      { new: true }  // Return updated deliveryPerson
  );
  if (!updateddeliveryPerson) {
      return res.status(404).send({ message: "deliveryPerson not found" });
  }
  res.status(200).send({ message: "deliveryPerson modified successfully", payload: updateddeliveryPerson });
}));

// partially update deliveryPerson fields by id
deliveryPersonApp.patch('/deliveryPersonupdate/:id', expressAsyncHandler(async (req, res) => {
  const updates = req.body || {};
  const filteredUpdates = {};

  Object.keys(updates).forEach((key) => {
    if (DELIVERY_EDITABLE_FIELDS.includes(key)) {
      filteredUpdates[key] = updates[key];
    }
  });

  if (Object.keys(filteredUpdates).length === 0) {
    return res.status(400).send({ message: 'No valid fields provided for update' });
  }

  const updateddeliveryPerson = await deliveryPersonModel.findByIdAndUpdate(
    req.params.id,
    { $set: filteredUpdates },
    { new: true, runValidators: true },
  );

  if (!updateddeliveryPerson) {
    return res.status(404).send({ message: 'deliveryPerson not found' });
  }

  res.status(200).send({ message: 'deliveryPerson fields updated successfully', payload: updateddeliveryPerson });
}));

// delete a specific optional field from deliveryPerson by id
deliveryPersonApp.delete('/deliveryPersonfield/:id/:fieldName', expressAsyncHandler(async (req, res) => {
  const { id, fieldName } = req.params;

  if (!DELIVERY_EDITABLE_FIELDS.includes(fieldName)) {
    return res.status(400).send({ message: 'Invalid field name' });
  }

  const updateddeliveryPerson = await deliveryPersonModel.findByIdAndUpdate(
    id,
    { $unset: { [fieldName]: 1 } },
    { new: true },
  );

  if (!updateddeliveryPerson) {
    return res.status(404).send({ message: 'deliveryPerson not found' });
  }

  res.status(200).send({ message: `Field ${fieldName} deleted successfully`, payload: updateddeliveryPerson });
}));


//get all deliverypersons
deliveryPersonApp.get('/deliveryPersons',expressAsyncHandler(async(req,res)=>{
  const delpersons=await deliveryPersonModel.find();
  res.status(201).send({message:"delivery persons",payload:delpersons})
  }));

//get all deliverypersons by id
deliveryPersonApp.get('/deliveryperson/:deliveryPersonId',expressAsyncHandler(async(req,res)=>{
    console.log(req.params.deliveryPersonId);
    const delpersons=await deliveryPersonModel.findOne({_id:req.params.deliveryPersonId});
    res.status(201).send({message:"delivery persons",payload:delpersons})
}))

//delete deliveryPerson by id
deliveryPersonApp.delete('/deliverypersonid/:_id',expressAsyncHandler(async(req,res)=>{
  const d_id=await deliveryPersonModel.findByIdAndDelete(req.params._id)
  res.status(201).send({message:"Delivery Person deleted",payload:d_id})
}))




module.exports=deliveryPersonApp;