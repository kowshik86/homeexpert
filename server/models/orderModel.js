const mongoose = require('mongoose');

// Define the schema for order items
const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'productType'
  },
  productType: {
    type: String,
    required: true,
    enum: ['shopItem', 'shopGood']
  },
  name: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  totalPrice: {
    type: Number,
    required: true
  }
});

// Define the schema for delivery address
const deliveryAddressSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true
  },
  mobileNumber: {
    type: String,
    required: true
  },
  addressLine1: {
    type: String,
    required: true
  },
  addressLine2: {
    type: String
  },
  city: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  pincode: {
    type: String,
    required: true
  },
  landmark: {
    type: String
  },
  addressType: {
    type: String,
    enum: ['home', 'work', 'other'],
    default: 'home'
  },
  isDefault: {
    type: Boolean,
    default: false
  }
});

const serviceBookingSchema = new mongoose.Schema({
  serviceSlug: {
    type: String,
    trim: true,
  },
  serviceName: {
    type: String,
    trim: true,
  },
  packageName: {
    type: String,
    trim: true,
  },
  serviceImage: {
    type: String,
    trim: true,
  },
  scheduledFor: {
    type: Date,
  },
  timeSlot: {
    type: String,
    trim: true,
  },
  notes: {
    type: String,
    trim: true,
  },
  estimatedDurationMins: {
    type: Number,
    min: 0,
  },
  estimatedPrice: {
    type: Number,
    min: 0,
  },
}, { _id: false });

const liveTrackingSchema = new mongoose.Schema({
  deliveryPersonLocation: {
    lat: {
      type: Number,
      min: -90,
      max: 90,
    },
    lng: {
      type: Number,
      min: -180,
      max: 180,
    },
  },
  destinationLocation: {
    lat: {
      type: Number,
      min: -90,
      max: 90,
    },
    lng: {
      type: Number,
      min: -180,
      max: 180,
    },
  },
  locationSyncedAt: {
    type: Date,
  },
}, { _id: false });

// Define the schema for orders
const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  bookingType: {
    type: String,
    enum: ['product', 'service'],
    default: 'product',
  },
  orderItems: [orderItemSchema],
  deliveryAddress: deliveryAddressSchema,
  serviceBooking: serviceBookingSchema,
  liveTracking: liveTrackingSchema,
  paymentMethod: {
    type: String,
    enum: ['COD', 'ONLINE', 'UPI', 'WALLET'],
    default: 'COD'
  },
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'PAID', 'FAILED'],
    default: 'PENDING'
  },
  paymentGateway: {
    type: String,
    enum: ['RAZORPAY'],
  },
  paymentGatewayOrderId: {
    type: String,
    trim: true,
  },
  paymentGatewayPaymentId: {
    type: String,
    trim: true,
  },
  paymentGatewaySignature: {
    type: String,
    trim: true,
  },
  paidAt: {
    type: Date,
  },
  orderStatus: {
    type: String,
    enum: ['PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
    default: 'PLACED'
  },
  deliveryPersonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'deliveryperson'
  },
  assignedWorkerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'worker'
  },
  subtotal: {
    type: Number,
    required: true
  },
  deliveryFee: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  expectedDeliveryTime: {
    type: Date
  },
  deliveredAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  cancelReason: {
    type: String
  },
  instructions: {
    type: String
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  feedback: {
    type: String
  }
}, { timestamps: true });

const Order = mongoose.model('order', orderSchema);

module.exports = Order;
