import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { createServiceBooking, fetchUserAddresses } from '../services/api';
import { useAuth } from '../context/AuthContext';

const FALLBACK_SERVICE_IMAGE = 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80';

const SERVICE_CATALOG = {
  cleaning: {
    title: 'Cleaning',
    subtitle: 'Deep cleaning, sofa, kitchen and bathroom care',
    imageUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80',
    packages: [
      { id: 'basic', name: 'Basic Cleaning', price: 699, duration: 120, popular: false, details: '1 expert, standard home cleaning.' },
      { id: 'deep', name: 'Deep Cleaning', price: 1499, duration: 240, popular: true, details: 'Full-room detailing, dusting, and sanitization.' },
      { id: 'premium', name: 'Premium Care', price: 2299, duration: 360, popular: false, details: 'Deep clean plus kitchen and bathroom focus.' },
    ],
  },
  'appliance-repair': {
    title: 'Appliance Repair',
    subtitle: 'AC, fridge, washer and smart appliance servicing',
    imageUrl: 'https://images.pexels.com/photos/5691664/pexels-photo-5691664.jpeg?auto=compress&cs=tinysrgb&w=1200',
    packages: [
      { id: 'inspection', name: 'Inspection Visit', price: 399, duration: 60, popular: false, details: 'Diagnosis and quick estimate.' },
      { id: 'repair', name: 'Standard Repair', price: 1299, duration: 120, popular: true, details: 'Common part replacement and repair labor.' },
      { id: 'priority', name: 'Priority Support', price: 1899, duration: 180, popular: false, details: 'Fast-track service with priority scheduling.' },
    ],
  },
  plumbing: {
    title: 'Plumbing',
    subtitle: 'Leaks, taps, pipe fixes and bathroom fittings',
    imageUrl: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=80',
    packages: [
      { id: 'tap', name: 'Tap & Leak Fix', price: 499, duration: 90, popular: false, details: 'Minor tap and leak repair.' },
      { id: 'bathroom', name: 'Bathroom Service', price: 899, duration: 150, popular: true, details: 'Pipe, tap, and bathroom fitting service.' },
      { id: 'full', name: 'Full Plumbing Care', price: 1599, duration: 240, popular: false, details: 'Comprehensive home plumbing support.' },
    ],
  },
  electrical: {
    title: 'Electrical',
    subtitle: 'Switchboards, wiring, fans and safety inspections',
    imageUrl: 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=1200&q=80',
    packages: [
      { id: 'safety', name: 'Safety Check', price: 599, duration: 90, popular: true, details: 'Home wiring and switchboard inspection.' },
      { id: 'repair', name: 'Fan / Light Repair', price: 799, duration: 120, popular: false, details: 'Installation and minor repair work.' },
      { id: 'premium', name: 'Full Electrical Service', price: 1499, duration: 240, popular: false, details: 'Full-home electrical support.' },
    ],
  },
};

const getSelectedService = (slug) => SERVICE_CATALOG[slug] || SERVICE_CATALOG.cleaning;

function ServiceBookingPage() {
  const { serviceSlug } = useParams();
  const navigate = useNavigate();
  const { currentUser, openAuthModal } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('deep');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [notes, setNotes] = useState('');
  const [booking, setBooking] = useState(false);

  const service = useMemo(() => getSelectedService(serviceSlug), [serviceSlug]);
  const selectedPackage = useMemo(
    () => service.packages.find((item) => item.id === selectedPackageId) || service.packages[0],
    [service.packages, selectedPackageId],
  );

  useEffect(() => {
    const loadAddresses = async () => {
      if (!currentUser?._id) {
        setLoadingAddresses(false);
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

  useEffect(() => {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 1);
    setPreferredDate(nextDate.toISOString().slice(0, 10));
    setPreferredTime('10:00');
  }, []);

  const selectedAddress = addresses.find((address) => address._id === selectedAddressId) || null;

  const handleImageError = (event) => {
    event.currentTarget.onerror = null;
    event.currentTarget.src = FALLBACK_SERVICE_IMAGE;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!currentUser) {
      openAuthModal('login');
      return;
    }

    if (!selectedAddress) {
      toast.error('Please choose a service address first.');
      return;
    }

    if (!preferredDate || !preferredTime) {
      toast.error('Please select date and time for your service.');
      return;
    }

    try {
      setBooking(true);

      const scheduledFor = new Date(`${preferredDate}T${preferredTime}:00`);

      await createServiceBooking({
        userId: currentUser._id,
        bookingType: 'service',
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
        serviceBooking: {
          serviceSlug: serviceSlug || 'cleaning',
          serviceName: service.title,
          packageName: selectedPackage.name,
          serviceImage: service.imageUrl,
          scheduledFor,
          timeSlot: `${preferredDate} ${preferredTime}`,
          notes: notes.trim(),
          estimatedDurationMins: selectedPackage.duration,
          estimatedPrice: selectedPackage.price,
        },
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
        orderStatus: 'PLACED',
        subtotal: selectedPackage.price,
        deliveryFee: 0,
        discount: 0,
        totalAmount: selectedPackage.price,
      });

      toast.success('Service booked successfully. A professional has been assigned.');
      navigate('/account?tab=orders');
    } catch (error) {
      toast.error(error.message || 'Failed to place your service booking.');
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="pt-24 pb-12 bg-gradient-to-b from-rose-50 via-white to-cyan-50 min-h-screen">
      <div className="container mx-auto px-4">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] items-start">
          <section className="rounded-[32px] overflow-hidden border border-slate-200 bg-white shadow-[0_30px_80px_-45px_rgba(15,23,42,0.5)]">
            <img src={service.imageUrl} alt={service.title} className="h-56 w-full object-cover" loading="lazy" onError={handleImageError} />
            <div className="p-6 md:p-8 space-y-6">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-primary-custom font-bold">Book a service</p>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 mt-2">{service.title}</h1>
                <p className="text-slate-600 mt-2 max-w-2xl">{service.subtitle}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {service.packages.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedPackageId(item.id)}
                    className={`rounded-2xl border p-4 text-left transition-all ${selectedPackageId === item.id ? 'border-primary-custom bg-primary-custom/5 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-slate-900">{item.name}</p>
                      {item.popular ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Popular</span> : null}
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{item.details}</p>
                    <p className="mt-3 text-lg font-black text-slate-900">Rs.{item.price}</p>
                    <p className="text-xs text-slate-500">Approx. {item.duration} mins</p>
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Service date</label>
                    <input
                      type="date"
                      value={preferredDate}
                      onChange={(event) => setPreferredDate(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Preferred time</label>
                    <input
                      type="time"
                      value={preferredTime}
                      onChange={(event) => setPreferredTime(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Service address</label>
                  {loadingAddresses ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Loading addresses...</div>
                  ) : addresses.length === 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      No saved address found. Add one in your account before booking.
                    </div>
                  ) : (
                    <select
                      value={selectedAddressId}
                      onChange={(event) => setSelectedAddressId(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
                    >
                      {addresses.map((address) => (
                        <option key={address._id} value={address._id}>
                          {address.fullName} - {address.city} ({address.pincode})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Special instructions</label>
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Add access details, problem notes, or special preferences"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={booking || !selectedAddress}
                    className="rounded-full bg-primary-custom px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {booking ? 'Booking...' : `Book ${service.title}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/services')}
                    className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Back to Hub
                  </button>
                </div>
              </form>
            </div>
          </section>

          <aside className="space-y-5 sticky top-24">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-primary-custom font-bold">Checkout summary</p>
              <h2 className="text-2xl font-black text-slate-900 mt-2">{selectedPackage.name}</h2>
              <p className="text-sm text-slate-600 mt-2">{selectedPackage.details}</p>

              <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Service</span>
                  <span className="font-semibold text-slate-900">{service.title}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Package</span>
                  <span className="font-semibold text-slate-900">{selectedPackage.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Duration</span>
                  <span className="font-semibold text-slate-900">{selectedPackage.duration} mins</span>
                </div>
                <div className="flex items-center justify-between text-sm border-t border-slate-200 pt-3">
                  <span className="text-slate-500">Total</span>
                  <span className="text-xl font-black text-slate-900">Rs.{selectedPackage.price}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-cyan-100 bg-gradient-to-br from-cyan-50 to-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-cyan-800">How this flow works</p>
              <ol className="mt-3 space-y-2 text-sm text-slate-700 list-decimal list-inside">
                <li>Choose a service package and time slot.</li>
                <li>Confirm your saved address and instructions.</li>
                <li>We create a service booking in orders.</li>
                <li>A matching worker receives the job in their dashboard.</li>
              </ol>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default ServiceBookingPage;