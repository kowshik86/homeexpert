import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { clearWorkforceAuth, getWorkforceAuth, setWorkforceAuth } from '../../utils/workforceAuth';
import { readImageFileAsDataUrl, validateImageFile } from '../../utils/imageUpload';

const getAuthState = () => getWorkforceAuth('vendor');

const PROFILE_PLACEHOLDER = 'https://via.placeholder.com/120?text=Profile';

function VendorProfile() {
  const navigate = useNavigate();
  const authState = getAuthState();
  const profile = authState?.profile || null;

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [profileImageData, setProfileImageData] = useState(profile?.profileImg || '');
  const [formData, setFormData] = useState({
    firstName: profile?.firstName || '',
    lastName: profile?.lastName || '',
    email: profile?.email || '',
    mobileNumber: profile?.mobileNumber || '',
    shopName: profile?.shopName || '',
    businessCategory: profile?.businessCategory || '',
    yearsInBusiness: profile?.yearsInBusiness ?? '',
    acceptsOnlinePayments: Boolean(profile?.acceptsOnlinePayments),
    minOrderValue: profile?.minOrderValue ?? '',
    gstNumber: profile?.gstNumber || '',
    flatNO: profile?.shopAddress?.address?.flatNO || '',
    landmark: profile?.shopAddress?.address?.landmark || '',
    area: profile?.shopAddress?.address?.area || '',
    city: profile?.shopAddress?.city || '',
    state: profile?.shopAddress?.state || '',
    pincode: profile?.shopAddress?.pincode || '',
  });

  useEffect(() => {
    setFormData({
      firstName: profile?.firstName || '',
      lastName: profile?.lastName || '',
      email: profile?.email || '',
      mobileNumber: profile?.mobileNumber || '',
      shopName: profile?.shopName || '',
      businessCategory: profile?.businessCategory || '',
      yearsInBusiness: profile?.yearsInBusiness ?? '',
      acceptsOnlinePayments: Boolean(profile?.acceptsOnlinePayments),
      minOrderValue: profile?.minOrderValue ?? '',
      gstNumber: profile?.gstNumber || '',
      flatNO: profile?.shopAddress?.address?.flatNO || '',
      landmark: profile?.shopAddress?.address?.landmark || '',
      area: profile?.shopAddress?.address?.area || '',
      city: profile?.shopAddress?.city || '',
      state: profile?.shopAddress?.state || '',
      pincode: profile?.shopAddress?.pincode || '',
    });
    setProfileImageData(profile?.profileImg || '');
  }, [profile]);

  const stats = useMemo(() => ([
    { label: 'Role', value: 'Vendor' },
    { label: 'Shop', value: formData.shopName || 'Not set' },
    { label: 'Category', value: formData.businessCategory || 'Not set' },
    { label: 'Payments', value: formData.acceptsOnlinePayments ? 'Enabled' : 'Disabled' },
  ]), [formData.shopName, formData.businessCategory, formData.acceptsOnlinePayments]);

  if (!authState || authState.role !== 'vendor') {
    return <Navigate to="/work/login" replace />;
  }

  const handleLogout = () => {
    clearWorkforceAuth('vendor');
    navigate('/work/login');
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

    if (!profile?._id) {
      setError('Profile data is unavailable. Please log in again.');
      return;
    }

    try {
      setIsSaving(true);
      setError('');

      const response = await fetch(`http://localhost:3000/vendor-api/vendorupdate/${profile._id}`, {
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
      const updatedProfile = data.payload || data.vendor;
      setWorkforceAuth('vendor', { ...authState, profile: updatedProfile });
      toast.success('Vendor profile updated');
      setIsEditing(false);
    } catch (profileError) {
      setError(profileError.message || 'Failed to save profile');
      toast.error(profileError.message || 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="pt-24 pb-12 px-4 bg-gradient-to-b from-violet-50 via-white to-amber-50/30 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="rounded-[28px] border border-white bg-white/90 shadow-[0_24px_60px_rgba(15,23,42,0.08)] p-6 md:p-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-violet-700 font-bold">Vendor Profile</p>
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 mt-2">{profile?.firstName || 'Vendor'}'s business profile</h1>
            <p className="text-gray-600 mt-2 max-w-2xl">Edit your contact, shop, and address details so catalog and partner operations stay accurate.</p>
          </div>
          <div className="flex items-center gap-3">
            <img
              src={profileImageData || profile?.profileImg || PROFILE_PLACEHOLDER}
              alt="Vendor profile"
              className="h-14 w-14 rounded-full border border-violet-100 object-cover"
            />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-violet-700 font-bold">Profile Photo</p>
              <p className="text-xs text-gray-600 mt-1">Displayed across workforce screens</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => navigate('/work/vendor-dashboard')} className="px-4 py-2 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">Back to Dashboard</button>
            <button type="button" onClick={handleLogout} className="px-4 py-2 rounded-full border border-violet-300 text-violet-700 hover:bg-violet-50 transition-colors">Logout</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="rounded-[24px] border border-white bg-white shadow-md p-5 space-y-4 lg:col-span-1">
            <div className="rounded-2xl bg-violet-50 border border-violet-100 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-violet-700 font-bold">Quick Stats</p>
              <div className="mt-4 space-y-3">
                {stats.map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-gray-600">{stat.label}</span>
                    <span className="text-sm font-semibold text-gray-900 text-right">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => setIsEditing((current) => !current)} className="w-full rounded-xl border border-violet-200 px-4 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-50 transition-colors">{isEditing ? 'View Profile' : 'Edit Profile'}</button>
          </div>

          <div className="rounded-[24px] border border-white bg-white shadow-md p-6 md:p-8 lg:col-span-3 space-y-6">
            {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                  <label htmlFor="vendorProfileImage" className="block text-sm font-medium text-gray-700 mb-2">Profile Photo</label>
                  <div className="flex flex-wrap items-center gap-4">
                    <img
                      src={profileImageData || PROFILE_PLACEHOLDER}
                      alt="Profile preview"
                      className="h-16 w-16 rounded-full border border-gray-200 object-cover bg-white"
                    />
                    <div className="space-y-2">
                      <input
                        id="vendorProfileImage"
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
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="firstName">First Name</label>
                    <input id="firstName" name="firstName" value={formData.firstName} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="lastName">Last Name</label>
                    <input id="lastName" name="lastName" value={formData.lastName} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">Email</label>
                    <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="mobileNumber">Mobile Number</label>
                    <input id="mobileNumber" name="mobileNumber" value={formData.mobileNumber} onChange={handleChange} disabled className="w-full rounded-xl border border-gray-300 px-3 py-2.5 bg-gray-50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="shopName">Shop Name</label>
                    <input id="shopName" name="shopName" value={formData.shopName} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="businessCategory">Business Category</label>
                    <input id="businessCategory" name="businessCategory" value={formData.businessCategory} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="yearsInBusiness">Years in Business</label>
                    <input id="yearsInBusiness" name="yearsInBusiness" type="number" min="0" value={formData.yearsInBusiness} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="minOrderValue">Minimum Order Value</label>
                    <input id="minOrderValue" name="minOrderValue" type="number" min="0" value={formData.minOrderValue} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="gstNumber">GST Number</label>
                    <input id="gstNumber" name="gstNumber" value={formData.gstNumber} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="flatNO">Flat / Shop No</label>
                    <input id="flatNO" name="flatNO" value={formData.flatNO} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="landmark">Landmark</label>
                    <input id="landmark" name="landmark" value={formData.landmark} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="area">Area</label>
                    <input id="area" name="area" value={formData.area} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="city">City</label>
                    <input id="city" name="city" value={formData.city} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="state">State</label>
                    <input id="state" name="state" value={formData.state} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="pincode">Pincode</label>
                    <input id="pincode" name="pincode" value={formData.pincode} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  </div>
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
                  <button type="button" onClick={() => setIsEditing(false)} className="rounded-full border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors" disabled={isSaving}>Cancel</button>
                  <button type="submit" disabled={isSaving} className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-70">{isSaving ? 'Saving...' : 'Save Profile'}</button>
                </div>
              </form>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl bg-violet-50 p-4 border border-violet-100">
                  <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Business Category</p>
                  <p className="mt-1 text-gray-900 font-semibold">{profile?.businessCategory || 'Not Provided'}</p>
                </div>
                <div className="rounded-2xl bg-violet-50 p-4 border border-violet-100">
                  <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">GST Number</p>
                  <p className="mt-1 text-gray-900 font-semibold">{profile?.gstNumber || 'Not Provided'}</p>
                </div>
                <div className="rounded-2xl bg-violet-50 p-4 border border-violet-100">
                  <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Online Payments</p>
                  <p className="mt-1 text-gray-900 font-semibold">{profile?.acceptsOnlinePayments ? 'Enabled' : 'Not Enabled'}</p>
                </div>
                <div className="rounded-2xl bg-violet-50 p-4 border border-violet-100">
                  <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Minimum Order Value</p>
                  <p className="mt-1 text-gray-900 font-semibold">{profile?.minOrderValue ? `₹${profile.minOrderValue}` : 'Not Set'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default VendorProfile;
