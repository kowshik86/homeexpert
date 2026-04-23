// API service for fetching data from the backend

const API_BASE_URL = 'http://localhost:3000'; // Make sure this matches your server port

/**
 * Helper function to handle API responses
 */
const handleApiResponse = async (response, errorMessage) => {
  if (!response.ok) {
    let backendMessage = '';

    try {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const errorData = await response.json();
        backendMessage = errorData?.message || errorData?.error || '';
      } else {
        backendMessage = await response.text();
      }
    } catch (parseError) {
      backendMessage = '';
    }

    console.error(`API Error (${response.status}): ${backendMessage || 'Unknown error'}`);
    throw new Error(backendMessage || `${errorMessage} (Status: ${response.status})`);
  }

  const data = await response.json();
  console.log('API Response:', data);

  // Check if payload exists and is valid
  if (!data || !data.payload) {
    console.warn('API response missing payload:', data);
    return [];
  }

  return data.payload;
};

/**
 * Helper function to add category to items if missing
 */
const addCategoryToItems = (items, category) => {
  if (!items || !Array.isArray(items)) return [];

  return items.map(item => {
    if (!item.category) {
      return { ...item, category };
    }
    return item;
  });
};

const addProductTypeToItems = (items, productType) => {
  if (!items || !Array.isArray(items)) return [];

  return items.map((item) => ({
    ...item,
    productType: item.productType || productType,
  }));
};

// Fetch all shop goods
export const fetchAllShopGoods = async () => {
  try {
    console.log('Fetching all shop goods...');
    const response = await fetch(`${API_BASE_URL}/shopgoods-api/shopGoods`);
    const data = await handleApiResponse(response, 'Failed to fetch shop goods');
    return addProductTypeToItems(data, 'shopGood');
  } catch (error) {
    console.error('Error fetching shop goods:', error);
    return [];
  }
};

// Fetch shop goods by category
export const fetchShopGoodsByCategory = async (category) => {
  try {
    console.log(`Fetching shop goods for category: ${category}...`);

    // Use the category endpoint from the HTTP file
    const response = await fetch(`${API_BASE_URL}/shopgoods-api/shopGood/category/${category}`);
    const data = await handleApiResponse(response, `Failed to fetch shop goods for category: ${category}`);

    // Add category to items if it's missing
    const normalized = addCategoryToItems(data, category);
    return addProductTypeToItems(normalized, 'shopGood');
  } catch (error) {
    console.error(`Error fetching shop goods for category ${category}:`, error);

    // If category endpoint fails, try fetching all goods
    try {
      console.log(`Falling back to all goods for category: ${category}`);
      const response = await fetch(`${API_BASE_URL}/shopgoods-api/shopGoods`);
      const allGoods = await handleApiResponse(response, 'Failed to fetch shop goods');

      // Return all goods with the category added
      const normalized = addCategoryToItems(allGoods, category);
      return addProductTypeToItems(normalized, 'shopGood');
    } catch (fallbackError) {
      console.error('Fallback error:', fallbackError);
      return [];
    }
  }
};

// Fetch all shop items
export const fetchAllShopItems = async () => {
  try {
    console.log('Fetching all shop items...');
    const response = await fetch(`${API_BASE_URL}/shopitems-api/shopitems`);
    const data = await handleApiResponse(response, 'Failed to fetch shop items');
    return addProductTypeToItems(data, 'shopItem');
  } catch (error) {
    console.error('Error fetching shop items:', error);
    return [];
  }
};

// Fetch shop items by category
export const fetchShopItemsByCategory = async (category) => {
  try {
    console.log(`Fetching shop items for category: ${category}...`);

    // Use the category endpoint from the HTTP file
    const response = await fetch(`${API_BASE_URL}/shopitems-api/shopItem/category/${category}`);
    const data = await handleApiResponse(response, `Failed to fetch shop items for category: ${category}`);

    // Add category to items if it's missing
    const normalized = addCategoryToItems(data, category);
    return addProductTypeToItems(normalized, 'shopItem');
  } catch (error) {
    console.error(`Error fetching shop items for category ${category}:`, error);

    // If category endpoint fails, try fetching all items
    try {
      console.log(`Falling back to all items for category: ${category}`);
      const response = await fetch(`${API_BASE_URL}/shopitems-api/shopitems`);
      const allItems = await handleApiResponse(response, 'Failed to fetch shop items');

      // Return all items with the category added
      const normalized = addCategoryToItems(allItems, category);
      return addProductTypeToItems(normalized, 'shopItem');
    } catch (fallbackError) {
      console.error('Fallback error:', fallbackError);
      return [];
    }
  }
};

// Fetch all shopkeepers
export const fetchAllShopkeepers = async () => {
  try {
    console.log('Fetching all shopkeepers...');
    const response = await fetch(`${API_BASE_URL}/shopkeeper-api/shopkeepers`);
    return await handleApiResponse(response, 'Failed to fetch shopkeepers');
  } catch (error) {
    console.error('Error fetching shopkeepers:', error);
    return [];
  }
};

// Fetch a single shopkeeper by ID
export const fetchShopkeeperById = async (shopkeeperId) => {
  try {
    if (!shopkeeperId) {
      return null;
    }

    const response = await fetch(`${API_BASE_URL}/shopkeeper-api/shopkeeper/${shopkeeperId}`);
    const data = await handleApiResponse(response, 'Failed to fetch shopkeeper');
    if (Array.isArray(data)) {
      return data[0] || null;
    }

    return data || null;
  } catch (error) {
    console.error('Error fetching shopkeeper:', error);
    return null;
  }
};

// Create a new global shop item
export const createShopItem = async (payload) => {
  try {
    const response = await fetch(`${API_BASE_URL}/shopitems-api/shopitem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return await handleApiResponse(response, 'Failed to create shop item');
  } catch (error) {
    console.error('Error creating shop item:', error);
    throw error;
  }
};

// Update an existing global shop item
export const updateShopItem = async (shopItemId, payload) => {
  try {
    const response = await fetch(`${API_BASE_URL}/shopitems-api/shopitem/${shopItemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return await handleApiResponse(response, 'Failed to update shop item');
  } catch (error) {
    console.error('Error updating shop item:', error);
    throw error;
  }
};

// Fetch active orders for delivery dashboard
export const fetchDeliveryOrders = async (deliveryPersonId) => {
  try {
    const query = deliveryPersonId ? `?deliveryPersonId=${encodeURIComponent(deliveryPersonId)}` : '';
    const response = await fetch(`${API_BASE_URL}/order-api/delivery/orders${query}`);
    return await handleApiResponse(response, 'Failed to fetch delivery orders');
  } catch (error) {
    console.error('Error fetching delivery orders:', error);
    return [];
  }
};

// Assign an order to a delivery person and move it to out-for-delivery
export const assignOrderToDeliveryPerson = async (orderId, deliveryPersonId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/order-api/delivery/order/${orderId}/assign`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deliveryPersonId }),
    });

    return await handleApiResponse(response, 'Failed to assign order');
  } catch (error) {
    console.error('Error assigning order:', error);
    throw error;
  }
};

// Update order status from delivery dashboard
export const updateDeliveryOrderStatus = async (orderId, orderStatus, deliveryPersonId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/order-api/order/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderStatus, deliveryPersonId }),
    });

    return await handleApiResponse(response, 'Failed to update delivery order status');
  } catch (error) {
    console.error('Error updating delivery order status:', error);
    throw error;
  }
};

// Update live delivery location from rider GPS
export const updateDeliveryOrderLocation = async (orderId, { deliveryPersonId, lat, lng, destinationLat, destinationLng }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/order-api/order/${orderId}/location`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deliveryPersonId, lat, lng, destinationLat, destinationLng }),
    });

    return await handleApiResponse(response, 'Failed to update delivery location');
  } catch (error) {
    console.error('Error updating delivery location:', error);
    throw error;
  }
};

// Update live service location from worker GPS
export const updateWorkerOrderLocation = async (orderId, { workerId, lat, lng, destinationLat, destinationLng }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/order-api/order/${orderId}/location`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ workerId, lat, lng, destinationLat, destinationLng }),
    });

    return await handleApiResponse(response, 'Failed to update worker location');
  } catch (error) {
    console.error('Error updating worker location:', error);
    throw error;
  }
};

// Fetch saved addresses for a user
export const fetchUserAddresses = async (userId) => {
  try {
    if (!userId) {
      return [];
    }

    const response = await fetch(`${API_BASE_URL}/address-api/addresses/${userId}`);
    return await handleApiResponse(response, 'Failed to fetch addresses');
  } catch (error) {
    console.error('Error fetching addresses:', error);
    return [];
  }
};

// Place a new order
export const createOrder = async (payload) => {
  try {
    const response = await fetch(`${API_BASE_URL}/order-api/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return await handleApiResponse(response, 'Failed to place order');
  } catch (error) {
    console.error('Error placing order:', error);
    throw error;
  }
};

// Fetch worker service bookings
export const fetchWorkerBookings = async (workerId) => {
  try {
    if (!workerId) {
      return [];
    }

    const response = await fetch(`${API_BASE_URL}/order-api/worker/bookings/${workerId}`);
    return await handleApiResponse(response, 'Failed to fetch worker bookings');
  } catch (error) {
    console.error('Error fetching worker bookings:', error);
    return [];
  }
};

// Create a service booking
export const createServiceBooking = async (payload) => {
  try {
    const response = await fetch(`${API_BASE_URL}/order-api/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        bookingType: 'service',
      }),
    });

    return await handleApiResponse(response, 'Failed to create service booking');
  } catch (error) {
    console.error('Error creating service booking:', error);
    throw error;
  }
};

export const getPaymentGatewayConfig = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/order-api/payment/config`);
    return await handleApiResponse(response, 'Failed to fetch payment gateway config');
  } catch (error) {
    console.error('Error fetching payment gateway config:', error);
    return {
      provider: 'RAZORPAY',
      enabled: false,
      keyId: '',
    };
  }
};

export const createPaymentOrder = async ({ amount, currency = 'INR', receipt, notes = {} }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/order-api/payment/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount, currency, receipt, notes }),
    });

    return await handleApiResponse(response, 'Failed to create payment order');
  } catch (error) {
    console.error('Error creating payment order:', error);
    throw error;
  }
};

export const verifyPaymentOrder = async (paymentPayload) => {
  try {
    const response = await fetch(`${API_BASE_URL}/order-api/payment/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentPayload),
    });

    return await handleApiResponse(response, 'Failed to verify payment');
  } catch (error) {
    console.error('Error verifying payment:', error);
    throw error;
  }
};
