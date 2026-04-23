import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { MapContainer, Marker, Polyline, Popup, ScaleControl, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchWorkerBookings, updateWorkerOrderLocation } from '../../services/api';
import { clearWorkforceAuth, getWorkforceAuth, setWorkforceAuth } from '../../utils/workforceAuth';

const FALLBACK_SERVICE_IMAGE = 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80';

const WORKER_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'leads', label: 'New Leads' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'map', label: 'Navigation' },
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

const iconShadow = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png';

const workerIcon = new L.Icon({
  iconUrl: 'https://img.icons8.com/color/96/motorcycle.png',
  shadowUrl: iconShadow,
  iconSize: [36, 36],
  iconAnchor: [18, 20],
  popupAnchor: [0, -20],
  shadowSize: [41, 41],
});

const destinationIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/535/535188.png',
  shadowUrl: iconShadow,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -24],
  shadowSize: [41, 41],
});

const createAddressCoordinates = (address = {}) => {
  const seed = `${address.pincode || ''}-${address.city || ''}-${address.addressLine1 || ''}`;
  const hash = String(seed || '1')
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0) || 1;
  const lat = 12.9 + (hash % 1700) / 1000;
  const lng = 77.2 + ((hash * 7) % 1900) / 1000;
  return { lat, lng };
};

const geocodeAddress = async (address) => {
  const query = [address?.addressLine1, address?.city, address?.state, address?.pincode, 'India']
    .filter(Boolean)
    .join(', ');

  if (!query) {
    return null;
  }

  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`, {
    headers: {
      'Accept-Language': 'en',
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  return {
    lat: Number(payload[0].lat),
    lng: Number(payload[0].lon),
  };
};

const toRadians = (value) => (value * Math.PI) / 180;
const isValidCoordinate = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng);

const getHaversineDistanceMeters = (from, to) => {
  if (!from || !to) {
    return 0;
  }

  const earthRadius = 6371000;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

const fetchOsrmRoute = async (from, to) => {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const route = payload?.routes?.[0]?.geometry?.coordinates;
  if (!Array.isArray(route) || route.length === 0) {
    return null;
  }

  return route.map((coord) => ({ lat: Number(coord[1]), lng: Number(coord[0]) }));
};

function FollowWorker({ enabled, position }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    map.setView([position.lat, position.lng], Math.max(map.getZoom(), 15), {
      animate: true,
      duration: 0.6,
    });
  }, [enabled, map, position]);

  return null;
}

const getAuthState = () => {
  return getWorkforceAuth('worker');
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
  const isAuthorized = authState?.role === 'worker';
  const mapRef = useRef(null);
  const gpsWatchRef = useRef(null);
  const locationSyncRef = useRef({
    orderId: null,
    lastSyncAt: 0,
    lastLat: null,
    lastLng: null,
  });

  const [activeTab, setActiveTab] = useState('overview');
  const [bookingRows, setBookingRows] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [workerProfile, setWorkerProfile] = useState(authState?.profile || {});
  const [availability, setAvailability] = useState(Boolean(authState?.profile?.isAvailable ?? true));
  const [profileForm, setProfileForm] = useState({
    hourlyRate: authState?.profile?.hourlyRate || 0,
    experienceYears: authState?.profile?.experienceYears || 0,
    serviceRadiusKm: authState?.profile?.serviceRadiusKm || 8,
    bio:
      authState?.profile?.bio ||
      'I deliver high-quality home services with transparent pricing, quick response, and attention to detail.',
    workTypes: Array.isArray(authState?.profile?.workTypes)
      ? authState.profile.workTypes.join(', ')
      : 'Home Cleaning, AC Service, Plumbing',
  });

  const [currentPosition, setCurrentPosition] = useState({ lat: 12.9716, lng: 77.5946 });
  const [navigationActive, setNavigationActive] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [routePath, setRoutePath] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [mapViewMode, setMapViewMode] = useState('follow');
  const [liveDistanceMeters, setLiveDistanceMeters] = useState(0);
  const routeSyncRef = useRef({
    lastFromLat: null,
    lastFromLng: null,
    lastToLat: null,
    lastToLng: null,
    lastFetchedAt: 0,
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
    if (!isAuthorized) {
      return;
    }

    refreshBookings(true);
    const poll = setInterval(() => refreshBookings(false), 20000);
    return () => clearInterval(poll);
  }, [workerId, isAuthorized]);

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

  const activeBooking = useMemo(() => scheduleBookings[0] || null, [scheduleBookings]);
  const activeBookingDestination = useMemo(() => {
    if (!activeBooking) {
      return null;
    }

    return activeBooking.deliveryAddress || activeBooking.address || activeBooking.serviceAddress || null;
  }, [activeBooking]);

  useEffect(() => {
    if (!activeBookingDestination) {
      setDestinationCoords(null);
      setRoutePath([]);
      setLiveDistanceMeters(0);
      setRouteLoading(false);
      return;
    }

    let isMounted = true;

    const resolveDestination = async () => {
      setRouteLoading(true);
      const stored = activeBooking?.liveTracking?.destinationLocation;
      if (isValidCoordinate(Number(stored?.lat), Number(stored?.lng))) {
        const storedDestination = {
          lat: Number(stored.lat),
          lng: Number(stored.lng),
        };
        setDestinationCoords(storedDestination);
        setLiveDistanceMeters(getHaversineDistanceMeters(currentPosition, storedDestination));
        setRouteLoading(false);
        return;
      }

      const geocoded = await geocodeAddress(activeBookingDestination).catch(() => null);
      const fallback = createAddressCoordinates(activeBookingDestination);

      if (!isMounted) {
        return;
      }

      const nextDestination = geocoded || fallback;
      setDestinationCoords(nextDestination);
      setLiveDistanceMeters(getHaversineDistanceMeters(currentPosition, nextDestination));
      setRouteLoading(false);
    };

    resolveDestination();

    return () => {
      isMounted = false;
    };
  }, [activeBooking, activeBookingDestination]);

  useEffect(() => {
    let cancelled = false;

    const loadRoute = async () => {
      if (!destinationCoords) {
        setRoutePath([]);
        setLiveDistanceMeters(0);
        return;
      }

      const now = Date.now();
      const previous = routeSyncRef.current;
      const hasSameRouteTarget =
        previous.lastToLat === destinationCoords.lat &&
        previous.lastToLng === destinationCoords.lng;
      const movedDistanceMeters =
        Number.isFinite(previous.lastFromLat) && Number.isFinite(previous.lastFromLng)
          ? getHaversineDistanceMeters(
              { lat: previous.lastFromLat, lng: previous.lastFromLng },
              currentPosition,
            )
          : Number.MAX_SAFE_INTEGER;
      const shouldRefetchRoute =
        !hasSameRouteTarget ||
        now - previous.lastFetchedAt > 15000 ||
        movedDistanceMeters >= 30;

      if (!shouldRefetchRoute && routePath.length > 1) {
        setLiveDistanceMeters(getHaversineDistanceMeters(currentPosition, destinationCoords));
        return;
      }

      const routedPath = await fetchOsrmRoute(currentPosition, destinationCoords).catch(() => null);
      if (cancelled) {
        return;
      }

      routeSyncRef.current = {
        lastFromLat: currentPosition.lat,
        lastFromLng: currentPosition.lng,
        lastToLat: destinationCoords.lat,
        lastToLng: destinationCoords.lng,
        lastFetchedAt: now,
      };

      if (routedPath && routedPath.length > 1) {
        setRoutePath(routedPath);
      } else {
        setRoutePath([currentPosition, destinationCoords]);
      }

      setLiveDistanceMeters(getHaversineDistanceMeters(currentPosition, destinationCoords));
    };

    loadRoute();

    return () => {
      cancelled = true;
    };
  }, [currentPosition, destinationCoords]);

  useEffect(() => {
    if (!navigationActive || !workerId || !activeBooking?._id || !destinationCoords) {
      return;
    }

    const now = Date.now();
    const previous = locationSyncRef.current;
    const previousPoint =
      Number.isFinite(previous.lastLat) && Number.isFinite(previous.lastLng)
        ? { lat: previous.lastLat, lng: previous.lastLng }
        : null;
    const movedDistanceMeters = previousPoint ? getHaversineDistanceMeters(previousPoint, currentPosition) : Number.MAX_SAFE_INTEGER;
    const shouldSync =
      previous.orderId !== activeBooking._id ||
      now - previous.lastSyncAt >= 8000 ||
      movedDistanceMeters >= 25;

    if (!shouldSync) {
      return;
    }

    locationSyncRef.current = {
      orderId: activeBooking._id,
      lastSyncAt: now,
      lastLat: currentPosition.lat,
      lastLng: currentPosition.lng,
    };

    updateWorkerOrderLocation(activeBooking._id, {
      workerId,
      lat: currentPosition.lat,
      lng: currentPosition.lng,
      destinationLat: destinationCoords.lat,
      destinationLng: destinationCoords.lng,
    }).catch((error) => {
      console.error('Failed to sync worker live location:', error);
    });
  }, [navigationActive, workerId, activeBooking, currentPosition, destinationCoords]);

  useEffect(() => {
    return () => {
      if (gpsWatchRef.current !== null && navigator.geolocation?.clearWatch) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || routePath.length < 2) {
      return;
    }

    if (mapViewMode === 'overview') {
      mapRef.current.fitBounds(routePath, { padding: [40, 40] });
    }
  }, [mapViewMode, routePath]);

  const handleLogout = () => {
    if (gpsWatchRef.current !== null && navigator.geolocation?.clearWatch) {
      navigator.geolocation.clearWatch(gpsWatchRef.current);
    }
    clearWorkforceAuth('worker');
    navigate('/work/login');
  };

  const handleStartGPS = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported on this device');
      return;
    }

    setLocationError(null);
    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        setLocationError(`GPS Error: ${error.message}`);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
    setNavigationActive(true);
  };

  const handleStopGPS = () => {
    if (gpsWatchRef.current !== null && navigator.geolocation?.clearWatch) {
      navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
    }
    setNavigationActive(false);
  };

  const handleOpenGoogleMaps = () => {
    if (!activeBookingDestination || !destinationCoords) {
      return;
    }

    const fullAddress = [
      activeBookingDestination.addressLine1,
      activeBookingDestination.addressLine2,
      activeBookingDestination.city,
      activeBookingDestination.state,
      activeBookingDestination.pincode,
    ]
      .filter(Boolean)
      .join(', ');

    const destination = `${destinationCoords.lat},${destinationCoords.lng}`;
    const query = fullAddress ? encodeURIComponent(fullAddress) : destination;
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${currentPosition.lat},${currentPosition.lng}&destination=${destination}&travelmode=driving`, '_blank', 'noopener,noreferrer');
  };

  const updateWorkforceLocalProfile = (nextProfile) => {
    const nextAuth = { ...authState, profile: nextProfile };
    setWorkforceAuth('worker', nextAuth);
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

  if (!isAuthorized) {
    return <Navigate to="/work/login" replace />;
  }

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

  const renderNavigation = () => {
    const hasActiveBooking = Boolean(activeBooking);
    const canShowTracking = hasActiveBooking && ['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'].includes(activeBooking?.orderStatus);

    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">Expert Location Map</p>
              {!hasActiveBooking ? (
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">No Active Booking</span>
              ) : activeBooking?.orderStatus === 'DELIVERED' ? (
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Completed</span>
              ) : activeBooking?.orderStatus === 'CANCELLED' ? (
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">Cancelled</span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {canShowTracking ? (
                <>
                  {!navigationActive ? (
                    <button
                      type="button"
                      onClick={handleStartGPS}
                      className="text-xs rounded-md bg-emerald-600 px-2 py-1 font-semibold text-white hover:bg-emerald-700"
                    >
                      Start GPS
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStopGPS}
                      className="text-xs rounded-md bg-rose-600 px-2 py-1 font-semibold text-white hover:bg-rose-700"
                    >
                      Stop GPS
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setMapViewMode('follow')}
                    className={`text-xs rounded-md px-2 py-1 font-semibold ${mapViewMode === 'follow' ? 'bg-sky-600 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    Follow Bike
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMapViewMode('overview');
                      if (routePath.length >= 2 && mapRef.current) {
                        mapRef.current.fitBounds(routePath, { padding: [40, 40] });
                      }
                    }}
                    className={`text-xs rounded-md px-2 py-1 font-semibold ${mapViewMode === 'overview' ? 'bg-sky-600 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    Route Overview
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={handleOpenGoogleMaps}
                disabled={!hasActiveBooking || !activeBookingDestination}
                className={`text-xs rounded-md px-2 py-1 font-semibold ${
                  !hasActiveBooking || !activeBookingDestination
                    ? 'border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Open in Google Maps
              </button>
            </div>
          </div>

          {locationError && navigationActive ? (
            <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {locationError}
            </div>
          ) : null}

          <div className="h-[280px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50 relative">
            {!hasActiveBooking ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-600">No active service booking</p>
                  <p className="text-xs text-slate-500 mt-1">Bookings will appear in your schedule</p>
                </div>
              </div>
            ) : null}
            <MapContainer
              key={activeBooking?._id || 'worker-map-empty'}
              ref={mapRef}
              center={destinationCoords ? [destinationCoords.lat, destinationCoords.lng] : [currentPosition.lat, currentPosition.lng]}
              zoom={13}
              scrollWheelZoom
              className="h-full w-full"
              zoomControl={hasActiveBooking}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <ScaleControl position="bottomleft" />

              {navigationActive && canShowTracking ? (
                <FollowWorker enabled={navigationActive && mapViewMode === 'follow'} position={currentPosition} />
              ) : null}

              {canShowTracking && destinationCoords ? (
                <Marker position={[destinationCoords.lat, destinationCoords.lng]} icon={destinationIcon}>
                  <Popup>Service Address</Popup>
                </Marker>
              ) : null}

              {navigationActive && canShowTracking ? (
                <>
                  <Marker position={[currentPosition.lat, currentPosition.lng]} icon={workerIcon}>
                    <Popup>Your Location (live)</Popup>
                  </Marker>
                  {routePath.length > 0 ? (
                    <Polyline positions={routePath} pathOptions={{ color: '#0ea5e9', weight: 5, opacity: 0.8 }} />
                  ) : null}
                </>
              ) : null}
            </MapContainer>
          </div>

          {canShowTracking ? (
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center">Your Location</div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center">Service Address</div>
            </div>
          ) : null}
        </div>

        {activeBooking ? (
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-bold text-slate-800 mb-3">Active Service Booking</p>
            <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{activeBooking.serviceBooking?.serviceName || 'Service'}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    📍 {activeBooking.deliveryAddress?.city || activeBooking.address?.city || 'Location pending'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(activeBooking.serviceBooking?.scheduledFor || activeBooking.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  activeBooking.orderStatus === 'DELIVERED' ? 'bg-emerald-100 text-emerald-800' :
                  activeBooking.orderStatus === 'CANCELLED' ? 'bg-rose-100 text-rose-800' :
                  'bg-cyan-100 text-cyan-800'
                }`}>
                  {activeBooking.orderStatus}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">💡 Tip</p>
          <p className="text-sm text-blue-900 mt-1">Enable GPS tracking to help customers track your arrival in real-time.</p>
        </div>
      </div>
    );
  };

  const renderProfileStudio = () => (
    <form onSubmit={handleProfileSave} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Profile Studio</h3>
          <p className="text-sm text-slate-500 mt-1">Optimize your profile for better booking conversion.</p>
        </div>
        <Link
          to="/work/worker-profile"
          className="px-4 py-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-sm font-semibold whitespace-nowrap"
        >
          Full Editor
        </Link>
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
                {activeTab === 'map' ? renderNavigation() : null}
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
