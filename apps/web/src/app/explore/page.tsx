'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import PlaceCard from '@/components/PlaceCard';
import CategoryFilterPills from '@/components/CategoryFilterPills';
import AddVisitModal from '@/components/AddVisitModal';
import { Place, PUNE_LOCALITIES } from '@spotdiary/shared';
import { PlaceService } from '@/lib/placeService';
import { Search, Map, LayoutGrid, MapPin, DollarSign, RefreshCw } from 'lucide-react';

export default function ExplorePage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLocality, setSelectedLocality] = useState('All');
  const [selectedPriceLevel, setSelectedPriceLevel] = useState<number | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [places, setPlaces] = useState<Place[]>([]);
  const [isAddVisitOpen, setIsAddVisitOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlaces();
  }, [selectedCategory, selectedLocality, selectedPriceLevel]);

  const fetchPlaces = async () => {
    setLoading(true);
    const data = await PlaceService.getPlaces({
      category: selectedCategory,
      locality: selectedLocality,
      priceLevel: selectedPriceLevel,
      query: searchQuery
    });
    setPlaces(data);
    setLoading(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPlaces();
  };

  return (
    <div className="min-h-screen bg-[#F8F5EE]">
      <Navbar onOpenAddVisit={() => setIsAddVisitOpen(true)} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Page Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-[#273C3A]">Explore Places in Pune</h1>
            <p className="text-xs text-[#89928D] mt-1">
              Filter by Pune localities, category, price level, or view on the interactive map.
            </p>
          </div>

          {/* Grid vs Map Toggle */}
          <div className="flex items-center gap-1 bg-white border border-[#E8E7DF] rounded-full p-1 shadow-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-smooth ${
                viewMode === 'grid' ? 'bg-[#254542] text-white shadow-sm' : 'text-[#89928D] hover:text-[#273C3A]'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Grid View</span>
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-smooth ${
                viewMode === 'map' ? 'bg-[#254542] text-white shadow-sm' : 'text-[#89928D] hover:text-[#273C3A]'
              }`}
            >
              <Map className="w-4 h-4" />
              <span>Map View</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="bg-white rounded-3xl p-5 border border-[#E8E7DF] shadow-sm space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#89928D]" />
              <input
                type="text"
                placeholder="Search by cafe name, food, or keyword..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl pl-11 pr-4 py-3 text-xs font-medium text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 rounded-2xl bg-[#254542] text-white font-bold text-xs shadow-sm hover:bg-[#1C3533] transition-smooth"
            >
              Search
            </button>
          </form>

          {/* Categories Pill Selector */}
          <CategoryFilterPills
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />

          {/* Pune Locality & Price Filter Row */}
          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-[#E8E7DF]">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-[#254542]" />
              <span className="text-xs font-bold text-[#273C3A]">Locality:</span>
              <select
                value={selectedLocality}
                onChange={e => setSelectedLocality(e.target.value)}
                className="bg-[#F8F5EE] border border-[#E8E7DF] rounded-xl px-3 py-1.5 text-xs font-semibold text-[#273C3A] focus:outline-none focus:ring-2 focus:ring-[#254542]"
              >
                <option value="All">All Pune Areas</option>
                {PUNE_LOCALITIES.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5 text-[#254542]" />
              <span className="text-xs font-bold text-[#273C3A]">Price:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setSelectedPriceLevel(undefined)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-smooth ${
                    selectedPriceLevel === undefined ? 'bg-[#254542] text-white' : 'bg-[#F8F5EE] text-[#89928D]'
                  }`}
                >
                  Any
                </button>
                {[1, 2, 3, 4].map(lvl => (
                  <button
                    key={lvl}
                    onClick={() => setSelectedPriceLevel(lvl)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-smooth ${
                      selectedPriceLevel === lvl ? 'bg-[#254542] text-white' : 'bg-[#F8F5EE] text-[#89928D]'
                    }`}
                  >
                    {'$'.repeat(lvl)}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                setSelectedCategory('All');
                setSelectedLocality('All');
                setSelectedPriceLevel(undefined);
                setSearchQuery('');
              }}
              className="ml-auto text-xs font-bold text-[#89928D] hover:text-[#254542] flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Reset Filters
            </button>
          </div>
        </div>

        {/* View Mode Switch Logic */}
        {viewMode === 'grid' ? (
          <div>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-64 rounded-3xl bg-white/60 animate-pulse border border-[#E8E7DF]" />
                ))}
              </div>
            ) : places.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-[#E8E7DF]">
                <span className="text-4xl block mb-2">🔍</span>
                <h3 className="font-bold text-lg text-[#273C3A]">No places found</h3>
                <p className="text-xs text-[#89928D] mt-1">Try resetting your locality or category filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {places.map(place => (
                  <PlaceCard key={place.id} place={place} />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Interactive Soft Map View Representation */
          <div className="bg-white rounded-3xl p-6 border border-[#E8E7DF] shadow-card min-h-[500px] relative overflow-hidden flex flex-col items-center justify-center text-center">
            {/* Soft map vector background pattern */}
            <div className="absolute inset-0 bg-[#F4EFE6] opacity-60 flex items-center justify-center">
              <svg className="w-full h-full text-[#AAB69A]/30" fill="none" stroke="currentColor" viewBox="0 0 100 100">
                <path d="M10,20 Q30,5 50,20 T90,20 M10,50 Q30,35 50,50 T90,50 M10,80 Q30,65 50,80 T90,80" strokeWidth="2" strokeDasharray="3,3" />
              </svg>
            </div>

            {/* Map markers for Pune places */}
            <div className="relative z-10 space-y-4 max-w-md bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-xl border border-[#E8E7DF]">
              <MapPin className="w-12 h-12 text-[#254542] mx-auto animate-bounce" />
              <h3 className="text-xl font-bold text-[#273C3A]">Pune Localities Map</h3>
              <p className="text-xs text-[#89928D]">
                Showing {places.length} place coordinates across Baner, Koregaon Park, Viman Nagar & Kothrud.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {places.map(p => (
                  <span key={p.id} className="text-[11px] font-bold bg-[#E8EFEF] text-[#254542] px-3 py-1 rounded-full border border-[#254542]/20">
                    📍 {p.name} ({p.locality})
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      <AddVisitModal
        isOpen={isAddVisitOpen}
        onClose={() => setIsAddVisitOpen(false)}
        onSuccess={() => fetchPlaces()}
      />
    </div>
  );
}
