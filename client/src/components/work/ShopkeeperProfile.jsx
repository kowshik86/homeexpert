import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { fetchShopkeeperById } from '../../services/api';
import { clearWorkforceAuth, getWorkforceAuth, setWorkforceAuth } from '../../utils/workforceAuth';
import { readImageFileAsDataUrl, validateImageFile } from '../../utils/imageUpload';

const getAuthState = () => {
  return getWorkforceAuth('shopkeeper');
};

const formatAddress = (address) => {
  if (!address) {
    return 'Address not set';
  }

  const parts = [address.flatNO, address.landmark, address.area].filter(Boolean);
  return parts.join(', ') || 'Address not set';
};

const PROFILE_PLACEHOLDER = 'https://via.placeholder.com/120?text=Profile';

function ShopkeeperProfile() {
  const navigate = useNavigate();
  const authState = getAuthState();
  const shopkeeperId = authState?.profile?._id;

  const [shopkeeper, setShopkeeper] = useState(authState?.profile || null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileImageData, setProfileImageData] = useState(authState?.profile?.profileImg || '');
  const [formData, setFormData] = useState({
    firstName: authState?.profile?.firstName || '',
    lastName: authState?.profile?.lastName || '',
    email: authState?.profile?.email || '',
    mobileNumber: authState?.profile?.mobileNumber || '',
    shopName: authState?.profile?.shopName || '',
    businessCategory: authState?.profile?.businessCategory || '',
    yearsInBusiness: authState?.profile?.yearsInBusiness ?? '',
    acceptsOnlinePayments: Boolean(authState?.profile?.acceptsOnlinePayments),
    minOrderValue: authState?.profile?.minOrderValue ?? '',
    shopDescription: authState?.profile?.shopDescription || '',
    openingTime: authState?.profile?.openingTime || '',
    closingTime: authState?.profile?.closingTime || '',
    isShopOpen: authState?.profile?.isShopOpen ?? true,
    gstNumber: authState?.profile?.gstNumber || '',
    flatNO: authState?.profile?.shopAddress?.address?.flatNO || '',
    landmark: authState?.profile?.shopAddress?.address?.landmark || '',
    area: authState?.profile?.shopAddress?.address?.area || '',
    city: authState?.profile?.shopAddress?.city || '',
    state: authState?.profile?.shopAddress?.state || '',
    pincode: authState?.profile?.shopAddress?.pincode || '',
  });

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

  useEffect(() => {
    setFormData({
      firstName: shopkeeper?.firstName || '',
      lastName: shopkeeper?.lastName || '',
      email: shopkeeper?.email || '',
      mobileNumber: shopkeeper?.mobileNumber || '',
      shopName: shopkeeper?.shopName || '',
      businessCategory: shopkeeper?.businessCategory || '',
      yearsInBusiness: shopkeeper?.yearsInBusiness ?? '',
      acceptsOnlinePayments: Boolean(shopkeeper?.acceptsOnlinePayments),
      minOrderValue: shopkeeper?.minOrderValue ?? '',
      shopDescription: shopkeeper?.shopDescription || '',
      openingTime: shopkeeper?.openingTime || '',
      closingTime: shopkeeper?.closingTime || '',
      isShopOpen: shopkeeper?.isShopOpen ?? true,
      gstNumber: shopkeeper?.gstNumber || '',
      flatNO: shopkeeper?.shopAddress?.address?.flatNO || '',
      landmark: shopkeeper?.shopAddress?.address?.landmark || '',
      area: shopkeeper?.shopAddress?.address?.area || '',
      city: shopkeeper?.shopAddress?.city || '',
      state: shopkeeper?.shopAddress?.state || '',
      pincode: shopkeeper?.shopAddress?.pincode || '',
    });
    setProfileImageData(shopkeeper?.profileImg || '');
  }, [shopkeeper]);

  const stats = useMemo(() => ([
    { label: 'Role', value: 'Shopkeeper' },
    { label: 'Shop', value: formData.shopName || 'Not set' },
    { label: 'Status', value: formData.isShopOpen ? 'Open' : 'Closed' },
    { label: 'Payments', value: formData.acceptsOnlinePayments ? 'Enabled' : 'Disabled' },
  ]), [formData.shopName, formData.isShopOpen, formData.acceptsOnlinePayments]);

  if (!authState || authState.role !== 'shopkeeper') {
    return <Navigate to="/work/login" replace />;
  }

  const handleLogout = () => {
    clearWorkforceAuth('shopkeeper');
    navigate('/work/login');
  };

  const handleBackToDashboard = () => {
    window.location.assign('/work/shopkeeper-dashboard');
  };

  const handleChange = (event) => {
    const { name, type, value, checked } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleProfileImageUpload = async (event) => {
    const selectedFile = event.target.files?.[0];
    const validationMessage = validateImageFile(selectedFile);

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    try {
      const encodedImage = await readImageFileAsDataUrl(selectedFile);
      setProfileImageData(encodedImage);
      setError('');
    } catch (uploadError) {
      setError(uploadError.message || 'Failed to process selected image.');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!shopkeeperId) {
      setError('Profile data is unavailable. Please log in again.');
      return;
    }

    try {
      setIsSaving(true);
      setError('');

      const response = await fetch(`http://localhost:3000/shopkeeper-api/shopKeeperupdate/${shopkeeperId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profileImg: profileImageData || undefined,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          mobileNumber: formData.mobileNumber,
          shopName: formData.shopName,
          businessCategory: formData.businessCategory,
          yearsInBusiness: Number(formData.yearsInBusiness || 0),
          acceptsOnlinePayments: Boolean(formData.acceptsOnlinePayments),
          minOrderValue: Number(formData.minOrderValue || 0),
          shopDescription: formData.shopDescription,
          openingTime: formData.openingTime,
          closingTime: formData.closingTime,
          isShopOpen: Boolean(formData.isShopOpen),
          gstNumber: formData.gstNumber,
          shopAddress: {
            city: formData.city,
            state: formData.state,
            pincode: formData.pincode,
            address: {
              flatNO: formData.flatNO,
              landmark: formData.landmark,
              area: formData.area,
            },
          },
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'Failed to save profile');
      }

      const data = await response.json();
      setShopkeeper(data.payload);
      setWorkforceAuth('shopkeeper', { ...authState, profile: data.payload });
      toast.success('Shopkeeper profile updated');
      setIsEditing(false);
    } catch (profileError) {
      setError(profileError.message || 'Failed to save profile');
      toast.error(profileError.message || 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
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
                <div className="flex items-center gap-3">
                  <img
                    src={profileImageData || shopkeeper?.profileImg || PROFILE_PLACEHOLDER}
                    alt="Shopkeeper profile"
                    className="h-14 w-14 rounded-full border border-white/20 object-cover"
                  />
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-violet-300 font-semibold">Profile Photo</p>
                    <p className="mt-1 text-sm text-gray-200">Visible to your customers and dashboard</p>
                  </div>
                </div>
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

            <div className="mt-6 grid grid-cols-1 gap-3">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl bg-violet-50 p-4 border border-violet-100 flex items-center justify-between gap-4">
                  <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">{stat.label}</p>
                  <p className="text-sm font-semibold text-gray-900 text-right">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => setIsEditing((current) => !current)} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition-colors">
                {isEditing ? 'View Profile' : 'Edit Profile'}
              </button>
            </div>

            {loading ? (
              <div className="mt-6 rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-600">Loading profile...</div>
            ) : isEditing ? (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                  <label htmlFor="shopkeeperProfileImage" className="block text-sm font-medium text-gray-700 mb-2">Profile Photo</label>
                  <div className="flex flex-wrap items-center gap-4">
                    <img
                      src={profileImageData || PROFILE_PLACEHOLDER}
                      alt="Profile preview"
                      className="h-16 w-16 rounded-full border border-gray-200 object-cover bg-white"
                    />
                    <div className="space-y-2">
                      <input
                        id="shopkeeperProfileImage"
                        type="file"
                        accept="image/*"
                        onChange={handleProfileImageUpload}
                        className="block w-full text-sm text-gray-700"
                      />
                      {profileImageData ? (
                        <button
                          type="button"
                          onClick={() => setProfileImageData('')}
                          className="text-xs font-semibold text-red-600 hover:text-red-700"
                        >
                          Remove photo
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input id="firstName" name="firstName" value={formData.firstName} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input id="lastName" name="lastName" value={formData.lastName} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label htmlFor="mobileNumber" className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                    <input id="mobileNumber" name="mobileNumber" value={formData.mobileNumber} onChange={handleChange} disabled className="w-full rounded-xl border border-gray-300 px-3 py-2.5 bg-gray-50" />
                  </div>
                  <div>
                    <label htmlFor="shopName" className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
                    <input id="shopName" name="shopName" value={formData.shopName} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label htmlFor="businessCategory" className="block text-sm font-medium text-gray-700 mb-1">Business Category</label>
                    <input id="businessCategory" name="businessCategory" value={formData.businessCategory} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label htmlFor="yearsInBusiness" className="block text-sm font-medium text-gray-700 mb-1">Years in Business</label>
                    <input id="yearsInBusiness" name="yearsInBusiness" type="number" min="0" value={formData.yearsInBusiness} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label htmlFor="minOrderValue" className="block text-sm font-medium text-gray-700 mb-1">Minimum Order Value</label>
                    <input id="minOrderValue" name="minOrderValue" type="number" min="0" value={formData.minOrderValue} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label htmlFor="gstNumber" className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                    <input id="gstNumber" name="gstNumber" value={formData.gstNumber} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="flatNO" className="block text-sm font-medium text-gray-700 mb-1">Flat / Shop No</label>
                    <input id="flatNO" name="flatNO" value={formData.flatNO} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label htmlFor="landmark" className="block text-sm font-medium text-gray-700 mb-1">Landmark</label>
                    <input id="landmark" name="landmark" value={formData.landmark} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label htmlFor="area" className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                    <input id="area" name="area" value={formData.area} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input id="city" name="city" value={formData.city} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input id="state" name="state" value={formData.state} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label htmlFor="pincode" className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                    <input id="pincode" name="pincode" value={formData.pincode} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Shop open</p>
                    <p className="text-sm text-gray-600">Control whether your shop appears active.</p>
                  </div>
                  <label className="inline-flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">{formData.isShopOpen ? 'On' : 'Off'}</span>
                    <input name="isShopOpen" type="checkbox" checked={formData.isShopOpen} onChange={handleChange} className="h-5 w-5 rounded border-gray-300 text-violet-600 focus:ring-violet-200" />
                  </label>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Online payments</p>
                    <p className="text-sm text-gray-600">Enable this if your shop accepts online payments.</p>
                  </div>
                  <label className="inline-flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">{formData.acceptsOnlinePayments ? 'On' : 'Off'}</span>
                    <input name="acceptsOnlinePayments" type="checkbox" checked={formData.acceptsOnlinePayments} onChange={handleChange} className="h-5 w-5 rounded border-gray-300 text-violet-600 focus:ring-violet-200" />
                  </label>
                </div>

                <div className="flex flex-wrap justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setIsEditing(false)} className="rounded-full border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors" disabled={isSaving}>
                    Cancel
                  </button>
                  <button type="submit" disabled={isSaving} className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-70">
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
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
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-gray-50 p-4 border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Address</p>
                <p className="mt-1 text-gray-900 font-semibold">{shopkeeper?.shopAddress?.address ? formatAddress(shopkeeper.shopAddress.address) : 'Address not set'}</p>
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShopkeeperProfile;