import { NextRequest, NextResponse } from 'next/server';
import { Place, Category } from '@spotdiary/shared';
import { getCollection } from '@/lib/db/dbAdapter';

// Mapping helper for Google PriceLevel string to 1-4 scale
function parsePriceLevel(priceLevelStr?: string): number {
  switch (priceLevelStr) {
    case 'PRICE_LEVEL_INEXPENSIVE': return 1;
    case 'PRICE_LEVEL_MODERATE': return 2;
    case 'PRICE_LEVEL_EXPENSIVE': return 3;
    case 'PRICE_LEVEL_VERY_EXPENSIVE': return 4;
    default: return 2;
  }
}

// Category mapper from Google Place types
function inferCategory(types?: string[], fallbackCategory?: string): Category {
  if (!types || types.length === 0) {
    return (fallbackCategory as Category) || 'Cafes';
  }
  const typeSet = new Set(types);
  if (typeSet.has('cafe') || typeSet.has('coffee_shop')) return 'Cafes';
  if (typeSet.has('bakery') || typeSet.has('dessert_shop')) return 'Bakeries and Desserts';
  if (typeSet.has('night_club') || typeSet.has('bar') || typeSet.has('pub')) return 'Clubs and Nightlife';
  if (typeSet.has('restaurant')) return 'Restaurants';
  if (typeSet.has('park')) return 'Nature and Outdoor Places';
  return (fallbackCategory as Category) || 'Cafes';
}

// Extract Pune locality from formatted address
function extractLocality(address: string, fallbackLocality?: string): string {
  if (fallbackLocality && fallbackLocality !== 'All') return fallbackLocality;
  
  const knownLocalities = [
    'Baner', 'Balewadi', 'Koregaon Park', 'Viman Nagar', 'Kothrud', 
    'Hinjawadi', 'FC Road', 'Shivajinagar', 'Aundh', 'Kalyani Nagar', 
    'Bavdhan', 'Erandwane', 'Wakad', 'Magarpatta'
  ];

  for (const loc of knownLocalities) {
    if (new RegExp(`\\b${loc}\\b`, 'i').test(address)) {
      return loc;
    }
  }
  return 'Pune';
}

// Pool of distinct, high-quality cafe & lifestyle photographs
const PHOTO_POOL = [
  'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=1000',
  'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&q=80&w=1000',
  'https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&q=80&w=1000',
  'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&q=80&w=1000',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1000',
  'https://images.unsplash.com/photo-1498804103079-a6351b050096?auto=format&fit=crop&q=80&w=1000',
  'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=1000',
  'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=1000',
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1000',
  'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&q=80&w=1000',
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&q=80&w=1000',
  'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&q=80&w=1000',
  'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?auto=format&fit=crop&q=80&w=1000',
  'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&q=80&w=1000',
  'https://images.unsplash.com/photo-1493857671505-72967e2e2760?auto=format&fit=crop&q=80&w=1000',
  'https://images.unsplash.com/photo-1463797221720-6b07e6426c24?auto=format&fit=crop&q=80&w=1000',
  'https://images.unsplash.com/photo-1507133750040-4a8f57021571?auto=format&fit=crop&q=80&w=1000',
  'https://images.unsplash.com/photo-1525610553991-2bede1a236e2?auto=format&fit=crop&q=80&w=1000'
];

/**
 * Generates a unique list of photographs specific to each place ID
 */
function getUniquePlacePhotos(gPlace: any, placeId: string, index: number): string[] {
  const resultPhotos: string[] = [];

  // 1. Check if Google Places API returned photo objects
  if (gPlace.photos && Array.isArray(gPlace.photos) && gPlace.photos.length > 0) {
    gPlace.photos.forEach((photo: any) => {
      if (photo.name) {
        resultPhotos.push(`/api/places/photo?name=${encodeURIComponent(photo.name)}`);
      }
    });
  }

  // 2. If API photos are empty or unavailable, compute a deterministic unique photo selection from photo pool based on place ID hash
  if (resultPhotos.length === 0) {
    let hash = 0;
    for (let i = 0; i < placeId.length; i++) {
      hash = (hash << 5) - hash + placeId.charCodeAt(i);
      hash |= 0;
    }

    const primaryIdx = Math.abs(hash) % PHOTO_POOL.length;
    const secondaryIdx = Math.abs(hash + index + 5) % PHOTO_POOL.length;

    resultPhotos.push(PHOTO_POOL[primaryIdx]);
    if (secondaryIdx !== primaryIdx) {
      resultPhotos.push(PHOTO_POOL[secondaryIdx]);
    }
  }

  return resultPhotos;
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      error: 'Google Maps API key is not configured on the server.',
      isConfigured: false,
      places: []
    }, { status: 200 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || '';
  const category = searchParams.get('category') || 'All';
  const locality = searchParams.get('locality') || 'All';

  // Construct text query string focused on Pune, Maharashtra
  let textQueryParts: string[] = [];
  
  if (query.trim()) {
    textQueryParts.push(query.trim());
  } else if (category !== 'All') {
    textQueryParts.push(category);
  } else {
    textQueryParts.push('cafes');
  }

  if (locality !== 'All') {
    textQueryParts.push(`in ${locality}`);
  }

  textQueryParts.push('Pune Maharashtra India');

  const textQuery = textQueryParts.join(' ');

  try {
    const googleRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.types,places.rating,places.userRatingCount,places.priceLevel,places.location,places.photos'
      },
      body: JSON.stringify({
        textQuery,
        locationBias: {
          circle: {
            center: {
              latitude: 18.5204,
              longitude: 73.8567
            },
            radius: 20000.0
          }
        }
      })
    });

    if (!googleRes.ok) {
      const errorText = await googleRes.text();
      console.error('[Google Places API Error]', googleRes.status);
      return NextResponse.json({
        error: `Google Places API returned status ${googleRes.status}`,
        isConfigured: true,
        places: []
      }, { status: 200 });
    }

    const data = await googleRes.json();
    const rawPlaces = data.places || [];

    // Normalize Google Places into SpotDiary Place model
    const normalizedPlaces: Place[] = rawPlaces.map((gPlace: any, index: number) => {
      const placeCategory = inferCategory(gPlace.types, category !== 'All' ? category : undefined);
      const placeLocality = extractLocality(gPlace.formattedAddress || '', locality);
      const uniquePhotos = getUniquePlacePhotos(gPlace, gPlace.id, index);

      return {
        id: gPlace.id,
        provider: 'google',
        provider_place_id: gPlace.id,
        name: gPlace.displayName?.text || 'Unnamed Place',
        description: `Popular ${placeCategory.toLowerCase()} in ${placeLocality}, Pune. Address: ${gPlace.formattedAddress}`,
        category: placeCategory,
        address: gPlace.formattedAddress || `${placeLocality}, Pune, Maharashtra`,
        locality: placeLocality,
        city: 'Pune',
        latitude: gPlace.location?.latitude,
        longitude: gPlace.location?.longitude,
        price_level: parsePriceLevel(gPlace.priceLevel),
        verification_status: 'verified',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        rating_avg: gPlace.rating || 4.5,
        reviews_count: gPlace.userRatingCount || 100,
        distance_km: Number((1.0 + (index * 0.4)).toFixed(1)),
        image_urls: uniquePhotos,
        popular_items: ['Specialty Coffee', 'Artisan Pastry', 'Signature Dish']
      };
    });

    // Cache normalized places into MongoDB places collection for cross-platform persistence
    getCollection('places').then((placesCollection) => {
      const bulkOps = normalizedPlaces.map((p) => ({
        updateOne: {
          filter: { id: p.id },
          update: { $set: p },
          upsert: true,
        },
      }));
      if (bulkOps.length > 0 && typeof placesCollection.bulkWrite === 'function') {
        placesCollection.bulkWrite(bulkOps).catch(() => {});
      }
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      isConfigured: true,
      query: textQuery,
      places: normalizedPlaces
    });

  } catch (error: any) {
    console.error('[Places API Network Failure]', error?.message);
    return NextResponse.json({
      error: 'Network failure when connecting to Google Places API.',
      isConfigured: true,
      places: []
    }, { status: 200 });
  }
}
