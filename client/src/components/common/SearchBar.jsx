import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAllShopGoods, fetchAllShopItems } from '../../services/api';

const MAX_RECENT_SEARCHES = 5;
const SEARCH_DEBOUNCE_MS = 180;

const normalizeText = (value) => {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

const SearchBar = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [showRecent, setShowRecent] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(-1);
  const [highlightedRecentIndex, setHighlightedRecentIndex] = useState(-1);
  const searchRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch all products and categories for search and load recent searches from localStorage
  useEffect(() => {
    const fetchProductsAndCategories = async () => {
      try {
        setLoading(true);
        const shopItems = await fetchAllShopItems();
        const shopGoods = await fetchAllShopGoods();

        // Extract unique categories from products
        const categories = new Set();
        [...shopItems, ...shopGoods].forEach(product => {
          if (product.category) {
            categories.add(product.category.toLowerCase());
          }
        });

        // Create category objects for search
        const categoryObjects = Array.from(categories).map(category => ({
          _id: `category-${category}`,
          name: category,
          _type: 'category',
          imageUrl: getCategoryImage(category),
          description: `Browse all ${category} products`
        }));

        // Add type identifier to products
        const productsWithType = [...shopItems, ...shopGoods].map(product => ({
          ...product,
          _type: 'product'
        }));

        // Combine products and categories
        const allSearchableItems = [...productsWithType, ...categoryObjects];
        setAllProducts(allSearchableItems);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching products for search:', error);
        setLoading(false);
      }
    };

    // Helper function to get category images
    const getCategoryImage = (category) => {
      const categoryImages = {
        vegetables: 'https://res.cloudinary.com/dm22f1lc0/image/upload/v1742713064/vegetables_category.jpg',
        fruits: 'https://res.cloudinary.com/dm22f1lc0/image/upload/v1742713064/fruits_category.jpg',
        dairy: 'https://res.cloudinary.com/dm22f1lc0/image/upload/v1742713064/dairy_category.jpg',
        groceries: 'https://res.cloudinary.com/dm22f1lc0/image/upload/v1742713064/groceries_category.jpg',
        pulses: 'https://res.cloudinary.com/dm22f1lc0/image/upload/v1742713064/pulses_category.jpg'
      };

      return categoryImages[category] || 'https://via.placeholder.com/40?text=Category';
    };

    // Load recent searches from localStorage
    const loadSearchData = () => {
      try {
        const savedSearches = localStorage.getItem('recentSearches');
        if (savedSearches) {
          setRecentSearches(JSON.parse(savedSearches));
        }
      } catch (error) {
        console.error('Error loading search data:', error);
      }
    };

    fetchProductsAndCategories();
    loadSearchData();
  }, []);

  // Handle click outside to close suggestions and recent searches
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
        setShowRecent(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Calculate Levenshtein distance for fuzzy matching
  const levenshteinDistance = (a, b) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    // Initialize matrix
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  };

  // Calculate similarity score (0-1) based on Levenshtein distance
  const similarityScore = (a, b) => {
    const distance = levenshteinDistance(a, b);
    const maxLength = Math.max(a.length, b.length);
    return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
  };

  // Filter and rank items based on search term
  useEffect(() => {
    if (debouncedSearchTerm.trim() === '') {
      setSuggestions([]);
      setShowSuggestions(false);
      setHighlightedSuggestionIndex(-1);
      return;
    }

    const searchTermLower = normalizeText(debouncedSearchTerm);
    const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 0);

    // Use all products without category filtering
    const categoryFiltered = allProducts;

    // Score and rank items based on relevance to search term
    const scoredItems = categoryFiltered
      .map(item => {
        let score = 0;
        let matchedName = '';
        let matchType = 'none';
        let fuzzyMatchScore = 0;

        // Function to process a name string
        const processName = (name) => {
          const nameLower = name.toLowerCase();
          let currentScore = 0;
          let currentMatchType = 'none';

          // Exact match gets highest score
          if (normalizeText(nameLower) === searchTermLower) {
            currentScore = 100;
            currentMatchType = 'exact';
          }
          // Starts with search term gets high score
          else if (normalizeText(nameLower).startsWith(searchTermLower)) {
            currentScore = 80 - (nameLower.length - searchTermLower.length) / 10;
            currentMatchType = 'startsWith';
          }
          // Contains search term gets medium score
          else if (normalizeText(nameLower).includes(searchTermLower)) {
            currentScore = 60 - nameLower.indexOf(searchTermLower) / 10;
            currentMatchType = 'contains';
          }
          // Word boundary match (e.g., "red onion" for "onion")
          else if (normalizeText(nameLower).split(/\s+/).some(word => searchWords.includes(word))) {
            currentScore = 70;
            currentMatchType = 'wordMatch';
          }
          // Fuzzy matching for typo tolerance
          else {
            // Check each word in the name against each search word
            const nameWords = nameLower.split(/\s+/);
            let bestWordSimilarity = 0;

            for (const nameWord of nameWords) {
              for (const searchWord of searchWords) {
                if (searchWord.length < 3) continue; // Skip very short words

                const similarity = similarityScore(nameWord, searchWord);
                if (similarity > 0.7 && similarity > bestWordSimilarity) { // 70% similarity threshold
                  bestWordSimilarity = similarity;
                }
              }
            }

            if (bestWordSimilarity > 0) {
              currentScore = 40 + bestWordSimilarity * 20; // Score between 40-60 based on similarity
              currentMatchType = 'fuzzy';
              fuzzyMatchScore = bestWordSimilarity;
            }
          }

          return { currentScore, currentMatchType, name };
        };

        // Process based on item type
        if (item._type === 'category') {
          // For categories, check the category name
          const result = processName(item.name);
          score = result.currentScore;
          matchType = result.currentMatchType;
          matchedName = result.name;

          // Give categories a slight boost in search results
          if (score > 0) score += 5;
        } else {
          // For products, check all names
          if (Array.isArray(item.name)) {
            // Check each name in the array
            for (const name of item.name) {
              const result = processName(name);
              if (result.currentScore > score) {
                score = result.currentScore;
                matchType = result.currentMatchType;
                matchedName = result.name;
              }
            }
          } else if (typeof item.name === 'string') {
            const result = processName(item.name);
            score = result.currentScore;
            matchType = result.currentMatchType;
            matchedName = result.name;
          }

          // Also check product description if available
          if (item.description && typeof item.description === 'string') {
            const descriptionLower = normalizeText(item.description);
            if (descriptionLower.includes(searchTermLower)) {
              // Add a smaller score boost for description matches
              score = Math.max(score, 30);
              if (matchType === 'none') {
                matchType = 'description';
                matchedName = item.name && Array.isArray(item.name) ? item.name[0] : item.name;
              }
            }
          }

          // Check category match
          if (item.category && typeof item.category === 'string') {
            const categoryLower = normalizeText(item.category);
            if (categoryLower.includes(searchTermLower)) {
              // Add a smaller score boost for category matches
              score = Math.max(score, 20);
              if (matchType === 'none') {
                matchType = 'category';
                matchedName = item.name && Array.isArray(item.name) ? item.name[0] : item.name;
              }
            }
          }
        }

        // Only include items with a score > 0 (meaning they matched somehow)
        return {
          item,
          score,
          matchedName,
          matchType,
          fuzzyMatchScore
        };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => {
        // First group by type (categories first, then products)
        if (a.item._type === 'category' && b.item._type !== 'category') return -1;
        if (a.item._type !== 'category' && b.item._type === 'category') return 1;
        // Then sort by score
        return b.score - a.score;
      })
      .slice(0, 12) // Limit to 12 suggestions
      .map(item => ({
        ...item.item,
        _matchScore: item.score,
        _matchedName: item.matchedName,
        _matchType: item.matchType,
        _fuzzyMatchScore: item.fuzzyMatchScore
      }));

    setSuggestions(scoredItems);
    setShowSuggestions(scoredItems.length > 0);
    setHighlightedSuggestionIndex(scoredItems.length > 0 ? 0 : -1);
  }, [debouncedSearchTerm, allProducts]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setHighlightedSuggestionIndex(-1);
    setHighlightedRecentIndex(-1);

    // Close recent searches when typing
    if (e.target.value.trim() !== '') {
      setShowRecent(false);
    } else if (e.target.value.trim() === '' && recentSearches.length > 0) {
      setShowRecent(true);
    }
  };

  const buildSearchUrl = (term, suggestionPool = suggestions) => {
    const cleanedTerm = term.trim();
    const searchParams = new URLSearchParams();
    searchParams.append('search', cleanedTerm);
    searchParams.append('exactMatch', 'false');

    const searchTermLower = normalizeText(cleanedTerm);
    const categoryNames = ['vegetables', 'fruits', 'pulses', 'dairy', 'groceries'];
    const directCategoryMatch = categoryNames.find((cat) => {
      const normalizedCategory = normalizeText(cat);
      return normalizedCategory === searchTermLower || searchTermLower.includes(normalizedCategory);
    });

    if (directCategoryMatch) {
      searchParams.append('category', directCategoryMatch);
      return `/products?${searchParams.toString()}`;
    }

    const categoryMatches = suggestionPool.filter((item) => item._type === 'category');
    if (categoryMatches.length > 0) {
      searchParams.append('category', categoryMatches[0].name);
    }

    return `/products?${searchParams.toString()}`;
  };

  const runSearch = (term, suggestionPool = suggestions) => {
    if (!term || !term.trim()) {
      return;
    }

    const cleanedTerm = term.trim();
    saveToRecentSearches(cleanedTerm);
    navigate(buildSearchUrl(cleanedTerm, suggestionPool));
    setShowSuggestions(false);
    setShowRecent(false);
    setSearchTerm('');
    setHighlightedSuggestionIndex(-1);
    setHighlightedRecentIndex(-1);
  };

  // Save a search term to recent searches
  const saveToRecentSearches = (term) => {
    if (!term) return;

    // Update recent searches
    setRecentSearches(prev => {
      // Remove the term if it already exists to avoid duplicates
      const filtered = prev.filter(item => item.toLowerCase() !== term.toLowerCase());
      // Add the new term at the beginning
      const updated = [term, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      // Save to localStorage
      localStorage.setItem('recentSearches', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSuggestionClick = (item) => {
    // Handle differently based on item type
    if (item._type === 'category') {
      // For categories, navigate to the category page
      const categoryName = item.name;

      // Save to recent searches
      saveToRecentSearches(categoryName);

      // Navigate to products page filtered by this category
      navigate(`/products?category=${encodeURIComponent(categoryName)}`);
    } else {
      // For products, navigate to product search
      // Get the exact name that was clicked or matched
      const productName = item._matchedName || (Array.isArray(item.name) ? item.name[0] : item.name);

      // Save to recent searches
      saveToRecentSearches(productName);

      // Navigate to products page with both product name and category as filters
      navigate(`/products?search=${encodeURIComponent(productName)}&exactMatch=true&category=${item.category || 'all'}`);
    }

    setShowSuggestions(false);
    setSearchTerm('');
    setHighlightedSuggestionIndex(-1);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    runSearch(searchTerm, suggestions);
  };

  const handleShowAllResults = () => {
    runSearch(searchTerm, suggestions);
  };

  const handleRecentSearchClick = (term) => {
    const matchingCategories = allProducts.filter(item =>
      item._type === 'category' &&
      normalizeText(item.name).includes(normalizeText(term))
    );

    runSearch(term, matchingCategories);
  };

  const handleInputKeyDown = (event) => {
    if (event.key === 'Escape') {
      setShowSuggestions(false);
      setShowRecent(false);
      setHighlightedSuggestionIndex(-1);
      setHighlightedRecentIndex(-1);
      return;
    }

    if (showSuggestions && suggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedSuggestionIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedSuggestionIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
        return;
      }

      if (event.key === 'Enter' && highlightedSuggestionIndex >= 0) {
        event.preventDefault();
        handleSuggestionClick(suggestions[highlightedSuggestionIndex]);
      }
      return;
    }

    if (showRecent && recentSearches.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedRecentIndex((prev) => (prev + 1) % recentSearches.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedRecentIndex((prev) => (prev <= 0 ? recentSearches.length - 1 : prev - 1));
        return;
      }

      if (event.key === 'Enter' && highlightedRecentIndex >= 0) {
        event.preventDefault();
        handleRecentSearchClick(recentSearches[highlightedRecentIndex]);
      }
    }
  };

  return (
    <div className="relative w-full max-w-md md:max-w-xl lg:max-w-2xl" ref={searchRef}>
      <form onSubmit={handleSearchSubmit} className="flex w-full">
        <div className="flex w-full rounded-md border border-gray-300 overflow-hidden">

          {/* Search input */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search fruits, vegetables, dairy..."
              className={`w-full h-12 px-4 py-2 text-base focus:outline-none ${isFocused ? 'ring-2 ring-[#8a4af3]' : ''}`}
              style={{ fontFamily: 'Gilroy, Arial, Helvetica Neue, sans-serif' }}
              value={searchTerm}
              onChange={handleSearchChange}
              onKeyDown={handleInputKeyDown}
              onFocus={() => {
                setIsFocused(true);
                if (searchTerm.trim() !== '' && suggestions.length > 0) {
                  setShowSuggestions(true);
                  setHighlightedSuggestionIndex(0);
                } else if (searchTerm.trim() === '' && recentSearches.length > 0) {
                  setShowRecent(true);
                  setHighlightedRecentIndex(0);
                }
              }}
              onBlur={() => {
                setIsFocused(false);
              }}
            />
            {!searchTerm ? (
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[11px] text-gray-400 pointer-events-none">
                Press Enter
              </span>
            ) : null}
            {searchTerm && (
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>

          {/* Search button */}
          <button type="submit" className="bg-[#8a4af3] hover:bg-[#7a3ad3] text-white px-6 flex items-center justify-center" aria-label="Search">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197M16.803 15.803A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
          </button>
        </div>
      </form>

      {/* Recent searches dropdown */}
      {showRecent && searchTerm.trim() === '' && recentSearches.length > 0 && (
        <div className="absolute z-10 w-full mt-2 bg-white rounded-md shadow-lg border border-gray-200 overflow-hidden">
          {recentSearches.length > 0 && (
            <div className="py-2 px-3">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium text-gray-700">Recent Searches</h3>
                <button
                  className="text-xs text-[#8a4af3] hover:text-[#7a3ad3] font-medium"
                  onClick={() => {
                    setRecentSearches([]);
                    localStorage.removeItem('recentSearches');
                  }}
                >
                  Clear
                </button>
              </div>
              <ul className="space-y-1">
                {recentSearches.map((term, index) => (
                  <li
                    key={`recent-${index}`}
                    className={`flex items-center justify-between py-1 px-2 text-sm text-gray-700 hover:bg-gray-100 rounded cursor-pointer ${highlightedRecentIndex === index ? 'bg-gray-100' : ''}`}
                    onClick={() => handleRecentSearchClick(term)}
                  >
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium">{term}</span>
                    </div>
                    <button
                      className="text-gray-400 hover:text-gray-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        const newRecentSearches = recentSearches.filter(s => s !== term);
                        setRecentSearches(newRecentSearches);
                        localStorage.setItem('recentSearches', JSON.stringify(newRecentSearches));
                      }}
                      aria-label="Remove from recent searches"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Search suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-2 bg-white rounded-md shadow-lg border border-gray-200 overflow-hidden">
          {/* Group suggestions by type */}
          {(() => {
            // Separate categories and products
            const categories = suggestions.filter(item => item._type === 'category');
            const products = suggestions.filter(item => item._type === 'product');

            // Group products by category for better organization
            const productsByCategory = {};
            products.forEach(product => {
              const category = product.category || 'Other';
              if (!productsByCategory[category]) {
                productsByCategory[category] = [];
              }
              productsByCategory[category].push(product);
            });

            return (
              <>
                {/* Search completion suggestions */}
                <div className="py-2 px-3 border-b border-gray-200">
                  <ul>
                    {searchTerm && (
                      <li
                        className="flex items-center justify-between py-2 px-2 text-sm text-gray-700 hover:bg-gray-100 rounded cursor-pointer"
                        onClick={() => handleSearchSubmit({ preventDefault: () => {} })}
                      >
                        <div className="flex items-center">
                          <span className="text-gray-600">Search for </span>
                          <span className="font-medium mx-1">"{searchTerm}"</span>
                              <span className="text-gray-600"> across all categories</span>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197M16.803 15.803A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                      </li>
                    )}
                  </ul>
                </div>

                {/* Categories section */}
                {categories.length > 0 && (
                  <div className="py-2 px-3 border-b border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-medium text-gray-700">Categories</h3>
                    </div>
                    <ul className="space-y-1">
                      {categories.map((category, index) => {
                        const categoryName = category.name;
                        const categoryImage = category.imageUrl || 'https://via.placeholder.com/40?text=Category';
                        const searchTermLower = searchTerm.toLowerCase();

                        // Function to highlight matching text
                        const highlightMatch = (text) => {
                          if (!text || !searchTerm) return text;

                          const textLower = text.toLowerCase();
                          const index = textLower.indexOf(searchTermLower);

                          if (index === -1) return text;

                          const before = text.substring(0, index);
                          const match = text.substring(index, index + searchTerm.length);
                          const after = text.substring(index + searchTerm.length);

                          return (
                            <>
                              {before}
                              <span className="bg-yellow-100">{match}</span>
                              {after}
                            </>
                          );
                        };

                        return (
                          <li
                            key={`category-${index}`}
                            className={`flex items-center py-2 px-2 text-sm hover:bg-gray-100 rounded cursor-pointer ${category._matchType === 'exact' ? 'bg-gray-50' : ''} ${highlightedSuggestionIndex === index ? 'bg-gray-100' : ''}`}
                            onClick={() => handleSuggestionClick(category)}
                          >
                            <div className="flex-shrink-0 w-10 h-10 mr-3">
                              <img
                                src={categoryImage}
                                alt={categoryName}
                                className="w-full h-full object-cover rounded"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = 'https://via.placeholder.com/40?text=Category';
                                }}
                              />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center text-gray-800 font-medium">
                                {highlightMatch(categoryName)}
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div className="text-xs text-gray-500">
                                Browse all {categoryName} products
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Products section - grouped by category */}
                {Object.keys(productsByCategory).length > 0 && (
                  <div className="py-2 px-3 border-b border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-medium text-gray-700">Products</h3>
                    </div>

                    {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
                      <div key={category} className="mb-3 last:mb-0">
                        <div className="mb-1">
                          <h4 className="text-xs font-medium text-gray-500 uppercase">{category}</h4>
                        </div>
                        <ul className="space-y-2">
                          {categoryProducts.map((product, index) => {
                            const productPosition = products.indexOf(product);
                            const suggestionIndex = categories.length + (productPosition >= 0 ? productPosition : index);
                            // Determine which name to show as primary based on match
                            let primaryName = '';
                            let alternateNames = [];

                            if (product._matchedName) {
                              // If we have a matched name, show it as primary
                              primaryName = product._matchedName;

                              // Get other names as alternates
                              if (Array.isArray(product.name)) {
                                alternateNames = product.name.filter(name => name !== primaryName);
                              }
                            } else {
                              // Fall back to default behavior
                              primaryName = Array.isArray(product.name) ? product.name[0] : product.name;
                              alternateNames = Array.isArray(product.name) && product.name.length > 1
                                ? product.name.slice(1) : [];
                            }

                            const productImage = product.imageUrl || 'https://via.placeholder.com/40';
                            const searchTermLower = searchTerm.toLowerCase();

                            // Function to highlight matching text
                            const highlightMatch = (text) => {
                              if (!text || !searchTerm) return text;

                              const textLower = text.toLowerCase();
                              const index = textLower.indexOf(searchTermLower);

                              if (index === -1) {
                                // If direct match not found, check for fuzzy match
                                if (product._matchType === 'fuzzy' && product._fuzzyMatchScore > 0.7) {
                                  return (
                                    <span className="flex items-center">
                                      {text}
                                      <span className="ml-1 text-xs bg-blue-50 text-blue-600 px-1 py-0.5 rounded">
                                        similar
                                      </span>
                                    </span>
                                  );
                                }
                                return text;
                              }

                              const before = text.substring(0, index);
                              const match = text.substring(index, index + searchTerm.length);
                              const after = text.substring(index + searchTerm.length);

                              return (
                                <>
                                  {before}
                                  <span className="bg-yellow-100">{match}</span>
                                  {after}
                                </>
                              );
                            };

                            return (
                              <li
                                key={product._id || `product-${category}-${index}`}
                                className={`flex py-2 px-2 text-sm hover:bg-gray-100 rounded cursor-pointer ${product._matchType === 'exact' ? 'bg-gray-50' : ''} ${highlightedSuggestionIndex === suggestionIndex ? 'bg-gray-100' : ''}`}
                                onClick={() => handleSuggestionClick(product)}
                              >
                                <div className="flex-shrink-0 w-12 h-12 mr-3">
                                  <img
                                    src={productImage}
                                    alt={primaryName}
                                    className="w-full h-full object-cover rounded"
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.src = 'https://via.placeholder.com/40?text=Error';
                                    }}
                                  />
                                </div>
                                <div className="flex-1">
                                  <div className="font-medium text-gray-800">{highlightMatch(primaryName)}</div>
                                  {alternateNames.length > 0 && (
                                    <div className="text-xs text-gray-500">
                                      {alternateNames.join(', ')}
                                    </div>
                                  )}
                                  {product._matchType === 'description' && (
                                    <div className="text-xs text-gray-500 italic">
                                      Matched in description
                                    </div>
                                  )}
                                </div>
                                <div className="flex-shrink-0 ml-2 self-center">
                                  {product.quantity && product.quantity > 0 ? (
                                    <div className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">In Stock</div>
                                  ) : (
                                    <div className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Out of Stock</div>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {/* See all results button */}
                <div className="py-2 px-3">
                  <button
                    className="w-full flex items-center justify-center py-2 px-4 bg-gray-100 hover:bg-gray-200 text-[#8a4af3] font-medium rounded transition-colors"
                    onClick={handleShowAllResults}
                  >
                    <span>See all results for "{searchTerm}"</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
