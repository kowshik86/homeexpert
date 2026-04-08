import React, { useEffect, useMemo, useState } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { createOrder, fetchUserAddresses } from '../services/api';

const Cart = () => {
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateQuantity, cartTotal, clearCart } = useCart();
  const { currentUser, openAuthModal } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);

  const deliveryFee = 40;
  const finalTotal = cartTotal + deliveryFee;

  useEffect(() => {
    const loadAddresses = async () => {
      if (!currentUser?._id) {
        setAddresses([]);
        setSelectedAddressId('');
        return;
      }

      setLoadingAddresses(true);
      const response = await fetchUserAddresses(currentUser._id);
      const normalized = Array.isArray(response) ? response : [];
      setAddresses(normalized);

      const defaultAddress = normalized.find((address) => address.isDefault);
      setSelectedAddressId(defaultAddress?._id || normalized[0]?._id || '');
      setLoadingAddresses(false);
    };

    loadAddresses();
  }, [currentUser]);

  const selectedAddress = useMemo(
    () => addresses.find((address) => address._id === selectedAddressId) || null,
    [addresses, selectedAddressId],
  );

  const buildOrderItems = () => {
    return cartItems.map((item) => {
      const name = Array.isArray(item.name) ? item.name[0] : item.name;
      const price = Number(item.price || item.cost || 0);
      const quantity = Number(item.quantity || 1);

      return {
        productId: item._id,
        productType: item.productType === 'shopGood' ? 'shopGood' : 'shopItem',
        name: name || 'Product',
        imageUrl: item.imageUrl || 'https://via.placeholder.com/300x200?text=No+Image',
        price,
        quantity,
        totalPrice: Number((price * quantity).toFixed(2)),
      };
    });
  };

  const handleProceedCheckout = async () => {
    if (!currentUser) {
      openAuthModal('login');
      return;
    }

    if (!selectedAddress) {
      toast.error('Please select a delivery address before checkout.');
      return;
    }

    const orderItems = buildOrderItems();
    if (orderItems.length === 0) {
      toast.error('Your cart is empty.');
      return;
    }

    try {
      setPlacingOrder(true);

      const payload = {
        userId: currentUser._id,
        orderItems,
        deliveryAddress: {
          fullName: selectedAddress.fullName,
          mobileNumber: selectedAddress.mobileNumber,
          addressLine1: selectedAddress.addressLine1,
          addressLine2: selectedAddress.addressLine2 || '',
          city: selectedAddress.city,
          state: selectedAddress.state,
          pincode: selectedAddress.pincode,
          landmark: selectedAddress.landmark || '',
          addressType: selectedAddress.addressType || 'home',
          isDefault: !!selectedAddress.isDefault,
        },
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
        orderStatus: 'PLACED',
        subtotal: Number(cartTotal.toFixed(2)),
        deliveryFee,
        discount: 0,
        totalAmount: Number(finalTotal.toFixed(2)),
        expectedDeliveryTime: new Date(Date.now() + 35 * 60 * 1000),
      };

      await createOrder(payload);
      clearCart();
      toast.success('Order placed successfully. Delivery partner has been notified.');
      navigate('/account');
    } catch (error) {
      toast.error(error.message || 'Failed to place your order. Please try again.');
    } finally {
      setPlacingOrder(false);
    }
  };

  // Cart component logic

  // Handle empty cart
  if (cartItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16">
        <div className="mb-4 md:mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 font-[Gilroy,_Arial,_Helvetica_Neue,_sans-serif]">
            Your Cart
          </h1>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6 text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-12 md:h-16 md:w-16 mx-auto mb-3 md:mb-4 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <p className="text-gray-600 mb-4 text-sm md:text-base">Your cart is empty</p>
          <Link
            to="/"
            className="bg-primary-custom text-white px-3 py-2 md:px-4 md:py-2 rounded-md hover:bg-opacity-80 hover:shadow-md transition-all duration-300 transform hover:scale-105 inline-block text-sm md:text-base font-[Gilroy,_Arial,_Helvetica_Neue,_sans-serif]"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800 font-[Gilroy,_Arial,_Helvetica_Neue,_sans-serif]">
          Your Cart
        </h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
        {/* Cart Items */}
        <div className="lg:w-2/3">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-3 md:p-4 border-b">
              <h2 className="text-base md:text-lg font-semibold text-gray-800">Items ({cartItems.length})</h2>
            </div>

            <ul className="divide-y divide-gray-200">
              {cartItems.map((item, index) => {
                // Handle different data structures between shop goods and shop items
                let displayName = 'Product';
                if (Array.isArray(item.name) && item.name.length > 0) {
                  displayName = item.name[0];
                } else if (typeof item.name === 'string') {
                  displayName = item.name;
                }

                // Use a default image if imageUrl is missing
                const imageUrl = item.imageUrl || 'https://via.placeholder.com/300x200?text=No+Image';

                // Handle different price properties (cost or price)
                const price = item.cost || item.price || 0;

                return (
                  <li key={item._id || index} className="p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center">
                    <div className="w-full sm:w-20 md:w-24 h-20 md:h-24 flex-shrink-0 mb-3 sm:mb-0">
                      <img
                        src={imageUrl}
                        alt={displayName}
                        className="w-full h-full object-contain rounded-md"
                        loading="lazy"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://via.placeholder.com/300x200?text=Error+Loading+Image';
                        }}
                      />
                    </div>

                    <div className="flex-1 ml-0 sm:ml-3 md:ml-4">
                      <h3 className="text-base md:text-lg font-medium text-gray-800">{displayName}</h3>
                      <div className="flex items-center">
                        <p className="text-primary-custom font-medium text-sm md:text-base">₹{Math.round(price)}</p>
                        {item.originalPrice && item.originalPrice !== price && (
                          <p className="text-xs text-gray-500 line-through ml-2">₹{item.originalPrice}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center mt-3 sm:mt-0">
                      <button
                        onClick={() => updateQuantity(item._id || (Array.isArray(item.name) ? item.name[0] : item.name), item.quantity - 1)}
                        className="w-7 h-7 md:w-8 md:h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                      >
                        -
                      </button>
                      <span className="mx-2 w-6 md:w-8 text-center text-sm md:text-base">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item._id || (Array.isArray(item.name) ? item.name[0] : item.name), item.quantity + 1)}
                        className="w-7 h-7 md:w-8 md:h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                      >
                        +
                      </button>

                      <button
                        onClick={() => removeFromCart(item._id || (Array.isArray(item.name) ? item.name[0] : item.name))}
                        className="ml-3 md:ml-4 text-red-500 hover:text-red-700"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="p-3 md:p-4 border-t">
              <button
                onClick={clearCart}
                className="text-red-500 hover:text-red-700 flex items-center transition-all duration-300 hover:scale-105 text-sm md:text-base"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear Cart
              </button>
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:w-1/3 mt-4 lg:mt-0">
          <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
            <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4">Order Summary</h2>

            <div className="flex justify-between mb-2">
              <span className="text-gray-600 text-sm md:text-base">Subtotal</span>
              <span className="font-medium text-sm md:text-base">₹{cartTotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between mb-2">
              <span className="text-gray-600 text-sm md:text-base">Shipping</span>
              <span className="font-medium text-sm md:text-base">₹{deliveryFee.toFixed(2)}</span>
            </div>

            <div className="border-t border-gray-200 my-3 md:my-4"></div>

            <div className="flex justify-between mb-4 md:mb-6">
              <span className="text-base md:text-lg font-semibold text-gray-800">Total</span>
              <span className="text-base md:text-lg font-semibold text-primary-custom">₹{finalTotal.toFixed(2)}</span>
            </div>

            {currentUser ? (
              <div className="mb-4 rounded-md border border-gray-200 p-3 bg-gray-50">
                <p className="text-sm font-semibold text-gray-800 mb-2">Delivery Address</p>
                {loadingAddresses ? (
                  <p className="text-sm text-gray-500">Loading addresses...</p>
                ) : addresses.length === 0 ? (
                  <div className="text-sm text-gray-600 space-y-2">
                    <p>No saved address found. Add one from your account.</p>
                    <Link to="/account" className="inline-block text-primary-custom font-semibold hover:underline">
                      Go to Account
                    </Link>
                  </div>
                ) : (
                  <>
                    <select
                      value={selectedAddressId}
                      onChange={(event) => setSelectedAddressId(event.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-custom/40"
                    >
                      {addresses.map((address) => (
                        <option key={address._id} value={address._id}>
                          {address.fullName} - {address.city} ({address.pincode})
                        </option>
                      ))}
                    </select>
                    {selectedAddress ? (
                      <p className="mt-2 text-xs text-gray-600">
                        {selectedAddress.addressLine1}
                        {selectedAddress.addressLine2 ? `, ${selectedAddress.addressLine2}` : ''}, {selectedAddress.city}, {selectedAddress.state} - {selectedAddress.pincode}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            <button
              onClick={handleProceedCheckout}
              disabled={placingOrder || (currentUser && addresses.length === 0)}
              className="w-full bg-primary-custom text-white py-2 md:py-3 rounded-md hover:bg-opacity-80 hover:shadow-md transition-all duration-300 transform hover:scale-105 text-sm md:text-base font-[Gilroy,_Arial,_Helvetica_Neue,_sans-serif]"
            >
              {placingOrder ? 'Placing Order...' : currentUser ? 'Proceed to Checkout' : 'Login to Checkout'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
