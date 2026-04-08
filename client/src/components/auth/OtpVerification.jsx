import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

const OtpVerification = () => {
  const { verifyOTP, phoneNumber, resendOTP } = useAuth();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(true);
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef([]);

  // Focus the first input when component mounts
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  // Set up countdown timer for resend button
  useEffect(() => {
    if (countdown > 0 && resendDisabled) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setResendDisabled(false);
    }
  }, [countdown, resendDisabled]);

  const handleChange = (index, value) => {
    // Only allow numbers
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input if current input is filled
    if (value && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Move to previous input on backspace if current input is empty
    if (e.key === 'Backspace' && !otp[index] && index > 0 && inputRefs.current[index - 1]) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await verifyOTP(otpValue);
      toast.success('Logged in successfully');
      window.location.href = '/account';
    } catch (error) {
      setError(error.message || 'OTP verification failed. Please try again.');
      toast.error(error.message || 'OTP verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle resend OTP
  const handleResendOTP = async () => {
    setError('');
    setResendDisabled(true);
    setCountdown(60);

    try {
      const result = await resendOTP(phoneNumber);
      toast.success('New OTP sent successfully');

      // Display OTP for testing purposes
      if (result && result.otp) {
        console.log('Your OTP:', result.otp);
        toast.info(`Your OTP: ${result.otp}`, {
          autoClose: false,
          closeOnClick: false
        });
      }
    } catch (error) {
      if (error.message && error.message.includes('Please wait')) {
        // If we need to wait, show the message and update countdown
        const waitMatch = error.message.match(/Please wait (\d+) seconds/);
        if (waitMatch && waitMatch[1]) {
          const waitSeconds = parseInt(waitMatch[1]);
          setCountdown(waitSeconds);
          toast.info(error.message);
        } else {
          setError(error.message || 'Failed to resend OTP. Please try again.');
        }
      } else {
        setError(error.message || 'Failed to resend OTP. Please try again.');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 md:mt-8">
      {error && (
        <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <div>
        <h3 className="text-lg font-medium text-[#8a4af3] mb-4">
          Verify with OTP
        </h3>

        <p className="text-sm text-gray-600 mb-4">
          We've sent a 6-digit OTP to <span className="font-medium">+91 {phoneNumber}</span>
        </p>

        <div className="flex justify-between gap-2 mb-4">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-12 h-12 text-center border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8a4af3] focus:border-transparent text-lg"
            />
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || otp.join('').length !== 6}
        className={`w-full bg-[#8a4af3] text-white py-3 rounded-full hover:opacity-95 hover:shadow-lg transition-all duration-300 font-medium ${
          loading || otp.join('').length !== 6 ? 'opacity-70 cursor-not-allowed' : ''
        }`}
      >
        {loading ? 'Verifying...' : 'Verify OTP'}
      </button>

      <div className="text-center">
        <p className="text-sm text-gray-600">
          Didn't receive the code?{' '}
          {resendDisabled ? (
            <span className="text-gray-500">
              Resend in {countdown}s
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResendOTP}
              className="text-[#8a4af3] font-medium hover:underline focus:outline-none"
            >
              Resend OTP
            </button>
          )}
        </p>
      </div>
    </form>
  );
};

export default OtpVerification;
