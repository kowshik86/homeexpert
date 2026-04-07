import React from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

function DeliveryDashboard() {
  const navigate = useNavigate();
  const authState = JSON.parse(localStorage.getItem('workforceAuth') || 'null');

  if (!authState || authState.role !== 'delivery') {
    return <Navigate to="/work/login" replace />;
  }

  const { profile } = authState;

  const handleLogout = () => {
    localStorage.removeItem('workforceAuth');
    navigate('/work/login');
  };

  return (
    <div className="pt-24 pb-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-md p-6 md:p-8 border border-purple-100">
          <p className="text-sm text-primary-custom font-semibold">Delivery Operations Console</p>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mt-1">Welcome back, {profile?.firstName || 'Delivery Partner'}</h1>
          <p className="text-gray-600 mt-2">Monitor route readiness, availability, and fleet details in a production-style partner interface.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="rounded-xl bg-purple-50 p-4 border border-purple-100">
              <p className="text-sm text-gray-600">Mobile</p>
              <p className="font-semibold text-gray-800 mt-1">{profile?.mobileNumber || 'Not Available'}</p>
            </div>
            <div className="rounded-xl bg-purple-50 p-4 border border-purple-100">
              <p className="text-sm text-gray-600">Email</p>
              <p className="font-semibold text-gray-800 mt-1">{profile?.email || 'Not Available'}</p>
            </div>
            <div className="rounded-xl bg-purple-50 p-4 border border-purple-100">
              <p className="text-sm text-gray-600">Vehicle Available</p>
              <p className="font-semibold text-gray-800 mt-1">{profile?.vechicle ? 'Yes' : 'No'}</p>
            </div>
            <div className="rounded-xl bg-purple-50 p-4 border border-purple-100">
              <p className="text-sm text-gray-600">Preferred Shift</p>
              <p className="font-semibold text-gray-800 mt-1">{profile?.preferredShift || 'Not Set'}</p>
            </div>
            <div className="rounded-xl bg-purple-50 p-4 border border-purple-100">
              <p className="text-sm text-gray-600">Emergency Contact</p>
              <p className="font-semibold text-gray-800 mt-1">{profile?.emergencyContact || 'Not Set'}</p>
            </div>
            <div className="rounded-xl bg-purple-50 p-4 border border-purple-100">
              <p className="text-sm text-gray-600">Service Areas</p>
              <p className="font-semibold text-gray-800 mt-1">{Array.isArray(profile?.serviceAreas) && profile.serviceAreas.length > 0 ? profile.serviceAreas.join(', ') : 'Not Set'}</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/" className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
              Home
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

export default DeliveryDashboard;
