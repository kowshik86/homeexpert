import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

const LoginForm = () => {
  const { sendOTP, checkUserExists, switchAuthMode } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!phoneNumber) {
      setError('Please enter your phone number');
      return;
    }

    // Validate phone number format
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phoneNumber)) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    try {
      setError('');
      setLoading(true);

      // First check if user exists
      const userExists = await checkUserExists(phoneNumber);

      if (!userExists) {
        toast.info('User not found. Please register first.');
        switchAuthMode(); // Switch to registration mode
        setLoading(false);
        return;
      }

      // If user exists, send OTP
      const result = await sendOTP(phoneNumber);
      toast.success('OTP sent successfully');

      // Display OTP for testing purposes
      if (result && result.otp) {
        console.log('Your OTP:', result.otp);
        toast.info(`Your OTP: ${result.otp}`, {
          autoClose: false,
          closeOnClick: false
        });
      }
    } catch (error) {
      setError(error.message || 'Failed to send OTP. Please try again.');
      toast.error(error.message || 'Failed to send OTP. Please try again.');
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

      <div className="relative">
        <div className="flex items-center border border-gray-300 rounded-full overflow-hidden focus-within:ring-2 focus-within:ring-[#8a4af3] focus-within:border-transparent bg-white">
          <div className="pl-4 pr-2 text-gray-500 flex items-center">
            <span className="text-sm font-medium">+91</span>
          </div>
          <input
            id="phoneNumber"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="10-digit mobile number"
            className="w-full px-3 py-3 border-0 focus:outline-none text-base bg-transparent"
            required
            maxLength={10}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className={`w-full bg-[#8a4af3] text-white py-3 rounded-full hover:opacity-95 hover:shadow-lg transition-all duration-300 font-medium ${
          loading ? 'opacity-70 cursor-not-allowed' : ''
        }`}
      >
        {loading ? 'Sending OTP...' : 'Continue'}
      </button>

      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600">
          New to HomeXpert?
          <button
            type="button"
            onClick={switchAuthMode}
            className="text-primary-custom font-semibold ml-1 hover:underline"
          >
            Create an account
          </button>
        </p>
      </div>
    </form>
  );
};

export default LoginForm;
