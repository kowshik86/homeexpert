import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import OrderTrackingDetails from './OrderTrackingDetails';

const getOrderItems = (order) => (Array.isArray(order?.orderItems) ? order.orderItems : []);

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

function OrderDetailsPage() {
  const { currentUser } = useAuth();
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const scope = searchParams.get('scope') === 'services' ? 'services' : 'groceries';

  useEffect(() => {
    const fetchOrder = async ({ silent = false } = {}) => {
      if (!orderId) {
        setError('Order ID is missing.');
        setIsLoading(false);
        return;
      }

      try {
        if (!silent) {
          setIsLoading(true);
        }
        if (!silent) {
          setError('');
        }

        const response = await fetch(`http://localhost:3000/order-api/order/${orderId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch order details');
        }

        const data = await response.json();
        const payload = data?.payload || null;

        if (!payload) {
          throw new Error('Order not found');
        }

        if (currentUser?._id && String(payload.userId) !== String(currentUser._id)) {
          throw new Error('You do not have access to this order');
        }

        setOrder(payload);
      } catch (fetchError) {
        if (!silent) {
          setError(fetchError.message || 'Failed to load order details');
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    };

    fetchOrder();

    const polling = window.setInterval(() => {
      fetchOrder({ silent: true });
    }, 5000);

    return () => window.clearInterval(polling);
  }, [orderId, currentUser]);

  const isServiceScope = useMemo(() => {
    if (order?.bookingType === 'service') {
      return true;
    }

    return scope === 'services';
  }, [order, scope]);

  const pageMode = useMemo(() => {
    if (isServiceScope) {
      return {
        eyebrow: 'Service Booking Details',
        title: 'Your service request',
        subtitle: 'Track the assigned expert, scheduled service, and live arrival updates.',
        toneClass: 'from-violet-50 via-white to-cyan-50',
        badgeClass: 'bg-violet-100 text-violet-700 border-violet-200',
        accentClass: 'text-violet-700',
      };
    }

    return {
      eyebrow: 'Grocery Order Details',
      title: 'Your grocery order',
      subtitle: 'Track the delivery partner, basket items, and arrival updates.',
      toneClass: 'from-orange-50 via-white to-slate-50',
      badgeClass: 'bg-orange-100 text-orange-700 border-orange-200',
      accentClass: 'text-primary-custom',
    };
  }, [isServiceScope]);

  const orderItems = useMemo(() => getOrderItems(order), [order]);
  const serviceName = order?.serviceBooking?.serviceName || 'Home Service';

  if (isLoading) {
    return (
      <div className="pt-24 pb-12 min-h-screen bg-gradient-to-b from-cyan-50 via-white to-slate-50">
        <div className="container mx-auto px-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading order details...</div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="pt-24 pb-12 min-h-screen bg-gradient-to-b from-cyan-50 via-white to-slate-50">
        <div className="container mx-auto px-4">
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-6 text-sm text-rose-700">{error || 'Order not found'}</div>
          <button
            onClick={() => navigate(`/account?tab=orders&scope=${scope}`)}
            className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`pt-24 pb-12 min-h-screen bg-gradient-to-b ${pageMode.toneClass}`}>
      <div className="container mx-auto px-4 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.16)]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className={`text-xs uppercase tracking-[0.16em] font-bold ${pageMode.accentClass}`}>{pageMode.eyebrow}</p>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 mt-1">{pageMode.title}</h1>
              <p className="text-sm text-slate-500 mt-1">Order #{String(order._id).substring(0, 8)} • Placed on {formatOrderDate(order.createdAt)}</p>
              <p className="text-sm text-slate-600 mt-2 max-w-2xl">{pageMode.subtitle}</p>
            </div>

            <button
              onClick={() => navigate(`/account?tab=orders&scope=${isServiceScope ? 'services' : 'groceries'}`)}
              className="w-fit rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Orders
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 md:p-5 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.12)]">
          <OrderTrackingDetails
            order={order}
            isServiceScope={isServiceScope}
            items={orderItems}
            serviceName={serviceName}
            formatMoney={formatMoney}
            formatOrderDate={formatOrderDate}
          />
        </div>
      </div>
    </div>
  );
}

export default OrderDetailsPage;
