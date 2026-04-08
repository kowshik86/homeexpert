import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { fetchShopkeeperById } from '../../services/api';

const getAuthState = () => {
  try {
    return JSON.parse(localStorage.getItem('workforceAuth') || 'null');
  } catch {
    return null;
  }
};

const formatAddress = (address) => {
  if (!address) {
    return 'Address not set';
  }

  const parts = [address.flatNO, address.landmark, address.area].filter(Boolean);
  return parts.join(', ') || 'Address not set';
};

function ShopkeeperProfile() {
  const navigate = useNavigate();
  const authState = getAuthState();
  const shopkeeperId = authState?.profile?._id;

  const [shopkeeper, setShopkeeper] = useState(authState?.profile || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      if (!shopkeeperId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const response = await fetchShopkeeperById(shopkeeperId);

      if (!isMounted) {
        return;
      }

      if (response) {
        setShopkeeper(response);
      } else {
        setError('Unable to load your profile. Please log in again.');
      }

      setLoading(false);
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [shopkeeperId]);

  if (!authState || authState.role !== 'shopkeeper') {
    return <Navigate to="/work/login" replace />;
  }

  const handleLogout = () => {
    localStorage.removeItem('workforceAuth');
    navigate('/work/login');
  };

  const handleBackToDashboard = () => {
    window.location.assign('/work/shopkeeper-dashboard');
  };

  return (
    <div className="pt-24 pb-12 px-4 bg-gradient-to-b from-violet-50 via-white to-white min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="rounded-3xl bg-white border border-violet-100 shadow-xl overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-3">
            <div className="lg:col-span-2 p-6 md:p-8 bg-gradient-to-br from-violet-50 via-white to-indigo-50">
              <p className="text-sm font-semibold text-violet-600">Shopkeeper Profile</p>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2">{shopkeeper?.shopName || 'Shopkeeper Profile'}</h1>
              <p className="text-gray-600 mt-3 max-w-2xl">
                This page contains your shop identity, contact information, and location details. Inventory editing stays on the dashboard.
              </p>
            </div>

            <div className="p-6 md:p-8 bg-gray-950 text-white">
              <div className="space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-violet-300 font-semibold">Shop Owner</p>
                  <p className="mt-2 text-lg font-semibold">{shopkeeper?.firstName || 'Unknown'} {shopkeeper?.lastName || ''}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-violet-300 font-semibold">Mobile</p>
                  <p className="mt-2 text-sm text-gray-200">{shopkeeper?.mobileNumber || 'Not Available'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-violet-300 font-semibold">Email</p>
                  <p className="mt-2 text-sm text-gray-200">{shopkeeper?.email || 'Not Available'}</p>
                </div>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button type="button" onClick={handleBackToDashboard} className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10 transition-colors">
                    Back to Dashboard
                  </button>
                  <button onClick={handleLogout} className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-400 transition-colors">
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div> : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-3xl bg-white border border-violet-100 shadow-lg p-6 md:p-8">
            <p className="text-sm font-semibold text-violet-600">Profile Details</p>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">Business information</h2>

            {loading ? (
              <div className="mt-6 rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-600">Loading profile...</div>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl bg-violet-50 p-4 border border-violet-100">
                  <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Business Category</p>
                  <p className="mt-1 text-gray-900 font-semibold">{shopkeeper?.businessCategory || 'Retail'}</p>
                </div>
                <div className="rounded-2xl bg-violet-50 p-4 border border-violet-100">
                  <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">GST Number</p>
                  <p className="mt-1 text-gray-900 font-semibold">{shopkeeper?.gstNumber || 'Not Provided'}</p>
                </div>
                <div className="rounded-2xl bg-violet-50 p-4 border border-violet-100">
                  <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Online Payments</p>
                  <p className="mt-1 text-gray-900 font-semibold">{shopkeeper?.acceptsOnlinePayments ? 'Enabled' : 'Not Enabled'}</p>
                </div>
                <div className="rounded-2xl bg-violet-50 p-4 border border-violet-100">
                  <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Minimum Order Value</p>
                  <p className="mt-1 text-gray-900 font-semibold">{shopkeeper?.minOrderValue ? `₹${shopkeeper.minOrderValue}` : 'Not Set'}</p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-white border border-violet-100 shadow-lg p-6 md:p-8">
            <p className="text-sm font-semibold text-violet-600">Shop Location</p>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">Where your shop is listed</h2>

            {loading ? (
              <div className="mt-6 rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-600">Loading profile...</div>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl bg-gray-50 p-4 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Address</p>
                  <p className="mt-1 text-gray-900 font-semibold">{formatAddress(shopkeeper?.shopAddress?.address)}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">City / State</p>
                  <p className="mt-1 text-gray-900 font-semibold">{shopkeeper?.shopAddress ? `${shopkeeper.shopAddress.city || 'Unknown City'}, ${shopkeeper.shopAddress.state || 'Unknown State'}` : 'Not Available'}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pincode</p>
                  <p className="mt-1 text-gray-900 font-semibold">{shopkeeper?.shopAddress?.pincode || 'Not Available'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShopkeeperProfile;