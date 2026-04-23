import React from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { clearWorkforceAuth, getWorkforceAuth } from '../../utils/workforceAuth';

function VendorDashboard() {
  const navigate = useNavigate();
  const authState = getWorkforceAuth('vendor');

  if (!authState || authState.role !== 'vendor') {
    return <Navigate to="/work/login" replace />;
  }

  const { profile } = authState;

  const handleLogout = () => {
    clearWorkforceAuth('vendor');
    navigate('/work/login');
  };

  return (
    <div className="pt-24 pb-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-md p-6 md:p-8 border border-purple-100">
          <p className="text-sm text-primary-custom font-semibold">Vendor Operations Hub</p>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mt-1">Welcome back, {profile?.firstName || 'Vendor'}</h1>
          <p className="text-gray-600 mt-2">Manage your catalog readiness, pricing, and partner profile from one place.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="rounded-xl bg-purple-50 p-4 border border-purple-100">
              <p className="text-sm text-gray-600">Shop Name</p>
              <p className="font-semibold text-gray-800 mt-1">{profile?.shopName || 'Not Available'}</p>
            </div>
            <div className="rounded-xl bg-purple-50 p-4 border border-purple-100">
              <p className="text-sm text-gray-600">Mobile</p>
              <p className="font-semibold text-gray-800 mt-1">{profile?.mobileNumber || 'Not Available'}</p>
            </div>
            <div className="rounded-xl bg-purple-50 p-4 border border-purple-100">
              <p className="text-sm text-gray-600">Email</p>
              <p className="font-semibold text-gray-800 mt-1">{profile?.email || 'Not Available'}</p>
            </div>
            <div className="rounded-xl bg-purple-50 p-4 border border-purple-100">
              <p className="text-sm text-gray-600">Business Category</p>
              <p className="font-semibold text-gray-800 mt-1">{profile?.businessCategory || 'General Merchandise'}</p>
            </div>
            <div className="rounded-xl bg-purple-50 p-4 border border-purple-100">
              <p className="text-sm text-gray-600">Years in Business</p>
              <p className="font-semibold text-gray-800 mt-1">{profile?.yearsInBusiness ?? 0}</p>
            </div>
            <div className="rounded-xl bg-purple-50 p-4 border border-purple-100">
              <p className="text-sm text-gray-600">Online Payments</p>
              <p className="font-semibold text-gray-800 mt-1">{profile?.acceptsOnlinePayments ? 'Enabled' : 'Not Enabled'}</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/" className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
              Home
            </Link>
            <Link to="/work/vendor-profile" className="px-4 py-2 rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50">
              Edit Profile
            </Link>
            <button onClick={handleLogout} className="px-4 py-2 rounded-lg bg-primary-custom text-white hover:opacity-90">
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VendorDashboard;
