import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="landing-page min-h-screen pt-20 pb-12">
      <div className="pointer-events-none absolute inset-0 landing-grid opacity-60" />
      <div className="landing-orb landing-orb--one absolute left-[-6rem] top-24 h-40 w-40 bg-orange-300/60" />
      <div className="landing-orb landing-orb--two absolute right-[-5rem] top-28 h-52 w-52 bg-cyan-300/50" />
      <div className="landing-orb landing-orb--three absolute bottom-[-4rem] left-1/3 h-64 w-64 bg-slate-300/35" />

      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-5xl rounded-[36px] border border-white/60 bg-white/75 p-6 md:p-8 shadow-[0_40px_120px_-70px_rgba(15,23,42,0.7)] backdrop-blur-xl">
          <div className="mb-8 flex flex-col items-center justify-center gap-3 text-center">
            <div className="home-logo-chip relative inline-flex items-center gap-3 rounded-[26px] border border-white/70 bg-white/80 px-5 py-4 shadow-[0_25px_60px_-38px_rgba(76,29,149,0.95)] backdrop-blur-xl">
              <span className="home-logo-glow pointer-events-none absolute -inset-2 -z-10 rounded-[30px]" />
              <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#4c1d95,#7c3aed)] text-white shadow-[0_12px_28px_-14px_rgba(76,29,149,0.95)]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v9a1 1 0 001 1h3m10-10l2 2m-2-2v9a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </span>
              <h1 className="home-logo-text text-4xl md:text-5xl font-black tracking-tight leading-none">HomeXpert</h1>
            </div>
            <p className="max-w-2xl text-sm md:text-base font-medium text-slate-600">
              One app for fresh groceries and trusted home services, delivered fast to your doorstep.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Link
              to="/products"
              className="group relative overflow-hidden rounded-[30px] border border-orange-100 bg-[linear-gradient(145deg,rgba(255,237,213,0.9),rgba(255,255,255,0.95))] p-6 md:p-7 shadow-[0_18px_40px_-28px_rgba(249,115,22,0.55)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_60px_-28px_rgba(249,115,22,0.55)]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.22),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(253,186,116,0.18),transparent_30%)]" />
              <div className="absolute right-6 top-6 h-24 w-24 rounded-full border border-orange-200/70 landing-ring" />
              <div className="absolute right-2 top-2 h-16 w-16 rounded-full bg-orange-200/50 blur-2xl" />
              <div className="relative z-10 flex h-full flex-col justify-between gap-8">
                <div>
                  <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-orange-700">
                    Groceries
                  </span>
                  <h2 className="mt-4 text-2xl font-black text-slate-900">Shop groceries</h2>
                  <p className="mt-2 text-sm text-slate-600 max-w-sm">Fresh essentials, pantry items, dairy, fruits, and vegetables.</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-500">Enter groceries</span>
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white transition-transform duration-300 group-hover:translate-x-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>

            <Link
              to="/services"
              className="group relative overflow-hidden rounded-[30px] border border-cyan-100 bg-[linear-gradient(145deg,rgba(236,254,255,0.95),rgba(255,255,255,0.96))] p-6 md:p-7 shadow-[0_18px_40px_-28px_rgba(6,182,212,0.5)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_60px_-28px_rgba(6,182,212,0.5)]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(103,232,249,0.24),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(191,219,254,0.2),transparent_30%)]" />
              <div className="absolute right-6 top-6 h-24 w-24 rounded-full border border-cyan-200/70 landing-ring" />
              <div className="absolute right-2 top-2 h-16 w-16 rounded-full bg-cyan-200/50 blur-2xl" />
              <div className="relative z-10 flex h-full flex-col justify-between gap-8">
                <div>
                  <span className="inline-flex items-center rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">
                    Services
                  </span>
                  <h2 className="mt-4 text-2xl font-black text-slate-900">Book home services</h2>
                  <p className="mt-2 text-sm text-slate-600 max-w-sm">Cleaning, plumbing, electrical work, and appliance repair.</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-500">Enter services</span>
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white transition-transform duration-300 group-hover:translate-x-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
