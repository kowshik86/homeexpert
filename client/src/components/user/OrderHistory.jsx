import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const STATUS_STEPS = ['PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'];
const ACTIVE_ORDER_STATUSES = ['PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'];
const CANCELLABLE_ORDER_STATUSES = ['PLACED', 'CONFIRMED', 'PREPARING'];

const getStatusStyles = (status) => {
  switch (status) {
    case 'DELIVERED':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'CANCELLED':
      return 'bg-rose-100 text-rose-800 border-rose-200';
    case 'OUT_FOR_DELIVERY':
      return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    case 'CONFIRMED':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'PREPARING':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

const formatStatus = (status) => {
  return (status || 'PLACED')
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const formatMoney = (value) => `Rs.${Number(value || 0).toFixed(2)}`;

const getTimelineIndex = (status) => {
  const normalizedStatus = status || 'PLACED';
  const foundIndex = STATUS_STEPS.indexOf(normalizedStatus);
  return foundIndex >= 0 ? foundIndex : 0;
};

const formatDate = (dateString) => {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

const formatDateTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getEtaText = (order) => {
  if (order.orderStatus === 'DELIVERED') {
    return 'Delivered';
  }

  if (order.orderStatus === 'CANCELLED') {
    return 'Order cancelled';
  }

  if (order.expectedDeliveryTime) {
    return `ETA ${formatDateTime(order.expectedDeliveryTime)}`;
  }

  return 'Preparing your order';
};

const StatusTimeline = ({ orderStatus }) => {
  if (orderStatus === 'CANCELLED') {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
        This order was cancelled.
      </div>
    );
  }

  const stepIndex = getTimelineIndex(orderStatus);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2">
        {STATUS_STEPS.map((step, index) => {
          const isCompleted = index <= stepIndex;
          const isCurrent = index === stepIndex;

          return (
            <div key={step} className="flex flex-1 items-center">
              <div className="flex flex-col items-center text-center w-full">
                <div
                  className={`h-7 w-7 rounded-full border-2 text-[10px] font-bold flex items-center justify-center ${
                    isCompleted
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'bg-white border-slate-300 text-slate-400'
                  } ${isCurrent ? 'ring-4 ring-emerald-100' : ''}`}
                >
                  {index + 1}
                </div>
                <span className={`mt-1 text-[10px] md:text-xs ${isCompleted ? 'text-slate-900' : 'text-slate-400'}`}>
                  {formatStatus(step)}
                </span>
              </div>
              {index < STATUS_STEPS.length - 1 ? (
                <div className={`hidden md:block h-1 flex-1 rounded-full ${index < stepIndex ? 'bg-emerald-500' : 'bg-slate-200'}`} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const OrderHistory = () => {
  const { currentUser } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionInProgress, setActionInProgress] = useState('');

  useEffect(() => {
    const fetchOrders = async (showInitialLoader = true) => {
      if (!currentUser?._id) {
        setIsLoading(false);
        return;
      }

      if (showInitialLoader) {
        setIsLoading(true);
      }

      try {
        const response = await fetch(`http://localhost:3000/order-api/orders/${currentUser._id}`);

        if (!response.ok) {
          throw new Error('Failed to fetch orders');
        }

        const data = await response.json();
        const normalizedOrders = Array.isArray(data.payload) ? data.payload : [];
        setOrders(normalizedOrders);

        if (selectedOrderId) {
          const selectedExists = normalizedOrders.some((order) => order._id === selectedOrderId);
          if (!selectedExists) {
            setSelectedOrderId('');
          }
        }
      } catch (error) {
        console.error('Error fetching orders:', error);
        if (showInitialLoader) {
          toast.error('Failed to load order history');
        }
      } finally {
        if (showInitialLoader) {
          setIsLoading(false);
        }
      }
    };

    fetchOrders(true);

    const pollInterval = setInterval(() => {
      fetchOrders(false);
    }, 20000);

    return () => clearInterval(pollInterval);
  }, [currentUser]);

  const handleViewDetails = (order) => {
    setSelectedOrderId(order._id);
  };

  const renderServiceBookingSummary = (order) => {
    if (order.bookingType !== 'service' || !order.serviceBooking) {
      return null;
    }

    return (
      <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4 space-y-2">
        <div className="flex items-center gap-3">
          <img
            src={order.serviceBooking.serviceImage || 'https://via.placeholder.com/400x240?text=Service+Booking'}
            alt={order.serviceBooking.serviceName || 'Service booking'}
            className="h-14 w-14 rounded-xl object-cover border border-cyan-100"
          />
          <div>
            <p className="text-sm font-bold text-cyan-900">{order.serviceBooking.serviceName}</p>
            <p className="text-xs text-cyan-700">{order.serviceBooking.packageName}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-cyan-900">
          <div className="rounded-xl bg-white/80 p-3">
            <p className="text-xs text-cyan-700 uppercase tracking-wide">Scheduled For</p>
            <p className="mt-1 font-semibold">{order.serviceBooking.scheduledFor ? formatDateTime(order.serviceBooking.scheduledFor) : 'Soon'}</p>
          </div>
          <div className="rounded-xl bg-white/80 p-3">
            <p className="text-xs text-cyan-700 uppercase tracking-wide">Estimated Duration</p>
            <p className="mt-1 font-semibold">{order.serviceBooking.estimatedDurationMins || 0} mins</p>
          </div>
          <div className="rounded-xl bg-white/80 p-3">
            <p className="text-xs text-cyan-700 uppercase tracking-wide">Assigned Area</p>
            <p className="mt-1 font-semibold">{order.deliveryAddress.city}, {order.deliveryAddress.state}</p>
          </div>
        </div>
        {order.serviceBooking.notes ? (
          <p className="text-xs text-cyan-800 bg-white/70 border border-cyan-100 rounded-xl p-3">{order.serviceBooking.notes}</p>
        ) : null}
      </div>
    );
  };

  const handleCloseDetails = () => {
    setSelectedOrderId('');
  };

  const canCancelOrder = (orderStatus) => CANCELLABLE_ORDER_STATUSES.includes(orderStatus);

  const handleReorder = (order) => {
    if (!order?.orderItems?.length) {
      toast.error('No items found in this order to reorder.');
      return;
    }

    order.orderItems.forEach((item) => {
      addToCart({
        _id: item.productId,
        productType: item.productType || 'shopItem',
        name: item.name,
        imageUrl: item.imageUrl,
        price: Number(item.price || 0),
        quantity: Number(item.quantity || 1),
      });
    });

    toast.success('Items added to cart. Ready to checkout again.');
    navigate('/cart');
  };

  const handleCancelOrder = async (order) => {
    if (!canCancelOrder(order?.orderStatus)) {
      toast.info('This order can no longer be cancelled at this stage.');
      return;
    }

    const shouldCancel = window.confirm('Do you want to cancel this order?');
    if (!shouldCancel) {
      return;
    }

    try {
      setActionInProgress(order._id);
      const response = await fetch(`http://localhost:3000/order-api/order/${order._id}/cancel`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cancelReason: 'Cancelled by user from app',
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Failed to cancel order');
      }

      setOrders((prevOrders) =>
        prevOrders.map((existingOrder) =>
          existingOrder._id === order._id
            ? { ...existingOrder, ...(data.payload || {}), orderStatus: 'CANCELLED' }
            : existingOrder,
        ),
      );

      toast.success('Order cancelled successfully.');
    } catch (error) {
      toast.error(error.message || 'Failed to cancel order');
    } finally {
      setActionInProgress('');
    }
  };

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'ALL') {
      return orders;
    }

    if (statusFilter === 'ACTIVE') {
      return orders.filter((order) => ACTIVE_ORDER_STATUSES.includes(order.orderStatus));
    }

    if (statusFilter === 'COMPLETED') {
      return orders.filter((order) => ['DELIVERED', 'CANCELLED'].includes(order.orderStatus));
    }

    return orders;
  }, [orders, statusFilter]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order._id === selectedOrderId) || null,
    [orders, selectedOrderId],
  );

  const activeOrdersCount = useMemo(
    () => orders.filter((order) => ACTIVE_ORDER_STATUSES.includes(order.orderStatus)).length,
    [orders],
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-custom"></div>
        <p className="mt-4 text-gray-600">Loading your orders...</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="mx-auto w-24 h-24 bg-gradient-to-br from-orange-50 to-cyan-50 rounded-full flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-900">No orders yet</h3>
        <p className="mt-1 text-slate-500">As soon as you place an order, live status tracking appears here.</p>
        <button
          onClick={() => window.location.href = '/products'}
          className="mt-6 inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-primary-custom hover:bg-opacity-90 focus:outline-none"
        >
          Start Shopping
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-orange-100 bg-gradient-to-r from-orange-50 via-white to-cyan-50 p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">My Orders</h2>
            <p className="text-sm text-slate-600 mt-1">Track your order updates in real-time with clear delivery progress.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800">
              Active: {activeOrdersCount}
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              Total: {orders.length}
            </span>
          </div>
        </div>
      </div>

      {selectedOrder ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 md:p-5 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Order Details</h3>
              <p className="text-sm text-slate-500">Order #{selectedOrder._id.substring(0, 8)}</p>
            </div>
            <button
              onClick={handleCloseDetails}
              className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Back
            </button>
          </div>

          <div className="p-4 md:p-5 border-b border-slate-100 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h4 className="text-sm font-medium text-slate-500">Order Date</h4>
                <p className="text-sm text-slate-900">{formatDateTime(selectedOrder.createdAt)}</p>
              </div>
              <div className="text-left md:text-right">
                <h4 className="text-sm font-medium text-slate-500">Status</h4>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusStyles(selectedOrder.orderStatus)}`}>
                  {formatStatus(selectedOrder.orderStatus)}
                </span>
                <p className="text-xs text-slate-500 mt-1">{getEtaText(selectedOrder)}</p>
              </div>
            </div>

            <StatusTimeline orderStatus={selectedOrder.orderStatus} />
          </div>

          <div className="p-4 md:p-5 border-b border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="mb-4">
              <h4 className="text-sm font-medium text-slate-500 mb-2">Delivery Address</h4>
              <div className="text-sm text-slate-900 space-y-0.5">
                <p>{selectedOrder.deliveryAddress.fullName}</p>
                <p>{selectedOrder.deliveryAddress.addressLine1}</p>
                {selectedOrder.deliveryAddress.addressLine2 && <p>{selectedOrder.deliveryAddress.addressLine2}</p>}
                <p>{selectedOrder.deliveryAddress.city}, {selectedOrder.deliveryAddress.state} - {selectedOrder.deliveryAddress.pincode}</p>
                <p>Phone: {selectedOrder.deliveryAddress.mobileNumber}</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-2">Payment Information</h4>
              <div className="text-sm text-slate-900 space-y-0.5">
                <p>Method: {selectedOrder.paymentMethod || 'COD'}</p>
                <p>Status: {selectedOrder.paymentStatus || 'PENDING'}</p>
                <p>Last Update: {formatDateTime(selectedOrder.updatedAt)}</p>
                {selectedOrder.bookingType === 'service' ? <p>Type: Service Booking</p> : <p>Type: Product Order</p>}
              </div>
            </div>
          </div>

          {renderServiceBookingSummary(selectedOrder) ? (
            <div className="p-4 md:p-5 border-b border-slate-100">
              {renderServiceBookingSummary(selectedOrder)}
            </div>
          ) : null}

          <div className="p-4 md:p-5 border-b border-slate-100">
            <h4 className="text-sm font-medium text-slate-500 mb-3">Order Items</h4>
            {selectedOrder.orderItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                This is a service booking. Details are shown above.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {selectedOrder.orderItems.map((item, index) => (
                  <li key={index} className="py-3 flex">
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full object-cover object-center"
                    />
                  </div>
                  <div className="ml-4 flex flex-1 flex-col">
                    <div>
                      <div className="flex justify-between text-base font-medium text-slate-900">
                        <h3>{item.name}</h3>
                        <p className="ml-4">{formatMoney(item.price)}</p>
                      </div>
                    </div>
                    <div className="flex flex-1 items-end justify-between text-sm">
                      <p className="text-slate-500">Qty {item.quantity}</p>
                      <p className="text-slate-500">{formatMoney(item.totalPrice)}</p>
                    </div>
                  </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="p-4 md:p-5 bg-slate-50">
            <div className="flex justify-between text-base font-medium text-slate-900 mb-2">
              <p>Subtotal</p>
              <p>{formatMoney(selectedOrder.subtotal)}</p>
            </div>
            <div className="flex justify-between text-sm text-slate-500 mb-2">
              <p>Delivery Fee</p>
              <p>{formatMoney(selectedOrder.deliveryFee)}</p>
            </div>
            {selectedOrder.discount > 0 && (
              <div className="flex justify-between text-sm text-emerald-600 mb-2">
                <p>Discount</p>
                <p>-{formatMoney(selectedOrder.discount)}</p>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t border-slate-200">
              <p>Total</p>
              <p>{formatMoney(selectedOrder.totalAmount)}</p>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                onClick={() => handleReorder(selectedOrder)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Reorder
              </button>
              <button
                onClick={() => handleCancelOrder(selectedOrder)}
                disabled={!canCancelOrder(selectedOrder.orderStatus) || actionInProgress === selectedOrder._id}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-rose-300"
              >
                {actionInProgress === selectedOrder._id ? 'Cancelling...' : 'Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {['ALL', 'ACTIVE', 'COMPLETED'].map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                  statusFilter === filter
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {filteredOrders.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center text-slate-600 text-sm">
              No orders match this filter.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const previewNames = order.orderItems.slice(0, 2).map((item) => item.name).join(', ');
                const remainingItems = order.orderItems.length > 2 ? ` +${order.orderItems.length - 2} more` : '';
                const isActiveOrder = ACTIVE_ORDER_STATUSES.includes(order.orderStatus);

                return (
                  <div
                    key={order._id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-slate-900">Order #{order._id.substring(0, 8)}</p>
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusStyles(order.orderStatus)}`}>
                            {formatStatus(order.orderStatus)}
                          </span>
                          {isActiveOrder ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                              Live
                            </span>
                          ) : null}
                        </div>

                        <p className="text-xs text-slate-500 mt-1">Placed on {formatDate(order.createdAt)}</p>
                        <p className="text-sm text-slate-700 mt-2">{previewNames}{remainingItems}</p>
                        <p className="text-xs text-slate-500 mt-1">{getEtaText(order)}</p>
                      </div>

                      <div className="text-left md:text-right">
                        <p className="text-sm text-slate-500">Total</p>
                        <p className="text-lg font-bold text-slate-900">{formatMoney(order.totalAmount)}</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <StatusTimeline orderStatus={order.orderStatus} />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                      <button
                        onClick={() => handleReorder(order)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Reorder
                      </button>
                      <button
                        onClick={() => handleCancelOrder(order)}
                        disabled={!canCancelOrder(order.orderStatus) || actionInProgress === order._id}
                        className="rounded-lg px-3 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-rose-300"
                      >
                        {actionInProgress === order._id ? 'Cancelling...' : 'Cancel'}
                      </button>
                      <button
                        onClick={() => handleViewDetails(order)}
                        className="rounded-lg bg-primary-custom px-4 py-2 text-sm font-semibold text-white hover:bg-opacity-90"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OrderHistory;
