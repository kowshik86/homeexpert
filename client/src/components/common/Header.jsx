import React, { useEffect, useMemo, useState } from "react";
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import SearchBar from './SearchBar';

function Header() {
  const { cartCount } = useCart();
  const { currentUser, openAuthModal, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [workforceAuth, setWorkforceAuth] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const currentTab = new URLSearchParams(location.search).get('tab');

  const isHomePath = location.pathname === '/';
  const isServicesPath = location.pathname.startsWith('/services');
  const isAccountOrdersPath = location.pathname === '/account' && currentTab === 'orders';
  const isAdminPath = location.pathname.startsWith('/private/workforce-admin-dashboard');
  const isWorkPath = location.pathname.startsWith('/work/');
  const showConsumerActions = !isAdminPath && !isWorkPath;
  const showSearch = showConsumerActions && !isHomePath;

  useEffect(() => {
    const workforceState = localStorage.getItem('workforceAuth');
    setWorkforceAuth(workforceState ? JSON.parse(workforceState) : null);
  }, [location.pathname, currentUser]);

  useEffect(() => {
    const onStorageChange = () => {
      const workforceState = localStorage.getItem('workforceAuth');
      setWorkforceAuth(workforceState ? JSON.parse(workforceState) : null);
    };

    window.addEventListener('storage', onStorageChange);
    return () => window.removeEventListener('storage', onStorageChange);
  }, []);

  const workforceRouteByRole = {
    shopkeeper: '/work/shopkeeper-profile',
    delivery: '/work/delivery-profile',
    worker: '/work/worker-dashboard',
  };

  const workforceBranding = {
    shopkeeper: {
      roleLabel: 'Shopkeeper Partner',
      tagline: 'Driving local neighborhood commerce',
    },
    delivery: {
      roleLabel: 'Delivery Partner',
      tagline: 'Fast and reliable doorstep fulfillment',
    },
    worker: {
      roleLabel: 'Service Professional',
      tagline: 'Trusted on-demand home expertise',
    },
  };

  const activeAccount = useMemo(() => {
    if (currentUser) {
      return {
        label: currentUser.firstName || 'Account',
        accountPath: '/account',
        isWorkforce: false,
        roleLabel: currentUser.role === 'admin' ? 'Admin Experience Manager' : 'HomeXpert Prime Customer',
        tagline: 'Smart shopping, seamless doorstep convenience',
      };
    }

    if (workforceAuth?.profile) {
      const roleConfig = workforceBranding[workforceAuth.role] || {
        roleLabel: 'Workforce Partner',
        tagline: 'Powering trusted services at scale',
      };

      return {
        label: workforceAuth.profile.firstName || 'Partner',
        accountPath: workforceRouteByRole[workforceAuth.role] || '/work/login',
        isWorkforce: true,
        roleLabel: roleConfig.roleLabel,
        tagline: roleConfig.tagline,
      };
    }

    return null;
  }, [currentUser, workforceAuth]);

  const showWorkLinkOnHome = isHomePath && !activeAccount;

  const showCartLink = showConsumerActions && !isHomePath && !isServicesPath && !isAccountOrdersPath && (!activeAccount || !activeAccount.isWorkforce);
  const showOrdersLink = showConsumerActions && (isServicesPath || isAccountOrdersPath) && (!activeAccount || !activeAccount.isWorkforce);
  const showWorkAtHomeXpertLink = showConsumerActions && !activeAccount;

  const handleUnifiedLogout = () => {
    const hadWorkforceSession = !!workforceAuth;
    const hadConsumerSession = !!currentUser;

    if (currentUser) {
      logout();
    }

    localStorage.removeItem('workforceAuth');
    setWorkforceAuth(null);

    if (isWorkPath || isAdminPath || hadWorkforceSession) {
      navigate('/work/login');
    } else if (hadConsumerSession) {
      navigate('/');
    }
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const renderAccountChip = (account) => {
    if (!account) {
      return null;
    }

    return (
      <Link
        to={account.accountPath}
        className="inline-flex items-center gap-2 rounded-2xl border border-primary-custom/15 bg-gradient-to-r from-purple-50 to-white px-3 py-2 text-sm font-semibold text-primary-custom transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-custom text-white text-xs font-bold">
          {(account.label || 'A').charAt(0)}
        </span>
        <span className="max-w-[220px] min-w-0 leading-tight">
          <span className="block truncate text-sm text-primary-custom">{account.label}</span>
          <span className="block truncate text-[11px] font-semibold text-primary-custom/75">{account.roleLabel}</span>
        </span>
      </Link>
    );
  };

  const renderRoleCta = (account) => {
    if (!account) {
      return null;
    }

    if (account.isWorkforce) {
      return (
        <Link
          to={account.accountPath}
          className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-all duration-300 hover:bg-slate-800 hover:-translate-y-0.5"
        >
          Open {account.roleLabel}
        </Link>
      );
    }

    return (
      <Link
        to="/services"
        className="inline-flex items-center rounded-full bg-primary-custom px-4 py-2 text-sm font-semibold text-white transition-all duration-300 hover:opacity-90 hover:-translate-y-0.5"
      >
        Home Services
      </Link>
    );
  };
  return (
    <div className="w-full">
      <nav className="fixed top-0 left-0 right-0 z-[1200] h-16 border-b border-white/70 bg-white/95 backdrop-blur-md shadow-[0px_12px_30px_-18px_rgba(138,74,243,0.55)] px-3 flex justify-between items-center">

        <Link
          to="/"
          className="text-primary-custom font-[1000] text-xl cursor-pointer px-2 transition-all duration-300 hover:scale-105 flex items-center"
          style={{ fontFamily: 'Gilroy, Arial, Helvetica Neue, sans-serif' }}
        >
          <span className="mr-1 text-primary-custom logo-icon">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </span>
          <span className="gradient-text font-bold">HomeXpert</span>
        </Link>

        <div className="flex flex-grow justify-center space-x-8 ml-8">
          {showSearch ? (
            <SearchBar />
          ) : null}
        </div>

        {/* Mobile menu button */}
        <div className="lg:hidden flex items-center">
          <button
            onClick={toggleMobileMenu}
            className="text-cement hover:text-primary-custom focus:outline-none"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        <div className="hidden lg:flex items-center space-x-4">
          <ul className="hidden lg:flex flex-grow justify-center space-x-8 ml-8" style={{ fontFamily: 'Gilroy, Arial, Helvetica Neue, sans-serif' }}>
            <li className="text-cement font-[600] flex items-center space-x-1 cursor-pointer">
              {activeAccount ? (
                <div className="flex items-center space-x-3">
                  {renderAccountChip(activeAccount)}
                  {renderRoleCta(activeAccount)}
                  {activeAccount.isWorkforce ? (
                    <button
                      onClick={handleUnifiedLogout}
                      aria-label="Logout"
                      title="Logout"
                      className="text-primary-custom cursor-pointer flex items-center justify-center transition-all duration-300 hover:text-primary-custom hover:scale-110 nav-link p-1 rounded-md"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={handleUnifiedLogout}
                      aria-label="Logout"
                      title="Logout"
                      className="text-primary-custom cursor-pointer flex items-center justify-center transition-all duration-300 hover:text-primary-custom hover:scale-110 nav-link p-1 rounded-md"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </button>
                  )}
                </div>
              ) : (
                showConsumerActions ? (
                  <button
                    onClick={() => openAuthModal('login')}
                    className="text-primary-custom cursor-pointer flex items-center transition-all duration-300 hover:text-primary-custom hover:scale-105 nav-link"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Login
                  </button>
                ) : (
                  <Link
                    to="/work/login"
                    className="text-primary-custom cursor-pointer flex items-center transition-all duration-300 hover:text-primary-custom hover:scale-105 nav-link"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A9 9 0 1118.88 6.196M15 12h6m0 0l-3-3m3 3l-3 3" />
                    </svg>
                    Partner Login
                  </Link>
                )
              )}
            </li>
            {showWorkLinkOnHome ? (
              <li className="text-cement font-bold flex items-center space-x-2 cursor-pointer">
                <Link to="/work/login" className="text-primary-custom transition-all duration-300 hover:text-primary-custom hover:scale-105 nav-link font-bold">
                  Work at HomeXpert
                </Link>
              </li>
            ) : showOrdersLink ? (
              <li className="text-cement font-[600] flex items-center space-x-1 cursor-pointer">
                <Link to="/account?tab=orders" className="text-primary-custom cursor-pointer flex items-center transition-all duration-300 hover:text-primary-custom hover:scale-105 nav-link">
                  <div className="relative flex items-center">
                    <div className="relative">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    </div>
                    <span className="ml-2">Orders</span>
                  </div>
                </Link>
              </li>
            ) : showCartLink ? (
              <>
                <li className="text-cement font-[600] flex items-center space-x-1 cursor-pointer">
                  <Link to="/cart" className="text-primary-custom cursor-pointer flex items-center transition-all duration-300 hover:text-primary-custom hover:scale-105 nav-link">
                    <div className="relative flex items-center">
                      <div className="relative">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        {cartCount > 0 && (
                          <span className="absolute -top-2 -right-2 bg-primary-custom text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                            {cartCount}
                          </span>
                        )}
                      </div>
                      <span className="ml-2">Cart</span>
                    </div>
                  </Link>
                </li>
                {showWorkAtHomeXpertLink ? (
                  <li className="text-cement font-bold flex items-center space-x-2 cursor-pointer">
                    <Link to="/work/login" className="text-primary-custom transition-all duration-300 hover:text-primary-custom hover:scale-105 nav-link font-bold">Work at HomeXpert</Link>
                  </li>
                ) : null}
              </>
            ) : showConsumerActions ? null : (
              <li className="text-cement font-bold flex items-center space-x-2 cursor-pointer">
                <Link to="/" className="text-primary-custom transition-all duration-300 hover:text-primary-custom hover:scale-105 nav-link font-bold">
                  Back to Storefront
                </Link>
              </li>
            )}
          </ul>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed top-[64px] inset-x-0 z-[1190] bg-white shadow-md py-3 px-4">
          <ul className="flex flex-col space-y-4" style={{ fontFamily: 'Gilroy, Arial, Helvetica Neue, sans-serif' }}>
            <li className="text-cement font-[600] flex items-center space-x-1 cursor-pointer">
              {activeAccount ? (
                <div className="flex flex-col space-y-3">
                  <div onClick={() => setMobileMenuOpen(false)}>{renderAccountChip(activeAccount)}</div>
                  <div onClick={() => setMobileMenuOpen(false)}>{renderRoleCta(activeAccount)}</div>
                  {activeAccount.isWorkforce ? (
                    <button
                      onClick={() => {
                        handleUnifiedLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="text-primary-custom cursor-pointer flex items-center transition-all duration-300 hover:text-primary-custom hover:scale-105 nav-link"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        handleUnifiedLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="text-primary-custom cursor-pointer flex items-center transition-all duration-300 hover:text-primary-custom hover:scale-105 nav-link"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  )}
                </div>
              ) : (
                showConsumerActions ? (
                  <button
                    onClick={() => openAuthModal('login')}
                    className="text-primary-custom cursor-pointer flex items-center transition-all duration-300 hover:text-primary-custom hover:scale-105 nav-link"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Login
                  </button>
                ) : (
                  <Link
                    to="/work/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-primary-custom cursor-pointer flex items-center transition-all duration-300 hover:text-primary-custom hover:scale-105 nav-link"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A9 9 0 1118.88 6.196M15 12h6m0 0l-3-3m3 3l-3 3" />
                    </svg>
                    Partner Login
                  </Link>
                )
              )}
            </li>
            {showWorkLinkOnHome ? (
              <li className="text-cement font-bold flex items-center space-x-2 cursor-pointer">
                <Link to="/work/login" onClick={() => setMobileMenuOpen(false)} className="text-primary-custom transition-all duration-300 hover:text-primary-custom hover:scale-105 nav-link font-bold">
                  Work at HomeXpert
                </Link>
              </li>
            ) : showOrdersLink ? (
              <li className="text-cement font-[600] flex items-center space-x-1 cursor-pointer">
                <Link to="/account?tab=orders" onClick={() => setMobileMenuOpen(false)} className="text-primary-custom cursor-pointer flex items-center transition-all duration-300 hover:text-primary-custom hover:scale-105 nav-link">
                  <div className="relative flex items-center">
                    <div className="relative">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    </div>
                    <span className="ml-2">Orders</span>
                  </div>
                </Link>
              </li>
            ) : showCartLink ? (
              <>
                <li className="text-cement font-[600] flex items-center space-x-1 cursor-pointer">
                  <Link to="/cart" onClick={() => setMobileMenuOpen(false)} className="text-primary-custom cursor-pointer flex items-center transition-all duration-300 hover:text-primary-custom hover:scale-105 nav-link">
                    <div className="relative flex items-center">
                      <div className="relative">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        {cartCount > 0 && (
                          <span className="absolute -top-2 -right-2 bg-primary-custom text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                            {cartCount}
                          </span>
                        )}
                      </div>
                      <span className="ml-2">Cart</span>
                    </div>
                  </Link>
                </li>
                {showWorkAtHomeXpertLink ? (
                  <li className="text-cement font-bold flex items-center space-x-2 cursor-pointer">
                    <Link to="/work/login" onClick={() => setMobileMenuOpen(false)} className="text-primary-custom transition-all duration-300 hover:text-primary-custom hover:scale-105 nav-link font-bold">Work at HomeXpert</Link>
                  </li>
                ) : null}
              </>
            ) : showConsumerActions ? null : (
              <li className="text-cement font-bold flex items-center space-x-2 cursor-pointer">
                <Link to="/" onClick={() => setMobileMenuOpen(false)} className="text-primary-custom transition-all duration-300 hover:text-primary-custom hover:scale-105 nav-link font-bold">Back to Storefront</Link>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default Header;



