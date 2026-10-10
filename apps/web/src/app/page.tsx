'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import CategoryFilterPills from '@/components/CategoryFilterPills';
import PlaceCard from '@/components/PlaceCard';
import AddVisitModal from '@/components/AddVisitModal';
import { Place, Collection } from '@spotdiary/shared';
import { PlaceService } from '@/lib/placeService';
import { Search, SlidersHorizontal, Bell, ArrowRight, Coffee, Sparkles } from 'lucide-react';

export default function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isAddVisitOpen, setIsAddVisitOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlaces();
    PlaceService.getCollections().then(setCollections);
  }, [selectedCategory]);

  const fetchPlaces = async () => {
    setLoading(true);
    const data = await PlaceService.getPlaces({
      category: selectedCategory,
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

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">

        {/* Hero & Greeting Section closely matching UI reference header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-2">
          <div>
            <div className="flex items-center gap-2 text-[#254542] mb-1">
              <Sparkles className="w-4 h-4 fill-[#254542]" />
              <span className="text-xs font-extrabold uppercase tracking-widest text-[#89928D]">
                Pune Place Discovery
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#273C3A]">
              Enjoy your morning <span className="text-[#254542]">Coffee ☕</span>
            </h1>
            <p className="text-xs md:text-sm text-[#89928D] mt-1 max-w-xl">
              Discover hidden cafes in Baner & Koregaon Park, save your experiences, and never forget where you had that amazing meal.
            </p>
          </div>

          {/* Notification bell icon button matching reference UI top right */}
          <div className="hidden md:flex items-center gap-3">
            <button className="w-11 h-11 rounded-2xl bg-white border border-[#E8E7DF] flex items-center justify-center text-[#254542] shadow-sm hover:scale-105 transition-smooth">
              <Bell className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar & Filter Button (Matching reference UI exact layout) */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#89928D]" />
            <input
              type="text"
              placeholder="Search cafes, coffee, places, or experiences in Pune..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-[#E8E7DF] rounded-2xl pl-12 pr-4 py-3.5 text-sm font-medium text-[#273C3A] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#254542] transition-smooth placeholder:text-[#89928D]"
            />
          </div>
          <button
            type="submit"
            className="w-12 h-12 rounded-2xl bg-[#254542] text-white flex items-center justify-center shadow-md hover:bg-[#1C3533] transition-smooth flex-shrink-0"
            title="Filter Results"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </form>

        {/* Category Pills matching reference UI */}
        <div>
          <CategoryFilterPills
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        </div>

        {/* Section 1: Nearby Place (Horizontal Card Grid matching reference) */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[#273C3A]">Nearby Places in Pune</h2>
            <Link 
              href="/explore" 
              className="text-xs font-bold text-[#89928D] hover:text-[#254542] flex items-center gap-1 transition-smooth"
            >
              <span>See all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 rounded-3xl bg-white/60 animate-pulse border border-[#E8E7DF]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {places.slice(0, 3).map((place) => (
                <PlaceCard key={place.id} place={place} />
              ))}
            </div>
          )}
        </section>

        {/* Section 2: Special for you (Horizontal row card matching reference lower UI) */}
        <section className="bg-white/50 border border-[#E8E7DF] rounded-3xl p-5 md:p-6 backdrop-blur-sm shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-[#273C3A]">Special for you</h2>
              <p className="text-xs text-[#89928D]">Handpicked recommendations based on popular Pune reviews</p>
            </div>
            <Link href="/explore" className="text-xs font-bold text-[#89928D] hover:text-[#254542]">
              See all
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {places.slice(3, 5).map((place) => (
              <PlaceCard key={place.id} place={place} layout="horizontal" />
            ))}
          </div>
        </section>

        {/* Section 3: Featured Pune Collections */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[#273C3A]">Featured Community Collections</h2>
            <Link href="/collections" className="text-xs font-bold text-[#89928D] hover:text-[#254542]">
              Explore all collections
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {collections.map((coll) => (
              <Link
                key={coll.id}
                href="/collections"
                className="group bg-white rounded-3xl p-5 border border-[#E8E7DF] shadow-card hover:shadow-soft transition-smooth block"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-[#254542]/10 text-[#254542] flex items-center justify-center flex-shrink-0 font-bold text-xl">
                    ☕
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-[#273C3A] group-hover:text-[#254542] transition-smooth">
                      {coll.title}
                    </h3>
                    <p className="text-xs text-[#89928D] line-clamp-1 mt-0.5">
                      {coll.description}
                    </p>
                    <span className="inline-block mt-2 text-[11px] font-bold text-[#254542] bg-[#E8EFEF] px-2.5 py-0.5 rounded-full">
                      {coll.places_count} Places included
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Section 4: Personal Travel Diary Banner */}
        <section className="bg-[#254542] text-white rounded-3xl p-8 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="relative z-10 max-w-xl">
            <span className="text-xs font-bold uppercase tracking-widest text-[#AAB69A] block mb-1">
              Personal Memory Vault
            </span>
            <h2 className="text-2xl md:text-3xl font-bold leading-tight">
              Never forget where you had that amazing Cold Coffee in Baner.
            </h2>
            <p className="text-xs md:text-sm text-white/80 mt-2">
              Record ratings, tags, who you visited with, and search your personal visit history using simple queries.
            </p>
            <button
              onClick={() => setIsAddVisitOpen(true)}
              className="mt-5 px-6 py-3 rounded-full bg-white text-[#254542] font-bold text-xs shadow-md hover:bg-[#F8F5EE] transition-smooth"
            >
              Log Your First Visit Memory
            </button>
          </div>

          <div className="w-32 h-32 md:w-44 md:h-44 rounded-full bg-[#1C3533]/60 border border-white/10 flex items-center justify-center text-5xl flex-shrink-0">
            📖
          </div>
        </section>

      </div>

      <AddVisitModal
        isOpen={isAddVisitOpen}
        onClose={() => setIsAddVisitOpen(false)}
        onSuccess={() => fetchPlaces()}
      />
    </div>
  );
}
