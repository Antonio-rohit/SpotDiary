import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db/dbAdapter';
import { Place } from '@spotdiary/shared';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Place ID is required.' }, { status: 400 });
    }

    // 1. Check MongoDB places collection
    const placesCollection = await getCollection('places');
    const dbPlace = await placesCollection.findOne({ id });
    if (dbPlace) {
      return NextResponse.json({ success: true, place: dbPlace });
    }

    // 2. Fallback to Google Places API lookup if API key configured
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (apiKey) {
      try {
        const googleRes = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'id,displayName,formattedAddress,types,rating,userRatingCount,priceLevel,location,photos'
          }
        });

        if (googleRes.ok) {
          const gPlace = await googleRes.json();
          const place: Place = {
            id: gPlace.id,
            provider: 'google',
            provider_place_id: gPlace.id,
            name: gPlace.displayName?.text || 'SpotDiary Place',
            description: `Popular cafe and spot in Pune. Address: ${gPlace.formattedAddress || 'Pune, MH'}`,
            category: 'Cafes',
            address: gPlace.formattedAddress || 'Pune, Maharashtra',
            locality: 'Pune',
            city: 'Pune',
            latitude: gPlace.location?.latitude,
            longitude: gPlace.location?.longitude,
            verification_status: 'verified',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            rating_avg: gPlace.rating || 4.5,
            reviews_count: gPlace.userRatingCount || 50,
            image_urls: [
              'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=1000'
            ],
            popular_items: ['Specialty Coffee', 'Signature Item']
          };

          await placesCollection.updateOne({ id: place.id }, { $set: place }, { upsert: true }).catch(() => {});

          return NextResponse.json({ success: true, place });
        }
      } catch {}
    }

    return NextResponse.json({ error: 'Place not found.' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error fetching place.' }, { status: 500 });
  }
}
