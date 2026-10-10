'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import AddVisitModal from '@/components/AddVisitModal';
import { Place } from '@spotdiary/shared';
import { PlaceService } from '@/lib/placeService';
import { 
  ArrowLeft, Heart, Share2, Star, MapPin, Coffee, 
  Sparkles, ExternalLink, Calendar, CheckCircle, Navigation
} from 'lucide-react';

export default function PlaceDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const placeId = params.id as string;

  const [place, setPlace] = useState<Place | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [peopleLoveItems, setPeopleLoveItems] = useState<string[]>([]);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [isAddVisitOpen, setIsAddVisitOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (placeId) {
      loadPlaceData();
    }
  }, [placeId]);

  const loadPlaceData = async () => {
    setLoading(true);
    const placeData = await PlaceService.getPlaceById(placeId);
    if (placeData) {
      setPlace(placeData);
      const saved = await PlaceService.isPlaceSaved(placeId);
      setIsSaved(saved);
      const items = await PlaceService.getWhatPeopleLove(placeId);
      setPeopleLoveItems(items);
    }
    setLoading(false);
  };

  const handleToggleSave = async () => {
    if (!place) return;
    const newState = await PlaceService.toggleSavedPlace(place.id);
    setIsSaved(newState);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F5EE]">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <div className="w-12 h-12 border-4 border-[#254542] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-[#89928D] mt-3 font-semibold">Loading place details...</p>
        </div>
      </div>
    );
  }

  if (!place) {
    return (
      <div className="min-h-screen bg-[#F8F5EE]">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center bg-white rounded-3xl border border-[#E8E7DF] my-8 p-8">
          <span className="text-4xl block mb-2">📍</span>
          <h2 className="text-2xl font-bold text-[#273C3A]">Place Not Found</h2>
          <p className="text-xs text-[#89928D] mt-1 mb-6">The requested cafe or venue could not be found in Pune.</p>
          <Link href="/explore" className="px-6 py-3 rounded-full bg-[#254542] text-white font-bold text-xs">
            Back to Explore
          </Link>
        </div>
      </div>
    );
  }

  const NEUTRAL_PLACEHOLDER = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300' fill='%23F4EFE6'%3E%3Crect width='400' height='300' fill='%23F4EFE6'/%3E%3Cpath d='M200 130c-11 0-20 9-20 20 0 15 20 35 20 35s20-20 20-35c0-11-9-20-20-20zm0 27c-3.9 0-7-3.1-7-7s3.1-7 7-7 7 3.1 7 7-3.1 7-7 7z' fill='%23254542' opacity='0.4'/%3E%3C/svg%3E";

  const images = place.image_urls && place.image_urls.length > 0 
    ? place.image_urls 
    : [NEUTRAL_PLACEHOLDER];

  return (
    <div className="min-h-screen bg-[#F8F5EE]">
      <Navbar onOpenAddVisit={() => setIsAddVisitOpen(true)} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Back navigation & Share/Save Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-xs font-bold text-[#254542] bg-white border border-[#E8E7DF] px-4 py-2 rounded-full shadow-sm hover:bg-[#F8F5EE] transition-smooth"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: place.name, url: window.location.href });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  alert('Place link copied to clipboard!');
                }
              }}
              className="w-10 h-10 rounded-full bg-white border border-[#E8E7DF] flex items-center justify-center text-[#254542] shadow-sm hover:scale-105 transition-smooth"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleToggleSave}
              className="w-10 h-10 rounded-full bg-white border border-[#E8E7DF] flex items-center justify-center shadow-sm hover:scale-105 transition-smooth"
            >
              <Heart className={`w-4 h-4 ${isSaved ? 'fill-rose-500 text-rose-500' : 'text-[#254542]'}`} />
            </button>
          </div>
        </div>

        {/* Top Image Slider & Gallery (Matching reference image details screen) */}
        <div className="bg-white rounded-3xl p-3 border border-[#E8E7DF] shadow-card">
          <div className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden bg-gray-100">
            <Image
              src={images[activePhotoIdx]}
              alt={place.name}
              fill
              priority
              className="object-cover transition-smooth"
            />

            {/* Locality badge overlay */}
            <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              <span>{place.locality}, Pune</span>
            </div>

            {/* Slider Dots matching reference image */}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-full">
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActivePhotoIdx(idx)}
                    className={`h-2 rounded-full transition-all ${
                      idx === activePhotoIdx ? 'w-5 bg-white' : 'w-2 bg-white/50'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Place Title, Distance Tag & Rating (Matching UI reference text arrangement) */}
        <div className="bg-white rounded-3xl p-6 border border-[#E8E7DF] shadow-card space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-[#E8EFEF] text-[#254542] text-[11px] font-extrabold uppercase tracking-wider mb-2">
                {place.category}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#273C3A] leading-tight">
                {place.name}
              </h1>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-sm font-bold text-[#89928D] block">
                {place.distance_km ? `${place.distance_km} km` : '1.26 km'}
              </span>
              <span className="text-[11px] text-[#254542] font-bold">Near you</span>
            </div>
          </div>

          {/* Rating Badge */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-3 py-1 rounded-full">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="text-xs font-bold">{place.rating_avg || 4.9}</span>
            </div>
            <span className="text-xs text-[#89928D] font-medium">
              / {place.reviews_count || 809} community reviews
            </span>
          </div>

          {/* Offering / Amenity Icon Pills (Matching UI reference: Coffee, Sippy Cups, Donut, Cookies) */}
          <div className="pt-2">
            <span className="text-xs font-bold text-[#89928D] uppercase tracking-wider block mb-3">
              Popular Offerings
            </span>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Coffee', icon: '☕' },
                { label: 'Sippy Cups', icon: '🥤' },
                { label: 'Donut', icon: '🍩' },
                { label: 'Cookies', icon: '🍪' }
              ].map((item, i) => (
                <div key={i} className="bg-[#F8F5EE] border border-[#E8E7DF] rounded-2xl p-3 text-center flex flex-col items-center justify-center gap-1">
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-[11px] font-bold text-[#273C3A]">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-sm font-bold text-[#273C3A] mb-1">About this spot</h3>
            <p className="text-xs text-[#89928D] leading-relaxed">
              {place.description}
            </p>
          </div>

          {/* Soft Map Preview snippet (Matching UI reference map card) */}
          <div className="pt-2">
            <h3 className="text-sm font-bold text-[#273C3A] mb-2 flex items-center gap-1">
              <MapPin className="w-4 h-4 text-[#254542]" />
              Location & Directions
            </h3>
            <div className="bg-[#F4EFE6] border border-[#E8E7DF] rounded-2xl p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-[#273C3A]">{place.address}</p>
                <p className="text-[11px] text-[#89928D] mt-0.5">{place.locality}, Pune, Maharashtra</p>
              </div>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(place.name + ' ' + place.address + ' Pune')}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-white text-[#254542] border border-[#E8E7DF] text-xs font-bold shadow-sm hover:bg-[#254542] hover:text-white transition-smooth flex-shrink-0"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Directions</span>
              </a>
            </div>
          </div>

          {/* Primary Action Button matching reference ("Log Visit Memory") */}
          <div className="pt-4">
            <button
              onClick={() => setIsAddVisitOpen(true)}
              className="w-full py-4 rounded-2xl text-sm font-bold text-white bg-[#254542] hover:bg-[#1C3533] shadow-lg transition-smooth flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Log Your Experience / Visit</span>
            </button>
          </div>

        </div>

        {/* "What people love here" Section (Generated from visits data as required!) */}
        <div className="bg-white rounded-3xl p-6 border border-[#E8E7DF] shadow-card space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
              ♥
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#273C3A]">What people love here</h3>
              <p className="text-xs text-[#89928D]">Extracted from real user visit memory notes in Pune</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {peopleLoveItems.map((item, idx) => (
              <span
                key={idx}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#F8F5EE] border border-[#E8E7DF] text-[#254542] flex items-center gap-1.5"
              >
                <span>✨</span>
                <span>{item}</span>
              </span>
            ))}
          </div>
        </div>

      </div>

      <AddVisitModal
        isOpen={isAddVisitOpen}
        onClose={() => setIsAddVisitOpen(false)}
        preselectedPlaceId={place.id}
        onSuccess={() => loadPlaceData()}
      />
    </div>
  );
}
