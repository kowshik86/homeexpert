import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchAllShopGoods,
  fetchAllShopItems,
  fetchShopGoodsByCategory,
  fetchShopItemsByCategory
} from '../services/api';
import CategorySection from './common/CategorySection';
import ProductSkeleton from './common/ProductSkeleton';
import CategoryFilter from './common/CategoryFilter';
import HeroCarousel from './common/HeroCarousel';
import { heroSlides } from './common/HeroSlides';
// Removed carousel fix import as it's no longer needed
import './styles/HeroBanner.css';

const Home = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');

  // State for categorized products
  const [vegetables, setVegetables] = useState([]);
  const [fruits, setFruits] = useState([]);
  const [pulses, setPulses] = useState([]);
  const [dairyProducts, setDairyProducts] = useState([]);
  const [groceries, setGroceries] = useState([]);

  // Featured products (random selection from all categories)
  const [featuredProducts, setFeaturedProducts] = useState([]);

  // Available categories based on database
  const filterCategories = [
    { id: 'all', name: 'All', icon: '🛒' },
    { id: 'vegetables', name: 'Vegetables', icon: '🥦' },
    { id: 'fruits', name: 'Fruits', icon: '🍎' },
    { id: 'pulses', name: 'Pulses', icon: '🌱' },
    { id: 'dairy', name: 'Dairy', icon: '🥛' },
    { id: 'groceries', name: 'Groceries', icon: '🧺' }
  ];



  // Removed carousel fix initialization

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        console.log('Fetching data from API...');

        // Fetch data by categories using the correct API routes
        const vegetablesData = await fetchShopItemsByCategory('vegetables');
        console.log('Vegetables data:', vegetablesData);

        const fruitsData = await fetchShopItemsByCategory('fruits');
        console.log('Fruits data:', fruitsData);

        const pulsesData = await fetchShopGoodsByCategory('pulses');
        console.log('Pulses data:', pulsesData);

        const dairyData = await fetchShopGoodsByCategory('dairy');
        console.log('Dairy data:', dairyData);

        const groceriesData = await fetchShopGoodsByCategory('groceries');
        console.log('Groceries data:', groceriesData);

        // Set state for each category
        setVegetables(Array.isArray(vegetablesData) ? vegetablesData : []);
        setFruits(Array.isArray(fruitsData) ? fruitsData : []);
        setPulses(Array.isArray(pulsesData) ? pulsesData : []);
        setDairyProducts(Array.isArray(dairyData) ? dairyData : []);
        setGroceries(Array.isArray(groceriesData) ? groceriesData : []);

        // Create featured products (random selection from all categories)
        const allProducts = [
          ...Array.isArray(vegetablesData) ? vegetablesData : [],
          ...Array.isArray(fruitsData) ? fruitsData : [],
          ...Array.isArray(pulsesData) ? pulsesData : [],
          ...Array.isArray(dairyData) ? dairyData : [],
          ...Array.isArray(groceriesData) ? groceriesData : []
        ];

        console.log('All products combined:', allProducts.length);

        if (allProducts.length === 0) {
          // If no categorized products, fetch all items and goods
          const allItems = await fetchAllShopItems();
          console.log('All shop items:', allItems);

          const allGoods = await fetchAllShopGoods();
          console.log('All shop goods:', allGoods);

          const combinedProducts = [...allItems, ...allGoods].map(item => ({
            ...item,
            category: item.category || 'uncategorized'
          }));

          if (combinedProducts.length === 0) {
            setError('No products available. Please try again later.');
            setLoading(false);
            return;
          }

          // Use all products for each category
          setVegetables(combinedProducts.filter(item => item.name && typeof item.name === 'string' &&
            ['potato', 'onion', 'tomato', 'carrot', 'vegetable'].some(term =>
              item.name.toLowerCase().includes(term)
            )
          ));

          setFruits(combinedProducts.filter(item => item.name && typeof item.name === 'string' &&
            ['apple', 'banana', 'orange', 'mango', 'fruit'].some(term =>
              item.name.toLowerCase().includes(term)
            )
          ));

          setPulses(combinedProducts.filter(item =>
            (Array.isArray(item.name) ? item.name.join(' ').toLowerCase() :
             (typeof item.name === 'string' ? item.name.toLowerCase() : ''))
            .match(/dal|pulse|bean/)
          ));

          setDairyProducts(combinedProducts.filter(item =>
            (Array.isArray(item.name) ? item.name.join(' ').toLowerCase() :
             (typeof item.name === 'string' ? item.name.toLowerCase() : ''))
            .match(/milk|cheese|paneer|curd/)
          ));

          // Everything else is groceries
          setGroceries(combinedProducts.filter(item =>
            !(['potato', 'onion', 'tomato', 'carrot', 'vegetable', 'apple', 'banana', 'orange', 'mango', 'fruit'].some(term =>
              (typeof item.name === 'string' && item.name.toLowerCase().includes(term))
            )) &&
            !(Array.isArray(item.name) ? item.name.join(' ').toLowerCase() : '').match(/dal|pulse|bean|milk|cheese|paneer|curd/)
          ));

          // Set featured products
          setFeaturedProducts(combinedProducts.slice(0, 4));
        } else {
          // Shuffle and select up to 4 products for featured section
          const shuffled = [...allProducts].sort(() => 0.5 - Math.random());
          setFeaturedProducts(shuffled.slice(0, 4));
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load products. Please try again later.');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 pt-16 pb-8">
        {/* Hero Carousel Skeleton */}
        <div className="bg-gray-100 rounded-xl mb-10 animate-pulse overflow-hidden relative" style={{ height: '400px' }}>
          <div className="flex h-full">
            <div className="w-full flex flex-col md:flex-row p-8">
              <div className="md:w-1/2 flex flex-col justify-center">
                <div className="h-10 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6 mb-6"></div>
                <div className="h-12 bg-gray-200 rounded w-32"></div>
              </div>
              <div className="md:w-1/2 flex items-center justify-center mt-6 md:mt-0">
                <div className="bg-gray-200 rounded-lg w-full md:w-4/5 h-48 md:h-64"></div>
              </div>
            </div>
          </div>
          {/* Navigation arrows skeleton */}
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-gray-200 p-2 rounded-full w-10 h-10"></div>
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-gray-200 p-2 rounded-full w-10 h-10"></div>
          {/* Dots indicator skeleton */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
            <div className="w-6 h-3 bg-gray-300 rounded-full"></div>
            <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
            <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          </div>
        </div>

        {/* Featured Products Skeleton */}
        <div className="mb-10">
          <div className="flex justify-between items-center mb-4">
            <div className="h-8 bg-gray-200 rounded w-48"></div>
            <div className="h-6 bg-gray-200 rounded w-24"></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {[...Array(4)].map((_, index) => (
              <ProductSkeleton key={index} />
            ))}
          </div>
        </div>

        {/* Categories Skeleton */}
        {[...Array(4)].map((_, index) => (
          <div className="mb-10" key={index}>
            <div className="flex justify-between items-center mb-4">
              <div className="h-8 bg-gray-200 rounded w-48"></div>
              <div className="h-6 bg-gray-200 rounded w-24"></div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {[...Array(4)].map((_, i) => (
                <ProductSkeleton key={i} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 pt-16 pb-8 flex justify-center items-center min-h-screen">
        <div className="text-center bg-red-50 p-6 rounded-lg shadow-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-primary-custom mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xl font-bold mb-2 text-gray-800" style={{ fontFamily: 'Gilroy, Arial, Helvetica Neue, sans-serif' }}>
            Oops! Something went wrong
          </h3>
          <p className="text-cement mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 bg-primary-custom text-white px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors"
            style={{ fontFamily: 'Gilroy, Arial, Helvetica Neue, sans-serif' }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Handle category change
  const handleCategoryChange = (categoryId) => {
    setActiveCategory(categoryId);
  };

  return (
    <div className="pt-16 pb-8">
      {/* Category Filter - Moved to top */}
      <div className="bg-white border-b border-gray-100 shadow-sm mb-8 sticky top-16 z-10">
        <div className="container mx-auto px-4">
          <CategoryFilter
            categories={filterCategories}
            activeCategory={activeCategory}
            onCategoryChange={handleCategoryChange}
          />
        </div>
      </div>

      {/* Hero Carousel - Moved below category filter */}
      <div className="container mx-auto px-4 mb-8">
        <div
          className="rounded-xl shadow-lg overflow-hidden h-[300px] md:h-[400px]"
        >
          <HeroCarousel slides={heroSlides} />
        </div>
      </div>

      <div className="container mx-auto px-4 mb-2">
        <div className="border-b border-gray-100 mb-6"></div>
      </div>

      <div className="container mx-auto px-4 mb-8">
        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm p-5 md:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 overflow-hidden relative">
          <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-cyan-100/40 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <p className="text-xs uppercase tracking-[0.2em] text-primary-custom font-bold">Home Services Hub</p>
            <h2 className="text-2xl font-black text-slate-900 mt-2">Need a home expert as fast as groceries?</h2>
            <p className="text-sm text-slate-600 mt-2 max-w-2xl">Browse cleaning, AC repair, plumbing, and electrical support in a premium, app-like flow designed for instant booking.</p>
          </div>
          <div className="relative z-10 flex flex-wrap gap-3">
            <Link to="/services" className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
              Explore Services
            </Link>
            <Link to="/account?tab=orders" className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Track Bookings
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4">
        {/* Featured Products - Always show regardless of filter */}
        {activeCategory === 'all' && (
          <CategorySection
            title="Featured Products"
            products={featuredProducts}
            viewAllLink="/products"
          />
        )}

        {/* View All Products Button */}
        <div className="mb-8 text-center">
          <Link
            to="/products"
            className="bg-primary-custom text-white px-6 py-3 rounded-md hover:bg-opacity-80 hover:shadow-md transition-all duration-300 transform hover:scale-105 inline-flex items-center"
            style={{ fontFamily: 'Gilroy, Arial, Helvetica Neue, sans-serif' }}
          >
            View All Products
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>

        {/* Vegetables Section */}
        {(activeCategory === 'all' || activeCategory === 'vegetables') && (
          <CategorySection
            title="Fresh Vegetables"
            products={vegetables}
            viewAllLink="/category/vegetables"
          />
        )}

        {/* Fruits Section */}
        {(activeCategory === 'all' || activeCategory === 'fruits') && (
          <CategorySection
            title="Seasonal Fruits"
            products={fruits}
            viewAllLink="/category/fruits"
          />
        )}

        {/* Pulses Section */}
        {(activeCategory === 'all' || activeCategory === 'pulses') && (
          <CategorySection
            title="Pulses & Lentils"
            products={pulses}
            viewAllLink="/category/pulses"
          />
        )}

        {/* Dairy Products */}
        {(activeCategory === 'all' || activeCategory === 'dairy') && (
          <CategorySection
            title="Dairy Products"
            products={dairyProducts}
            viewAllLink="/category/dairy"
          />
        )}

        {/* Groceries */}
        {(activeCategory === 'all' || activeCategory === 'groceries') && (
          <CategorySection
            title="Groceries & Essentials"
            products={groceries}
            viewAllLink="/category/groceries"
          />
        )}
      </div>
    </div>
  );
};

export default Home;
