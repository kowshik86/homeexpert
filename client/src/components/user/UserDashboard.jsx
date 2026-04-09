import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import UserProfile from './UserProfile';
import OrderHistory from './OrderHistory';
import SavedAddresses from './SavedAddresses';
import Favorites from './Favorites';
import { toast } from 'react-toastify';

const ACTIVE_ORDER_STATUSES = ['PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'];

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
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('profile');
  const [activeOrder, setActiveOrder] = useState(null);
  const [loadingActiveOrder, setLoadingActiveOrder] = useState(true);

  useEffect(() => {
    // Redirect to home if not logged in
    if (!currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    const allowedTabs = ['profile', 'orders', 'addresses', 'favorites'];

    if (tab && allowedTabs.includes(tab)) {
      setActiveTab(tab);
    }
  }, [location.search]);

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
        const firstActive = allOrders.find((order) => ACTIVE_ORDER_STATUSES.includes(order.orderStatus));
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

  const orderSummaryLabel = useMemo(() => {
    if (!activeOrder) {
      return 'No active orders right now';
    }

    return `Order #${activeOrder._id.substring(0, 8)} is ${formatOrderStatus(activeOrder.orderStatus)}`;
  }, [activeOrder]);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/');
  };

  if (!currentUser) {
    return null; // Don't render anything if not logged in
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
