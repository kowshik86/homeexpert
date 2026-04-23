import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polyline, Popup, ScaleControl, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const TRACKING_STEPS = [
  { key: 'PLACED', label: 'Placed' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'PREPARING', label: 'Packing' },
  { key: 'OUT_FOR_DELIVERY', label: 'Partner Assigned' },
  { key: 'DELIVERED', label: 'Delivered' },
];

const FALLBACK_CENTER = { lat: 12.9716, lng: 77.5946 };
const iconShadow = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png';

const partnerIcon = new L.Icon({
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

const toLeafletCoord = (point) => [point.lat, point.lng];

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

const isValidCoordinate = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng);

const formatRelativeTime = (dateValue) => {
  if (!dateValue) {
    return 'just now';
  }

  const now = Date.now();
  const value = new Date(dateValue).getTime();
  if (Number.isNaN(value)) {
    return 'just now';
  }

  const diffSeconds = Math.max(0, Math.round((now - value) / 1000));
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  return `${diffHours}h ago`;
};

const formatEtaTime = (dateValue) => {
  return new Date(dateValue).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
};

function FitMapBounds({ points, enabled }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!Array.isArray(points) || points.length < 2) {
      return;
    }

    map.fitBounds(points.map((point) => [point.lat, point.lng]), { padding: [40, 40] });
  }, [enabled, map, points]);

  return null;
}

function FollowPartner({ enabled, position }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    map.setView([position.lat, position.lng], Math.max(map.getZoom(), 15), {
      animate: true,
      duration: 0.6,
    });
  }, [enabled, position, map]);

  return null;
}

const hashCode = (value) =>
  String(value || '')
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

const getAddressCoordinates = (address = {}) => {
  const seed = `${address.pincode || ''}-${address.city || ''}-${address.addressLine1 || ''}`;
  const hash = hashCode(seed) || 1;
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

const getStatusStepIndex = (status) => {
  const index = TRACKING_STEPS.findIndex((step) => step.key === status);
  return index >= 0 ? index : 0;
};

const formatStatus = (status) => {
  return (status || 'PLACED')
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const getLiveTrackingMessage = (status, assigneeName) => {
  if (status === 'DELIVERED') {
    return 'Order delivered successfully.';
  }

  if (status === 'CANCELLED') {
    return 'Order has been cancelled.';
  }

  if (status === 'OUT_FOR_DELIVERY') {
    return assigneeName
      ? `${assigneeName} is on the way to your location.`
      : 'Delivery partner has been assigned and is on the way.';
  }

  if (status === 'PREPARING') {
    return 'Your order is currently packing and almost ready to dispatch.';
  }

  if (status === 'CONFIRMED') {
    return 'Order is confirmed and queued for preparation.';
  }

  return 'Order has been placed and is waiting for confirmation.';
};

const getAssigneeDetails = (order, isServiceScope) => {
  const partner = isServiceScope ? order?.assignedWorkerId : order?.deliveryPersonId;
  const hasPerson = partner && typeof partner === 'object';

  if (!hasPerson) {
    return {
      label: isServiceScope ? 'Assigned Expert' : 'Delivery Partner',
      name: 'Not assigned yet',
      phone: '',
      initials: 'NA',
    };
  }

  const firstName = String(partner.firstName || '').trim();
  const lastName = String(partner.lastName || '').trim();
  const fullName = `${firstName} ${lastName}`.trim() || 'Assigned Partner';
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || firstName.charAt(0).toUpperCase() || 'AP';

  return {
    label: isServiceScope ? 'Assigned Expert' : 'Delivery Partner',
    name: fullName,
    phone: partner.mobileNumber || '',
    initials,
  };
};

const getPartnerMapPosition = ({ pickupPoint, destinationPoint, status, liveLocation }) => {
  if (liveLocation && isValidCoordinate(liveLocation.lat, liveLocation.lng)) {
    return {
      lat: Number(liveLocation.lat),
      lng: Number(liveLocation.lng),
    };
  }

  if (status === 'DELIVERED') {
    return destinationPoint;
  }

  if (status === 'OUT_FOR_DELIVERY') {
    return {
      lat: pickupPoint.lat + (destinationPoint.lat - pickupPoint.lat) * 0.62,
      lng: pickupPoint.lng + (destinationPoint.lng - pickupPoint.lng) * 0.62,
    };
  }

  return pickupPoint;
};

function OrderTrackingDetails({ order, isServiceScope, items, serviceName, formatMoney, formatOrderDate }) {
  const assignee = useMemo(() => getAssigneeDetails(order, isServiceScope), [order, isServiceScope]);
  const statusStepIndex = getStatusStepIndex(order?.orderStatus);
  const livePartnerLocation = order?.liveTracking?.deliveryPersonLocation;
  const [resolvedDestinationPoint, setResolvedDestinationPoint] = useState(() => {
    const stored = order?.liveTracking?.destinationLocation;
    if (isValidCoordinate(Number(stored?.lat), Number(stored?.lng))) {
      return {
        lat: Number(stored.lat),
        lng: Number(stored.lng),
      };
    }

    return order?.deliveryAddress ? getAddressCoordinates(order.deliveryAddress) : FALLBACK_CENTER;
  });
  const [routePath, setRoutePath] = useState([]);
  const [mapViewMode, setMapViewMode] = useState('follow');

  useEffect(() => {
    let isMounted = true;

    const resolveDestination = async () => {
      const stored = order?.liveTracking?.destinationLocation;
      if (isValidCoordinate(Number(stored?.lat), Number(stored?.lng))) {
        if (isMounted) {
          setResolvedDestinationPoint({
            lat: Number(stored.lat),
            lng: Number(stored.lng),
          });
        }
        return;
      }

      const geocoded = await geocodeAddress(order?.deliveryAddress).catch(() => null);
      const fallback = order?.deliveryAddress ? getAddressCoordinates(order.deliveryAddress) : FALLBACK_CENTER;

      if (isMounted) {
        setResolvedDestinationPoint(geocoded || fallback);
      }
    };

    resolveDestination();

    return () => {
      isMounted = false;
    };
  }, [order]);

  const destinationPoint = resolvedDestinationPoint;

  const pickupPoint = useMemo(() => {
    return {
      lat: destinationPoint.lat - 0.045,
      lng: destinationPoint.lng - 0.045,
    };
  }, [destinationPoint]);

  const partnerPoint = useMemo(() => {
    return getPartnerMapPosition({
      pickupPoint,
      destinationPoint,
      status: order?.orderStatus,
      liveLocation: livePartnerLocation,
    });
  }, [pickupPoint, destinationPoint, order?.orderStatus, livePartnerLocation]);

  const mapPoints = useMemo(() => [partnerPoint, destinationPoint], [partnerPoint, destinationPoint]);

  useEffect(() => {
    let cancelled = false;

    const loadRoute = async () => {
      const routedPath = await fetchOsrmRoute(partnerPoint, destinationPoint).catch(() => null);
      if (cancelled) {
        return;
      }

      if (routedPath && routedPath.length > 1) {
        setRoutePath(routedPath);
        return;
      }

      setRoutePath([partnerPoint, destinationPoint]);
    };

    loadRoute();

    return () => {
      cancelled = true;
    };
  }, [partnerPoint, destinationPoint]);

  const distanceMeters = useMemo(() => {
    if (order?.orderStatus === 'DELIVERED') {
      return 0;
    }

    return getHaversineDistanceMeters(partnerPoint, destinationPoint);
  }, [partnerPoint, destinationPoint, order?.orderStatus]);

  const etaMinutes = useMemo(() => {
    if (order?.orderStatus === 'DELIVERED' || order?.orderStatus === 'CANCELLED') {
      return 0;
    }

    if (!distanceMeters) {
      return 12;
    }

    // Approx. city speed of 26 km/h for delivery ETA.
    return Math.max(1, Math.round(distanceMeters / 430));
  }, [distanceMeters, order?.orderStatus]);

  const etaAt = useMemo(() => {
    const etaDate = new Date();
    etaDate.setMinutes(etaDate.getMinutes() + etaMinutes);
    return etaDate;
  }, [etaMinutes]);

  const expectedDeliveryTime = useMemo(() => {
    if (!order?.expectedDeliveryTime) {
      return null;
    }

    const value = new Date(order.expectedDeliveryTime);
    return Number.isNaN(value.getTime()) ? null : value;
  }, [order?.expectedDeliveryTime]);

  const delayMinutes = useMemo(() => {
    if (!expectedDeliveryTime || order?.orderStatus === 'DELIVERED') {
      return 0;
    }

    const diff = etaAt.getTime() - expectedDeliveryTime.getTime();
    return diff > 0 ? Math.round(diff / (1000 * 60)) : 0;
  }, [expectedDeliveryTime, etaAt, order?.orderStatus]);

  const etaToneMessage = useMemo(() => {
    if (order?.orderStatus === 'DELIVERED') {
      return 'Delivered successfully. Thank you for ordering with us.';
    }

    if (order?.orderStatus === 'CANCELLED') {
      return 'This order has been cancelled, so delivery timing is no longer tracked.';
    }

    if (delayMinutes > 0) {
      return `Thanks for your patience. ${assignee.name} is running about ${delayMinutes} min late and is still on the way.`;
    }

    return `Good news. Your order is expected around ${formatEtaTime(etaAt)}.`;
  }, [order?.orderStatus, delayMinutes, etaAt, assignee.name]);

  const liveMessage = getLiveTrackingMessage(order?.orderStatus, assignee.name !== 'Not assigned yet' ? assignee.name : '');
  const orderKind = isServiceScope ? 'Service Booking' : 'Grocery Order';
  const orderKindLabel = isServiceScope ? 'Service details' : 'Basket details';

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border p-4 ${isServiceScope ? 'border-violet-100 bg-gradient-to-r from-violet-50 via-white to-cyan-50' : 'border-cyan-100 bg-gradient-to-r from-cyan-50 via-white to-emerald-50'}`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className={`text-xs uppercase tracking-[0.16em] font-bold ${isServiceScope ? 'text-violet-700' : 'text-cyan-700'}`}>Live {orderKind} Tracking</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{liveMessage}</p>
          </div>
          <span className={`inline-flex w-fit rounded-full border bg-white px-3 py-1 text-xs font-semibold ${isServiceScope ? 'border-violet-200 text-violet-800' : 'border-cyan-200 text-cyan-800'}`}>
            {formatStatus(order?.orderStatus)}
          </span>
        </div>

        {order?.orderStatus === 'CANCELLED' ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            This order was cancelled and live tracking has stopped.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-5 gap-2">
            {TRACKING_STEPS.map((step, index) => {
              const done = index <= statusStepIndex;
              const active = index === statusStepIndex;
              return (
                <div key={step.key} className="text-center">
                  <div
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full border-2 text-[11px] font-bold ${done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white text-slate-400'} ${active ? 'ring-4 ring-emerald-100' : ''}`}
                  >
                    {index + 1}
                  </div>
                  <p className={`mt-1 text-[11px] font-medium ${done ? 'text-slate-800' : 'text-slate-400'}`}>{step.label}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Estimated Arrival</p>
          <p className="mt-1 text-base font-semibold text-slate-900">
            {order?.orderStatus === 'DELIVERED' ? 'Delivered' : formatEtaTime(etaAt)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Distance Remaining</p>
          <p className="mt-1 text-base font-semibold text-slate-900">
            {order?.orderStatus === 'DELIVERED' ? '0 m' : distanceMeters >= 1000 ? `${(distanceMeters / 1000).toFixed(1)} km` : `${Math.round(distanceMeters)} m`}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Traffic / Delay</p>
          <p className={`mt-1 text-base font-semibold ${delayMinutes > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {delayMinutes > 0 ? `${delayMinutes} min late` : 'On time'}
          </p>
        </div>
      </div>

      <div className={`rounded-xl border px-3 py-2 text-sm ${delayMinutes > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
        {etaToneMessage}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-3">
          <div className="rounded-xl bg-white border border-slate-200 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">{assignee.label}</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-900 text-white text-sm font-bold flex items-center justify-center">
                {assignee.initials}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{assignee.name}</p>
                <p className="text-xs text-slate-500">{assignee.phone || 'Contact will appear once assigned'}</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              {order?.liveTracking?.locationSyncedAt
                ? `Location synced ${formatRelativeTime(order.liveTracking.locationSyncedAt)} from partner GPS.`
                : 'Using latest available route estimate until GPS sync starts.'}
            </p>
          </div>

          <div className="rounded-xl bg-white border border-slate-200 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">{isServiceScope ? 'Service Address' : 'Delivery Address'}</p>
            <p className="text-sm text-slate-800 mt-1">
              {order.deliveryAddress?.fullName || 'N/A'} • {order.deliveryAddress?.mobileNumber || 'N/A'}
            </p>
            <p className="text-sm text-slate-700 mt-1">
              {order.deliveryAddress?.addressLine1 || ''}
              {order.deliveryAddress?.addressLine2 ? `, ${order.deliveryAddress.addressLine2}` : ''}
            </p>
            <p className="text-sm text-slate-700 mt-1">
              {order.deliveryAddress?.city || ''}, {order.deliveryAddress?.state || ''} - {order.deliveryAddress?.pincode || ''}
            </p>
          </div>

          {isServiceScope ? (
            <div className="rounded-xl bg-white border border-slate-200 p-3 text-sm text-slate-700 space-y-1">
              <p className="font-semibold text-slate-900">{serviceName}</p>
              <p>Package: {order?.serviceBooking?.packageName || 'Standard Package'}</p>
              {order?.serviceBooking?.scheduledFor ? <p>Scheduled: {formatOrderDate(order.serviceBooking.scheduledFor)}</p> : null}
              {order?.serviceBooking?.timeSlot ? <p>Slot: {order.serviceBooking.timeSlot}</p> : null}
              <p className="text-xs uppercase tracking-wide text-slate-500 pt-1">{orderKindLabel}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-xl bg-white border border-slate-200 p-3 text-sm text-slate-700 space-y-1">
                <p className="font-semibold text-slate-900">{items.length} items in basket</p>
                <p>Fresh groceries and essentials packed for delivery.</p>
                <p className="text-xs uppercase tracking-wide text-slate-500 pt-1">{orderKindLabel}</p>
              </div>
              <ul className="space-y-2">
              {items.map((item, index) => (
                <li key={`${order._id}-detail-${index}`} className="flex items-center justify-between rounded-xl bg-white border border-slate-200 px-3 py-2">
                  <span className="text-sm text-slate-700">{item.name} x{item.quantity}</span>
                  <span className="text-sm font-semibold text-slate-900">{formatMoney(item.totalPrice)}</span>
                </li>
              ))}
              </ul>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">{isServiceScope ? 'Expert Location Map' : 'Partner Location Map'}</p>
              {order?.orderStatus === 'DELIVERED' ? (
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Delivered</span>
              ) : order?.orderStatus === 'CANCELLED' ? (
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">Cancelled</span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMapViewMode('follow')}
                disabled={order?.orderStatus === 'PLACED' || order?.orderStatus === 'CANCELLED'}
                className={`text-xs rounded-md px-2 py-1 font-semibold ${
                  mapViewMode === 'follow'
                    ? 'bg-sky-600 text-white'
                    : order?.orderStatus === 'PLACED' || order?.orderStatus === 'CANCELLED'
                      ? 'border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                      : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Follow {isServiceScope ? 'Expert' : 'Bike'}
              </button>
              <button
                type="button"
                onClick={() => setMapViewMode('overview')}
                disabled={order?.orderStatus === 'PLACED' || order?.orderStatus === 'CANCELLED'}
                className={`text-xs rounded-md px-2 py-1 font-semibold ${
                  mapViewMode === 'overview'
                    ? 'bg-sky-600 text-white'
                    : order?.orderStatus === 'PLACED' || order?.orderStatus === 'CANCELLED'
                      ? 'border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                      : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Route Overview
              </button>
              <button
                type="button"
                onClick={() => {
                  const origin = `${partnerPoint.lat},${partnerPoint.lng}`;
                  const destination = `${destinationPoint.lat},${destinationPoint.lng}`;
                  const fullAddress = [
                    order?.deliveryAddress?.addressLine1,
                    order?.deliveryAddress?.addressLine2,
                    order?.deliveryAddress?.city,
                    order?.deliveryAddress?.state,
                    order?.deliveryAddress?.pincode,
                  ]
                    .filter(Boolean)
                    .join(', ');
                  const query = fullAddress ? `&query=${encodeURIComponent(fullAddress)}` : '';
                  window.open(
                    `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving${query}`,
                    '_blank',
                    'noopener,noreferrer',
                  );
                }}
                disabled={order?.orderStatus === 'PLACED' || order?.orderStatus === 'CANCELLED'}
                className={`text-xs rounded-md px-2 py-1 font-semibold ${
                  order?.orderStatus === 'PLACED' || order?.orderStatus === 'CANCELLED'
                    ? 'border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Open in Google Maps
              </button>
            </div>
          </div>
          <div className="h-[280px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50 relative">
            {order?.orderStatus === 'PLACED' ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-600">Waiting for {isServiceScope ? 'expert' : 'partner'} assignment...</p>
                  <p className="text-xs text-slate-500 mt-1">Map will appear once assigned</p>
                </div>
              </div>
            ) : null}
            <MapContainer
              center={toLeafletCoord(partnerPoint)}
              zoom={13}
              scrollWheelZoom
              className="h-full w-full"
              key={order._id}
              zoomControl={order?.orderStatus !== 'PLACED' && order?.orderStatus !== 'CANCELLED'}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <ScaleControl position="bottomleft" />

              {order?.orderStatus !== 'PLACED' && order?.orderStatus !== 'CANCELLED' ? (
                <>
                  <FollowPartner enabled={mapViewMode === 'follow'} position={partnerPoint} />
                  <FitMapBounds points={mapPoints} enabled={mapViewMode === 'overview'} />
                </>
              ) : null}

              {order?.orderStatus === 'OUT_FOR_DELIVERY' && routePath.length > 0 ? (
                <Polyline positions={routePath.map(toLeafletCoord)} pathOptions={{ color: '#0ea5e9', weight: 5, opacity: 0.8 }} />
              ) : null}

              {order?.orderStatus !== 'PLACED' ? (
                <>
                  <Marker position={toLeafletCoord(partnerPoint)} icon={partnerIcon}>
                    <Popup>{assignee.name} {order?.orderStatus === 'DELIVERED' ? '(delivered)' : '(live location)'}</Popup>
                  </Marker>
                  <Marker position={toLeafletCoord(destinationPoint)} icon={destinationIcon}>
                    <Popup>{isServiceScope ? 'Service Address' : 'Your Address'}</Popup>
                  </Marker>
                </>
              ) : null}
            </MapContainer>
          </div>

          {order?.orderStatus !== 'PLACED' ? (
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center">{isServiceScope ? 'Assigned Expert' : 'Delivery Partner'}</div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center">{isServiceScope ? 'Service Address' : 'Destination'}</div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl bg-white border border-slate-200 p-3 space-y-1.5">
        <div className="flex items-center justify-between text-sm text-slate-700">
          <span>Subtotal</span>
          <span>{formatMoney(order.subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-slate-700">
          <span>Delivery Fee</span>
          <span>{formatMoney(order.deliveryFee)}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-slate-700">
          <span>Discount</span>
          <span>-{formatMoney(order.discount)}</span>
        </div>
        <div className="border-t border-slate-200 pt-1.5 flex items-center justify-between text-sm font-bold text-slate-900">
          <span>Total</span>
          <span>{formatMoney(order.totalAmount)}</span>
        </div>
      </div>
    </div>
  );
}

export default OrderTrackingDetails;
