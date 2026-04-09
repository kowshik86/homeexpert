const express = require('express');
const orderApp = express.Router();
const orderModel = require('../models/orderModel');
const userModel = require('../models/userModel');
const workerModel = require('../models/workerModel');
const expressAsyncHandler = require('express-async-handler');
const mongoose = require('mongoose');

const ACTIVE_DELIVERY_STATUSES = ['PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'];
const CANCELLABLE_STATUSES = ['PLACED', 'CONFIRMED', 'PREPARING'];
const SERVICE_MATCHING_KEYWORDS = {
  cleaning: ['cleaning', 'home cleaning', 'deep cleaning', 'sofa cleaning'],
  appliance: ['appliance', 'ac', 'fridge', 'washing machine', 'repair'],
  plumbing: ['plumbing', 'pipe', 'tap', 'bathroom'],
  electrical: ['electrical', 'electric', 'wiring', 'switchboard', 'fan'],
};

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

// Create a new order
orderApp.post('/order', expressAsyncHandler(async (req, res) => {
  try {
    const orderData = req.body;
    
    // Validate user exists
    const user = await userModel.findById(orderData.userId);
    if (!user) {
      return res.status(404).send({ message: "User not found" });
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
    }
    
    // Create new order
    const newOrder = new orderModel(orderData);
    const savedOrder = await newOrder.save();
    
    res.status(201).send({ 
      message: "Order placed successfully", 
      payload: savedOrder 
    });
  } catch (error) {
    res.status(500).send({ 
      message: "Failed to place order", 
      error: error.message 
    });
  }
}));

// Get all orders for a user
orderApp.get('/orders/:userId', expressAsyncHandler(async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Find all orders for the user
    const orders = await orderModel.find({ userId }).sort({ createdAt: -1 });
    
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
    const order = await orderModel.findById(orderId);
    
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
    const recentOrders = await orderModel.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5);
    
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
