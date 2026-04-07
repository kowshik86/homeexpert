const mongoose=require('mongoose');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const validatePhoneNumber = (phone) => {
    const phoneNumber = parsePhoneNumberFromString(phone, 'IN'); // Change 'IN' to default country if needed
    return phoneNumber ? phoneNumber.isValid() : false;
};

// model for user
const bulinfo=new mongoose.Schema({
  flatNo:{
    type:String,
    required:true
},
landmark:{
    type:String,
    required:true
},
area:{
    type:String,
    required:true
}
})

const workeraddress=new mongoose.Schema({
  state:{
    type:String,
    required:true
},
city:{
    type:String,
    required:true
},
pincode: {
    type: String,
    required: true,
    match: [/^\d{6}$/, "Pincode must be exactly 6 digits"],
},
address:{
    type:bulinfo,
    required:true
}
})
const workerSchema = new mongoose.Schema({
  profileImg:{
        type: String
     },
  mobileNumber:{
     type:String,
     unique:true,
     required:true,
     validate: {
        validator: validatePhoneNumber,
        message: props => `${props.value} is not a valid phone number!`
    }
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String
  },
  email: {
    type: String,
    unique: true,
    lowercase: true
  },
  passwordHash: {
    type: String,
    select: false,
  },
  Address:{
    type:workeraddress,
    required:true
  },
  reviews:{
    type:[{
      rating:Number,
      comment:String,
      userId:String
    }]
  },
  workTypes: {
    type: [String], 
    required: true, 
    //validation that worker must have atleast one worker 
    validate: {
        validator: function (value) {
            return value.length > 0; 
        },
        message: 'A worker must have at least one type of work.'
    }
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },
  experienceYears: {
    type: Number,
    min: 0,
    default: 0,
  },
  hourlyRate: {
    type: Number,
    min: 0,
  },
  serviceRadiusKm: {
    type: Number,
    min: 0,
  },
  bio: {
    type: String,
    trim: true,
  }
});

const Worker=mongoose.model('worker',workerSchema);

module.exports=Worker;