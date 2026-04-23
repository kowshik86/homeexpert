import React, { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { clearWorkforceAuth, getWorkforceAuth, setWorkforceAuth } from '../../utils/workforceAuth';
import { readImageFileAsDataUrl, validateImageFile } from '../../utils/imageUpload';

const getAuthState = () => {
  return getWorkforceAuth('worker');
};

const joinList = (items) => (Array.isArray(items) ? items.join(', ') : '');

const PROFILE_PLACEHOLDER = 'https://via.placeholder.com/120?text=Profile';

function WorkerProfile() {
  const navigate = useNavigate();
  const authState = getAuthState();
  const profile = authState?.profile || null;

  const [formData, setFormData] = useState({
    firstName: profile?.firstName || '',
    lastName: profile?.lastName || '',
    email: profile?.email || '',
    mobileNumber: profile?.mobileNumber || '',
    dob: profile?.dob ? String(profile.dob).slice(0, 10) : '',
    specializations: joinList(profile?.workTypes),
    yearsOfExperience: profile?.experienceYears || '',
    serviceAreas: joinList(profile?.Address?.address ? [profile.Address.address.area] : []),
    hourlyRate: profile?.hourlyRate || '',
    isAvailable: profile?.isAvailable ?? true,
    bio: profile?.bio || '',
    certifications: '',
  });
  const [profileImageData, setProfileImageData] = useState(profile?.profileImg || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleBackToDashboard = () => {
    window.location.assign('/work/worker-dashboard');
  };

  const stats = useMemo(() => ([
    { label: 'Role', value: 'Service Professional' },
    { label: 'Experience', value: formData.yearsOfExperience ? `${formData.yearsOfExperience} years` : 'Not set' },
    { label: 'Availability', value: formData.isAvailable ? 'Available' : 'Offline' },
    { label: 'Hourly Rate', value: formData.hourlyRate ? `₹${formData.hourlyRate}` : 'Not set' },
  ]), [formData.yearsOfExperience, formData.isAvailable, formData.hourlyRate]);

  if (!authState || authState.role !== 'worker') {
    return <Navigate to="/work/login" replace />;
  }

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
    setError('');

    if (!profile?._id) {
      setError('Profile data is unavailable. Please log in again.');
      return;
    }

    try {
      setIsSaving(true);

      const response = await fetch(`http://localhost:3000/worker-api/workerupdate/${profile._id}`, {
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
          workTypes: formData.specializations
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          experienceYears: Number(formData.yearsOfExperience || 0),
          hourlyRate: Number(formData.hourlyRate || 0),
          isAvailable: Boolean(formData.isAvailable),
          bio: formData.bio.trim(),
        }),
      });

      if (!response.ok) {
        const responseData = await response.json().catch(() => ({}));
        throw new Error(responseData.message || 'Failed to save profile');
      }

      const data = await response.json();
      setWorkforceAuth('worker', { ...authState, profile: data.payload || data.worker });
      toast.success('Worker profile updated');
      navigate('/work/worker-dashboard');
    } catch (profileError) {
      setError(profileError.message || 'Failed to save profile');
      toast.error(profileError.message || 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    clearWorkforceAuth('worker');
    navigate('/work/login');
  };

  return (
    <div className="pt-24 pb-12 px-4 bg-gradient-to-b from-emerald-50 via-white to-blue-50/30 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="rounded-[28px] border border-white bg-white/90 shadow-[0_24px_60px_rgba(15,23,42,0.08)] p-6 md:p-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-700 font-bold">Worker Profile</p>
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 mt-2">
              {profile?.firstName || 'Professional'}'s Service Profile
            </h1>
            <p className="text-gray-600 mt-2 max-w-2xl">
              Update your contact, specializations, rates, and availability details for service bookings.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleBackToDashboard}
              className="px-4 py-2 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back to Dashboard
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-2 rounded-full border border-red-300 text-red-700 hover:bg-red-50 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Stats Sidebar */}
          <div className="rounded-[24px] border border-white bg-white shadow-md p-5 space-y-4 lg:col-span-1">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 flex items-center gap-3">
              <img
                src={profileImageData || profile?.profileImg || PROFILE_PLACEHOLDER}
                alt="Worker profile"
                className="h-12 w-12 rounded-full border border-emerald-200 object-cover"
              />
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-700 font-bold">Profile Photo</p>
                <p className="text-xs text-emerald-900 mt-1">Visible to customers</p>
              </div>
            </div>

            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-700 font-bold">Quick Stats</p>
              <div className="mt-4 space-y-3">
                {stats.map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-gray-600">{stat.label}</span>
                    <span className="text-sm font-semibold text-gray-900 text-right">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-900">
              Complete your profile to increase your chances of getting more bookings and maintaining high quality standards.
            </div>
          </div>

          {/* Main Form */}
          <div className="lg:col-span-3 space-y-6">
            {error && (
              <div className="rounded-[20px] border border-red-200 bg-red-50 p-4 text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="rounded-[24px] border border-white bg-white shadow-md p-6 md:p-8 space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Profile Photo</h2>
                  <p className="text-gray-600 text-sm mt-1">Upload a clear image for your workforce profile.</p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <img
                    src={profileImageData || PROFILE_PLACEHOLDER}
                    alt="Profile preview"
                    className="h-16 w-16 rounded-full border border-gray-200 object-cover bg-white"
                  />
                  <div className="space-y-2">
                    <input
                      id="workerProfileImage"
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

              {/* Personal Information */}
              <div className="rounded-[24px] border border-white bg-white shadow-md p-6 md:p-8 space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Personal Information</h2>
                  <p className="text-gray-600 text-sm mt-1">Your contact details and basic information</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
                      placeholder="First Name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
                      placeholder="Last Name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
                      placeholder="Email"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Mobile Number</label>
                    <input
                      type="tel"
                      name="mobileNumber"
                      value={formData.mobileNumber}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
                      placeholder="Mobile Number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Date of Birth</label>
                    <input
                      type="date"
                      name="dob"
                      value={formData.dob}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
                    />
                  </div>
                </div>
              </div>

              {/* Professional Information */}
              <div className="rounded-[24px] border border-white bg-white shadow-md p-6 md:p-8 space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Professional Details</h2>
                  <p className="text-gray-600 text-sm mt-1">Skills, experience, and service information</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Specializations (comma-separated)</label>
                    <input
                      type="text"
                      name="specializations"
                      value={formData.specializations}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
                      placeholder="e.g., Plumbing, Electrical, HVAC"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Years of Experience</label>
                    <input
                      type="number"
                      name="yearsOfExperience"
                      value={formData.yearsOfExperience}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
                      placeholder="e.g., 5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Hourly Rate (₹)</label>
                    <input
                      type="number"
                      name="hourlyRate"
                      value={formData.hourlyRate}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
                      placeholder="e.g., 500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Service Areas (comma-separated)</label>
                    <input
                      type="text"
                      name="serviceAreas"
                      value={formData.serviceAreas}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
                      placeholder="e.g., Downtown, North Area, East Side"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Certifications (comma-separated)</label>
                    <input
                      type="text"
                      name="certifications"
                      value={formData.certifications}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
                      placeholder="e.g., NSDC Certified, Gas Fitting License"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Bio</label>
                    <textarea
                      name="bio"
                      value={formData.bio}
                      onChange={handleChange}
                      rows="4"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
                      placeholder="Tell clients about your experience and approach to service..."
                    />
                  </div>
                </div>
              </div>

              {/* Availability */}
              <div className="rounded-[24px] border border-white bg-white shadow-md p-6 md:p-8 space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Availability</h2>
                  <p className="text-gray-600 text-sm mt-1">Control when you receive booking notifications</p>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="isAvailable"
                      checked={formData.isAvailable}
                      onChange={handleChange}
                      className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-gray-700 font-semibold">
                      I am currently available for bookings
                    </span>
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 rounded-[16px] bg-emerald-600 px-6 py-3 text-white font-semibold hover:bg-emerald-700 disabled:bg-gray-400 transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </button>
                <button
                  type="button"
                  onClick={handleBackToDashboard}
                  className="flex-1 rounded-[16px] border border-gray-300 px-6 py-3 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkerProfile;
