import React from 'react';

const GROCERY_IMAGE = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80';
const SERVICE_IMAGE = 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=900&q=80';
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=900&q=80';

const GroceryBagImage = () => {
  const handleImageError = (event) => {
    event.currentTarget.onerror = null;
    event.currentTarget.src = FALLBACK_IMAGE;
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="relative w-full h-full overflow-hidden rounded-[24px] border border-white/20 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.24),transparent_34%),linear-gradient(152deg,#1f1142_0%,#4c1d95_52%,#7c3aed_100%)] p-4 shadow-[0_28px_80px_-34px_rgba(16,4,38,0.9)]">
        <div className="auth-illus-grid absolute inset-0 opacity-20" />
        <div className="pointer-events-none absolute -top-12 -right-10 h-32 w-32 rounded-full bg-fuchsia-300/30 blur-3xl auth-illus-float" />
        <div className="pointer-events-none absolute -bottom-12 -left-10 h-36 w-36 rounded-full bg-cyan-300/30 blur-3xl auth-illus-drift" />

        <div className="relative mx-auto mt-2 w-full max-w-[302px] rounded-[28px] border border-white/30 bg-white/12 p-3 backdrop-blur-xl shadow-[0_18px_60px_-26px_rgba(7,3,28,0.95)]">
          <div className="relative overflow-hidden rounded-[20px] border border-white/45 shadow-2xl">
            <div className="grid grid-cols-2">
              <img
                src={GROCERY_IMAGE}
                alt="Fresh groceries"
                className="h-48 w-full object-cover"
                loading="lazy"
                onError={handleImageError}
              />
              <img
                src={SERVICE_IMAGE}
                alt="Home services"
                className="h-48 w-full object-cover"
                loading="lazy"
                onError={handleImageError}
              />
            </div>

            <div className="absolute inset-y-0 left-1/2 w-px bg-white/55" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(2,6,23,0.32)_100%)]" />
            <div className="auth-illus-sheen absolute -left-20 top-0 h-full w-16 rotate-[14deg] bg-gradient-to-r from-transparent via-white/35 to-transparent" />
          </div>

          <div className="mt-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/45 bg-white/20 text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4" />
                </svg>
              </span>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/45 bg-white/20 text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.7 6.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4-1.4l8-8a1 1 0 011.4 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7l1-1a2.12 2.12 0 113 3l-1 1m-3-3l3 3m-5 5l3 3m-3-3l-1 1a2.12 2.12 0 11-3-3l1-1" />
                </svg>
              </span>
            </div>
            <div className="h-1 w-16 rounded-full bg-white/60" />
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-center backdrop-blur">
          <h3 className="text-white text-[1.9rem] leading-none font-black tracking-tight">HomeXpert</h3>
        </div>
      </div>
    </div>
  );
};

export default GroceryBagImage;
