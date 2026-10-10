'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Star, Heart, MapPin } from 'lucide-react';
import { Place } from '@spotdiary/shared';
import { PlaceService } from '@/lib/placeService';

interface PlaceCardProps {
  place: Place;
  layout?: 'grid' | 'horizontal';
  isSavedInitial?: boolean;
}

const NEUTRAL_PLACEHOLDER = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300' fill='%23F4EFE6'%3E%3Crect width='400' height='300' fill='%23F4EFE6'/%3E%3Cpath d='M200 130c-11 0-20 9-20 20 0 15 20 35 20 35s20-20 20-35c0-11-9-20-20-20zm0 27c-3.9 0-7-3.1-7-7s3.1-7 7-7 7 3.1 7 7-3.1 7-7 7z' fill='%23254542' opacity='0.4'/%3E%3C/svg%3E";

export default function PlaceCard({ place, layout = 'grid', isSavedInitial = false }: PlaceCardProps) {
  const [isSaved, setIsSaved] = useState(isSavedInitial);
  
  const primaryPhoto = place.image_urls && place.image_urls.length > 0 ? place.image_urls[0] : NEUTRAL_PLACEHOLDER;
  const secondaryPhoto = place.image_urls && place.image_urls.length > 1 ? place.image_urls[1] : NEUTRAL_PLACEHOLDER;
  
  const [currentImgSrc, setCurrentImgSrc] = useState(primaryPhoto);
  const [isImgLoading, setIsImgLoading] = useState(true);

  const handleToggleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newState = await PlaceService.toggleSavedPlace(place.id);
    setIsSaved(newState);
  };

  const handleImageError = () => {
    if (currentImgSrc !== secondaryPhoto && secondaryPhoto !== NEUTRAL_PLACEHOLDER) {
      setCurrentImgSrc(secondaryPhoto);
    } else if (currentImgSrc !== NEUTRAL_PLACEHOLDER) {
      setCurrentImgSrc(NEUTRAL_PLACEHOLDER);
    }
  };

  if (layout === 'horizontal') {
    return (
      <Link 
        href={`/places/${place.id}`}
        className="group bg-white rounded-3xl p-3 border border-[#E8E7DF] shadow-card hover:shadow-soft transition-smooth flex items-center gap-4 cursor-pointer"
      >
        <div className="relative w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 bg-gray-100">
          {isImgLoading && (
            <div className="absolute inset-0 bg-gray-200 animate-pulse rounded-2xl" />
          )}
          <Image
            src={currentImgSrc}
            alt={place.name}
            fill
            sizes="96px"
            onLoad={() => setIsImgLoading(false)}
            onError={handleImageError}
            className="object-cover group-hover:scale-105 transition-smooth"
          />
        </div>
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-sm text-[#273C3A] truncate group-hover:text-[#254542] transition-smooth">
              {place.name}
            </h3>
            <span className="text-xs font-semibold text-[#89928D] flex-shrink-0">
              {place.distance_km ? `${place.distance_km} km` : 'Near you'}
            </span>
          </div>
          <p className="text-xs text-[#89928D] mt-0.5 truncate">{place.locality}, Pune</p>
          <div className="flex items-center gap-1 mt-2">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="text-xs font-bold text-[#273C3A]">{place.rating_avg || 4.8}</span>
            <span className="text-[11px] text-[#89928D]">({place.reviews_count || 500}+)</span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link 
      href={`/places/${place.id}`}
      className="group bg-white rounded-3xl p-3.5 border border-[#E8E7DF] shadow-card hover:shadow-soft transition-smooth flex flex-col justify-between cursor-pointer"
    >
      {/* Image container with rounded corners matching UI reference */}
      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-gray-100 mb-3">
        {isImgLoading && (
          <div className="absolute inset-0 bg-gray-200 animate-pulse rounded-2xl" />
        )}
        <Image
          src={currentImgSrc}
          alt={place.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          onLoad={() => setIsImgLoading(false)}
          onError={handleImageError}
          className="object-cover group-hover:scale-105 transition-smooth"
        />

        {/* Heart Wishlist Toggle Button */}
        <button
          onClick={handleToggleSave}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center shadow-md hover:scale-110 transition-smooth"
        >
          <Heart className={`w-4 h-4 ${isSaved ? 'fill-rose-500 text-rose-500' : 'text-[#254542]'}`} />
        </button>

        {/* Locality badge overlay on bottom left */}
        <div className="absolute bottom-3 left-3 bg-black/40 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
          <MapPin className="w-3 h-3 text-white/90" />
          <span>{place.locality}, Pune</span>
        </div>
      </div>

      {/* Place info */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-base text-[#273C3A] group-hover:text-[#254542] transition-smooth leading-tight">
            {place.name}
          </h3>
          <span className="text-xs font-semibold text-[#89928D] whitespace-nowrap pt-0.5">
            {place.distance_km ? `${place.distance_km} km` : '1.2 km'}
          </span>
        </div>

        {/* Ratings and review count */}
        <div className="flex items-center gap-1.5 mt-2">
          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          <span className="text-xs font-bold text-[#273C3A]">
            {place.rating_avg || 4.9}
          </span>
          <span className="text-xs text-[#89928D]">
            / {place.reviews_count || 809} reviews
          </span>
        </div>
      </div>
    </Link>
  );
}
