import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  assignOrderToDeliveryPerson,
  fetchDeliveryOrders,
  updateDeliveryOrderStatus,
} from '../../services/api';

const getAuthState = () => {
  try {
    return JSON.parse(localStorage.getItem('workforceAuth') || 'null');
  } catch {
    return null;
  }
};

const DELIVERY_FLOW = ['PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'];
const ACTIVE_DELIVERY_STATUSES = ['PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'];

const getStatusBadgeClass = (status) => {
  if (status === 'OUT_FOR_DELIVERY') return 'bg-sky-100 text-sky-800 border-sky-200';
  if (status === 'DELIVERED') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'CANCELLED') return 'bg-rose-100 text-rose-700 border-rose-200';
  if (status === 'PREPARING') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
};

const iconShadow =
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png';

const courierIcon = new L.Icon({
  iconUrl: 'https://img.icons8.com/color/96/motorcycle.png',
  shadowUrl: iconShadow,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  popupAnchor: [0, -18],
  shadowSize: [41, 41],
});

const customerIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/535/535188.png',
  shadowUrl: iconShadow,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -24],
  shadowSize: [41, 41],
});

const hashCode = (value) =>
  String(value || '')
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

const createAddressCoordinates = (address = {}) => {
  const seed = `${address.pincode || ''}-${address.city || ''}-${address.addressLine1 || ''}`;
  const hash = hashCode(seed) || 1;
  const lat = 12.9 + (hash % 1700) / 1000;
  const lng = 77.2 + ((hash * 7) % 1900) / 1000;
  return { lat, lng };
};

const formatDistance = (meters) => {
  if (!meters) return 'NA';
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
};

const formatDuration = (seconds) => {
  if (!seconds) return 'NA';
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
};

const buildStepInstruction = (step) => {
  if (!step?.maneuver) {
    return 'Continue on the route';
  }

  const type = step.maneuver.type || 'continue';
  const modifier = step.maneuver.modifier || '';
  const street = step.name ? ` on ${step.name}` : '';

  if (type === 'arrive') {
    return 'You have arrived at the destination';
  }

  if (modifier === 'left') {
    return `Turn left${street}`;
  }

  if (modifier === 'right') {
    return `Turn right${street}`;
  }

  if (modifier === 'slight left') {
    return `Keep slight left${street}`;
  }

  if (modifier === 'slight right') {
    return `Keep slight right${street}`;
  }

  if (modifier === 'straight') {
    return `Go straight${street}`;
  }

  if (modifier === 'uturn') {
    return `Take a U-turn${street}`;
  }

  if (type === 'roundabout') {
    return `Enter roundabout${street}`;
  }

  return `Continue${street}`;
};

const toRadians = (value) => (value * Math.PI) / 180;

const getHaversineDistanceMeters = (from, to) => {
  if (!from || !to) {
    return 0;
  }

  const earthRadius = 6371000;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

const geocodeAddress = async (address) => {
  const query = [address?.addressLine1, address?.city, address?.state, address?.pincode, 'India']
    .filter(Boolean)
    .join(', ');

  if (!query) {
    return null;
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
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

const fetchOsrmRoute = async (from, to) => {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch route');
  }

  const payload = await response.json();
  const route = payload?.routes?.[0];
  if (!route?.geometry?.coordinates) {
    throw new Error('No route geometry available');
  }

  const path = route.geometry.coordinates.map((coord) => [coord[1], coord[0]]);
  const steps = (route.legs || [])
    .flatMap((leg) => leg.steps || [])
    .map((step) => ({
      ...step,
      instruction: buildStepInstruction(step),
      location: {
        lat: Number(step?.maneuver?.location?.[1] || 0),
        lng: Number(step?.maneuver?.location?.[0] || 0),
      },
    }));

  return {
    path,
    distance: route.distance,
    duration: route.duration,
    steps,
  };
};

function FollowCourier({ enabled, position }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    map.setView([position.lat, position.lng], Math.max(map.getZoom(), 17), {
      animate: true,
      duration: 0.8,
    });
  }, [enabled, map, position]);

  return null;
}

function DeliveryDashboard() {
  const navigate = useNavigate();
  const authState = getAuthState();
  const mapRef = useRef(null);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [currentPosition, setCurrentPosition] = useState({ lat: 12.9716, lng: 77.5946 });
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [routePath, setRoutePath] = useState([]);
  const [routeMeta, setRouteMeta] = useState({ distance: 0, duration: 0 });
  const [routeLoading, setRouteLoading] = useState(false);
  const [activeNavigationOrderId, setActiveNavigationOrderId] = useState('');
  const [liveDistanceMeters, setLiveDistanceMeters] = useState(0);
  const [lastGpsUpdateAt, setLastGpsUpdateAt] = useState(null);
  const [routeSteps, setRouteSteps] = useState([]);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [mapViewMode, setMapViewMode] = useState('follow');
  const [mapLayerMode, setMapLayerMode] = useState('standard');
  const [riderSpeedKmph, setRiderSpeedKmph] = useState(0);
  const [riderHeading, setRiderHeading] = useState(null);

  const previousOrderIdsRef = useRef(new Set());
  const watchIdRef = useRef(null);

  if (!authState || authState.role !== 'delivery') {
    return <Navigate to="/work/login" replace />;
  }

  const { profile } = authState;
  const deliveryPersonId = profile?._id;

  const requestNotificationPermission = async () => {
    if (!('Notification' in window) || Notification.permission !== 'default') {
      return;
    }

    try {
      await Notification.requestPermission();
    } catch {
      // Intentionally no-op when browser blocks notification prompt.
    }
  };

  const notifyForNewOrders = (incomingOrders) => {
    const currentIds = new Set(incomingOrders.map((order) => order._id));
    const previousIds = previousOrderIdsRef.current;

    const newlyAdded = incomingOrders.filter((order) => !previousIds.has(order._id));
    newlyAdded.forEach((order) => {
      const customerName = order?.deliveryAddress?.fullName || 'Customer';
      toast.info(`New order from ${customerName} is waiting for pickup.`);

      if ('Notification' in window && Notification.permission === 'granted') {
        const title = 'New Delivery Order';
        const body = `${customerName} placed a new order. Tap to open dashboard.`;
        const notification = new Notification(title, { body });
        notification.onclick = () => {
          window.focus();
        };
      }
    });

    previousOrderIdsRef.current = currentIds;
  };

  const loadOrders = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }

    setError('');
    try {
      const response = await fetchDeliveryOrders(deliveryPersonId);
      const incomingOrders = Array.isArray(response) ? response : [];
      setOrders(incomingOrders);

      if (incomingOrders.length > 0 && !selectedOrderId) {
        setSelectedOrderId(incomingOrders[0]._id);
      }

      notifyForNewOrders(incomingOrders);
    } catch (apiError) {
      setError(apiError.message || 'Unable to fetch orders right now.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    requestNotificationPermission();
    loadOrders();

    const pollingInterval = window.setInterval(() => {
      loadOrders({ silent: true });
    }, 12000);

    return () => {
      window.clearInterval(pollingInterval);
    };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('GPS is not supported in this browser.');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setRiderSpeedKmph(Number(position.coords.speed || 0) * 3.6);
        setRiderHeading(position.coords.heading ?? null);
        setLastGpsUpdateAt(new Date());
        setLocationError('');
      },
      () => {
        setLocationError('Location permission denied. Showing default city map.');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const myOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          !order.deliveryPersonId ||
          String(order.deliveryPersonId) === String(deliveryPersonId),
      ),
    [orders, deliveryPersonId],
  );

  const selectedOrder = useMemo(
    () => myOrders.find((order) => order._id === selectedOrderId) || myOrders[0] || null,
    [myOrders, selectedOrderId],
  );

  const selectedOrderAssignedToMe =
    !!selectedOrder && String(selectedOrder.deliveryPersonId) === String(deliveryPersonId);

  const navigationActive =
    !!selectedOrder && selectedOrderAssignedToMe && selectedOrder._id === activeNavigationOrderId;

  const preferredDistanceMeters = useMemo(() => {
    if (!navigationActive) {
      return 0;
    }

    // Keep both cards consistent: prefer routed distance, fallback to GPS straight-line.
    return routeMeta.distance > 0 ? routeMeta.distance : liveDistanceMeters;
  }, [navigationActive, routeMeta.distance, liveDistanceMeters]);

  useEffect(() => {
    let isMounted = true;

    const resolveDestination = async () => {
      if (!selectedOrder?.deliveryAddress) {
        setDestinationCoords(null);
        return;
      }

      const geocoded = await geocodeAddress(selectedOrder.deliveryAddress).catch(() => null);
      const fallback = createAddressCoordinates(selectedOrder.deliveryAddress);

      if (isMounted) {
        setDestinationCoords(geocoded || fallback);
      }
    };

    resolveDestination();

    return () => {
      isMounted = false;
    };
  }, [selectedOrder]);

  useEffect(() => {
    let cancelled = false;

    const loadRoute = async () => {
      if (!navigationActive || !destinationCoords) {
        setRoutePath([]);
        setRouteMeta({ distance: 0, duration: 0 });
        return;
      }

      setRouteLoading(true);
      try {
        const route = await fetchOsrmRoute(currentPosition, destinationCoords);
        if (!cancelled) {
          setRoutePath(route.path);
          setRouteMeta({ distance: route.distance, duration: route.duration });
          setRouteSteps(route.steps || []);
          setActiveStepIndex(0);
        }
      } catch {
        if (!cancelled) {
          setRoutePath([]);
          const fallbackDistance = getHaversineDistanceMeters(currentPosition, destinationCoords);
          // Approximate ETA fallback at ~28 km/h average city speed.
          const fallbackDuration = fallbackDistance > 0 ? fallbackDistance / 7.8 : 0;
          setRouteMeta({ distance: fallbackDistance, duration: fallbackDuration });
          setRouteSteps([]);
          setActiveStepIndex(0);
        }
      } finally {
        if (!cancelled) {
          setRouteLoading(false);
        }
      }
    };

    loadRoute();

    return () => {
      cancelled = true;
    };
  }, [currentPosition, destinationCoords, navigationActive]);

  useEffect(() => {
    if (!navigationActive || mapViewMode !== 'overview') {
      return;
    }

    if (!mapRef.current || routePath.length < 2) {
      return;
    }

    mapRef.current.fitBounds(routePath, { padding: [40, 40] });
  }, [navigationActive, mapViewMode, routePath]);

  useEffect(() => {
    if (!navigationActive || !destinationCoords) {
      setLiveDistanceMeters(0);
      return;
    }

    const liveDistance = getHaversineDistanceMeters(currentPosition, destinationCoords);
    setLiveDistanceMeters(liveDistance);
  }, [currentPosition, destinationCoords, navigationActive]);

  useEffect(() => {
    if (!navigationActive || routeSteps.length === 0) {
      setActiveStepIndex(0);
      return;
    }

    let bestIndex = activeStepIndex;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let index = activeStepIndex; index < routeSteps.length; index += 1) {
      const stepLocation = routeSteps[index]?.location;
      if (!stepLocation?.lat || !stepLocation?.lng) {
        continue;
      }

      const distance = getHaversineDistanceMeters(currentPosition, stepLocation);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }

      if (distance < 35) {
        break;
      }
    }

    if (bestIndex !== activeStepIndex) {
      setActiveStepIndex(bestIndex);
    }
  }, [currentPosition, navigationActive, routeSteps, activeStepIndex]);

  const acceptedCount = myOrders.filter(
    (order) => String(order.deliveryPersonId) === String(deliveryPersonId),
  ).length;

  const outForDeliveryCount = myOrders.filter(
    (order) => order.orderStatus === 'OUT_FOR_DELIVERY' && String(order.deliveryPersonId) === String(deliveryPersonId),
  ).length;

  const activeAssignedDelivery = myOrders.find(
    (order) =>
      String(order.deliveryPersonId) === String(deliveryPersonId) &&
      ACTIVE_DELIVERY_STATUSES.includes(order.orderStatus),
  );
  const hasActiveAssignedDelivery = Boolean(activeAssignedDelivery);

  const handleLogout = () => {
    localStorage.removeItem('workforceAuth');
    navigate('/work/login');
  };

  const handleAcceptOrder = async (orderId) => {
    try {
      await assignOrderToDeliveryPerson(orderId, deliveryPersonId);
      toast.success('Order accepted and moved to out-for-delivery.');
      setSelectedOrderId(orderId);
      await loadOrders({ silent: true });
    } catch (apiError) {
      toast.error(apiError.message || 'Failed to accept this order.');
    }
  };

  const handleStatusChange = async (orderId, nextStatus) => {
    try {
      await updateDeliveryOrderStatus(orderId, nextStatus, deliveryPersonId);
      toast.success(`Order moved to ${nextStatus.replaceAll('_', ' ')}.`);
      await loadOrders({ silent: true });
    } catch (apiError) {
      toast.error(apiError.message || 'Failed to update order status.');
    }
  };

  const openNavigation = () => {
    if (!selectedOrderAssignedToMe) {
      toast.info('Accept this order first to start Google Maps navigation.');
      return;
    }

    const fallback = createAddressCoordinates(selectedOrder?.deliveryAddress);
    const destinationPosition = destinationCoords || fallback;
    const destination = `${destinationPosition.lat},${destinationPosition.lng}`;
    const origin = `${currentPosition.lat},${currentPosition.lng}`;
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
  };

  const startInAppNavigation = () => {
    if (!selectedOrderAssignedToMe) {
      toast.info('Accept this order first to start in-app GPS navigation.');
      return;
    }

    if (!selectedOrder?._id) {
      return;
    }

    setActiveNavigationOrderId(selectedOrder._id);
    toast.success('In-app GPS started. Bike icon will move live with rider location.');
  };

  const stopInAppNavigation = () => {
    setActiveNavigationOrderId('');
    setRoutePath([]);
    setRouteMeta({ distance: 0, duration: 0 });
    setRouteSteps([]);
    setActiveStepIndex(0);
    setMapViewMode('follow');
  };

  const centerOnRider = () => {
    if (!mapRef.current) {
      return;
    }

    mapRef.current.setView([currentPosition.lat, currentPosition.lng], 17, {
      animate: true,
      duration: 0.8,
    });
  };

  const fitRouteOverview = () => {
    if (!mapRef.current || routePath.length < 2) {
      toast.info('Route is not ready yet. Start navigation first.');
      return;
    }

    mapRef.current.fitBounds(routePath, { padding: [40, 40] });
  };

  const activeStep = navigationActive && routeSteps.length > 0 ? routeSteps[activeStepIndex] : null;
  const activeStepDistance = activeStep?.location
    ? getHaversineDistanceMeters(currentPosition, activeStep.location)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-cyan-50 pt-24 pb-10 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <section className="rounded-3xl border border-amber-100 bg-white/90 shadow-lg p-6 md:p-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-amber-700 font-bold">HomeExpert Rider Hub</p>
              <h1 className="text-2xl md:text-4xl font-black text-gray-900 mt-1">
                Delivery dashboard for {profile?.firstName || 'Partner'}
              </h1>
              <p className="text-gray-600 mt-2">
                New customer orders appear here automatically. Accept, navigate, and mark delivered from one screen.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-full lg:min-w-[420px]">
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                <p className="text-xs text-gray-500">Incoming</p>
                <p className="text-xl font-bold text-gray-900">{myOrders.length}</p>
              </div>
              <div className="rounded-xl border border-sky-100 bg-sky-50 p-3">
                <p className="text-xs text-gray-500">Accepted</p>
                <p className="text-xl font-bold text-gray-900">{acceptedCount}</p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                <p className="text-xs text-gray-500">On Trip</p>
                <p className="text-xl font-bold text-gray-900">{outForDeliveryCount}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Mobile</p>
                <p className="text-sm font-semibold text-gray-900">{profile?.mobileNumber || 'NA'}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1 rounded-3xl border border-gray-200 bg-white shadow-md p-5 space-y-4 max-h-[76vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Live Order Queue</h2>
              <button
                type="button"
                onClick={() => loadOrders({ silent: true })}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold hover:bg-gray-50"
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {error ? <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-rose-700 text-sm">{error}</div> : null}
            {loading ? <div className="text-sm text-gray-500">Loading delivery orders...</div> : null}
            {!loading && myOrders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                No active orders right now. New orders will auto-appear here.
              </div>
            ) : null}

            <div className="space-y-3">
              {myOrders.map((order) => {
                const address = order.deliveryAddress || {};
                const itemCount = Array.isArray(order.orderItems) ? order.orderItems.length : 0;
                const isAssignedToMe = String(order.deliveryPersonId) === String(deliveryPersonId);
                const isActive = selectedOrder?._id === order._id;
                const canAccept = !hasActiveAssignedDelivery || isAssignedToMe;

                return (
                  <div
                    key={order._id}
                    onClick={() => setSelectedOrderId(order._id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        setSelectedOrderId(order._id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className={`w-full text-left rounded-2xl border p-4 transition cursor-pointer ${
                      isActive ? 'border-amber-300 bg-amber-50/70' : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-gray-800 text-sm">Order #{order._id.slice(-6).toUpperCase()}</p>
                      <span className={`text-[11px] border px-2 py-0.5 rounded-full font-semibold ${getStatusBadgeClass(order.orderStatus)}`}>
                        {(order.orderStatus || 'PLACED').replaceAll('_', ' ')}
                      </span>
                    </div>

                    <p className="text-sm text-gray-700 mt-2">{address.fullName || 'Customer'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {address.city || 'City'}, {address.state || 'State'} - {address.pincode || 'NA'}
                    </p>
                    <p className="text-xs text-gray-600 mt-2">
                      {itemCount} items • Rs {Number(order.totalAmount || 0).toFixed(2)}
                    </p>

                    {!isAssignedToMe ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleAcceptOrder(order._id);
                        }}
                        disabled={!canAccept}
                        className="mt-3 w-full rounded-lg bg-amber-500 text-white text-sm py-2 font-semibold hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-amber-300"
                      >
                        {canAccept ? 'Accept Delivery' : 'Complete current delivery first'}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="xl:col-span-2 rounded-3xl border border-gray-200 bg-white shadow-md p-5">
            {!selectedOrder ? (
              <div className="h-full min-h-[420px] flex items-center justify-center text-gray-500">
                Select an order to view route and controls.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black text-gray-900">Route & Delivery Control</h3>
                    <p className="text-sm text-gray-600">
                      {selectedOrder.deliveryAddress?.fullName || 'Customer'} • {selectedOrder.deliveryAddress?.mobileNumber || 'No phone'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={startInAppNavigation}
                      className="rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-semibold hover:bg-sky-700"
                    >
                      Start In-App GPS
                    </button>
                    <button
                      type="button"
                      onClick={openNavigation}
                      className="rounded-lg bg-cyan-700 text-white px-4 py-2 text-sm font-semibold hover:bg-cyan-800"
                    >
                      Open in Google Maps
                    </button>
                    {navigationActive ? (
                      <button
                        type="button"
                        onClick={stopInAppNavigation}
                        className="rounded-lg border border-gray-300 bg-white text-gray-700 px-4 py-2 text-sm font-semibold hover:bg-gray-50"
                      >
                        Stop Navigation
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleStatusChange(selectedOrder._id, 'DELIVERED')}
                      className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-700"
                    >
                      Mark Delivered
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                    <p className="text-xs text-gray-500">Address</p>
                    <p className="text-sm font-semibold text-gray-800 mt-1">
                      {selectedOrder.deliveryAddress?.addressLine1 || 'Address not available'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                    <p className="text-xs text-gray-500">Order Value</p>
                    <p className="text-sm font-semibold text-gray-800 mt-1">Rs {Number(selectedOrder.totalAmount || 0).toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                    <p className="text-xs text-gray-500">Current Status</p>
                    <p className="text-sm font-semibold text-gray-800 mt-1">
                      {(selectedOrder.orderStatus || 'PLACED').replaceAll('_', ' ')}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                    <p className="text-xs text-gray-500">ETA (OSRM)</p>
                    <p className="text-sm font-semibold text-gray-800 mt-1">
                      {!selectedOrderAssignedToMe
                        ? 'Accept order first'
                        : !navigationActive
                          ? 'Start GPS'
                          : routeLoading
                            ? 'Calculating...'
                            : formatDuration(routeMeta.duration)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                    <p className="text-xs text-gray-500">Distance</p>
                    <p className="text-sm font-semibold text-gray-800 mt-1">
                      {!selectedOrderAssignedToMe
                        ? 'Accept order first'
                        : !navigationActive
                          ? 'Start GPS'
                          : formatDistance(preferredDistanceMeters)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                    <p className="text-xs text-gray-500">Live Distance</p>
                    <p className="text-sm font-semibold text-gray-800 mt-1">
                      {!selectedOrderAssignedToMe
                        ? 'Accept order first'
                        : !navigationActive
                          ? 'Start GPS'
                          : formatDistance(preferredDistanceMeters)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                    <p className="text-xs text-gray-500">Last GPS Ping</p>
                    <p className="text-sm font-semibold text-gray-800 mt-1">
                      {lastGpsUpdateAt ? lastGpsUpdateAt.toLocaleTimeString() : 'Waiting for GPS'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                    <p className="text-xs text-gray-500">Speed</p>
                    <p className="text-sm font-semibold text-gray-800 mt-1">
                      {navigationActive ? `${Math.max(0, riderSpeedKmph).toFixed(1)} km/h` : 'Start GPS'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                    <p className="text-xs text-gray-500">Heading</p>
                    <p className="text-sm font-semibold text-gray-800 mt-1">
                      {navigationActive && riderHeading !== null ? `${Math.round(riderHeading)}°` : 'Start GPS'}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl overflow-hidden border border-gray-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setMapViewMode('follow')}
                        className={`rounded-md px-3 py-1 text-xs font-semibold ${mapViewMode === 'follow' ? 'bg-sky-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}
                      >
                        Follow Bike
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMapViewMode('overview');
                          fitRouteOverview();
                        }}
                        className={`rounded-md px-3 py-1 text-xs font-semibold ${mapViewMode === 'overview' ? 'bg-sky-600 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}
                      >
                        Route Overview
                      </button>
                      <button
                        type="button"
                        onClick={centerOnRider}
                        className="rounded-md px-3 py-1 text-xs font-semibold bg-white border border-gray-300 text-gray-700"
                      >
                        Recenter
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMapLayerMode((mode) => (mode === 'standard' ? 'terrain' : 'standard'))}
                      className="rounded-md px-3 py-1 text-xs font-semibold bg-white border border-gray-300 text-gray-700"
                    >
                      {mapLayerMode === 'standard' ? 'Terrain Layer' : 'Standard Layer'}
                    </button>
                  </div>

                  <MapContainer
                    ref={mapRef}
                    center={destinationCoords ? [destinationCoords.lat, destinationCoords.lng] : [currentPosition.lat, currentPosition.lng]}
                    zoom={13}
                    scrollWheelZoom
                    style={{ height: 360, width: '100%' }}
                  >
                    {mapLayerMode === 'standard' ? (
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                    ) : (
                      <TileLayer
                        attribution='Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap'
                        url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                      />
                    )}

                    {navigationActive ? (
                      <>
                        <FollowCourier enabled={navigationActive && mapViewMode === 'follow'} position={currentPosition} />
                        <Marker position={[currentPosition.lat, currentPosition.lng]} icon={courierIcon}>
                          <Popup>Bike live location (GPS)</Popup>
                        </Marker>
                      </>
                    ) : null}

                    <Marker
                      position={destinationCoords ? [destinationCoords.lat, destinationCoords.lng] : [currentPosition.lat, currentPosition.lng]}
                      icon={customerIcon}
                    >
                      <Popup>Customer Destination</Popup>
                    </Marker>

                    {navigationActive && routePath.length > 0 ? (
                      <Polyline positions={routePath} pathOptions={{ color: '#0ea5e9', weight: 5, opacity: 0.8 }} />
                    ) : null}
                  </MapContainer>
                </div>

                {!selectedOrderAssignedToMe ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Accept this order first. Navigation route appears only for accepted orders.
                  </p>
                ) : !navigationActive ? (
                  <p className="text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
                    Start In-App GPS to see moving bike tracking, or open Google Maps for turn-by-turn external navigation.
                  </p>
                ) : activeStep ? (
                  <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2">
                    <p className="text-xs font-semibold text-cyan-700 uppercase tracking-wide">Next Direction</p>
                    <p className="text-sm font-semibold text-cyan-900 mt-1">{activeStep.instruction}</p>
                    <p className="text-xs text-cyan-700 mt-1">In {formatDistance(activeStepDistance)}</p>
                  </div>
                ) : null}

                {locationError ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{locationError}</p>
                ) : null}

                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-sm font-bold text-gray-800 mb-3">Delivery Flow</p>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {DELIVERY_FLOW.map((status) => {
                      const currentIndex = DELIVERY_FLOW.indexOf(selectedOrder.orderStatus || 'PLACED');
                      const itemIndex = DELIVERY_FLOW.indexOf(status);
                      const isDone = itemIndex <= currentIndex;

                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => handleStatusChange(selectedOrder._id, status)}
                          className={`rounded-lg border px-2 py-2 text-xs font-semibold ${
                            isDone
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {status.replaceAll('_', ' ')}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link to="/" className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
            Home
          </Link>
          <Link to="/work/delivery-profile" className="px-4 py-2 rounded-lg border border-sky-200 text-sky-700 hover:bg-sky-50">
            View Profile
          </Link>
          <button onClick={handleLogout} className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800">
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeliveryDashboard;
