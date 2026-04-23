import React, { useEffect, useMemo, useState } from 'react';
import { createShopItem } from '../../services/api';

const ROLE_CONFIG = {
  vendor: {
    label: 'Vendor',
    listEndpoint: 'http://localhost:3000/vendor-api/vendors',
    deleteEndpoint: (id) => `http://localhost:3000/vendor-api/vendorid/${id}`,
  },
  shopkeeper: {
    label: 'Shopkeeper',
    listEndpoint: 'http://localhost:3000/shopkeeper-api/shopkeepers',
    deleteEndpoint: (id) => `http://localhost:3000/shopkeeper-api/shopkeeperid/${id}`,
  },
  delivery: {
    label: 'Delivery Partner',
    listEndpoint: 'http://localhost:3000/delivery-api/deliveryPersons',
    deleteEndpoint: (id) => `http://localhost:3000/delivery-api/deliverypersonid/${id}`,
  },
  worker: {
    label: 'Worker',
    listEndpoint: 'http://localhost:3000/worker-api/workers',
    deleteEndpoint: (id) => `http://localhost:3000/worker-api/workerid/${id}`,
  },
};

const getRoleBadgeClasses = (role) => {
  if (role === 'vendor') return 'bg-blue-100 text-blue-700';
  if (role === 'shopkeeper') return 'bg-violet-100 text-violet-700';
  if (role === 'delivery') return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
};

const getOperationalStatus = (member, role) => {
  if (role === 'shopkeeper') return member.isShopOpen ? 'Active' : 'Closed';
  if (role === 'delivery' || role === 'worker') return member.isAvailable ? 'Active' : 'Inactive';
  if (role === 'vendor') return member.acceptsOnlinePayments ? 'Payment Ready' : 'Onboarding';
  return 'Active';
};

const toCsv = (rows) => {
  const header = ['role', 'name', 'mobileNumber', 'email', 'status', 'city', 'shopName'];
  const lines = rows.map((row) => [
    row.role,
    row.name,
    row.mobileNumber,
    row.email,
    row.status,
    row.city,
    row.shopName,
  ]);

  return [header, ...lines]
    .map((line) => line.map((value) => `"${`${value || ''}`.replace(/"/g, '""')}"`).join(','))
    .join('\n');
};

function WorkforceAdminDashboard() {
  const [dataByRole, setDataByRole] = useState({
    vendor: [],
    shopkeeper: [],
    delivery: [],
    worker: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [deletingRecordId, setDeletingRecordId] = useState('');
  const [productForm, setProductForm] = useState({
    name: '',
    category: '',
    imageUrl: '',
    description: '',
    quantity: '50',
    cost: '0',
  });
  const [savingProduct, setSavingProduct] = useState(false);
  const [productMessage, setProductMessage] = useState('');
  const [productError, setProductError] = useState('');

  const fetchAllRoles = async () => {
    setLoading(true);
    setError('');

    try {
      const entries = await Promise.all(
        Object.entries(ROLE_CONFIG).map(async ([roleKey, config]) => {
          const response = await fetch(config.listEndpoint);
          if (!response.ok) {
            throw new Error(`Failed to fetch ${config.label}`);
          }

          const data = await response.json();
          return [roleKey, Array.isArray(data?.payload) ? data.payload : []];
        }),
      );

      const nextData = entries.reduce((acc, [roleKey, records]) => {
        acc[roleKey] = records;
        return acc;
      }, {});

      setDataByRole(nextData);
    } catch (fetchError) {
      console.error('Admin dashboard fetch failed:', fetchError);
      setError(fetchError.message || 'Unable to load workforce data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllRoles();
  }, []);

  const unifiedRows = useMemo(() => {
    return Object.entries(dataByRole).flatMap(([role, records]) =>
      records.map((member) => ({
        id: member._id,
        role,
        roleLabel: ROLE_CONFIG[role].label,
        name: `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'NA',
        mobileNumber: member.mobileNumber || 'NA',
        email: member.email || 'NA',
        status: getOperationalStatus(member, role),
        city: member.shopAddress?.city || member.Address?.city || 'NA',
        shopName: member.shopName || 'NA',
        profileImg: member.profileImg || member.shopImage || member.vehicleImage || '',
        raw: member,
      })),
    );
  }, [dataByRole]);

  const summary = useMemo(() => {
    const total = unifiedRows.length;
    const active = unifiedRows.filter((row) => row.status === 'Active' || row.status === 'Payment Ready').length;

    return {
      total,
      active,
      vendor: dataByRole.vendor.length,
      shopkeeper: dataByRole.shopkeeper.length,
      delivery: dataByRole.delivery.length,
      worker: dataByRole.worker.length,
    };
  }, [dataByRole, unifiedRows]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const result = unifiedRows.filter((row) => {
      const roleMatch = roleFilter === 'all' || row.role === roleFilter;
      const statusMatch = statusFilter === 'all' || row.status === statusFilter;
      const searchMatch = !normalizedSearch || [row.name, row.mobileNumber, row.email, row.shopName, row.city]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);

      return roleMatch && statusMatch && searchMatch;
    });

    if (sortBy === 'role') {
      return result.sort((a, b) => a.roleLabel.localeCompare(b.roleLabel));
    }

    if (sortBy === 'status') {
      return result.sort((a, b) => a.status.localeCompare(b.status));
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [roleFilter, search, sortBy, statusFilter, unifiedRows]);

  const exportCsv = () => {
    const csvContent = toCsv(filteredRows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'workforce-admin-export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCreateProduct = async (event) => {
    event.preventDefault();
    setProductError('');
    setProductMessage('');

    const quantity = Number(productForm.quantity);
    const cost = Number(productForm.cost);

    if (!productForm.name.trim() || !productForm.imageUrl.trim() || !productForm.description.trim()) {
      setProductError('Name, image URL, and description are required.');
      return;
    }

    if (Number.isNaN(quantity) || quantity < 0) {
      setProductError('Quantity must be zero or greater.');
      return;
    }

    if (Number.isNaN(cost) || cost < 0) {
      setProductError('Cost must be zero or greater.');
      return;
    }

    try {
      setSavingProduct(true);
      await createShopItem({
        name: productForm.name.trim(),
        category: productForm.category.trim() || 'uncategorized',
        imageUrl: productForm.imageUrl.trim(),
        description: productForm.description.trim(),
        quantity,
        cost,
      });

      setProductMessage('Product added to the catalog successfully.');
      setProductForm({
        name: '',
        category: '',
        imageUrl: '',
        description: '',
        quantity: '50',
        cost: '0',
      });
      fetchAllRoles();
    } catch (createError) {
      setProductError(createError.message || 'Failed to create product.');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteRecord = async (row) => {
    const roleConfig = ROLE_CONFIG[row.role];

    if (!roleConfig) {
      return;
    }

    const shouldDelete = window.confirm(`Delete ${row.roleLabel} profile for ${row.name}? This action cannot be undone.`);
    if (!shouldDelete) {
      return;
    }

    setError('');
    setDeletingRecordId(row.id);

    try {
      const response = await fetch(roleConfig.deleteEndpoint(row.id), {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete profile');
      }

      setDataByRole((prev) => ({
        ...prev,
        [row.role]: prev[row.role].filter((entry) => entry._id !== row.id),
      }));

      if (selectedRecord?.id === row.id) {
        setSelectedRecord(null);
      }
    } catch (deleteError) {
      console.error('Delete failed:', deleteError);
      setError(deleteError.message || 'Failed to delete profile');
    } finally {
      setDeletingRecordId('');
    }
  };

  return (
    <div className="pt-24 pb-12 px-4 bg-gradient-to-b from-indigo-50 via-white to-white min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="rounded-2xl border border-indigo-100 bg-white shadow-lg p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-indigo-600">Admin Console</p>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">Workforce Management Dashboard</h1>
              <p className="text-gray-600 mt-2">Monitor all partner registrations and operational readiness in one place.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={fetchAllRoles} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Refresh</button>
              <button onClick={exportCsv} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Export CSV</button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-6">
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4"><p className="text-xs text-indigo-700">Total</p><p className="text-2xl font-bold text-indigo-900">{summary.total}</p></div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4"><p className="text-xs text-emerald-700">Active</p><p className="text-2xl font-bold text-emerald-900">{summary.active}</p></div>
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-4"><p className="text-xs text-blue-700">Vendors</p><p className="text-2xl font-bold text-blue-900">{summary.vendor}</p></div>
            <div className="rounded-xl bg-violet-50 border border-violet-100 p-4"><p className="text-xs text-violet-700">Shopkeepers</p><p className="text-2xl font-bold text-violet-900">{summary.shopkeeper}</p></div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-4"><p className="text-xs text-amber-700">Delivery</p><p className="text-2xl font-bold text-amber-900">{summary.delivery}</p></div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4"><p className="text-xs text-emerald-700">Workers</p><p className="text-2xl font-bold text-emerald-900">{summary.worker}</p></div>
          </div>

          <div className="mt-6 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-5 md:p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
              <div>
                <p className="text-sm font-semibold text-violet-600">Catalog Management</p>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-1">Add a new product to the shared shop item catalog</h2>
                <p className="text-gray-600 mt-2">This product becomes available for shopkeepers to stock in their shops.</p>
              </div>
            </div>

            {productError ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">{productError}</div> : null}
            {productMessage ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 text-sm">{productMessage}</div> : null}

            <form onSubmit={handleCreateProduct} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <input
                type="text"
                value={productForm.name}
                onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Product name"
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-300 focus:outline-none"
              />
              <input
                type="text"
                value={productForm.category}
                onChange={(event) => setProductForm((current) => ({ ...current, category: event.target.value }))}
                placeholder="Category"
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-300 focus:outline-none"
              />
              <input
                type="url"
                value={productForm.imageUrl}
                onChange={(event) => setProductForm((current) => ({ ...current, imageUrl: event.target.value }))}
                placeholder="Image URL"
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-300 focus:outline-none"
              />
              <textarea
                value={productForm.description}
                onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Product description"
                rows="3"
                className="md:col-span-2 xl:col-span-3 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-300 focus:outline-none"
              />
              <input
                type="number"
                min="0"
                value={productForm.quantity}
                onChange={(event) => setProductForm((current) => ({ ...current, quantity: event.target.value }))}
                placeholder="Quantity"
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-300 focus:outline-none"
              />
              <input
                type="number"
                min="0"
                value={productForm.cost}
                onChange={(event) => setProductForm((current) => ({ ...current, cost: event.target.value }))}
                placeholder="Cost"
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-300 focus:outline-none"
              />
              <button
                type="submit"
                disabled={savingProduct}
                className="xl:col-span-3 rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {savingProduct ? 'Saving Product...' : 'Add Product to Catalog'}
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-6">
            <input
              type="text"
              placeholder="Search by name, phone, email, city"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="md:col-span-2 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-300 focus:outline-none"
            />
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-300 focus:outline-none">
              <option value="all">All Roles</option>
              <option value="vendor">Vendor</option>
              <option value="shopkeeper">Shopkeeper</option>
              <option value="delivery">Delivery Partner</option>
              <option value="worker">Worker</option>
            </select>
            <div className="grid grid-cols-2 gap-3">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-300 focus:outline-none">
                <option value="all">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Closed">Closed</option>
                <option value="Payment Ready">Payment Ready</option>
                <option value="Onboarding">Onboarding</option>
              </select>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-300 focus:outline-none">
                <option value="name">Sort: Name</option>
                <option value="role">Sort: Role</option>
                <option value="status">Sort: Status</option>
              </select>
            </div>
          </div>

          {error ? <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div> : null}

          {loading ? (
            <div className="mt-6 p-8 text-center text-gray-600">Loading workforce data...</div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-200 text-gray-600">
                    <th className="py-3 px-2">Role</th>
                    <th className="py-3 px-2">Name</th>
                    <th className="py-3 px-2">Contact</th>
                    <th className="py-3 px-2">City</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={`${row.role}-${row.id}`} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-2"><span className={`px-2 py-1 rounded-md text-xs font-semibold ${getRoleBadgeClasses(row.role)}`}>{row.roleLabel}</span></td>
                      <td className="py-3 px-2 font-medium text-gray-900">{row.name}</td>
                      <td className="py-3 px-2 text-gray-700"><div>{row.mobileNumber}</div><div className="text-xs text-gray-500">{row.email}</div></td>
                      <td className="py-3 px-2 text-gray-700">{row.city}</td>
                      <td className="py-3 px-2 text-gray-700">{row.status}</td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-3">
                          <button onClick={() => setSelectedRecord(row)} className="text-indigo-600 hover:text-indigo-800 font-medium">View</button>
                          <button
                            onClick={() => handleDeleteRecord(row)}
                            disabled={deletingRecordId === row.id}
                            className="text-red-600 hover:text-red-700 font-medium disabled:opacity-60"
                          >
                            {deletingRecordId === row.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredRows.length === 0 ? <div className="text-center text-gray-500 py-8">No records match the selected filters.</div> : null}
            </div>
          )}
        </div>
      </div>

      {selectedRecord ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{selectedRecord.roleLabel} Profile</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleDeleteRecord(selectedRecord)}
                  disabled={deletingRecordId === selectedRecord.id}
                  className="px-3 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  {deletingRecordId === selectedRecord.id ? 'Deleting...' : 'Delete Profile'}
                </button>
                <button onClick={() => setSelectedRecord(null)} className="text-gray-500 hover:text-gray-700">Close</button>
              </div>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-auto">
              <div className="flex items-center gap-4">
                {selectedRecord.profileImg ? (
                  <img src={selectedRecord.profileImg} alt="Profile" className="h-16 w-16 rounded-full object-cover border border-gray-200" />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500">N/A</div>
                )}
                <div>
                  <p className="text-xl font-semibold text-gray-900">{selectedRecord.name}</p>
                  <p className="text-sm text-gray-600">{selectedRecord.mobileNumber}</p>
                  <p className="text-sm text-gray-600">{selectedRecord.email}</p>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-2">Raw Record</p>
                <pre className="text-xs whitespace-pre-wrap break-all text-gray-800">{JSON.stringify(selectedRecord.raw, null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default WorkforceAdminDashboard;
