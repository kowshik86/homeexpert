import React from 'react';
import { Link } from 'react-router-dom';

const FALLBACK_SERVICE_IMAGE = 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80';

const SERVICES = [
  {
    slug: 'cleaning',
    title: 'Cleaning',
    subtitle: 'Deep cleaning, sofa, kitchen and bathroom care',
    imageUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80',
    cta: 'Book Cleaning',
  },
  {
    slug: 'appliance-repair',
    title: 'Appliance Repair',
    subtitle: 'AC, fridge, washer and smart appliance servicing',
    imageUrl: 'https://images.pexels.com/photos/5691664/pexels-photo-5691664.jpeg?auto=compress&cs=tinysrgb&w=1200',
    cta: 'Book Repair',
  },
  {
    slug: 'plumbing',
    title: 'Plumbing',
    subtitle: 'Leaks, taps, pipe fixes and bathroom fittings',
    imageUrl: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=80',
    cta: 'Fix Plumbing',
  },
  {
    slug: 'electrical',
    title: 'Electrical',
    subtitle: 'Switchboards, wiring, fans and safety inspections',
    imageUrl: 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=1200&q=80',
    cta: 'Book Electrician',
  },
];

function HomeServicesHub() {
  const handleImageError = (event) => {
    event.currentTarget.onerror = null;
    event.currentTarget.src = FALLBACK_SERVICE_IMAGE;
  };

  return (
    <div className="pt-24 pb-12 bg-gradient-to-b from-rose-50 via-white to-cyan-50 min-h-screen">
      <div className="container mx-auto px-4 space-y-8">
        <section className="relative overflow-hidden rounded-[32px] bg-slate-900 text-white shadow-[0_40px_100px_-50px_rgba(15,23,42,0.9)]">
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, #ffffff 0%, transparent 40%)' }} />
          <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr] p-6 md:p-10 items-center">
            <div className="space-y-5">
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
                HOME SERVICES HUB
              </span>
              <h1 className="text-4xl md:text-5xl font-black leading-tight">Book trusted home experts with a premium, instant-service feel.</h1>
              <p className="max-w-2xl text-cyan-100 text-base md:text-lg">
                From cleaning to appliance repair, HomeXpert helps users discover skilled professionals with a polished booking experience inspired by modern on-demand service apps.
              </p>

            </div>

            <div className="grid grid-cols-2 gap-3">
              {SERVICES.map((service) => (
                <div key={service.title} className="overflow-hidden rounded-2xl bg-white/10 backdrop-blur border border-white/10 shadow-lg">
                  <img src={service.imageUrl} alt={service.title} className="h-32 w-full object-cover" loading="lazy" onError={handleImageError} />
                  <div className="p-3">
                    <p className="font-bold text-sm">{service.title}</p>
                    <p className="mt-1 text-xs text-cyan-100 line-clamp-2">{service.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {SERVICES.map((service) => (
            <Link
              key={service.slug}
              to={`/services/book/${service.slug}`}
              className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl block"
            >
              <img src={service.imageUrl} alt={service.title} className="h-52 w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" onError={handleImageError} />
              <div className="p-5 space-y-3">
                <div>
                  <p className="text-lg font-bold text-slate-900">{service.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{service.subtitle}</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Starting from Rs.499</span>
                  <span className="text-sm font-semibold text-primary-custom group-hover:underline">
                    {service.cta}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </section>

      </div>
    </div>
  );
}

export default HomeServicesHub;