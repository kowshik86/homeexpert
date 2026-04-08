import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const getAuthState = () => {
  try {
    return JSON.parse(localStorage.getItem('workforceAuth') || 'null');
  } catch {
    return null;
  }
};

const joinList = (items) => (Array.isArray(items) ? items.join(', ') : '');

function DeliveryProfile() {
  const navigate = useNavigate();
  const authState = getAuthState();
  const profile = authState?.profile || null;

  const [formData, setFormData] = useState({
    firstName: profile?.firstName || '',
    lastName: profile?.lastName || '',
    email: profile?.email || '',
    mobileNumber: profile?.mobileNumber || '',
    dob: profile?.dob ? String(profile.dob).slice(0, 10) : '',
    vechicle: Boolean(profile?.vechicle),
    vehicleNumber: profile?.vehicleNumber || '',
    vehicleType: profile?.vehicleType || 'bike',
    emergencyContact: profile?.emergencyContact || '',
    preferredShift: profile?.preferredShift || 'morning',
    licenseNumber: profile?.licenseNumber || '',
    isAvailable: profile?.isAvailable ?? true,
    serviceAreas: joinList(profile?.serviceAreas),
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleBackToDashboard = () => {
    window.location.assign('/work/delivery-dashboard');
  };

  useEffect(() => {
    setFormData({
      firstName: profile?.firstName || '',
      lastName: profile?.lastName || '',
      email: profile?.email || '',
      mobileNumber: profile?.mobileNumber || '',
      dob: profile?.dob ? String(profile.dob).slice(0, 10) : '',
      vechicle: Boolean(profile?.vechicle),
      vehicleNumber: profile?.vehicleNumber || '',
      vehicleType: profile?.vehicleType || 'bike',
      emergencyContact: profile?.emergencyContact || '',
      preferredShift: profile?.preferredShift || 'morning',
      licenseNumber: profile?.licenseNumber || '',
      isAvailable: profile?.isAvailable ?? true,
      serviceAreas: joinList(profile?.serviceAreas),
    });
  }, [profile]);

  const stats = useMemo(() => ([
    { label: 'Role', value: 'Delivery Person' },
    { label: 'Shift', value: formData.preferredShift || 'morning' },
    { label: 'Availability', value: formData.isAvailable ? 'Available' : 'Offline' },
    { label: 'Vehicle', value: formData.vehicleType || 'bike' },
  ]), [formData.preferredShift, formData.isAvailable, formData.vehicleType]);

  if (!authState || authState.role !== 'delivery') {
    return <Navigate to="/work/login" replace />;
  }

  const handleChange = (event) => {
    const { name, type, value, checked } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!profile?._id) {
      setError('Profile data is unavailable. Please log in again.');
      return;
    }

    try {
      setIsSaving(true);

      const response = await fetch(`http://localhost:3000/delivery-api/deliveryPersonupdate/${profile._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          serviceAreas: formData.serviceAreas
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });

      if (!response.ok) {
        const responseData = await response.json().catch(() => ({}));
        throw new Error(responseData.message || 'Failed to save profile');
      }

      const data = await response.json();
      localStorage.setItem('workforceAuth', JSON.stringify({ ...authState, profile: data.payload }));
      toast.success('Delivery profile updated');
      navigate('/work/delivery-dashboard');
    } catch (profileError) {
      setError(profileError.message || 'Failed to save profile');
      toast.error(profileError.message || 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="pt-24 pb-12 px-4 bg-gradient-to-b from-sky-50 via-white to-emerald-50/30 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="rounded-[28px] border border-white bg-white/90 shadow-[0_24px_60px_rgba(15,23,42,0.08)] p-6 md:p-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-700 font-bold">Delivery Profile</p>
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 mt-2">{profile?.firstName || 'Partner'}'s rider profile</h1>
            <p className="text-gray-600 mt-2 max-w-2xl">Update your contact, vehicle, and availability details used by the delivery dashboard.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={handleBackToDashboard} className="px-4 py-2 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">
              Back to Dashboard
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="rounded-[24px] border border-white bg-white shadow-md p-5 space-y-4 lg:col-span-1">
            <div className="rounded-2xl bg-sky-50 border border-sky-100 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-sky-700 font-bold">Quick Stats</p>
              <div className="mt-4 space-y-3">
                {stats.map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-gray-600">{stat.label}</span>
                    <span className="text-sm font-semibold text-gray-900 text-right">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-900">
              Keep this profile accurate so accepted orders, navigation and contact details stay reliable.
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rounded-[24px] border border-gray-100 bg-white shadow-md p-6 lg:col-span-3 space-y-6">
            {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="firstName">First Name</label>
                <input id="firstName" name="firstName" value={formData.firstName} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-200" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="lastName">Last Name</label>
                <input id="lastName" name="lastName" value={formData.lastName} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-200" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">Email</label>
                <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-200" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="mobileNumber">Mobile Number</label>
                <input id="mobileNumber" name="mobileNumber" value={formData.mobileNumber} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 bg-gray-50" disabled />
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="dob">Date of Birth</label>
                <input id="dob" name="dob" type="date" value={formData.dob} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-200" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="preferredShift">Preferred Shift</label>
                <select id="preferredShift" name="preferredShift" value={formData.preferredShift} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-200">
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                  <option value="night">Night</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="vehicleType">Vehicle Type</label>
                <select id="vehicleType" name="vehicleType" value={formData.vehicleType} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-200">
                  <option value="bike">Bike</option>
                  <option value="scooter">Scooter</option>
                  <option value="car">Car</option>
                  <option value="van">Van</option>
                </select>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3">
                <input id="vechicle" name="vechicle" type="checkbox" checked={formData.vechicle} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-200" />
                <label htmlFor="vechicle" className="text-sm font-medium text-gray-700">Has personal vehicle</label>
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="vehicleNumber">Vehicle Number</label>
                <input id="vehicleNumber" name="vehicleNumber" value={formData.vehicleNumber} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-200" placeholder="KA01AB1234" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="licenseNumber">License Number</label>
                <input id="licenseNumber" name="licenseNumber" value={formData.licenseNumber} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-200" placeholder="Driving license ID" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="emergencyContact">Emergency Contact</label>
                <input id="emergencyContact" name="emergencyContact" value={formData.emergencyContact} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-200" placeholder="Relative or emergency contact" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="serviceAreas">Service Areas</label>
                <input id="serviceAreas" name="serviceAreas" value={formData.serviceAreas} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-200" placeholder="Area 1, Area 2, Area 3" />
              </div>
            </section>

            <section className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Online availability</p>
                <p className="text-sm text-gray-600">When enabled, you stay visible for new delivery assignments.</p>
              </div>
              <label className="inline-flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">{formData.isAvailable ? 'On' : 'Off'}</span>
                <input name="isAvailable" type="checkbox" checked={formData.isAvailable} onChange={handleChange} className="h-5 w-5 rounded border-gray-300 text-sky-600 focus:ring-sky-200" />
              </label>
            </section>

            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <button type="button" onClick={handleBackToDashboard} className="rounded-full border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={isSaving} className="rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 transition-colors disabled:opacity-70">
                {isSaving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default DeliveryProfile;