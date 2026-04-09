import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 };

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const buildAddressLine = (address) => {
  const lineParts = [
    address?.house_number,
    address?.road,
    address?.suburb,
    address?.neighbourhood,
  ].filter(Boolean);

  return lineParts.join(', ');
};

const getCityName = (address) => {
  return address?.city || address?.town || address?.village || address?.county || '';
};

const getReadableGeolocationError = (error) => {
  if (!error || typeof error.code !== 'number') {
    return 'Unable to fetch your current location.';
  }

  switch (error.code) {
    case 1:
      return 'Location permission was denied. Allow location access and try again.';
    case 2:
      return 'Location is currently unavailable. Please check GPS/network and retry.';
    case 3:
      return 'Location request timed out. Please try again.';
    default:
      return 'Unable to fetch your current location.';
  }
};

const geocodePlace = async (query) => {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`,
    { headers: { 'Accept-Language': 'en' } },
  );

  if (!response.ok) {
    throw new Error('Unable to search this place right now.');
  }

  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
};

const reverseGeocode = async (lat, lng) => {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${lat}&lon=${lng}`,
    { headers: { 'Accept-Language': 'en' } },
  );

  if (!response.ok) {
    throw new Error('Unable to fetch location details.');
  }

  return await response.json();
};

function MapRecenter({ center }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo([center.lat, center.lng], 16, { duration: 0.8 });
  }, [center, map]);

  return null;
}

function MapClickHandler({ onPick }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng);
    },
  });

  return null;
}

const SavedAddresses = () => {
  const { currentUser } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [locatingCurrentPosition, setLocatingCurrentPosition] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState(DEFAULT_CENTER);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [formData, setFormData] = useState({
    fullName: '',
    mobileNumber: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    landmark: '',
    addressType: 'home',
    isDefault: false,
  });

  useEffect(() => {
    fetchAddresses();
  }, [currentUser]);

  const fetchAddresses = async () => {
    if (!currentUser?._id) return;

    try {
      const response = await fetch(`http://localhost:3000/address-api/addresses/${currentUser._id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch addresses');
      }
      
      const data = await response.json();
      setAddresses(data.payload || []);
    } catch (error) {
      console.error('Error fetching addresses:', error);
      toast.error('Failed to load saved addresses');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const applyLocationData = (locationPayload, lat, lng) => {
    const address = locationPayload?.address || {};
    const bestLine = buildAddressLine(address) || locationPayload?.display_name || '';

    setSelectedCoords({ lat, lng });
    setMapCenter({ lat, lng });
    setSearchQuery(locationPayload?.display_name || '');
    setFormData((prev) => ({
      ...prev,
      addressLine1: bestLine,
      city: getCityName(address),
      state: address?.state || prev.state,
      pincode: address?.postcode || prev.pincode,
      landmark: prev.landmark || address?.suburb || address?.neighbourhood || '',
    }));
  };

  const handleLocationSearch = async () => {
    const query = searchQuery.trim();
    if (!query) {
      toast.error('Type an area or address to search on map.');
      return;
    }

    try {
      setSearchingLocation(true);
      const results = await geocodePlace(query);
      setSearchResults(results);

      if (results.length === 0) {
        toast.info('No matching places found. Try another nearby landmark.');
      }
    } catch (error) {
      toast.error(error.message || 'Place search failed.');
    } finally {
      setSearchingLocation(false);
    }
  };

  const selectSearchResult = (result) => {
    const lat = Number(result.lat);
    const lng = Number(result.lon);

    applyLocationData(result, lat, lng);
    setSearchResults([]);
  };

  const handleMapPick = async (latlng) => {
    try {
      setResolvingLocation(true);
      const resolved = await reverseGeocode(latlng.lat, latlng.lng);
      applyLocationData(resolved, latlng.lat, latlng.lng);
    } catch (error) {
      toast.error(error.message || 'Could not fetch place details from map pin.');
    } finally {
      setResolvingLocation(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported in this browser.');
      return;
    }

    try {
      setLocatingCurrentPosition(true);
      setResolvingLocation(true);
      setSearchResults([]);

      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude } = position.coords;
      const resolved = await reverseGeocode(latitude, longitude);
      applyLocationData(resolved, latitude, longitude);
      toast.success('Current location added to address form.');
    } catch (error) {
      toast.error(getReadableGeolocationError(error));
    } finally {
      setLocatingCurrentPosition(false);
      setResolvingLocation(false);
    }
  };

  const handleAddAddress = () => {
    setFormData({
      fullName: currentUser?.firstName + ' ' + (currentUser?.lastName || ''),
      mobileNumber: currentUser?.mobileNumber || '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      pincode: '',
      landmark: '',
      addressType: 'home',
      isDefault: addresses.length === 0,
    });
    setSearchQuery('');
    setSearchResults([]);
    setSelectedCoords(DEFAULT_CENTER);
    setMapCenter(DEFAULT_CENTER);
    setIsAddingAddress(true);
    setIsEditingAddress(null);
  };

  const handleEditAddress = (address) => {
    setFormData({
      fullName: address.fullName,
      mobileNumber: address.mobileNumber,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || '',
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      landmark: address.landmark || '',
      addressType: address.addressType,
      isDefault: address.isDefault,
    });
    const editQuery = [address.addressLine1, address.city, address.state, address.pincode].filter(Boolean).join(', ');
    setSearchQuery(editQuery);
    setSearchResults([]);
    setSelectedCoords(DEFAULT_CENTER);
    setMapCenter(DEFAULT_CENTER);

    geocodePlace(editQuery)
      .then((results) => {
        if (Array.isArray(results) && results.length > 0) {
          const lat = Number(results[0].lat);
          const lng = Number(results[0].lon);
          setSelectedCoords({ lat, lng });
          setMapCenter({ lat, lng });
        }
      })
      .catch(() => {
        // Keep default center if geocoding the existing address fails.
      });

    setIsEditingAddress(address._id);
    setIsAddingAddress(false);
  };

  const handleCancelForm = () => {
    setIsAddingAddress(false);
    setIsEditingAddress(null);
    setSearchResults([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    if (!formData.fullName.trim() || !formData.mobileNumber.trim() || !formData.addressLine1.trim()) {
      toast.error('Name, mobile and selected address are required.');
      setIsLoading(false);
      return;
    }

    if (!formData.city.trim() || !formData.state.trim() || !formData.pincode.trim()) {
      toast.error('Please enter city, state and pincode before saving.');
      setIsLoading(false);
      return;
    }

    try {
      if (isAddingAddress) {
        const response = await fetch('http://localhost:3000/address-api/address', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...formData,
            userId: currentUser._id,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to add address');
        }

        toast.success('Address added successfully');
      } else if (isEditingAddress) {
        const response = await fetch(`http://localhost:3000/address-api/address/${isEditingAddress}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          throw new Error('Failed to update address');
        }

        toast.success('Address updated successfully');
      }

      fetchAddresses();

      setIsAddingAddress(false);
      setIsEditingAddress(null);
      setSearchResults([]);
    } catch (error) {
      toast.error(error.message || 'Failed to save address');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetDefault = async (addressId) => {
    try {
      const response = await fetch(`http://localhost:3000/address-api/address/${addressId}/default`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to set default address');
      }

      toast.success('Default address updated');
      fetchAddresses();
    } catch (error) {
      toast.error(error.message || 'Failed to set default address');
    }
  };

  const handleDeleteAddress = async (addressId) => {
    if (!window.confirm('Are you sure you want to delete this address?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3000/address-api/address/${addressId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete address');
      }

      toast.success('Address deleted successfully');
      fetchAddresses();
    } catch (error) {
      toast.error(error.message || 'Failed to delete address');
    }
  };

  if (isLoading && addresses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-custom"></div>
        <p className="mt-4 text-gray-600">Loading your addresses...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Saved Addresses</h2>
        {!isAddingAddress && !isEditingAddress && (
          <button
            onClick={handleAddAddress}
            className="px-4 py-2 bg-primary-custom text-white rounded-md hover:bg-opacity-90 transition-colors flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add New Address
          </button>
        )}
      </div>

      {(isAddingAddress || isEditingAddress) ? (
        <div className="bg-gradient-to-br from-cyan-50 via-white to-emerald-50 rounded-2xl p-6 mb-6 border border-cyan-100 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {isAddingAddress ? 'Add New Address' : 'Edit Address'}
          </h3>

          <div className="rounded-xl border border-cyan-100 bg-white p-4 mb-5">
            <p className="text-xs uppercase tracking-wide text-cyan-700 font-semibold">Step 1</p>
            <p className="text-sm text-gray-700 mt-1">Search your area and tap exact location on map.</p>

            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search area, society, landmark"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleLocationSearch}
                  disabled={searchingLocation || locatingCurrentPosition}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-cyan-300"
                >
                  {searchingLocation ? 'Searching...' : 'Search'}
                </button>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={locatingCurrentPosition || searchingLocation}
                  className="rounded-lg border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {locatingCurrentPosition ? 'Locating...' : 'Use Current Location'}
                </button>
              </div>
            </div>

            {searchResults.length > 0 ? (
              <div className="mt-3 max-h-44 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                {searchResults.map((result) => (
                  <button
                    key={`${result.place_id}-${result.lat}-${result.lon}`}
                    type="button"
                    onClick={() => selectSearchResult(result)}
                    className="w-full text-left px-3 py-2 text-sm border-b border-gray-100 last:border-b-0 hover:bg-cyan-50"
                  >
                    {result.display_name}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-3 rounded-xl overflow-hidden border border-gray-200">
              <MapContainer
                center={[mapCenter.lat, mapCenter.lng]}
                zoom={15}
                scrollWheelZoom
                style={{ height: 300, width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapRecenter center={mapCenter} />
                <MapClickHandler onPick={handleMapPick} />
                <Marker position={[selectedCoords.lat, selectedCoords.lng]} />
              </MapContainer>
            </div>

            <p className="mt-2 text-xs text-gray-500">
              {resolvingLocation
                ? 'Fetching exact residential details from selected pin...'
                : 'Tip: Tap exact building entrance for accurate delivery pin.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900">
              <p className="font-semibold">Detected Location</p>
              <p className="mt-1">{formData.addressLine1 || 'Select your location from map to auto-fill address details.'}</p>
              {formData.city || formData.state || formData.pincode ? (
                <p className="mt-1 text-emerald-800">{formData.city}, {formData.state} - {formData.pincode}</p>
              ) : null}
              <p className="mt-1 text-xs text-emerald-700">
                Pin: {selectedCoords.lat.toFixed(5)}, {selectedCoords.lng.toFixed(5)}
              </p>
              <p className="mt-2 text-xs text-emerald-700">You can edit city, state and pincode manually if auto-detection is incomplete.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name*
                </label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-custom/50"
                  required
                />
              </div>
              <div>
                <label htmlFor="mobileNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile Number*
                </label>
                <input
                  type="tel"
                  id="mobileNumber"
                  name="mobileNumber"
                  value={formData.mobileNumber}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-custom/50"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="addressLine1" className="block text-sm font-medium text-gray-700 mb-1">
                Primary Address (auto-filled from map)*
              </label>
              <input
                type="text"
                id="addressLine1"
                name="addressLine1"
                value={formData.addressLine1}
                onChange={handleChange}
                placeholder="Tap map to capture your exact location"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-custom/50"
                required
              />
            </div>

            <div>
              <label htmlFor="addressLine2" className="block text-sm font-medium text-gray-700 mb-1">
                Flat / Floor / Area details
              </label>
              <input
                type="text"
                id="addressLine2"
                name="addressLine2"
                value={formData.addressLine2}
                onChange={handleChange}
                placeholder="Flat no, floor, wing (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-custom/50"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                  City*
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-custom/50"
                  required
                />
              </div>
              <div>
                <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                  State*
                </label>
                <input
                  type="text"
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-custom/50"
                  required
                />
              </div>
              <div>
                <label htmlFor="pincode" className="block text-sm font-medium text-gray-700 mb-1">
                  Pincode*
                </label>
                <input
                  type="text"
                  id="pincode"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-custom/50"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="landmark" className="block text-sm font-medium text-gray-700 mb-1">
                Landmark
              </label>
              <input
                type="text"
                id="landmark"
                name="landmark"
                value={formData.landmark}
                onChange={handleChange}
                placeholder="Nearby landmark (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-custom/50"
              />
            </div>

            <div className="flex items-center">
              <input
                id="isDefault"
                name="isDefault"
                type="checkbox"
                checked={formData.isDefault}
                onChange={handleChange}
                className="h-4 w-4 text-primary-custom focus:ring-primary-custom/50 border-gray-300 rounded"
              />
              <label htmlFor="isDefault" className="ml-2 block text-sm text-gray-700">
                Set as default address
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary-custom text-white rounded-md hover:bg-opacity-90 transition-colors"
              >
                {isAddingAddress ? 'Add Address' : 'Update Address'}
              </button>
            </div>
          </form>
        </div>
      ) : addresses.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900">No addresses saved</h3>
          <p className="mt-1 text-gray-500">Add an address to make checkout faster.</p>
          <button
            onClick={handleAddAddress}
            className="mt-6 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-custom hover:bg-opacity-90 focus:outline-none"
          >
            Add New Address
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((address) => (
            <div
              key={address._id}
              className={`border rounded-lg p-4 relative ${
                address.isDefault ? 'border-primary-custom bg-primary-custom/5' : 'border-gray-200'
              }`}
            >
              {address.isDefault && (
                <span className="absolute top-2 right-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-custom text-white">
                  Default
                </span>
              )}
              
              <div className="flex items-start mb-2">
                <div className="p-2 rounded-full bg-cyan-100 text-cyan-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="ml-3 mt-1">
                  <h3 className="text-base font-medium text-gray-900">Residential Address</h3>
                </div>
              </div>
              
              <div className="mt-4 mb-2">
                <p className="text-sm font-medium text-gray-900">{address.fullName}</p>
                <p className="text-sm text-gray-600 mt-1">{address.addressLine1}</p>
                {address.addressLine2 && <p className="text-sm text-gray-600">{address.addressLine2}</p>}
                <p className="text-sm text-gray-600">{address.city}, {address.state} - {address.pincode}</p>
                {address.landmark && <p className="text-sm text-gray-600">Landmark: {address.landmark}</p>}
                <p className="text-sm text-gray-600 mt-1">Phone: {address.mobileNumber}</p>
              </div>
              
              <div className="mt-4 flex space-x-3">
                <button
                  onClick={() => handleEditAddress(address)}
                  className="text-sm text-primary-custom hover:text-primary-custom/80"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteAddress(address._id)}
                  className="text-sm text-red-600 hover:text-red-500"
                >
                  Delete
                </button>
                {!address.isDefault && (
                  <button
                    onClick={() => handleSetDefault(address._id)}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Set as Default
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedAddresses;
