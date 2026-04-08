import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { fetchAllShopItems, fetchShopkeeperById } from '../../services/api';

const getAuthState = () => {
  try {
    return JSON.parse(localStorage.getItem('workforceAuth') || 'null');
  } catch {
    return null;
  }
};

const normalizeName = (name) => {
  if (Array.isArray(name)) {
    return (name[0] || '').trim();
  }

  return `${name || ''}`.trim();
};

const getProductKey = (item) => normalizeName(item?.name).toLowerCase();

const buildProductFromCatalogItem = (catalogItem, quantity) => ({
  name: Array.isArray(catalogItem.name) ? catalogItem.name : [catalogItem.name],
  category: catalogItem.category || 'uncategorized',
  imageUrl: catalogItem.imageUrl,
  description: catalogItem.description,
  quantity,
  price: Number(catalogItem.cost || 0),
  rating: catalogItem.rating || 0,
});

const formatAddress = (address) => {
  if (!address) {
    return 'Address not set';
  }

  const parts = [address.flatNO, address.landmark, address.area].filter(Boolean);
  return parts.join(', ') || 'Address not set';
};

function ShopkeeperDashboard() {
  const navigate = useNavigate();
  const authState = getAuthState();
  const shopkeeperId = authState?.profile?._id;

  const [shopkeeper, setShopkeeper] = useState(authState?.profile || null);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [inventoryDrafts, setInventoryDrafts] = useState({});
  const [catalogDrafts, setCatalogDrafts] = useState({});
  const [savingInventoryId, setSavingInventoryId] = useState('');
  const [addingCatalogId, setAddingCatalogId] = useState('');
  const [searchCatalog, setSearchCatalog] = useState('');

  if (!authState || authState.role !== 'shopkeeper') {
    return <Navigate to="/work/login" replace />;
  }

  useEffect(() => {
    let isMounted = true;

    const loadShopkeeper = async () => {
      if (!shopkeeperId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const response = await fetchShopkeeperById(shopkeeperId);
      if (!isMounted) {
        return;
      }

      if (response) {
        setShopkeeper(response);
        const nextDrafts = {};
        (response.products || []).forEach((product) => {
          nextDrafts[product._id] = { quantity: Number(product.quantity || 0) };
        });
        setInventoryDrafts(nextDrafts);
      } else {
        setError('Unable to load shopkeeper profile. Please log in again.');
      }

      setLoading(false);
    };

    const loadCatalog = async () => {
      setCatalogLoading(true);
      const items = await fetchAllShopItems();
      if (!isMounted) {
        return;
      }

      setCatalog(Array.isArray(items) ? items : []);
      const nextCatalogDrafts = {};
      (Array.isArray(items) ? items : []).forEach((item) => {
        nextCatalogDrafts[item._id] = { quantity: 1 };
      });
      setCatalogDrafts(nextCatalogDrafts);
      setCatalogLoading(false);
    };

    loadShopkeeper();
    loadCatalog();

    return () => {
      isMounted = false;
    };
  }, [shopkeeperId]);

  const inventory = useMemo(() => Array.isArray(shopkeeper?.products) ? shopkeeper.products : [], [shopkeeper]);

  const inventoryMap = useMemo(() => {
    return inventory.reduce((accumulator, product) => {
      accumulator[getProductKey(product)] = product;
      return accumulator;
    }, {});
  }, [inventory]);

  const totalStock = useMemo(() => inventory.reduce((sum, product) => sum + Number(product.quantity || 0), 0), [inventory]);
  const activeProducts = useMemo(() => inventory.filter((product) => Number(product.quantity || 0) > 0).length, [inventory]);

  const handleLogout = () => {
    localStorage.removeItem('workforceAuth');
    navigate('/work/login');
  };

  const refreshShopkeeper = async () => {
    if (!shopkeeperId) {
      return;
    }

    const response = await fetchShopkeeperById(shopkeeperId);
    if (!response) {
      return;
    }

    setShopkeeper(response);
    const nextDrafts = {};
    (response.products || []).forEach((product) => {
      nextDrafts[product._id] = { quantity: Number(product.quantity || 0) };
    });
    setInventoryDrafts(nextDrafts);
  };

  const updateInventoryQuantity = async (product) => {
    setError('');
    setSuccessMessage('');

    const draftQuantity = Number(inventoryDrafts[product._id]?.quantity ?? product.quantity ?? 0);
    const priceValue = Number(product.price || 0);

    if (Number.isNaN(draftQuantity) || draftQuantity < 0) {
      setError('Quantity must be zero or greater.');
      return;
    }

    try {
      setSavingInventoryId(product._id);
      const response = await fetch(
        `http://localhost:3000/shopkeeper-api/productChange/${shopkeeperId}/${product._id}/${draftQuantity}/${priceValue}`,
        { method: 'PUT' },
      );

      if (!response.ok) {
        const responseData = await response.json().catch(() => ({}));
        throw new Error(responseData.message || 'Failed to update quantity');
      }

      setSuccessMessage(`${normalizeName(product.name)} quantity updated.`);
      await refreshShopkeeper();
    } catch (updateError) {
      setError(updateError.message || 'Failed to update quantity.');
    } finally {
      setSavingInventoryId('');
    }
  };

  const addCatalogStock = async (catalogItem) => {
    setError('');
    setSuccessMessage('');

    const addQuantity = Number(catalogDrafts[catalogItem._id]?.quantity ?? 1);

    if (Number.isNaN(addQuantity) || addQuantity <= 0) {
      setError('Add quantity must be at least 1.');
      return;
    }

    const productKey = getProductKey(catalogItem);
    const existingProduct = inventoryMap[productKey];

    try {
      setAddingCatalogId(catalogItem._id);

      if (existingProduct) {
        const nextQuantity = Number(existingProduct.quantity || 0) + addQuantity;
        const response = await fetch(
          `http://localhost:3000/shopkeeper-api/productChange/${shopkeeperId}/${existingProduct._id}/${nextQuantity}/${Number(existingProduct.price || catalogItem.cost || 0)}`,
          { method: 'PUT' },
        );

        if (!response.ok) {
          const responseData = await response.json().catch(() => ({}));
          throw new Error(responseData.message || 'Failed to add stock');
        }

        setSuccessMessage(`${normalizeName(catalogItem.name)} stock increased by ${addQuantity}.`);
      } else {
        const response = await fetch(`http://localhost:3000/shopkeeper-api/product/${shopkeeperId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildProductFromCatalogItem(catalogItem, addQuantity)),
        });

        if (!response.ok) {
          const responseData = await response.json().catch(() => ({}));
          throw new Error(responseData.message || 'Failed to add item to shop');
        }

        setSuccessMessage(`${normalizeName(catalogItem.name)} added to your shop.`);
      }

      await refreshShopkeeper();
    } catch (addError) {
      setError(addError.message || 'Failed to add stock.');
    } finally {
      setAddingCatalogId('');
    }
  };

  const filteredCatalog = useMemo(() => {
    const normalizedSearch = searchCatalog.trim().toLowerCase();

    if (!normalizedSearch) {
      return catalog;
    }

    return catalog.filter((item) => {
      const itemName = normalizeName(item.name).toLowerCase();
      const itemCategory = `${item.category || ''}`.toLowerCase();
      return itemName.includes(normalizedSearch) || itemCategory.includes(normalizedSearch);
    });
  }, [catalog, searchCatalog]);

  const formatLocation = shopkeeper?.shopAddress
    ? `${shopkeeper.shopAddress.city || 'Unknown City'}, ${shopkeeper.shopAddress.state || 'Unknown State'} - ${shopkeeper.shopAddress.pincode || 'Unknown Pincode'}`
    : 'Not Available';

  return (
    <div className="pt-24 pb-12 px-4 bg-gradient-to-b from-violet-50 via-white to-white min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="rounded-3xl bg-white border border-violet-100 shadow-xl overflow-hidden p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-violet-600">Inventory Dashboard</p>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2">{shopkeeper?.shopName || 'Shop Dashboard'}</h1>
              <p className="text-gray-600 mt-3 max-w-2xl">
                Update stock quantities for approved shop items and keep your catalog aligned with what delivery partners can see.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link to="/work/shopkeeper-profile" className="rounded-xl border border-violet-200 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50 transition-colors">
                View Profile
              </Link>
              <button onClick={handleLogout} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition-colors">
                Logout
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="rounded-2xl bg-violet-50 border border-violet-100 p-4 shadow-sm">
              <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Inventory</p>
              <p className="mt-1 text-gray-900 font-semibold">{activeProducts} active / {inventory.length} total</p>
            </div>
            <div className="rounded-2xl bg-violet-50 border border-violet-100 p-4 shadow-sm">
              <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Total Stock</p>
              <p className="mt-1 text-gray-900 font-semibold">{totalStock}</p>
            </div>
            <div className="rounded-2xl bg-violet-50 border border-violet-100 p-4 shadow-sm">
              <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Shop Status</p>
              <p className="mt-1 text-gray-900 font-semibold">{shopkeeper?.isShopOpen ? 'Open' : 'Closed'}</p>
            </div>
          </div>
        </div>

        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div> : null}
        {successMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">{successMessage}</div> : null}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="rounded-3xl bg-white border border-violet-100 shadow-lg p-6 md:p-8">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-sm font-semibold text-violet-600">Inventory Manager</p>
                <h2 className="text-2xl font-bold text-gray-900 mt-1">Adjust shop item quantities</h2>
                <p className="text-gray-600 mt-2">Only quantity can be changed here. Price and item details stay controlled by the shared catalog.</p>
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-600">Loading shop profile...</div>
            ) : inventory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-600">No inventory yet. Add stock from the catalog on the right.</div>
            ) : (
              <div className="space-y-4 max-h-[950px] overflow-y-auto pr-1">
                {inventory.map((product) => (
                  <div key={product._id} className="rounded-2xl border border-gray-200 p-4 shadow-sm bg-gray-50/70">
                    <div className="flex flex-col md:flex-row gap-4">
                      <img
                        src={product.imageUrl}
                        alt={normalizeName(product.name)}
                        className="h-24 w-24 rounded-2xl object-cover border border-gray-200 bg-white"
                        onError={(event) => {
                          event.currentTarget.src = 'https://via.placeholder.com/300x200?text=Image+Unavailable';
                        }}
                      />

                      <div className="flex-1 space-y-3">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">{normalizeName(product.name)}</h3>
                          <p className="text-sm text-gray-500">{product.category || 'uncategorized'}</p>
                          <p className="text-sm text-gray-600 mt-1">{product.description}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Quantity</label>
                            <input
                              type="number"
                              min="0"
                              value={inventoryDrafts[product._id]?.quantity ?? product.quantity ?? 0}
                              onChange={(event) => {
                                const value = event.target.value;
                                setInventoryDrafts((current) => ({
                                  ...current,
                                  [product._id]: { quantity: value },
                                }));
                              }}
                              className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-violet-300 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Locked Price</label>
                            <input
                              type="text"
                              value={`₹${Number(product.price || 0)}`}
                              readOnly
                              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700"
                            />
                          </div>
                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() => updateInventoryQuantity(product)}
                              disabled={savingInventoryId === product._id}
                              className="w-full rounded-xl bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {savingInventoryId === product._id ? 'Saving...' : 'Save Quantity'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-white border border-violet-100 shadow-lg p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-5">
              <div>
                <p className="text-sm font-semibold text-violet-600">Shared Catalog</p>
                <h2 className="text-2xl font-bold text-gray-900 mt-1">Add stock from approved shop items</h2>
                <p className="text-gray-600 mt-2">These are the global product definitions created by admin.</p>
              </div>

              <input
                type="text"
                value={searchCatalog}
                onChange={(event) => setSearchCatalog(event.target.value)}
                className="w-full md:w-72 rounded-xl border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-violet-300 focus:outline-none"
                placeholder="Search items or categories"
              />
            </div>

            {catalogLoading ? (
              <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-600">Loading catalog...</div>
            ) : filteredCatalog.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-600">No catalog items found.</div>
            ) : (
              <div className="space-y-4 max-h-[950px] overflow-y-auto pr-1">
                {filteredCatalog.map((catalogItem) => {
                  const productKey = getProductKey(catalogItem);
                  const existingProduct = inventoryMap[productKey];
                  const addQuantity = catalogDrafts[catalogItem._id]?.quantity ?? 1;

                  return (
                    <div key={catalogItem._id} className="rounded-2xl border border-gray-200 p-4 shadow-sm bg-gradient-to-br from-white to-violet-50/40">
                      <div className="flex flex-col md:flex-row gap-4">
                        <img
                          src={catalogItem.imageUrl}
                          alt={normalizeName(catalogItem.name)}
                          className="h-24 w-24 rounded-2xl object-cover border border-gray-200 bg-white"
                          onError={(event) => {
                            event.currentTarget.src = 'https://via.placeholder.com/300x200?text=Image+Unavailable';
                          }}
                        />

                        <div className="flex-1 space-y-3">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-bold text-gray-900">{normalizeName(catalogItem.name)}</h3>
                              <p className="text-sm text-gray-500">{catalogItem.category || 'uncategorized'}</p>
                              <p className="text-sm text-gray-600 mt-1">{catalogItem.description}</p>
                            </div>
                            <div className="rounded-2xl bg-white border border-violet-100 px-4 py-3 text-sm text-gray-700">
                              <p className="font-semibold text-violet-700">Catalog Price</p>
                              <p>₹{Number(catalogItem.cost || 0)}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">Add Quantity</label>
                              <input
                                type="number"
                                min="1"
                                value={addQuantity}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setCatalogDrafts((current) => ({
                                    ...current,
                                    [catalogItem._id]: { quantity: value },
                                  }));
                                }}
                                className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-violet-300 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">Current Shop Stock</label>
                              <input
                                type="text"
                                value={existingProduct ? existingProduct.quantity : 'Not in shop'}
                                readOnly
                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700"
                              />
                            </div>
                            <div className="flex items-end">
                              <button
                                type="button"
                                onClick={() => addCatalogStock(catalogItem)}
                                disabled={addingCatalogId === catalogItem._id}
                                className="w-full rounded-xl bg-gray-950 px-4 py-2 font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {addingCatalogId === catalogItem._id
                                  ? 'Updating...'
                                  : existingProduct
                                    ? 'Increase Stock'
                                    : 'Add to My Shop'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShopkeeperDashboard;