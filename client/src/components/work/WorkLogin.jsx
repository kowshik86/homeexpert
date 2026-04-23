import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { setWorkforceAuth } from '../../utils/workforceAuth';

const ROLE_CONFIG = {
  shopkeeper: {
    label: 'Shopkeeper',
    apiBase: 'http://localhost:3000/shopkeeper-api/auth',
    redirectPath: '/work/shopkeeper-dashboard',
  },
  delivery: {
    label: 'Delivery Person',
    apiBase: 'http://localhost:3000/delivery-api/auth',
    redirectPath: '/work/delivery-dashboard',
  },
  worker: {
    label: 'Worker',
    apiBase: 'http://localhost:3000/worker-api/auth',
    redirectPath: '/work/worker-dashboard',
  },
};

function WorkLogin() {
  const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState('login');
  const [selectedRole, setSelectedRole] = useState('shopkeeper');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [shopName, setShopName] = useState('');
  const [profileImageData, setProfileImageData] = useState('');
  const [shopImageData, setShopImageData] = useState('');
  const [vehicleImageData, setVehicleImageData] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [yearsInBusiness, setYearsInBusiness] = useState('');
  const [acceptsOnlinePayments, setAcceptsOnlinePayments] = useState('yes');
  const [minOrderValue, setMinOrderValue] = useState('');

  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [flatNo, setFlatNo] = useState('');
  const [landmark, setLandmark] = useState('');
  const [area, setArea] = useState('');

  const [dob, setDob] = useState('');
  const [hasVehicle, setHasVehicle] = useState('yes');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [preferredShift, setPreferredShift] = useState('morning');

  const [workTypesInput, setWorkTypesInput] = useState('');
  const [workerBio, setWorkerBio] = useState('');
  const [serviceRadiusKm, setServiceRadiusKm] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const roleDetails = useMemo(() => ROLE_CONFIG[selectedRole], [selectedRole]);

  const resetFormState = () => {
    setFirstName('');
    setLastName('');
    setMobileNumber('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShopName('');
    setProfileImageData('');
    setShopImageData('');
    setVehicleImageData('');
    setGstNumber('');
    setBusinessCategory('');
    setYearsInBusiness('');
    setAcceptsOnlinePayments('yes');
    setMinOrderValue('');
    setState('');
    setCity('');
    setPincode('');
    setFlatNo('');
    setLandmark('');
    setArea('');
    setDob('');
    setHasVehicle('yes');
    setEmergencyContact('');
    setPreferredShift('morning');
    setWorkTypesInput('');
    setWorkerBio('');
    setServiceRadiusKm('');
    setError('');
  };

  const buildRegisterPayload = () => {
    const basePayload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      mobileNumber: mobileNumber.trim(),
      email: email.trim().toLowerCase(),
      password,
      profileImg: profileImageData || undefined,
    };

    if (selectedRole === 'shopkeeper') {
      return {
        ...basePayload,
        shopName: shopName.trim(),
        shopImage: shopImageData || undefined,
        businessCategory: businessCategory.trim() || undefined,
        yearsInBusiness: yearsInBusiness ? Number(yearsInBusiness) : undefined,
        acceptsOnlinePayments: acceptsOnlinePayments === 'yes',
        minOrderValue: minOrderValue ? Number(minOrderValue) : undefined,
        gstNumber: gstNumber.trim() || undefined,
        shopAddress: {
          state: state.trim(),
          city: city.trim(),
          pincode: pincode.trim(),
          address: {
            flatNO: flatNo.trim(),
            landmark: landmark.trim(),
            area: area.trim(),
          },
        },
      };
    }

    if (selectedRole === 'delivery') {
      return {
        ...basePayload,
        dob,
        vechicle: hasVehicle === 'yes',
        vehicleImage: vehicleImageData || undefined,
        emergencyContact: emergencyContact.trim() || undefined,
        preferredShift: preferredShift || undefined,
      };
    }

    return {
      ...basePayload,
      Address: {
        state: state.trim(),
        city: city.trim(),
        pincode: pincode.trim(),
        address: {
          flatNo: flatNo.trim(),
          landmark: landmark.trim(),
          area: area.trim(),
        },
      },
      workTypes: workTypesInput
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      bio: workerBio.trim() || undefined,
      serviceRadiusKm: serviceRadiusKm ? Number(serviceRadiusKm) : undefined,
    };
  };

  const validateRegisterInputs = () => {
    if (!firstName.trim() || !mobileNumber.trim() || !email.trim() || !password) {
      return 'Please fill all required fields.';
    }
    if (password.length < 6) {
      return 'Password must be at least 6 characters.';
    }
    if (password !== confirmPassword) {
      return 'Password and confirm password do not match.';
    }

    if (selectedRole === 'shopkeeper') {
      if (!shopName.trim() || !state.trim() || !city.trim() || !pincode.trim() || !flatNo.trim() || !landmark.trim() || !area.trim()) {
        return 'Please complete shop and address details.';
      }
    }

    if (selectedRole === 'delivery') {
      if (!dob) {
        return 'Date of birth is required for delivery person registration.';
      }
    }

    if (selectedRole === 'worker') {
      if (!state.trim() || !city.trim() || !pincode.trim() || !flatNo.trim() || !landmark.trim() || !area.trim()) {
        return 'Please complete address details for worker registration.';
      }
      if (!workTypesInput.trim()) {
        return 'Please provide at least one work type.';
      }
    }

    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      setLoading(true);

      if (authMode === 'register') {
        const validationMessage = validateRegisterInputs();
        if (validationMessage) {
          setError(validationMessage);
          return;
        }
      } else if (!mobileNumber.trim() || !password) {
        setError('Please enter mobile number and password.');
        return;
      }

      const endpoint = authMode === 'register' ? `${roleDetails.apiBase}/register` : `${roleDetails.apiBase}/login`;
      const payload = authMode === 'register'
        ? buildRegisterPayload()
        : { mobileNumber: mobileNumber.trim(), password };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const responseData = await response.json().catch(() => ({}));
        throw new Error(responseData.message || 'Authentication failed');
      }

      const data = await response.json();

      setWorkforceAuth(selectedRole, {
        token: data?.token,
        profile: data?.payload,
        loggedInAt: new Date().toISOString(),
      });

      navigate(roleDetails.redirectPath);
    } catch (authError) {
      console.error('Workforce auth failed:', authError);
      setError(authError.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (event, setImageState) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const encodedImage = await toBase64(file);
      setImageState(encodedImage);
    } catch (imageError) {
      console.error('Image processing failed:', imageError);
      setError('Failed to process image. Please try another file.');
    }
  };

  return (
    <div className="pt-24 pb-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg border border-purple-100 overflow-hidden">
        <div className="p-6 md:p-8 bg-gradient-to-r from-purple-50 to-violet-50 border-b border-purple-100">
          <h1 className="text-2xl md:text-3xl font-bold text-primary-custom">Work at HomeXpert</h1>
          <p className="text-gray-600 mt-2">Professional workforce authentication for Shopkeeper, Delivery Person, and Worker.</p>
        </div>

        <div className="p-6 md:p-8">
          <div className="grid grid-cols-2 gap-3 mb-6 max-w-sm">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setError('');
              }}
              className={`rounded-lg border px-4 py-2 font-semibold transition-all ${
                authMode === 'login'
                  ? 'border-primary-custom bg-purple-50 text-primary-custom'
                  : 'border-gray-200 text-gray-700'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setError('');
              }}
              className={`rounded-lg border px-4 py-2 font-semibold transition-all ${
                authMode === 'register'
                  ? 'border-primary-custom bg-purple-50 text-primary-custom'
                  : 'border-gray-200 text-gray-700'
              }`}
            >
              Register
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            {Object.entries(ROLE_CONFIG).map(([roleKey, config]) => (
              <button
                key={roleKey}
                type="button"
                onClick={() => {
                  setSelectedRole(roleKey);
                  resetFormState();
                }}
                className={`rounded-lg border px-4 py-3 font-semibold transition-all ${
                  selectedRole === roleKey
                    ? 'border-primary-custom bg-purple-50 text-primary-custom'
                    : 'border-gray-200 text-gray-700 hover:border-purple-300'
                }`}
              >
                {config.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {authMode === 'register' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input id="firstName" type="text" value={firstName} onChange={(event) => setFirstName(event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none" />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input id="lastName" type="text" value={lastName} onChange={(event) => setLastName(event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none" />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="mobileNumber" className="block text-sm font-medium text-gray-700 mb-1">
                Mobile Number
              </label>
              <input
                id="mobileNumber"
                type="text"
                value={mobileNumber}
                onChange={(event) => setMobileNumber(event.target.value)}
                placeholder="Enter registered mobile number"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none"
              />
            </div>

            {authMode === 'register' && (
              <>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="profileImage" className="block text-sm font-medium text-gray-700 mb-1">Profile Image (Optional)</label>
                  <input
                    id="profileImage"
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleImageUpload(event, setProfileImageData)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none"
                  />
                  {profileImageData ? <img src={profileImageData} alt="Profile preview" className="mt-2 h-16 w-16 rounded-full object-cover border border-gray-200" /> : null}
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none"
                  />
                </div>

                {selectedRole === 'shopkeeper' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="shopName" className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
                        <input id="shopName" type="text" value={shopName} onChange={(event) => setShopName(event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none" />
                      </div>
                      <div>
                        <label htmlFor="shopImage" className="block text-sm font-medium text-gray-700 mb-1">Shop Image Upload (Optional)</label>
                        <input
                          id="shopImage"
                          type="file"
                          accept="image/*"
                          onChange={(event) => handleImageUpload(event, setShopImageData)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none"
                        />
                        {shopImageData ? <img src={shopImageData} alt="Shop preview" className="mt-2 h-16 w-16 rounded object-cover border border-gray-200" /> : null}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="gstNumber" className="block text-sm font-medium text-gray-700 mb-1">GST Number (Optional)</label>
                      <input id="gstNumber" type="text" value={gstNumber} onChange={(event) => setGstNumber(event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Business Category (Optional)</label>
                        <input type="text" value={businessCategory} onChange={(event) => setBusinessCategory(event.target.value)} placeholder="Groceries, Fresh Produce" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Years in Business (Optional)</label>
                        <input type="number" min="0" value={yearsInBusiness} onChange={(event) => setYearsInBusiness(event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Accepts Online Payments</label>
                        <select value={acceptsOnlinePayments} onChange={(event) => setAcceptsOnlinePayments(event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none">
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Order Value (Optional)</label>
                        <input type="number" min="0" value={minOrderValue} onChange={(event) => setMinOrderValue(event.target.value)} placeholder="e.g. 199" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none" />
                      </div>
                    </div>
                  </>
                )}

                {(selectedRole === 'shopkeeper' || selectedRole === 'worker') && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                      <input type="text" value={state} onChange={(event) => setState(event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input type="text" value={city} onChange={(event) => setCity(event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                      <input type="text" value={pincode} onChange={(event) => setPincode(event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Flat No</label>
                      <input type="text" value={flatNo} onChange={(event) => setFlatNo(event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Landmark</label>
                      <input type="text" value={landmark} onChange={(event) => setLandmark(event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                      <input type="text" value={area} onChange={(event) => setArea(event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none" />
                    </div>
                  </div>
                )}

                {selectedRole === 'delivery' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                      <input type="date" value={dob} onChange={(event) => setDob(event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Has Vehicle</label>
                      <select value={hasVehicle} onChange={(event) => setHasVehicle(event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none">
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact (Optional)</label>
                      <input type="text" value={emergencyContact} onChange={(event) => setEmergencyContact(event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Shift</label>
                      <select value={preferredShift} onChange={(event) => setPreferredShift(event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none">
                        <option value="morning">Morning</option>
                        <option value="afternoon">Afternoon</option>
                        <option value="evening">Evening</option>
                        <option value="night">Night</option>
                      </select>
                    </div>
                  </div>
                )}

                {selectedRole === 'delivery' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Image Upload (Optional)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleImageUpload(event, setVehicleImageData)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none"
                    />
                    {vehicleImageData ? <img src={vehicleImageData} alt="Vehicle preview" className="mt-2 h-16 w-16 rounded object-cover border border-gray-200" /> : null}
                  </div>
                )}

                {selectedRole === 'worker' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Work Types (comma separated)</label>
                      <input type="text" value={workTypesInput} onChange={(event) => setWorkTypesInput(event.target.value)} placeholder="electrician, plumber" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Service Radius (KM, Optional)</label>
                      <input type="number" min="0" value={serviceRadiusKm} onChange={(event) => setServiceRadiusKm(event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Professional Bio (Optional)</label>
                      <textarea value={workerBio} onChange={(event) => setWorkerBio(event.target.value)} rows={3} placeholder="Tell customers about your skills and experience" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 focus:outline-none" />
                    </div>
                  </div>
                )}
              </>
            )}

            {error ? <p className="text-red-600 text-sm">{error}</p> : null}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-primary-custom text-white font-semibold rounded-lg px-5 py-2.5 hover:opacity-90 disabled:opacity-70"
              >
                {loading ? 'Please wait...' : `${authMode === 'login' ? 'Login' : 'Register'} as ${roleDetails.label}`}
              </button>
              <Link
                to="/"
                className="inline-flex items-center justify-center border border-gray-300 rounded-lg px-5 py-2.5 text-gray-700 hover:bg-gray-50"
              >
                Back to Home
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default WorkLogin;
