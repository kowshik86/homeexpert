import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

const RegisterForm = () => {
  const { register, sendOTP } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mobileNumber: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic validation
    if (!formData.firstName || !formData.mobileNumber) {
      setError('First name and phone number are required');
      toast.error('First name and phone number are required');
      return;
    }

    // Validate phone number format
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(formData.mobileNumber)) {
      setError('Please enter a valid 10-digit phone number');
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    try {
      setError('');
      setLoading(true);

      // First register the user
      await register(formData);
      toast.success('Account created successfully');

      // Then send OTP for verification
      const result = await sendOTP(formData.mobileNumber);
      toast.info('OTP sent to your phone number');

      // Display OTP for testing purposes
      if (result && result.otp) {
        console.log('Your OTP:', result.otp);
        toast.info(`Your OTP: ${result.otp}`, {
          autoClose: false,
          closeOnClick: false
        });
      }
    } catch (error) {
      setError(error.message || 'Registration failed. Please try again.');
      toast.error(error.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      {error && (
        <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
            First Name*
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            value={formData.firstName}
            onChange={handleChange}
            placeholder="First name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8a4af3] focus:border-transparent"
            required
          />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
            Last Name
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            value={formData.lastName}
            onChange={handleChange}
            placeholder="Last name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8a4af3] focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Email address"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8a4af3] focus:border-transparent"
        />
      </div>

      <div>
        <label htmlFor="mobileNumber" className="block text-sm font-medium text-gray-700 mb-1">
          Phone Number*
        </label>
        <input
          id="mobileNumber"
          name="mobileNumber"
          type="tel"
          value={formData.mobileNumber}
          onChange={handleChange}
          placeholder="10-digit mobile number"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8a4af3] focus:border-transparent"
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          We'll send you a one-time password to verify your phone number
        </p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className={`w-full bg-[#8a4af3] text-white py-3 rounded-full hover:opacity-95 hover:shadow-lg transition-all duration-300 font-medium ${
          loading ? 'opacity-70 cursor-not-allowed' : ''
        }`}
      >
        {loading ? 'Creating Account...' : 'Create Account'}
      </button>
    </form>
  );
};

export default RegisterForm;
