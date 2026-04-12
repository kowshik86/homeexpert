import React from 'react';
import { useAuth } from '../../context/AuthContext';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import OtpVerification from './OtpVerification';
// Import assets
import mobileIllus from '../../assets/mobile-illus-new.svg';
import appStore from '../../assets/app-store-new.svg';
import playStore from '../../assets/play-store-new.svg';
import GroceryBagImage from '../../assets/grocery-bag-image';

const AuthModal = () => {
  const { authModalOpen, closeAuthModal, authMode, otpSent, switchAuthMode } = useAuth();

  if (!authModalOpen) return null;

  // Handle click outside to close modal
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      closeAuthModal();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-3 py-6"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-[28px] shadow-[0_30px_80px_rgba(15,23,42,0.28)] w-full max-w-[760px] overflow-hidden flex font-[Gilroy,arial,Helvetica_Neue,sans-serif] z-50 relative border border-white/60">
        {/* Left side - Image */}
        <div className="hidden md:block md:w-[46%] ">
          <div className="h-full w-full bg-gradient-to-br from-[#6d28d9] via-[#8a4af3] to-[#c084fc] flex items-center justify-center p-4">
            <GroceryBagImage />
          </div>
        </div>

        {/* Right side - White background with form */}
        <div className="flex-1 p-5 md:p-6 relative bg-gradient-to-b from-white to-purple-50/30">
          <button
            onClick={closeAuthModal}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 rounded-full border border-gray-200 bg-white/90 p-2 shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="pr-10">
            <div className="inline-flex items-center rounded-full bg-primary-custom/10 px-3 py-1 text-xs font-semibold text-primary-custom">
              Secure one-time login
            </div>
            <h2 className="mt-3 text-2xl font-black text-gray-900 leading-tight">
              {otpSent ? 'Enter your verification code' : authMode === 'login' ? 'Sign in to your account' : 'Create your account'}
            </h2>
            <p className="mt-2 text-sm text-gray-600 max-w-md">
              {otpSent
                ? 'We use OTP to keep login fast and low-friction on mobile.'
                : authMode === 'login'
                  ? 'Continue with your mobile number and finish login with a one-time password.'
                  : 'Create your profile once and keep orders, addresses, and account details in sync.'}
            </p>
          </div>

          {otpSent ? (
            <OtpVerification />
          ) : authMode === 'login' ? (
            <div className="mt-6 flex flex-col gap-5">
              <div className="flex items-center gap-4 rounded-2xl border border-purple-100 bg-white p-4 shadow-sm">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-custom/10">
                  <img
                    src={mobileIllus}
                    alt="Mobile App"
                    className="h-12 w-12"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Order faster & easier</h3>
                  <p className="text-sm text-gray-600">Sign in once, then jump back to shopping and checkout faster.</p>
                </div>
              </div>

              <LoginForm />

              <div className="flex flex-wrap justify-center gap-3">
                <a href="#" className="block opacity-90 transition hover:opacity-100">
                  <img
                    src={appStore}
                    alt="Download on App Store"
                    className="h-9"
                  />
                </a>
                <a href="#" className="block opacity-90 transition hover:opacity-100">
                  <img
                    src={playStore}
                    alt="Get it on Google Play"
                    className="h-9"
                  />
                </a>
              </div>
            </div>
          ) : (
            <div className="mt-6">
              <RegisterForm />
            </div>
          )}

          {!otpSent && (
            <div className="mt-6 text-center border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-600">
                {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
                <button
                  onClick={switchAuthMode}
                  className="text-primary-custom hover:underline font-semibold ml-1 text-sm"
                >
                  {authMode === 'login' ? 'Register' : 'Login'}
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
