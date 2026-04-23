import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';

// Create the cart context
const CartContext = createContext();

// Custom hook to use the cart context
export const useCart = () => {
  return useContext(CartContext);
};

const getCartStorageKey = (user) => {
  if (!user) {
    return 'cart:guest';
  }

  const userId = user._id || user.mobileNumber || user.email;
  return userId ? `cart:user:${userId}` : 'cart:guest';
};

// Helper function to get cart from localStorage
const getCartFromStorage = (storageKey) => {
  try {
    const storedCart = localStorage.getItem(storageKey);
    if (storedCart) {
      const parsedCart = JSON.parse(storedCart);
      console.log(`Retrieved cart from localStorage (${storageKey}):`, parsedCart);
      return parsedCart;
    }
  } catch (error) {
    console.error('Error getting cart from localStorage:', error);
  }
  return [];
};

// Helper function to save cart to localStorage
const saveCartToStorage = (storageKey, cart) => {
  try {
    console.log(`Saving cart to localStorage (${storageKey}):`, cart);
    localStorage.setItem(storageKey, JSON.stringify(cart));
  } catch (error) {
    console.error('Error saving cart to localStorage:', error);
  }
};

// Cart provider component
export const CartProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const activeCartStorageKey = useMemo(() => getCartStorageKey(currentUser), [currentUser]);

  const [cartItems, setCartItems] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  // Load cart for current auth identity (guest/user).
  useEffect(() => {
    setHydrated(false);
    let initialCart = getCartFromStorage(activeCartStorageKey);

    // Migrate legacy cart key once for a smooth upgrade.
    if (initialCart.length === 0) {
      const legacyCart = getCartFromStorage('cart');
      if (legacyCart.length > 0) {
        initialCart = legacyCart;
      }
    }

    setCartItems(initialCart);
    setHydrated(true);
  }, [activeCartStorageKey]);

  // Update localStorage whenever cart changes after hydration.
  useEffect(() => {
    if (!hydrated) {
      return;
    }

    saveCartToStorage(activeCartStorageKey, cartItems);
  }, [cartItems, activeCartStorageKey, hydrated]);

  const cartCount = useMemo(() => {
    return cartItems.reduce((total, item) => total + Number(item.quantity || 0), 0);
  }, [cartItems]);

  const cartTotal = useMemo(() => {
    return cartItems.reduce((total, item) => {
      const price = Number(item.price || item.cost || 0);
      const quantity = Number(item.quantity || 0);
      return total + (price * quantity);
    }, 0);
  }, [cartItems]);

  // Add item to cart
  const addToCart = useCallback((product) => {
    // Log the product being added
    console.log('Adding product to cart:', product);

    // Create a unique identifier for the product
    const productId = product._id ||
                     (product.name && (Array.isArray(product.name) ? product.name[0] : product.name)) ||
                     Math.random().toString(36).substring(2, 15);

    setCartItems(prevItems => {
      // Check if item already exists in cart
      const existingItemIndex = prevItems.findIndex(item => {
        const itemId = item._id ||
                      (item.name && (Array.isArray(item.name) ? item.name[0] : item.name)) ||
                      '';
        return itemId === productId;
      });

      console.log('Existing item index:', existingItemIndex);

      let updatedItems;

      if (existingItemIndex !== -1) {
        // Item exists, update quantity but preserve the price
        updatedItems = [...prevItems];
        // If product has a specified quantity, use it, otherwise increment by 1
        const quantityToAdd = product.quantity !== undefined ? product.quantity : 1;

        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: updatedItems[existingItemIndex].quantity + quantityToAdd,
          // Preserve the original price that was set when first added to cart
          price: updatedItems[existingItemIndex].price
        };
        console.log('Updated items:', updatedItems);
      } else {
        // Item doesn't exist, add new item
        // Ensure the price is properly set and preserved
        const quantityToSet = product.quantity !== undefined ? product.quantity : 1;

        const newItem = {
          ...product,
          _id: productId,
          quantity: quantityToSet,
          // Make sure price is set and is a number
          price: typeof product.price === 'number' ? product.price : (product.cost || 0)
        };
        console.log('New item:', newItem);
        updatedItems = [...prevItems, newItem];
      }

      // Immediately save to localStorage for extra safety
      saveCartToStorage(activeCartStorageKey, updatedItems);

      return updatedItems;
    });
  }, [activeCartStorageKey]);

  // Remove item from cart
  const removeFromCart = useCallback((productId) => {
    console.log('Removing product with ID:', productId);
    setCartItems(prevItems => {
      const newItems = prevItems.filter(item => {
        const itemId = item._id ||
                     (item.name && (Array.isArray(item.name) ? item.name[0] : item.name)) ||
                     '';
        return itemId !== productId;
      });
      console.log('Items after removal:', newItems);

      // Immediately save to localStorage for extra safety
      saveCartToStorage(activeCartStorageKey, newItems);

      return newItems;
    });
  }, [activeCartStorageKey]);

  // Update item quantity
  const updateQuantity = useCallback((productId, quantity) => {
    console.log('Updating quantity for product ID:', productId, 'to', quantity);

    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCartItems(prevItems => {
      const updatedItems = prevItems.map(item => {
        const itemId = item._id ||
                     (item.name && (Array.isArray(item.name) ? item.name[0] : item.name)) ||
                     '';
        return itemId === productId ? { ...item, quantity } : item;
      });
      console.log('Items after quantity update:', updatedItems);

      // Immediately save to localStorage for extra safety
      saveCartToStorage(activeCartStorageKey, updatedItems);

      return updatedItems;
    });
  }, [activeCartStorageKey]);

  // Clear cart
  const clearCart = useCallback(() => {
    setCartItems([]);
    localStorage.removeItem(activeCartStorageKey);
    console.log('Cart cleared');
  }, [activeCartStorageKey]);

  // Context value
  const value = useMemo(() => ({
    cartItems,
    cartCount,
    cartTotal,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
  }), [cartItems, cartCount, cartTotal, addToCart, removeFromCart, updateQuantity, clearCart]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
