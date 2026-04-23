const express = require('express');
const orderApp = express.Router();
const orderModel = require('../models/orderModel');
const userModel = require('../models/userModel');
const workerModel = require('../models/workerModel');
const shopItemsModel = require('../models/shopItemsModel');
const shopGoodsModel = require('../models/shopGoodsModel');
const shopKeeperModel = require('../models/shopKeeperModel');
const expressAsyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const crypto = require('crypto');
const Razorpay = require('razorpay');

const ACTIVE_DELIVERY_STATUSES = ['PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'];
const CANCELLABLE_STATUSES = ['PLACED', 'CONFIRMED', 'PREPARING'];
const WORKER_ACTIVE_ASSIGNMENT_STATUSES = ['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'];
const DEFAULT_SERVICE_DURATION_MINS = 60;
const SERVICE_MATCHING_KEYWORDS = {
  cleaning: ['cleaning', 'home cleaning', 'deep cleaning', 'sofa cleaning'],
  appliance: ['appliance', 'ac', 'fridge', 'washing machine', 'repair'],
  plumbing: ['plumbing', 'pipe', 'tap', 'bathroom'],
  electrical: ['electrical', 'electric', 'wiring', 'switchboard', 'fan'],
};
const PAYMENT_PROVIDER = 'RAZORPAY';

const populateOrderRelations = (query) => {
  return query
    .populate('deliveryPersonId', 'firstName lastName mobileNumber profileImg vehicleType vehicleNumber')
    .populate('assignedWorkerId', 'firstName lastName mobileNumber profileImg workTypes');
};

const hasRazorpayCredentials = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

const getRazorpayClient = () => new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const safeEqual = (leftValue, rightValue) => {
  const left = Buffer.from(String(leftValue || ''), 'utf8');
  const right = Buffer.from(String(rightValue || ''), 'utf8');
  if (left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
};

const verifyRazorpaySignature = ({ orderId, paymentId, signature }) => {
  const signedPayload = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(signedPayload)
    .digest('hex');

  return safeEqual(expectedSignature, signature);
};

const extractGatewayPayment = (orderData = {}) => ({
  orderId: orderData.paymentGatewayOrderId || orderData.razorpayOrderId || orderData.razorpay_order_id,
  paymentId: orderData.paymentGatewayPaymentId || orderData.razorpayPaymentId || orderData.razorpay_payment_id,
  signature: orderData.paymentGatewaySignature || orderData.razorpaySignature || orderData.razorpay_signature,
});

const normalizeText = (value) => String(value || '').toLowerCase();

const getServiceTerms = (serviceBooking = {}) => {
  const slug = normalizeText(serviceBooking.serviceSlug);
  const serviceName = normalizeText(serviceBooking.serviceName);
  const mappedTerms = SERVICE_MATCHING_KEYWORDS[slug] || [];
  return Array.from(new Set([slug, serviceName, ...mappedTerms].filter(Boolean)));
};

const matchWorkerForBooking = async (serviceBooking = {}) => {
  const terms = getServiceTerms(serviceBooking);
  const workers = await workerModel.find({ isAvailable: true });

  const matchedWorker = workers.find((worker) => {
    const workerWorkTypes = Array.isArray(worker.workTypes) ? worker.workTypes.map(normalizeText) : [];
    return workerWorkTypes.some((workType) => terms.some((term) => workType.includes(term) || term.includes(workType)));
  });

  return matchedWorker || workers[0] || null;
};

const getBookingWindow = (booking = {}) => {
  const scheduledAt = booking?.serviceBooking?.scheduledFor ? new Date(booking.serviceBooking.scheduledFor) : null;
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
    return null;
  }

  const durationMins = Math.max(1, Number(booking?.serviceBooking?.estimatedDurationMins || DEFAULT_SERVICE_DURATION_MINS));
  const startTime = scheduledAt.getTime();
  const endTime = startTime + (durationMins * 60 * 1000);

  return { startTime, endTime };
};

const hasTimeOverlap = (firstWindow, secondWindow) => {
  return firstWindow.startTime < secondWindow.endTime && secondWindow.startTime < firstWindow.endTime;
};

const hasOverlappingWorkerBooking = ({ targetOrder, activeBookings }) => {
  const targetWindow = getBookingWindow(targetOrder);
  if (!targetWindow) {
    // If schedule is missing, be conservative and avoid over-booking when another active booking exists.
    return activeBookings.length > 0;
  }

  return activeBookings.some((booking) => {
    const existingWindow = getBookingWindow(booking);
    if (!existingWindow) {
      return true;
    }

    return hasTimeOverlap(targetWindow, existingWindow);
  });
};

const isValidLatitude = (value) => Number.isFinite(value) && value >= -90 && value <= 90;
const isValidLongitude = (value) => Number.isFinite(value) && value >= -180 && value <= 180;

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeProductType = (value) => {
  const normalizedValue = String(value || '').trim().toLowerCase();
  return normalizedValue === 'shopgood' ? 'shopGood' : 'shopItem';
};

const normalizeStockName = (value) => String(value || '').trim().toLowerCase();

const getStockNames = (value) => {
  const names = Array.isArray(value) ? value : [value];
  return names.map(normalizeStockName).filter(Boolean);
};

const getCatalogModelByProductType = (productType) => {
  return normalizeProductType(productType) === 'shopGood' ? shopGoodsModel : shopItemsModel;
};

const aggregateOrderStockRequirements = (orderItems = []) => {
  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    throw createHttpError(400, 'At least one order item is required for product orders.');
  }

  const requirementMap = new Map();

  orderItems.forEach((item, index) => {
    const productId = String(item?.productId || '').trim();
    const productType = normalizeProductType(item?.productType);
    const requestedQuantity = Number(item?.quantity);
    const fallbackName = `Item ${index + 1}`;
    const displayName = String(item?.name || fallbackName).trim() || fallbackName;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw createHttpError(400, `Invalid product id for ${displayName}.`);
    }

    if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
      throw createHttpError(400, `Invalid quantity for ${displayName}.`);
    }

    const requirementKey = `${productType}:${productId}`;
    const existingRequirement = requirementMap.get(requirementKey);

    requirementMap.set(requirementKey, {
      productId,
      productType,
      displayName: existingRequirement?.displayName || displayName,
      requiredQuantity: Number(existingRequirement?.requiredQuantity || 0) + requestedQuantity,
    });
  });

  return Array.from(requirementMap.values());
};

const reserveCatalogStock = async (stockRequirements = []) => {
  const reservedEntries = [];

  try {
    for (const requirement of stockRequirements) {
      const catalogModel = getCatalogModelByProductType(requirement.productType);
      const catalogProduct = await catalogModel.findById(requirement.productId).select('quantity');

      if (!catalogProduct) {
        throw createHttpError(404, `${requirement.displayName} is no longer available.`);
      }

      if (Number(catalogProduct.quantity || 0) < Number(requirement.requiredQuantity || 0)) {
        throw createHttpError(
          409,
          `${requirement.displayName} has only ${Number(catalogProduct.quantity || 0)} left in stock.`,
        );
      }

      const reservationResult = await catalogModel.updateOne(
        { _id: requirement.productId, quantity: { $gte: requirement.requiredQuantity } },
        { $inc: { quantity: -requirement.requiredQuantity } },
      );

      if (!reservationResult.modifiedCount) {
        throw createHttpError(409, `${requirement.displayName} stock changed. Please refresh and try again.`);
      }

      reservedEntries.push({
        productId: requirement.productId,
        productType: requirement.productType,
        quantity: requirement.requiredQuantity,
      });
    }

    return reservedEntries;
  } catch (error) {
    if (reservedEntries.length > 0) {
      await rollbackCatalogStock(reservedEntries);
    }
    throw error;
  }
};

const rollbackCatalogStock = async (reservedEntries = []) => {
  if (!Array.isArray(reservedEntries) || reservedEntries.length === 0) {
    return;
  }

  await Promise.all(reservedEntries.map((entry) => {
    const catalogModel = getCatalogModelByProductType(entry.productType);
    return catalogModel.updateOne(
      { _id: entry.productId },
      { $inc: { quantity: Number(entry.quantity || 0) } },
    ).catch(() => null);
  }));
};

const prepareShopkeeperInventoryAdjustments = async (stockRequirements = []) => {
  const shopItemRequirements = stockRequirements.filter((entry) => entry.productType === 'shopItem');
  if (shopItemRequirements.length === 0) {
    return [];
  }

  const shopkeepers = await shopKeeperModel.find({ 'products.quantity': { $gt: 0 } });
  const changedShopkeepers = new Map();

  for (const requirement of shopItemRequirements) {
    let remainingQuantity = Number(requirement.requiredQuantity || 0);
    const requiredProductId = String(requirement.productId);
    const requiredName = normalizeStockName(requirement.displayName);
    const candidates = [];

    for (const shopkeeper of shopkeepers) {
      const products = Array.isArray(shopkeeper.products) ? shopkeeper.products : [];

      for (const product of products) {
        const currentQuantity = Number(product.quantity || 0);
        if (currentQuantity <= 0) {
          continue;
        }

        const productCatalogItemId = String(product.catalogItemId || '');
        const productNameMatches = requiredName && getStockNames(product.name).includes(requiredName);
        const productIdMatches = productCatalogItemId && productCatalogItemId === requiredProductId;

        if (!productIdMatches && !productNameMatches) {
          continue;
        }

        candidates.push({
          shopkeeper,
          product,
          currentQuantity,
        });
      }
    }

    candidates.sort((left, right) => right.currentQuantity - left.currentQuantity);

    for (const candidate of candidates) {
      if (remainingQuantity <= 0) {
        break;
      }

      const availableQuantity = Number(candidate.product.quantity || 0);
      const deduction = Math.min(availableQuantity, remainingQuantity);
      if (deduction <= 0) {
        continue;
      }

      candidate.product.quantity = availableQuantity - deduction;
      remainingQuantity -= deduction;
      changedShopkeepers.set(String(candidate.shopkeeper._id), candidate.shopkeeper);
    }
  }

  return Array.from(changedShopkeepers.values());
};

const savePreparedShopkeeperInventoryChanges = async (preparedShopkeepers = []) => {
  for (const shopkeeper of preparedShopkeepers) {
    await shopkeeper.save();
  }
};

const reserveStockForProductOrder = async (orderItems = []) => {
  const stockRequirements = aggregateOrderStockRequirements(orderItems);
  const preparedShopkeepers = await prepareShopkeeperInventoryAdjustments(stockRequirements);
  const catalogReservations = await reserveCatalogStock(stockRequirements);

  return {
    catalogReservations,
    preparedShopkeepers,
  };
};

orderApp.get('/payment/config', expressAsyncHandler(async (req, res) => {
  res.status(200).send({
    message: 'Payment gateway configuration fetched successfully',
    payload: {
      provider: PAYMENT_PROVIDER,
      enabled: hasRazorpayCredentials(),
      keyId: process.env.RAZORPAY_KEY_ID || '',
    },
  });
}));

orderApp.post('/payment/create-order', expressAsyncHandler(async (req, res) => {
  if (!hasRazorpayCredentials()) {
    return res.status(503).send({ message: 'Online payments are not configured yet.' });
  }

  const amountRupees = Number(req.body?.amount || 0);
  const amountInPaise = Math.round(amountRupees * 100);
  const currency = String(req.body?.currency || 'INR').toUpperCase();
  const receipt = String(req.body?.receipt || `homexpert_${Date.now()}`).slice(0, 40);
  const notes = typeof req.body?.notes === 'object' && req.body.notes ? req.body.notes : {};

  if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
    return res.status(400).send({ message: 'Valid amount is required to create a payment order.' });
  }

  const gatewayOrder = await getRazorpayClient().orders.create({
    amount: amountInPaise,
    currency,
    receipt,
    notes,
  });

  res.status(201).send({
    message: 'Payment order created successfully',
    payload: gatewayOrder,
  });
}));

orderApp.post('/payment/verify', expressAsyncHandler(async (req, res) => {
  if (!hasRazorpayCredentials()) {
    return res.status(503).send({ message: 'Online payments are not configured yet.' });
  }

  const orderId = req.body?.razorpay_order_id || req.body?.orderId;
  const paymentId = req.body?.razorpay_payment_id || req.body?.paymentId;
  const signature = req.body?.razorpay_signature || req.body?.signature;

  if (!orderId || !paymentId || !signature) {
    return res.status(400).send({ message: 'Payment verification details are required.' });
  }

  const verified = verifyRazorpaySignature({ orderId, paymentId, signature });
  if (!verified) {
    return res.status(400).send({ message: 'Invalid payment signature.' });
  }

  res.status(200).send({
    message: 'Payment verified successfully',
    payload: {
      verified: true,
      paymentGateway: PAYMENT_PROVIDER,
      paymentGatewayOrderId: orderId,
      paymentGatewayPaymentId: paymentId,
      paymentGatewaySignature: signature,
    },
  });
}));

// Create a new order
orderApp.post('/order', expressAsyncHandler(async (req, res) => {
  let reservedCatalogEntries = [];

  try {
    const orderData = req.body;
    let preparedShopkeepers = [];

    orderData.bookingType = orderData.bookingType === 'service' ? 'service' : 'product';
    
    // Validate user exists
    const user = await userModel.findById(orderData.userId);
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    const normalizedPaymentMethod = String(orderData.paymentMethod || 'COD').toUpperCase();
    orderData.paymentMethod = ['COD', 'ONLINE', 'UPI', 'WALLET'].includes(normalizedPaymentMethod) ? normalizedPaymentMethod : 'COD';

    if (['ONLINE', 'UPI'].includes(orderData.paymentMethod)) {
      if (!hasRazorpayCredentials()) {
        return res.status(503).send({ message: 'Online payments are not configured yet.' });
      }

      const gatewayPayment = extractGatewayPayment(orderData);
      if (!gatewayPayment.orderId || !gatewayPayment.paymentId || !gatewayPayment.signature) {
        return res.status(400).send({ message: 'Verified online payment details are required.' });
      }

      const verified = verifyRazorpaySignature(gatewayPayment);
      if (!verified) {
        return res.status(400).send({ message: 'Online payment verification failed. Please try again.' });
      }

      orderData.paymentStatus = 'PAID';
      orderData.paymentGateway = PAYMENT_PROVIDER;
      orderData.paymentGatewayOrderId = gatewayPayment.orderId;
      orderData.paymentGatewayPaymentId = gatewayPayment.paymentId;
      orderData.paymentGatewaySignature = gatewayPayment.signature;
      orderData.paidAt = new Date();
    } else {
      orderData.paymentStatus = orderData.paymentStatus || 'PENDING';
    }

    if (orderData.bookingType === 'service') {
      if (!orderData.serviceBooking?.serviceName || !orderData.serviceBooking?.scheduledFor) {
        return res.status(400).send({ message: 'Service booking details are required' });
      }

      const matchedWorker = await matchWorkerForBooking(orderData.serviceBooking);
      if (matchedWorker) {
        orderData.assignedWorkerId = matchedWorker._id;
      }

      orderData.orderItems = [];
      orderData.subtotal = Number(orderData.serviceBooking.estimatedPrice || orderData.subtotal || 0);
      orderData.totalAmount = Number(orderData.serviceBooking.estimatedPrice || orderData.totalAmount || 0);
      orderData.deliveryFee = 0;
      orderData.discount = 0;
      orderData.paymentStatus = orderData.paymentStatus || 'PENDING';
    } else {
      const stockReservation = await reserveStockForProductOrder(orderData.orderItems || []);
      reservedCatalogEntries = stockReservation.catalogReservations;
      preparedShopkeepers = stockReservation.preparedShopkeepers;
    }
    
    // Create new order
    const newOrder = new orderModel(orderData);
    const savedOrder = await newOrder.save();

    if (preparedShopkeepers.length > 0) {
      try {
        await savePreparedShopkeeperInventoryChanges(preparedShopkeepers);
      } catch (shopkeeperSyncError) {
        console.error('Shopkeeper inventory sync failed after order save:', shopkeeperSyncError);
      }
    }

    reservedCatalogEntries = [];
    
    res.status(201).send({ 
      message: "Order placed successfully", 
      payload: savedOrder 
    });
  } catch (error) {
    const statusCode = Number(error.statusCode || 500);

    if (Array.isArray(reservedCatalogEntries) && reservedCatalogEntries.length > 0) {
      await rollbackCatalogStock(reservedCatalogEntries);
    }

    res.status(statusCode).send({ 
      message: error.message || "Failed to place order", 
      error: error.message 
    });
  }
}));

// Get all orders for a user
orderApp.get('/orders/:userId', expressAsyncHandler(async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Find all orders for the user
    const orders = await populateOrderRelations(orderModel.find({ userId }).sort({ createdAt: -1 }));
    
    res.status(200).send({ 
      message: "Orders fetched successfully", 
      payload: orders 
    });
  } catch (error) {
    res.status(500).send({ 
      message: "Failed to fetch orders", 
      error: error.message 
    });
  }
}));

// Get all service bookings assigned to a worker
orderApp.get('/worker/bookings/:workerId', expressAsyncHandler(async (req, res) => {
  try {
    const { workerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(workerId)) {
      return res.status(400).send({ message: 'Invalid workerId' });
    }

    const bookings = await orderModel.find({
      bookingType: 'service',
      assignedWorkerId: workerId,
    }).sort({ createdAt: -1 });

    res.status(200).send({
      message: 'Worker bookings fetched successfully',
      payload: bookings,
    });
  } catch (error) {
    res.status(500).send({
      message: 'Failed to fetch worker bookings',
      error: error.message,
    });
  }
}));

// Get a specific order by ID
orderApp.get('/order/:orderId', expressAsyncHandler(async (req, res) => {
  try {
    const orderId = req.params.orderId;
    
    // Find the order
    const order = await populateOrderRelations(orderModel.findById(orderId));
    
    if (!order) {
      return res.status(404).send({ message: "Order not found" });
    }
    
    res.status(200).send({ 
      message: "Order fetched successfully", 
      payload: order 
    });
  } catch (error) {
    res.status(500).send({ 
      message: "Failed to fetch order", 
      error: error.message 
    });
  }
}));

// Update order status
orderApp.patch('/order/:orderId/status', expressAsyncHandler(async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { orderStatus, deliveryPersonId, workerId } = req.body;

    const updatePayload = {
      orderStatus,
      ...(orderStatus === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
      ...(orderStatus === 'CANCELLED' ? { cancelledAt: new Date(), cancelReason: req.body.cancelReason } : {}),
    };

    if (deliveryPersonId) {
      if (!mongoose.Types.ObjectId.isValid(deliveryPersonId)) {
        return res.status(400).send({ message: 'Invalid deliveryPersonId' });
      }
      updatePayload.deliveryPersonId = deliveryPersonId;
    }

    if (workerId) {
      if (!mongoose.Types.ObjectId.isValid(workerId)) {
        return res.status(400).send({ message: 'Invalid workerId' });
      }
      updatePayload.assignedWorkerId = workerId;
    }
    
    // Find and update the order
    const updatedOrder = await orderModel.findByIdAndUpdate(
      orderId,
      updatePayload,
      { new: true }
    );
    
    if (!updatedOrder) {
      return res.status(404).send({ message: "Order not found" });
    }
    
    res.status(200).send({ 
      message: "Order status updated successfully", 
      payload: updatedOrder 
    });
  } catch (error) {
    res.status(500).send({ 
      message: "Failed to update order status", 
      error: error.message 
    });
  }
}));

// Update delivery partner live GPS location for an active order
orderApp.patch('/order/:orderId/location', expressAsyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;
    const { deliveryPersonId, workerId, lat, lng, destinationLat, destinationLng } = req.body || {};

    const hasValidDeliveryPersonId = Boolean(deliveryPersonId && mongoose.Types.ObjectId.isValid(deliveryPersonId));
    const hasValidWorkerId = Boolean(workerId && mongoose.Types.ObjectId.isValid(workerId));

    if (!hasValidDeliveryPersonId && !hasValidWorkerId) {
      return res.status(400).send({ message: 'Valid deliveryPersonId or workerId is required' });
    }

    const latitude = Number(lat);
    const longitude = Number(lng);

    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
      return res.status(400).send({ message: 'Valid latitude and longitude are required' });
    }

    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.status(404).send({ message: 'Order not found' });
    }

    if (hasValidWorkerId) {
      if (String(order.assignedWorkerId || '') !== String(workerId)) {
        return res.status(403).send({ message: 'This booking is assigned to a different worker' });
      }

      if (!WORKER_ACTIVE_ASSIGNMENT_STATUSES.includes(order.orderStatus)) {
        return res.status(400).send({ message: 'Live location can be updated only for active worker bookings' });
      }
    } else {
      if (String(order.deliveryPersonId || '') !== String(deliveryPersonId)) {
        return res.status(403).send({ message: 'This order is assigned to a different delivery partner' });
      }

      if (order.orderStatus !== 'OUT_FOR_DELIVERY') {
        return res.status(400).send({ message: 'Live location can be updated only for out-for-delivery orders' });
      }
    }

    order.liveTracking = {
      ...(order.liveTracking || {}),
      deliveryPersonLocation: {
        lat: latitude,
        lng: longitude,
      },
      ...(hasValidWorkerId
        ? {
            workerLocation: {
              lat: latitude,
              lng: longitude,
            },
          }
        : {}),
      ...(isValidLatitude(Number(destinationLat)) && isValidLongitude(Number(destinationLng))
        ? {
            destinationLocation: {
              lat: Number(destinationLat),
              lng: Number(destinationLng),
            },
          }
        : {}),
      locationSyncedAt: new Date(),
      sourceRole: hasValidWorkerId ? 'worker' : 'delivery',
    };

    await order.save();

    res.status(200).send({
      message: 'Order live location updated successfully',
      payload: order.liveTracking,
    });
  } catch (error) {
    res.status(500).send({
      message: 'Failed to update live location',
      error: error.message,
    });
  }
}));

// Get active orders for delivery dashboard
orderApp.get('/delivery/orders', expressAsyncHandler(async (req, res) => {
  try {
    const { deliveryPersonId } = req.query;
    const query = {
      orderStatus: { $in: ACTIVE_DELIVERY_STATUSES },
    };

    if (deliveryPersonId) {
      if (!mongoose.Types.ObjectId.isValid(deliveryPersonId)) {
        return res.status(400).send({ message: 'Invalid deliveryPersonId' });
      }

      query.$or = [
        { deliveryPersonId },
        { deliveryPersonId: null },
        { deliveryPersonId: { $exists: false } },
      ];
    }

    const orders = await orderModel.find(query).sort({ createdAt: -1 });

    res.status(200).send({
      message: 'Delivery orders fetched successfully',
      payload: orders,
    });
  } catch (error) {
    res.status(500).send({
      message: 'Failed to fetch delivery orders',
      error: error.message,
    });
  }
}));

// Assign delivery person to an order
orderApp.patch('/delivery/order/:orderId/assign', expressAsyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;
    const { deliveryPersonId } = req.body;

    if (!deliveryPersonId || !mongoose.Types.ObjectId.isValid(deliveryPersonId)) {
      return res.status(400).send({ message: 'Valid deliveryPersonId is required' });
    }

    const activeAssignedOrder = await orderModel.findOne({
      deliveryPersonId,
      orderStatus: { $in: ACTIVE_DELIVERY_STATUSES },
      _id: { $ne: orderId },
    });

    if (activeAssignedOrder) {
      return res.status(409).send({
        message: 'You already have an active delivery. Complete it before accepting another order.',
      });
    }

    const targetOrder = await orderModel.findById(orderId);
    if (!targetOrder) {
      return res.status(404).send({ message: 'Order not found' });
    }

    if (targetOrder.deliveryPersonId && String(targetOrder.deliveryPersonId) !== String(deliveryPersonId)) {
      return res.status(409).send({ message: 'Order is already assigned to another delivery partner.' });
    }

    if (!ACTIVE_DELIVERY_STATUSES.includes(targetOrder.orderStatus)) {
      return res.status(400).send({
        message: `Order cannot be accepted at ${String(targetOrder.orderStatus || '').replace(/_/g, ' ')} stage`,
      });
    }

    const updatedOrder = await orderModel.findByIdAndUpdate(
      orderId,
      {
        deliveryPersonId,
        orderStatus: 'OUT_FOR_DELIVERY',
      },
      { new: true },
    );

    if (!updatedOrder) {
      return res.status(404).send({ message: 'Order not found' });
    }

    res.status(200).send({
      message: 'Order assigned successfully',
      payload: updatedOrder,
    });
  } catch (error) {
    res.status(500).send({
      message: 'Failed to assign order',
      error: error.message,
    });
  }
}));

// Update worker booking status directly
orderApp.patch('/worker/order/:orderId/status', expressAsyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderStatus, workerId } = req.body;

    if (!orderStatus) {
      return res.status(400).send({ message: 'orderStatus is required' });
    }

    if (workerId && !mongoose.Types.ObjectId.isValid(workerId)) {
      return res.status(400).send({ message: 'Invalid workerId' });
    }

    const targetOrder = await orderModel.findById(orderId);
    if (!targetOrder) {
      return res.status(404).send({ message: 'Order not found' });
    }

    if (workerId && WORKER_ACTIVE_ASSIGNMENT_STATUSES.includes(orderStatus)) {
      const activeWorkerAssignments = await orderModel.find({
        assignedWorkerId: workerId,
        orderStatus: { $in: WORKER_ACTIVE_ASSIGNMENT_STATUSES },
        _id: { $ne: orderId },
      });

      const overlapsExistingBooking = hasOverlappingWorkerBooking({
        targetOrder,
        activeBookings: activeWorkerAssignments,
      });

      if (overlapsExistingBooking) {
        return res.status(409).send({
          message: 'This booking overlaps with another active booking in your schedule.',
        });
      }
    }

    const updatePayload = {
      orderStatus,
      ...(workerId ? { assignedWorkerId: workerId } : {}),
      ...(orderStatus === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
      ...(orderStatus === 'CANCELLED' ? { cancelledAt: new Date(), cancelReason: req.body.cancelReason } : {}),
    };

    const updatedOrder = await orderModel.findByIdAndUpdate(orderId, updatePayload, { new: true });

    if (!updatedOrder) {
      return res.status(404).send({ message: 'Order not found' });
    }

    res.status(200).send({
      message: 'Worker booking status updated successfully',
      payload: updatedOrder,
    });
  } catch (error) {
    res.status(500).send({
      message: 'Failed to update worker booking status',
      error: error.message,
    });
  }
}));

// Release a worker lead back to the unassigned pool
orderApp.patch('/worker/order/:orderId/release', expressAsyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;

    const updatedOrder = await orderModel.findByIdAndUpdate(
      orderId,
      {
        $unset: { assignedWorkerId: 1 },
        orderStatus: 'PLACED',
      },
      { new: true },
    );

    if (!updatedOrder) {
      return res.status(404).send({ message: 'Order not found' });
    }

    res.status(200).send({
      message: 'Worker lead released successfully',
      payload: updatedOrder,
    });
  } catch (error) {
    res.status(500).send({
      message: 'Failed to release worker lead',
      error: error.message,
    });
  }
}));

// Add rating and feedback to an order
orderApp.patch('/order/:orderId/feedback', expressAsyncHandler(async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { rating, feedback } = req.body;
    
    // Find and update the order
    const updatedOrder = await orderModel.findByIdAndUpdate(
      orderId,
      { rating, feedback },
      { new: true }
    );
    
    if (!updatedOrder) {
      return res.status(404).send({ message: "Order not found" });
    }
    
    res.status(200).send({ 
      message: "Feedback added successfully", 
      payload: updatedOrder 
    });
  } catch (error) {
    res.status(500).send({ 
      message: "Failed to add feedback", 
      error: error.message 
    });
  }
}));

// Cancel an order (allowed only before out-for-delivery)
orderApp.patch('/order/:orderId/cancel', expressAsyncHandler(async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const cancelReason = (req.body?.cancelReason || '').trim() || 'Cancelled by user';

    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.status(404).send({ message: 'Order not found' });
    }

    if (!CANCELLABLE_STATUSES.includes(order.orderStatus)) {
      return res.status(400).send({
        message: `Order cannot be cancelled at ${order.orderStatus.replace(/_/g, ' ')} stage`,
      });
    }

    order.orderStatus = 'CANCELLED';
    order.cancelledAt = new Date();
    order.cancelReason = cancelReason;
    await order.save();

    res.status(200).send({
      message: 'Order cancelled successfully',
      payload: order,
    });
  } catch (error) {
    res.status(500).send({
      message: 'Failed to cancel order',
      error: error.message,
    });
  }
}));

// Get recent orders for a user (last 5 orders)
orderApp.get('/orders/:userId/recent', expressAsyncHandler(async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Find recent orders for the user
    const recentOrders = await populateOrderRelations(
      orderModel.find({ userId })
        .sort({ createdAt: -1 })
        .limit(5),
    );
    
    res.status(200).send({ 
      message: "Recent orders fetched successfully", 
      payload: recentOrders 
    });
  } catch (error) {
    res.status(500).send({ 
      message: "Failed to fetch recent orders", 
      error: error.message 
    });
  }
}));

module.exports = orderApp;
