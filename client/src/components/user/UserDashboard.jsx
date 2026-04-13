import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useLocation, useNavigate } from 'react-router-dom';
import UserProfile from './UserProfile';
import SavedAddresses from './SavedAddresses';
import Favorites from './Favorites';
import { toast } from 'react-toastify';

const ACTIVE_ORDER_STATUSES = ['PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'];
const CLOSED_ORDER_STATUSES = ['DELIVERED', 'CANCELLED'];
const FALLBACK_GROCERY_IMAGE = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80';
const FALLBACK_SERVICE_IMAGE = 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80';
const APPLIANCE_REPAIR_IMAGE = 'https://images.pexels.com/photos/5691664/pexels-photo-5691664.jpeg?auto=compress&cs=tinysrgb&w=1200';

const SERVICE_IMAGE_BY_SLUG = {
  cleaning: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80',
  'appliance-repair': APPLIANCE_REPAIR_IMAGE,
  plumbing: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=80',
  electrical: 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=1200&q=80',
};

const isGroceryOrder = (order) => order?.bookingType !== 'service';
const isServiceOrder = (order) => order?.bookingType === 'service';

const getOrderItems = (order) => (Array.isArray(order?.orderItems) ? order.orderItems : []);

const getOrderItemCount = (order) => {
  return getOrderItems(order).reduce((total, item) => total + Number(item?.quantity || 0), 0);
};

const formatMoney = (value) => `Rs.${Number(value || 0).toFixed(2)}`;

const formatOrderDate = (dateValue) => {
  const date = dateValue ? new Date(dateValue) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getEtaText = (order) => {
  if (order.orderStatus === 'DELIVERED') {
    return 'Delivered';
  }

  if (order.orderStatus === 'CANCELLED') {
    return 'Cancelled';
  }

  if (!order.expectedDeliveryTime) {
    return 'ETA will be updated soon';
  }

  return `ETA ${formatOrderDate(order.expectedDeliveryTime)}`;
};

const getOrderPreviewItem = (order) => getOrderItems(order)[0] || null;

const getOrderPreviewImage = (order) => {
  const imageUrl = typeof getOrderPreviewItem(order)?.imageUrl === 'string'
    ? getOrderPreviewItem(order).imageUrl.trim()
    : '';

  return /^https?:\/\//i.test(imageUrl) ? imageUrl : FALLBACK_GROCERY_IMAGE;
};

const getServiceImageByMeta = (serviceSlug, serviceName) => {
  if (serviceSlug && SERVICE_IMAGE_BY_SLUG[serviceSlug]) {
    return SERVICE_IMAGE_BY_SLUG[serviceSlug];
  }

  const normalizedName = String(serviceName || '').toLowerCase();
  if (normalizedName.includes('appliance') || normalizedName.includes('repair')) {
    return SERVICE_IMAGE_BY_SLUG['appliance-repair'];
  }
  if (normalizedName.includes('plumb')) {
    return SERVICE_IMAGE_BY_SLUG.plumbing;
  }
  if (normalizedName.includes('electri')) {
    return SERVICE_IMAGE_BY_SLUG.electrical;
  }
  if (normalizedName.includes('clean')) {
    return SERVICE_IMAGE_BY_SLUG.cleaning;
  }

  return FALLBACK_SERVICE_IMAGE;
};

const getServiceImageFromOrder = (order) => {
  const canonicalImage = getServiceImageByMeta(order?.serviceBooking?.serviceSlug, order?.serviceBooking?.serviceName);
  if (canonicalImage !== FALLBACK_SERVICE_IMAGE) {
    return canonicalImage;
  }

  const storedImage = typeof order?.serviceBooking?.serviceImage === 'string'
    ? order.serviceBooking.serviceImage.trim()
    : '';

  return /^https?:\/\//i.test(storedImage) ? storedImage : FALLBACK_SERVICE_IMAGE;
};

const formatOrderStatus = (status) => {
  return (status || 'PLACED')
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'OUT_FOR_DELIVERY':
      return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    case 'PREPARING':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'CONFIRMED':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    default:
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  }
};

const UserDashboard = () => {
  const { currentUser, logout, openAuthModal } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const urlTab = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    const allowedTabs = ['profile', 'orders', 'addresses', 'favorites'];
    return tab && allowedTabs.includes(tab) ? tab : 'profile';
  }, [location.search]);
  const urlOrderScope = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('scope') === 'services' ? 'services' : 'groceries';
  }, [location.search]);
  const [activeTab, setActiveTab] = useState(urlTab);
  const [activeOrder, setActiveOrder] = useState(null);
  const [loadingActiveOrder, setLoadingActiveOrder] = useState(true);
  const [groceryOrders, setGroceryOrders] = useState([]);
  const [loadingGroceryOrders, setLoadingGroceryOrders] = useState(false);
  const [groceryOrdersError, setGroceryOrdersError] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [expandedOrderId, setExpandedOrderId] = useState('');

  const isServiceScope = activeTab === 'orders' && urlOrderScope === 'services';

  useEffect(() => {
    // Redirect to home if not logged in and not viewing the orders page
    if (!currentUser && urlTab !== 'orders') {
      navigate('/');
    }
  }, [currentUser, urlTab, navigate]);

  useEffect(() => {
    setActiveTab(urlTab);
  }, [urlTab]);

  useEffect(() => {
    const fetchActiveOrder = async (showLoader = false) => {
      if (!currentUser?._id) {
        setLoadingActiveOrder(false);
        setActiveOrder(null);
        return;
      }

      if (showLoader) {
        setLoadingActiveOrder(true);
      }

      try {
        const response = await fetch(`http://localhost:3000/order-api/orders/${currentUser._id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch orders');
        }

        const data = await response.json();
        const allOrders = Array.isArray(data.payload) ? data.payload : [];
        const groceryOrdersOnly = allOrders.filter(isGroceryOrder);
        const firstActive = groceryOrdersOnly.find((order) => ACTIVE_ORDER_STATUSES.includes(order.orderStatus));
        setActiveOrder(firstActive || null);
      } catch (error) {
        console.error('Error loading active order:', error);
      } finally {
        if (showLoader) {
          setLoadingActiveOrder(false);
        }
      }
    };

    fetchActiveOrder(true);

    const polling = setInterval(() => {
      fetchActiveOrder(false);
    }, 20000);

    return () => clearInterval(polling);
  }, [currentUser]);

  useEffect(() => {
    const fetchGroceryOrders = async () => {
      if (activeTab !== 'orders') {
        return;
      }

      if (!currentUser?._id) {
        setGroceryOrders([]);
        setGroceryOrdersError('');
        setLoadingGroceryOrders(false);
        return;
      }

      try {
        setLoadingGroceryOrders(true);
        setGroceryOrdersError('');

        const response = await fetch(`http://localhost:3000/order-api/orders/${currentUser._id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch grocery orders');
        }

        const data = await response.json();
        const allOrders = Array.isArray(data.payload) ? data.payload : [];
        const scopedOrders = allOrders
          .filter((order) => (urlOrderScope === 'services' ? isServiceOrder(order) : isGroceryOrder(order)))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        setGroceryOrders(scopedOrders);
      } catch (error) {
        setGroceryOrdersError(error.message || 'Failed to fetch grocery orders');
      } finally {
        setLoadingGroceryOrders(false);
      }
    };

    fetchGroceryOrders();
  }, [activeTab, currentUser, urlOrderScope]);

  const orderSummaryLabel = useMemo(() => {
    if (!activeOrder) {
      return 'No active orders right now';
    }

    return `Order #${activeOrder._id.substring(0, 8)} is ${formatOrderStatus(activeOrder.orderStatus)}`;
  }, [activeOrder]);

  const filteredGroceryOrders = useMemo(() => {
    const normalizedSearch = orderSearch.trim().toLowerCase();

    return groceryOrders.filter((order) => {
      const statusMatches =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'ACTIVE'
            ? ACTIVE_ORDER_STATUSES.includes(order.orderStatus)
            : CLOSED_ORDER_STATUSES.includes(order.orderStatus);

      if (!statusMatches) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const orderIdPart = String(order?._id || '').toLowerCase();
      const serviceMeta = [
        order?.serviceBooking?.serviceName,
        order?.serviceBooking?.packageName,
        order?.serviceBooking?.serviceSlug,
      ].map((value) => String(value || '').toLowerCase()).join(' ');
      const itemNames = getOrderItems(order)
        .map((item) => String(item?.name || '').toLowerCase())
        .join(' ');

      return orderIdPart.includes(normalizedSearch) || itemNames.includes(normalizedSearch) || serviceMeta.includes(normalizedSearch);
    });
  }, [groceryOrders, orderSearch, statusFilter]);

  const orderMetrics = useMemo(() => {
    const activeCount = groceryOrders.filter((order) => ACTIVE_ORDER_STATUSES.includes(order.orderStatus)).length;
    const deliveredCount = groceryOrders.filter((order) => order.orderStatus === 'DELIVERED').length;
    const totalSpend = groceryOrders.reduce((total, order) => total + Number(order?.totalAmount || 0), 0);

    return { activeCount, deliveredCount, totalSpend };
  }, [groceryOrders]);

  const handleQuickReorder = (order) => {
    if (isServiceScope) {
      navigate('/services');
      return;
    }

    const items = getOrderItems(order);

    if (!items.length) {
      toast.error('No items found in this order to reorder.');
      return;
    }

    items.forEach((item) => {
      addToCart({
        _id: item.productId,
        productType: item.productType || 'shopItem',
        name: item.name,
        imageUrl: item.imageUrl,
        price: Number(item.price || 0),
        quantity: Number(item.quantity || 1),
      });
    });

    toast.success('Items added to cart.');
    navigate('/cart');
  };

  const handleDownloadInvoice = (order) => {
    const items = getOrderItems(order);
    const orderId = String(order?._id || '').slice(0, 8);
    const lines = [
      'HomeXpert Grocery Invoice',
      `Order ID: ${orderId}`,
      `Date: ${formatOrderDate(order?.createdAt)}`,
      `Status: ${formatOrderStatus(order?.orderStatus)}`,
      '',
      'Items:',
      ...items.map((item) => `- ${item.name} x${item.quantity} = ${formatMoney(item.totalPrice)}`),
      '',
      `Subtotal: ${formatMoney(order?.subtotal)}`,
      `Delivery Fee: ${formatMoney(order?.deliveryFee)}`,
      `Discount: ${formatMoney(order?.discount)}`,
      `Total: ${formatMoney(order?.totalAmount)}`,
      '',
      `Payment Method: ${order?.paymentMethod || 'COD'}`,
      `Payment Status: ${order?.paymentStatus || 'PENDING'}`,
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `invoice-${orderId}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/');
  };

  if (activeTab === 'orders') {
    return (
      <div className="pt-24 pb-12 bg-gradient-to-b from-cyan-50 via-white to-slate-50 min-h-screen">
        <div className="container mx-auto px-4">
          <section className="rounded-[32px] border border-slate-200 bg-white p-6 md:p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-primary-custom font-bold">{isServiceScope ? 'Previous Service Orders' : 'Previous Grocery Orders'}</p>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 mt-2">{isServiceScope ? 'Your service bookings, organized.' : 'Your grocery orders, organized.'}</h1>
                <p className="text-sm text-slate-600 mt-2 max-w-2xl">
                  {isServiceScope
                    ? 'Review booked services, schedule details, status, and invoices in one place.'
                    : 'See exact items, track live progress, reorder in one tap, and download invoices anytime.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigate(isServiceScope ? '/services' : '/products')}
                  className="inline-flex items-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  {isServiceScope ? 'Book Service' : 'Continue Shopping'}
                </button>
              </div>
            </div>

            {!currentUser ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <p className="text-sm text-slate-600">Sign in to see your {isServiceScope ? 'service orders' : 'grocery orders'}.</p>
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="mt-4 inline-flex items-center rounded-full bg-primary-custom px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
                >
                  Sign In
                </button>
              </div>
            ) : loadingGroceryOrders ? (
              <div className="mt-6 space-y-4">
                {[...Array(3)].map((_, index) => (
                  <div key={index} className="h-52 rounded-2xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : groceryOrdersError ? (
              <div className="mt-6 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
                {groceryOrdersError}
              </div>
            ) : groceryOrders.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <p className="text-sm text-slate-600">
                  {isServiceScope
                    ? 'No service orders yet. Book your first service and it will appear here.'
                    : 'No grocery orders yet. Place your first order and it will appear here.'}
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-cyan-700">{isServiceScope ? 'Active Bookings' : 'Active Orders'}</p>
                    <p className="text-2xl font-black text-cyan-900 mt-1">{orderMetrics.activeCount}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-emerald-700">{isServiceScope ? 'Completed Bookings' : 'Delivered Orders'}</p>
                    <p className="text-2xl font-black text-emerald-900 mt-1">{orderMetrics.deliveredCount}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-amber-700">Total Spend</p>
                    <p className="text-2xl font-black text-amber-900 mt-1">{formatMoney(orderMetrics.totalSpend)}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                  <div className="relative w-full lg:max-w-md">
                    <input
                      type="text"
                      value={orderSearch}
                      onChange={(event) => setOrderSearch(event.target.value)}
                      placeholder={isServiceScope ? 'Search by order ID or service name' : 'Search by order ID or item name'}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-primary-custom"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['ALL', 'ACTIVE', 'COMPLETED'].map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setStatusFilter(filter)}
                        className={`rounded-full px-4 py-2 text-xs font-semibold ${statusFilter === filter ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredGroceryOrders.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
                    No orders match your current search or filter.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredGroceryOrders.map((order) => {
                      const items = getOrderItems(order);
                      const previewImage = isServiceScope ? getServiceImageFromOrder(order) : getOrderPreviewImage(order);
                      const itemCount = getOrderItemCount(order);
                      const isExpanded = expandedOrderId === order._id;
                      const serviceName = order?.serviceBooking?.serviceName || 'Home Service';

                      return (
                        <article key={order._id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                          <div className="p-4 md:p-5">
                            <div className="flex flex-col xl:flex-row gap-4 xl:items-start xl:justify-between">
                              <div className="flex gap-4">
                                <img
                                  src={previewImage}
                                  alt={isServiceScope ? serviceName : (items[0]?.name || 'Grocery order')}
                                  className="h-20 w-20 rounded-xl object-cover border border-slate-200"
                                  onError={(event) => {
                                    const imageElement = event.currentTarget;
                                    imageElement.onerror = null;
                                    imageElement.src = isServiceScope ? FALLBACK_SERVICE_IMAGE : FALLBACK_GROCERY_IMAGE;
                                  }}
                                />

                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-bold text-slate-900">Order #{String(order._id).substring(0, 8)}</p>
                                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusBadgeClass(order.orderStatus)}`}>
                                      {formatOrderStatus(order.orderStatus)}
                                    </span>
                                    {ACTIVE_ORDER_STATUSES.includes(order.orderStatus) ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                        Live
                                      </span>
                                    ) : null}
                                  </div>

                                  <p className="text-xs text-slate-500 mt-1">Placed on {formatOrderDate(order.createdAt)}</p>
                                  <p className="text-xs text-slate-500 mt-1">
                                    {isServiceScope
                                      ? `${serviceName} • ${order?.serviceBooking?.packageName || 'Standard Package'} • ${getEtaText(order)}`
                                      : `${itemCount} item${itemCount === 1 ? '' : 's'} • ${getEtaText(order)}`}
                                  </p>
                                </div>
                              </div>

                              <div className="text-left xl:text-right">
                                <p className="text-xs text-slate-500">Total</p>
                                <p className="text-xl font-black text-slate-900">{formatMoney(order.totalAmount)}</p>
                                <p className="text-xs text-slate-500 mt-1">{order.paymentMethod || 'COD'} • {order.paymentStatus || 'PENDING'}</p>
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              {isServiceScope ? (
                                <>
                                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                                    {serviceName}
                                  </span>
                                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                                    {order?.serviceBooking?.packageName || 'Standard Package'}
                                  </span>
                                  {order?.serviceBooking?.scheduledFor ? (
                                    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                                      Scheduled {formatOrderDate(order.serviceBooking.scheduledFor)}
                                    </span>
                                  ) : null}
                                </>
                              ) : (
                                <>
                                  {items.slice(0, 4).map((item, index) => (
                                    <span key={`${order._id}-${index}`} className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                                      {item.name} x{item.quantity}
                                    </span>
                                  ))}
                                  {items.length > 4 ? (
                                    <span className="inline-flex items-center rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-700">
                                      +{items.length - 4} more
                                    </span>
                                  ) : null}
                                </>
                              )}
                            </div>

                            <div className="mt-4 flex flex-wrap items-center gap-2">
                              <button
                                onClick={() => handleQuickReorder(order)}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                              >
                                {isServiceScope ? 'Book Again' : 'Reorder'}
                              </button>
                              <button
                                onClick={() => setExpandedOrderId((prev) => (prev === order._id ? '' : order._id))}
                                className="rounded-lg bg-primary-custom px-3 py-2 text-xs font-semibold text-white hover:bg-opacity-90"
                              >
                                {isExpanded ? 'Hide Details' : 'Track & Details'}
                              </button>
                              <button
                                onClick={() => handleDownloadInvoice(order)}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                              >
                                Download Invoice
                              </button>
                            </div>
                          </div>

                          {isExpanded ? (
                            <div className="border-t border-slate-100 bg-slate-50/60 p-4 md:p-5">
                              <div className="grid gap-4 lg:grid-cols-2">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isServiceScope ? 'Service Details' : 'Ordered Items'}</p>
                                  {isServiceScope ? (
                                    <div className="mt-3 space-y-2">
                                      <div className="rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm text-slate-700">
                                        <p className="font-semibold text-slate-900">{serviceName}</p>
                                        <p className="mt-1">Package: {order?.serviceBooking?.packageName || 'Standard Package'}</p>
                                        {order?.serviceBooking?.scheduledFor ? <p className="mt-1">Scheduled: {formatOrderDate(order.serviceBooking.scheduledFor)}</p> : null}
                                        {order?.serviceBooking?.timeSlot ? <p className="mt-1">Slot: {order.serviceBooking.timeSlot}</p> : null}
                                        {order?.serviceBooking?.estimatedDurationMins ? <p className="mt-1">Duration: {order.serviceBooking.estimatedDurationMins} mins</p> : null}
                                        {order?.serviceBooking?.notes ? <p className="mt-1">Notes: {order.serviceBooking.notes}</p> : null}
                                      </div>
                                    </div>
                                  ) : (
                                    <ul className="mt-3 space-y-2">
                                      {items.map((item, index) => (
                                        <li key={`${order._id}-detail-${index}`} className="flex items-center justify-between rounded-xl bg-white border border-slate-200 px-3 py-2">
                                          <span className="text-sm text-slate-700">{item.name} x{item.quantity}</span>
                                          <span className="text-sm font-semibold text-slate-900">{formatMoney(item.totalPrice)}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>

                                <div className="space-y-3">
                                  <div className="rounded-xl bg-white border border-slate-200 p-3">
                                    <p className="text-xs uppercase tracking-wide text-slate-500">Delivery Address</p>
                                    <p className="text-sm text-slate-800 mt-1">
                                      {order.deliveryAddress?.fullName || 'N/A'} • {order.deliveryAddress?.mobileNumber || 'N/A'}
                                    </p>
                                    <p className="text-sm text-slate-700 mt-1">
                                      {order.deliveryAddress?.addressLine1 || ''}{order.deliveryAddress?.addressLine2 ? `, ${order.deliveryAddress.addressLine2}` : ''}
                                    </p>
                                    <p className="text-sm text-slate-700 mt-1">
                                      {order.deliveryAddress?.city || ''}, {order.deliveryAddress?.state || ''} - {order.deliveryAddress?.pincode || ''}
                                    </p>
                                  </div>

                                  <div className="rounded-xl bg-white border border-slate-200 p-3 space-y-1.5">
                                    <div className="flex items-center justify-between text-sm text-slate-700">
                                      <span>Subtotal</span>
                                      <span>{formatMoney(order.subtotal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm text-slate-700">
                                      <span>Delivery Fee</span>
                                      <span>{formatMoney(order.deliveryFee)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm text-slate-700">
                                      <span>Discount</span>
                                      <span>-{formatMoney(order.discount)}</span>
                                    </div>
                                    <div className="border-t border-slate-200 pt-1.5 flex items-center justify-between text-sm font-bold text-slate-900">
                                      <span>Total</span>
                                      <span>{formatMoney(order.totalAmount)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return <UserProfile />;
      case 'orders':
        return <OrderHistory />;
      case 'addresses':
        return <SavedAddresses />;
      case 'favorites':
        return <Favorites />;
      default:
        return <UserProfile />;
    }
  };

  return (
    <div className="pt-24 pb-12 bg-gradient-to-b from-purple-50 via-white to-amber-50/30 min-h-screen">
      <div className="container mx-auto px-4 space-y-6">
        <div className="rounded-[28px] border border-white bg-white/90 shadow-[0_24px_60px_rgba(15,23,42,0.08)] p-6 md:p-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary-custom font-bold">My Account</p>
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 mt-2">Welcome back, {currentUser.firstName || 'Partner'}</h1>
            <p className="text-gray-600 mt-2 max-w-2xl">Keep track of your orders, addresses, and profile settings from one clean space.</p>
          </div>
          <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
            <div className="rounded-2xl border border-purple-100 bg-purple-50 p-3 min-w-[96px]">
              <p className="text-xs text-gray-500">Orders</p>
              <p className="text-lg font-bold text-gray-900">{activeTab === 'orders' ? 'Open' : 'All'}</p>
            </div>
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-3 min-w-[96px]">
              <p className="text-xs text-gray-500">Addresses</p>
              <p className="text-lg font-bold text-gray-900">Saved</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 min-w-[96px]">
              <p className="text-xs text-gray-500">Favorites</p>
              <p className="text-lg font-bold text-gray-900">Quick</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-100 bg-gradient-to-r from-cyan-50 via-white to-emerald-50 p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-700 font-bold">Current Active Order</p>
            {loadingActiveOrder ? (
              <p className="text-sm text-gray-600 mt-2">Checking your latest order status...</p>
            ) : (
              <>
                <p className="text-base font-semibold text-gray-900 mt-2">{orderSummaryLabel}</p>
                {activeOrder ? (
                  <span className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(activeOrder.orderStatus)}`}>
                    {formatOrderStatus(activeOrder.orderStatus)}
                  </span>
                ) : (
                  <p className="text-sm text-gray-600 mt-1">Place a new order and track every stage here instantly.</p>
                )}
              </>
            )}
          </div>

          <button
            onClick={() => setActiveTab('orders')}
            className="inline-flex items-center justify-center rounded-lg bg-primary-custom px-4 py-2 text-sm font-semibold text-white hover:bg-opacity-90"
          >
            View Orders
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <div className="md:w-1/4 bg-white rounded-[24px] shadow-md p-4 border border-gray-100">
            <div className="flex items-center mb-6 border-b pb-4">
              <div className="w-12 h-12 rounded-full bg-primary-custom/20 flex items-center justify-center text-primary-custom font-bold text-xl">
                {currentUser.firstName ? currentUser.firstName.charAt(0) : ''}
                {currentUser.lastName ? currentUser.lastName.charAt(0) : ''}
              </div>
              <div className="ml-3">
                <h3 className="font-semibold text-gray-800">
                  {currentUser.firstName} {currentUser.lastName}
                </h3>
                <p className="text-sm text-gray-600">{currentUser.mobileNumber}</p>
              </div>
            </div>

            <nav>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => setActiveTab('profile')}
                    className={`w-full text-left px-4 py-2 rounded-md flex items-center ${
                      activeTab === 'profile'
                        ? 'bg-primary-custom/10 text-primary-custom font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    My Profile
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveTab('orders')}
                    className={`w-full text-left px-4 py-2 rounded-md flex items-center ${
                      activeTab === 'orders'
                        ? 'bg-primary-custom/10 text-primary-custom font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    My Orders
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveTab('addresses')}
                    className={`w-full text-left px-4 py-2 rounded-md flex items-center ${
                      activeTab === 'addresses'
                        ? 'bg-primary-custom/10 text-primary-custom font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Saved Addresses
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveTab('favorites')}
                    className={`w-full text-left px-4 py-2 rounded-md flex items-center ${
                      activeTab === 'favorites'
                        ? 'bg-primary-custom/10 text-primary-custom font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    Favorites
                  </button>
                </li>
                <li className="pt-4 border-t mt-4">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 rounded-md flex items-center text-red-600 hover:bg-red-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
                </li>
              </ul>
            </nav>
          </div>

          {/* Main Content */}
          <div className="md:w-3/4 bg-white rounded-[24px] shadow-md p-6 border border-gray-100">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
