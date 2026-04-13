import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { fetchWorkerBookings } from '../../services/api';

const FALLBACK_SERVICE_IMAGE = 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80';

const WORKER_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'leads', label: 'New Leads' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'earnings', label: 'Earnings' },
  { id: 'profile', label: 'Profile Studio' },
];

const SERVICE_LIBRARY = [
  {
    title: 'Cleaning',
    imageUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80',
  },
  {
    title: 'Appliance Repair',
    imageUrl: 'https://images.pexels.com/photos/5691664/pexels-photo-5691664.jpeg?auto=compress&cs=tinysrgb&w=900',
  },
  {
    title: 'Plumbing',
    imageUrl: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=900&q=80',
  },
  {
    title: 'Electrical',
    imageUrl: 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=900&q=80',
  },
];

const getAuthState = () => {
  try {
    return JSON.parse(localStorage.getItem('workforceAuth') || 'null');
  } catch {
    return null;
  }
};

const getServiceImage = (booking = {}) => {
  return booking.serviceBooking?.serviceImage || SERVICE_LIBRARY.find((item) =>
    (booking.serviceBooking?.serviceName || '').toLowerCase().includes(item.title.toLowerCase())
  )?.imageUrl || FALLBACK_SERVICE_IMAGE;
};

const formatMoney = (value) => `Rs.${Number(value || 0).toFixed(0)}`;

const formatBookingDate = (dateValue) => {
  if (!dateValue) return 'Schedule pending';
  return new Date(dateValue).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatRelativeBucket = (dateValue) => {
  if (!dateValue) return 'Later';
  const now = new Date();
  const target = new Date(dateValue);
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round((startOfTarget - startOfNow) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return 'Upcoming';
};

const getSlotLabel = (booking) => booking.serviceBooking?.timeSlot || formatBookingDate(booking.serviceBooking?.scheduledFor || booking.createdAt);

const DEFAULT_BOOKING_DURATION_MINS = 60;

const getBookingWindow = (booking) => {
  const scheduledFor = booking?.serviceBooking?.scheduledFor ? new Date(booking.serviceBooking.scheduledFor) : null;
  if (!scheduledFor || Number.isNaN(scheduledFor.getTime())) {
    return null;
  }

  const durationMins = Math.max(1, Number(booking?.serviceBooking?.estimatedDurationMins || DEFAULT_BOOKING_DURATION_MINS));
  const startTime = scheduledFor.getTime();
  const endTime = startTime + (durationMins * 60 * 1000);

  return { startTime, endTime };
};

const isOverlappingWindow = (firstWindow, secondWindow) => {
  return firstWindow.startTime < secondWindow.endTime && secondWindow.startTime < firstWindow.endTime;
};

function WorkerDashboard() {
  const navigate = useNavigate();
  const authState = getAuthState();

  if (!authState || authState.role !== 'worker') {
    return <Navigate to="/work/login" replace />;
  }

  const [activeTab, setActiveTab] = useState('overview');
  const [bookingRows, setBookingRows] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [workerProfile, setWorkerProfile] = useState(authState.profile || {});
  const [availability, setAvailability] = useState(Boolean(authState.profile?.isAvailable ?? true));
  const [profileForm, setProfileForm] = useState({
    hourlyRate: authState.profile?.hourlyRate || 0,
    experienceYears: authState.profile?.experienceYears || 0,
    serviceRadiusKm: authState.profile?.serviceRadiusKm || 8,
    bio:
      authState.profile?.bio ||
      'I deliver high-quality home services with transparent pricing, quick response, and attention to detail.',
    workTypes: Array.isArray(authState.profile?.workTypes)
      ? authState.profile.workTypes.join(', ')
      : 'Home Cleaning, AC Service, Plumbing',
  });

  const workerId = workerProfile?._id;
  const fullName = `${workerProfile?.firstName || ''} ${workerProfile?.lastName || ''}`.trim() || 'HomeXpert Partner';

  const handleImageError = (event) => {
    event.currentTarget.onerror = null;
    event.currentTarget.src = FALLBACK_SERVICE_IMAGE;
  };

  const refreshBookings = async (showSpinner = false) => {
    if (!workerId) {
      setLoadingBookings(false);
      return;
    }

    if (showSpinner) {
      setLoadingBookings(true);
    }

    try {
      const bookings = await fetchWorkerBookings(workerId);
      setBookingRows(Array.isArray(bookings) ? bookings : []);
    } catch (error) {
      console.error('Failed to load worker bookings:', error);
      if (showSpinner) {
        toast.error('Failed to load your bookings');
      }
    } finally {
      if (showSpinner) {
        setLoadingBookings(false);
      }
    }
  };

  useEffect(() => {
    refreshBookings(true);
    const poll = setInterval(() => refreshBookings(false), 20000);
    return () => clearInterval(poll);
  }, [workerId]);

  const leads = useMemo(() => bookingRows.filter((booking) => booking.orderStatus === 'PLACED'), [bookingRows]);
  const scheduleBookings = useMemo(
    () => bookingRows.filter((booking) => ['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'].includes(booking.orderStatus)),
    [bookingRows],
  );
  const completedBookings = useMemo(() => bookingRows.filter((booking) => booking.orderStatus === 'DELIVERED'), [bookingRows]);
  const cancelledBookings = useMemo(() => bookingRows.filter((booking) => booking.orderStatus === 'CANCELLED'), [bookingRows]);

  const todayEarnings = useMemo(
    () => completedBookings.reduce((sum, booking) => sum + Number(booking.totalAmount || 0), 0),
    [completedBookings],
  );

  const projectedEarnings = useMemo(
    () => scheduleBookings.reduce((sum, booking) => sum + Number(booking.totalAmount || 0), 0),
    [scheduleBookings],
  );

  const completionRate = useMemo(() => {
    const total = bookingRows.length;
    if (!total) return 0;
    return Math.round((completedBookings.length / total) * 100);
  }, [bookingRows, completedBookings.length]);

  const hasActiveAssignedBooking = scheduleBookings.length > 0;

  const isLeadOverlappingWithSchedule = (leadBooking) => {
    const leadWindow = getBookingWindow(leadBooking);
    if (!leadWindow) {
      return hasActiveAssignedBooking;
    }

    return scheduleBookings.some((scheduledBooking) => {
      const scheduledWindow = getBookingWindow(scheduledBooking);
      if (!scheduledWindow) {
        return true;
      }

      return isOverlappingWindow(leadWindow, scheduledWindow);
    });
  };

  const serviceMix = useMemo(() => {
    const counts = {};
    completedBookings.forEach((booking) => {
      const serviceName = booking.serviceBooking?.serviceName || 'Service';
      counts[serviceName] = (counts[serviceName] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count);
  }, [completedBookings]);

  const handleLogout = () => {
    localStorage.removeItem('workforceAuth');
    navigate('/work/login');
  };

  const updateWorkforceLocalProfile = (nextProfile) => {
    const nextAuth = { ...authState, profile: nextProfile };
    localStorage.setItem('workforceAuth', JSON.stringify(nextAuth));
    setWorkerProfile(nextProfile);
  };

  const updateWorkerBooking = async (orderId, payload) => {
    const response = await fetch(`http://localhost:3000/order-api/worker/order/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to update booking');
    }

    return data.payload;
  };

  const handleLeadAction = async (bookingId, action) => {
    try {
      if (action === 'accepted') {
        await updateWorkerBooking(bookingId, { orderStatus: 'CONFIRMED', workerId });
        toast.success('Lead accepted and moved to your schedule.');
      } else {
        const response = await fetch(`http://localhost:3000/order-api/worker/order/${bookingId}/release`, {
          method: 'PATCH',
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message || 'Failed to release lead');
        }

        toast.info('Lead released back to the pool.');
      }

      await refreshBookings(false);
    } catch (error) {
      toast.error(error.message || 'Action failed');
    }
  };

  const markBookingAsCompleted = async (bookingId) => {
    try {
      await updateWorkerBooking(bookingId, { orderStatus: 'DELIVERED', workerId });
      toast.success('Booking marked as completed.');
      await refreshBookings(false);
    } catch (error) {
      toast.error(error.message || 'Failed to complete booking');
    }
  };

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvailabilityToggle = async () => {
    try {
      const nextAvailability = !availability;
      const response = await fetch(`http://localhost:3000/worker-api/workerupdate/${workerProfile._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isAvailable: nextAvailability }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to update availability');
      }

      setAvailability(nextAvailability);
      updateWorkforceLocalProfile(payload.payload || { ...workerProfile, isAvailable: nextAvailability });
      toast.success(nextAvailability ? 'You are now live for new leads' : 'You are now paused for new leads');
    } catch (error) {
      toast.error(error.message || 'Failed to update availability');
    }
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();

    const sanitizedWorkTypes = profileForm.workTypes
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const updatePayload = {
      hourlyRate: Number(profileForm.hourlyRate || 0),
      experienceYears: Number(profileForm.experienceYears || 0),
      serviceRadiusKm: Number(profileForm.serviceRadiusKm || 0),
      bio: profileForm.bio.trim(),
      workTypes: sanitizedWorkTypes,
      isAvailable: availability,
    };

    try {
      setIsSavingProfile(true);
      const response = await fetch(`http://localhost:3000/worker-api/workerupdate/${workerProfile._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to update profile');
      }

      updateWorkforceLocalProfile(payload.payload || { ...workerProfile, ...updatePayload });
      toast.success('Profile updated successfully.');
    } catch (error) {
      toast.error(error.message || 'Profile update failed');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Today Earnings</p>
          <p className="text-2xl font-black text-slate-900 mt-2">{formatMoney(todayEarnings)}</p>
          <p className="text-xs text-emerald-700 mt-1">Booked from completed services</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Pending Leads</p>
          <p className="text-2xl font-black text-slate-900 mt-2">{leads.length}</p>
          <p className="text-xs text-slate-600 mt-1">Service requests waiting</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Upcoming Jobs</p>
          <p className="text-2xl font-black text-slate-900 mt-2">{scheduleBookings.length}</p>
          <p className="text-xs text-slate-600 mt-1">Confirmed and in-progress</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Completion Rate</p>
          <p className="text-2xl font-black text-slate-900 mt-2">{completionRate}%</p>
          <p className="text-xs text-slate-600 mt-1">Professional reliability score</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">High-Demand Services</h3>
            <span className="text-xs text-slate-500">Web imagery from customer demand signals</span>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {SERVICE_LIBRARY.map((service) => (
              <div key={service.title} className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                <img src={service.imageUrl} alt={service.title} className="h-32 w-full object-cover" loading="lazy" onError={handleImageError} />
                <div className="p-3">
                  <p className="font-semibold text-slate-900 text-sm">{service.title}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                    <span>Demand-ready</span>
                    <span className="font-semibold text-emerald-700">Open for booking</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-bold text-slate-900">Performance Snapshot</h3>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
              <p className="text-xs text-emerald-700">Accepted Leads</p>
              <p className="text-xl font-black text-emerald-800">{scheduleBookings.length + completedBookings.length}</p>
            </div>
            <div className="rounded-xl bg-cyan-50 border border-cyan-100 p-3">
              <p className="text-xs text-cyan-700">Projected Earnings</p>
              <p className="text-xl font-black text-cyan-800">{formatMoney(projectedEarnings)}</p>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
              <p className="text-xs text-amber-700">Cancelled</p>
              <p className="text-xl font-black text-amber-800">{cancelledBookings.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLeads = () => (
    <div className="space-y-4">
      {hasActiveAssignedBooking ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          You can accept another lead only if it does not overlap with your active schedule.
        </div>
      ) : null}

      {leads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          No new leads yet. New service bookings will appear here automatically.
        </div>
      ) : (
        leads.map((booking) => (
          <div key={booking._id} className="rounded-2xl border border-slate-200 bg-white p-4">
            {isLeadOverlappingWithSchedule(booking) ? (
              <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                Schedule overlap: this lead conflicts with an already accepted booking.
              </div>
            ) : null}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex gap-4">
                <img src={getServiceImage(booking)} alt={booking.serviceBooking?.serviceName || 'Service'} className="h-20 w-20 rounded-xl object-cover border border-slate-200" onError={handleImageError} />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{booking.serviceBooking?.serviceName || 'Service booking'}</p>
                    <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">New Lead</span>
                  </div>
                  <p className="text-sm text-slate-700 mt-2">{booking.serviceBooking?.packageName || 'Standard package'}</p>
                  <p className="text-xs text-slate-500 mt-1">{booking.deliveryAddress?.city}, {booking.deliveryAddress?.state} • {getSlotLabel(booking)}</p>
                  <p className="text-xs text-slate-500 mt-1">Customer: {booking.deliveryAddress?.fullName || 'Customer'}</p>
                </div>
              </div>

              <div className="text-left md:text-right">
                <p className="text-sm text-slate-500">Estimated Payout</p>
                <p className="text-lg font-black text-slate-900">{formatMoney(booking.totalAmount)}</p>
                <p className="text-xs text-slate-500">Status: {booking.orderStatus}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={() => handleLeadAction(booking._id, 'declined')}
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => handleLeadAction(booking._id, 'accepted')}
                disabled={isLeadOverlappingWithSchedule(booking)}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                {isLeadOverlappingWithSchedule(booking) ? 'Overlaps existing booking' : 'Accept Lead'}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderSchedule = () => {
    const grouped = scheduleBookings.reduce(
      (accumulator, booking) => {
        const bucket = formatRelativeBucket(booking.serviceBooking?.scheduledFor || booking.createdAt);
        accumulator[bucket] = accumulator[bucket] || [];
        accumulator[bucket].push(booking);
        return accumulator;
      },
      { Today: [], Tomorrow: [], Upcoming: [] },
    );

    const columns = ['Today', 'Tomorrow', 'Upcoming'];

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((column) => (
          <div key={column} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <p className="text-sm font-bold text-slate-900">{column}</p>
              <p className="text-xs text-slate-500 mt-1">{grouped[column].length} service booking{grouped[column].length === 1 ? '' : 's'}</p>
            </div>
            <div className="p-4 space-y-3 min-h-[240px]">
              {grouped[column].length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 text-center">
                  No jobs scheduled.
                </div>
              ) : (
                grouped[column].map((booking) => (
                  <div key={booking._id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900 text-sm">{booking.serviceBooking?.serviceName}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${booking.orderStatus === 'DELIVERED' ? 'bg-emerald-100 text-emerald-700' : 'bg-cyan-100 text-cyan-700'}`}>
                        {booking.orderStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{booking.serviceBooking?.packageName}</p>
                    <p className="text-xs text-slate-500 mt-1">{getSlotLabel(booking)}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">{formatMoney(booking.totalAmount)}</span>
                      {booking.orderStatus !== 'DELIVERED' ? (
                        <button
                          type="button"
                          onClick={() => markBookingAsCompleted(booking._id)}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800"
                        >
                          Complete
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold text-emerald-700">Done</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderEarnings = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-bold text-slate-900">Service Mix Performance</h3>
        <p className="text-sm text-slate-500 mt-1">Where your best repeat demand is coming from</p>

        <div className="mt-4 space-y-3">
          {serviceMix.length === 0 ? (
            <p className="text-sm text-slate-500">No completed service insights yet.</p>
          ) : (
            serviceMix.map((item) => (
              <div key={item.service} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-800">{item.service}</span>
                  <span className="text-slate-600">{item.count} jobs</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-2 rounded-full bg-cyan-500" style={{ width: `${Math.min(100, item.count * 25)}%` }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-bold text-slate-900">Earnings Pulse</h3>
        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
            <p className="text-xs text-emerald-700">Today Closed</p>
            <p className="text-2xl font-black text-emerald-800">{formatMoney(todayEarnings)}</p>
          </div>
          <div className="rounded-xl bg-cyan-50 border border-cyan-100 p-3">
            <p className="text-xs text-cyan-700">Upcoming Projection</p>
            <p className="text-2xl font-black text-cyan-800">{formatMoney(projectedEarnings)}</p>
          </div>
          <div className="rounded-xl bg-violet-50 border border-violet-100 p-3">
            <p className="text-xs text-violet-700">Avg Ticket</p>
            <p className="text-2xl font-black text-violet-800">
              {formatMoney(bookingRows.length ? (todayEarnings + projectedEarnings) / bookingRows.length : 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderProfileStudio = () => (
    <form onSubmit={handleProfileSave} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Profile Studio</h3>
        <p className="text-sm text-slate-500 mt-1">Optimize your profile for better booking conversion.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="hourlyRate" className="block text-sm font-medium text-slate-700 mb-1">Hourly Rate (Rs)</label>
          <input
            id="hourlyRate"
            name="hourlyRate"
            type="number"
            min="0"
            value={profileForm.hourlyRate}
            onChange={handleProfileChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
          />
        </div>
        <div>
          <label htmlFor="experienceYears" className="block text-sm font-medium text-slate-700 mb-1">Experience (Years)</label>
          <input
            id="experienceYears"
            name="experienceYears"
            type="number"
            min="0"
            value={profileForm.experienceYears}
            onChange={handleProfileChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="serviceRadiusKm" className="block text-sm font-medium text-slate-700 mb-1">Service Radius (km)</label>
          <input
            id="serviceRadiusKm"
            name="serviceRadiusKm"
            type="number"
            min="0"
            value={profileForm.serviceRadiusKm}
            onChange={handleProfileChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
          />
        </div>
        <div>
          <label htmlFor="workTypes" className="block text-sm font-medium text-slate-700 mb-1">Service Types (comma separated)</label>
          <input
            id="workTypes"
            name="workTypes"
            type="text"
            value={profileForm.workTypes}
            onChange={handleProfileChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
            placeholder="Cleaning, Plumbing, Electrical"
          />
        </div>
      </div>

      <div>
        <label htmlFor="bio" className="block text-sm font-medium text-slate-700 mb-1">Professional Bio</label>
        <textarea
          id="bio"
          name="bio"
          rows={4}
          value={profileForm.bio}
          onChange={handleProfileChange}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
        />
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={handleAvailabilityToggle}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${availability ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}
        >
          {availability ? 'Pause Availability' : 'Go Live'}
        </button>
        <button
          type="submit"
          disabled={isSavingProfile}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {isSavingProfile ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </form>
  );

  return (
    <div className="pt-24 pb-12 px-4 bg-gradient-to-b from-cyan-50 via-white to-emerald-50/40 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <section className="rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)]">
          <div className="relative p-6 md:p-8 bg-gradient-to-r from-slate-900 via-cyan-900 to-emerald-900 text-white">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, #ffffff 0%, transparent 40%)' }} />
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-100 font-semibold">Worker Command Center</p>
                <h1 className="text-3xl md:text-4xl font-black mt-2">Welcome, {workerProfile?.firstName || 'Partner'}</h1>
                <p className="text-sm md:text-base text-cyan-100 mt-2 max-w-2xl">
                  Manage service leads, schedule appointments, and grow your earnings from a real booking pipeline.
                </p>
                <div className="mt-3 inline-flex items-center rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs font-semibold">
                  Elite Home Service Professional
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 border border-white/20 p-4 min-w-[280px]">
                <p className="text-xs uppercase tracking-wide text-cyan-100">Partner Identity</p>
                <p className="text-lg font-bold mt-1">{fullName}</p>
                <p className="text-xs text-cyan-100 mt-1">{workerProfile?.mobileNumber || 'Mobile not available'}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-cyan-100">Availability</span>
                  <button
                    type="button"
                    onClick={handleAvailabilityToggle}
                    className={`rounded-full px-3 py-1 text-xs font-bold ${availability ? 'bg-emerald-400 text-emerald-950' : 'bg-rose-300 text-rose-900'}`}
                  >
                    {availability ? 'LIVE' : 'PAUSED'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-5 border-b border-slate-200 bg-white">
            <div className="flex flex-wrap gap-2">
              {WORKER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    activeTab === tab.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 md:p-6 bg-slate-50/70">
            {loadingBookings ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading your bookings...</div>
            ) : (
              <>
                {activeTab === 'overview' ? renderOverview() : null}
                {activeTab === 'leads' ? renderLeads() : null}
                {activeTab === 'schedule' ? renderSchedule() : null}
                {activeTab === 'earnings' ? renderEarnings() : null}
                {activeTab === 'profile' ? renderProfileStudio() : null}
              </>
            )}
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link to="/" className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">
            Home
          </Link>
          <button onClick={handleLogout} className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800">
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export default WorkerDashboard;
