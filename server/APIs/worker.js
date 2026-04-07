const exp=require('express');
const workerApp=exp.Router();
const workerModel=require('../models/workerModel');
const expressAsyncHandler=require('express-async-handler');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'homeexpert_dev_secret';

const WORKER_EDITABLE_FIELDS = [
  'profileImg',
  'mobileNumber',
  'firstName',
  'lastName',
  'email',
  'Address',
  'reviews',
  'workTypes',
  'isAvailable',
  'experienceYears',
  'hourlyRate',
  'serviceRadiusKm',
  'bio',
];

const sanitizeWorker = (workerDoc) => {
  const worker = workerDoc.toObject ? workerDoc.toObject() : workerDoc;
  delete worker.passwordHash;
  return worker;
};

workerApp.post('/auth/register', expressAsyncHandler(async (req, res) => {
  const { password, ...workerPayload } = req.body || {};

  if (!password || password.length < 6) {
    return res.status(400).send({ message: 'Password must be at least 6 characters' });
  }

  const existingWorker = await workerModel.findOne({ mobileNumber: workerPayload.mobileNumber });
  if (existingWorker) {
    return res.status(409).send({ message: 'Worker already exists with this mobile number' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newWorker = new workerModel({ ...workerPayload, passwordHash });
  const savedWorker = await newWorker.save();

  const token = jwt.sign(
    { id: savedWorker._id, role: 'worker', mobileNumber: savedWorker.mobileNumber },
    JWT_SECRET,
    { expiresIn: '7d' },
  );

  res.status(201).send({
    message: 'Worker registered successfully',
    token,
    payload: sanitizeWorker(savedWorker),
  });
}));

workerApp.post('/auth/login', expressAsyncHandler(async (req, res) => {
  const { mobileNumber, password } = req.body || {};

  if (!mobileNumber || !password) {
    return res.status(400).send({ message: 'Mobile number and password are required' });
  }

  const worker = await workerModel.findOne({ mobileNumber }).select('+passwordHash');
  if (!worker || !worker.passwordHash) {
    return res.status(401).send({ message: 'Invalid credentials' });
  }

  const isPasswordValid = await bcrypt.compare(password, worker.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).send({ message: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: worker._id, role: 'worker', mobileNumber: worker.mobileNumber },
    JWT_SECRET,
    { expiresIn: '7d' },
  );

  res.status(200).send({
    message: 'Worker login successful',
    token,
    payload: sanitizeWorker(worker),
  });
}));
// post the worker
workerApp.post('/worker',expressAsyncHandler(async(req,res)=>{
    //bussiness logic 
     //get worker or author
     const worker=req.body;
    //  find worker by email id
      let newworker=new workerModel(worker);
      let newworkerDoc=await newworker.save();
      res.status(201).send({message:newworkerDoc.role,payload:newworkerDoc})
}));

//get all workers
workerApp.get('/workers',expressAsyncHandler(async(req,res)=>{
    const workers=await workerModel.find();
    res.status(201).send({message:"workers",payload:workers})
}))

//get worker by worker id
workerApp.get('/worker/:_id',expressAsyncHandler(async(req,res)=>{
    console.log(req.params._id);
    const workers=await workerModel.findOne({_id:req.params._id});
    res.status(201).send({message:"workers",payload:workers})
}))
// update worker by id
workerApp.put('/workerupdate/:id', expressAsyncHandler(async (req, res) => {
  console.log("Replacing worker:", req.params.id);
  // Find and replace worker by worker id
  const updatedWorker = await workerModel.findOneAndReplace(
      { _id: req.params.id},  // Find worker by _Id
      req.body,  // Replace with full new object
      { new: true }  // Return updated worker
  );
  if (!updatedWorker) {
      return res.status(404).send({ message: "Worker not found" });
  }
  res.status(200).send({ message: "Worker modified successfully", payload: updatedWorker });
}));

// partially update worker fields by id
workerApp.patch('/workerupdate/:id', expressAsyncHandler(async (req, res) => {
  const updates = req.body || {};
  const filteredUpdates = {};

  Object.keys(updates).forEach((key) => {
    if (WORKER_EDITABLE_FIELDS.includes(key)) {
      filteredUpdates[key] = updates[key];
    }
  });

  if (Object.keys(filteredUpdates).length === 0) {
    return res.status(400).send({ message: 'No valid fields provided for update' });
  }

  const updatedWorker = await workerModel.findByIdAndUpdate(
    req.params.id,
    { $set: filteredUpdates },
    { new: true, runValidators: true },
  );

  if (!updatedWorker) {
    return res.status(404).send({ message: 'Worker not found' });
  }

  res.status(200).send({ message: 'Worker fields updated successfully', payload: updatedWorker });
}));

// delete a specific optional field from worker by id
workerApp.delete('/workerfield/:id/:fieldName', expressAsyncHandler(async (req, res) => {
  const { id, fieldName } = req.params;

  if (!WORKER_EDITABLE_FIELDS.includes(fieldName)) {
    return res.status(400).send({ message: 'Invalid field name' });
  }

  const updatedWorker = await workerModel.findByIdAndUpdate(
    id,
    { $unset: { [fieldName]: 1 } },
    { new: true },
  );

  if (!updatedWorker) {
    return res.status(404).send({ message: 'Worker not found' });
  }

  res.status(200).send({ message: `Field ${fieldName} deleted successfully`, payload: updatedWorker });
}));


//delete worker by id
workerApp.delete('/workerid/:_id',expressAsyncHandler(async(req,res)=>{
  const d_id=await workerModel.findByIdAndDelete(req.params._id)
  res.status(201).send({message:"worker deleted",payload:d_id})
}))




module.exports=workerApp;