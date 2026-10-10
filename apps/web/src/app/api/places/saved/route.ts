import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getCollection } from '@/lib/db/dbAdapter';
import { Place } from '@spotdiary/shared';
import { z } from 'zod';

const SavedPlaceToggleSchema = z.object({
  place_id: z.string().min(1, 'place_id is required'),
  place: z.any().optional(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ places: [], authenticated: false });
    }

    const savedCollection = await getCollection('saved_places');
    const savedRecords = await savedCollection.find({ user_id: user.id });
    const recordsArray = await savedRecords.toArray();
    const placeIds = recordsArray.map((r: any) => r.place_id);

    const placesCollection = await getCollection('places');
    const placesCursor = await placesCollection.find({ id: { $in: placeIds } });
    const places = await placesCursor.toArray();

    // Check for any saved placeIds not yet in places collection
    const missingPlaceIds = placeIds.filter((pId: string) => !places.some((p: any) => p.id === pId));
    if (missingPlaceIds.length > 0) {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      for (const mId of missingPlaceIds) {
        if (apiKey) {
          try {
            const googleRes = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(mId)}`, {
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'id,displayName,formattedAddress,types,rating,userRatingCount,priceLevel,location,photos',
              },
            });

            if (googleRes.ok) {
              const gPlace = await googleRes.json();
              const resolvedPlace: Place = {
                id: gPlace.id,
                provider: 'google',
                provider_place_id: gPlace.id,
                name: gPlace.displayName?.text || 'Saved Place',
                description: `Saved spot in Pune. Address: ${gPlace.formattedAddress || 'Pune, MH'}`,
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
                  'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=1000',
                ],
                popular_items: ['Specialty Coffee'],
              };
              await placesCollection.updateOne({ id: resolvedPlace.id }, { $set: resolvedPlace }, { upsert: true });
              places.push(resolvedPlace);
            }
          } catch {}
        }
      }
    }

    return NextResponse.json({ places, authenticated: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error fetching saved places' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in first.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parseResult = SavedPlaceToggleSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid place_id parameter.', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { place_id, place } = parseResult.data;
    const savedCollection = await getCollection('saved_places');
    const placesCollection = await getCollection('places');

    // If place object is provided in payload, ensure it is cached in places collection
    if (place && place.id) {
      await placesCollection.updateOne({ id: place.id }, { $set: place }, { upsert: true });
    }

    const existing = await savedCollection.findOne({ user_id: user.id, place_id });
    if (existing) {
      await savedCollection.deleteOne({ user_id: user.id, place_id });
      return NextResponse.json({ saved: false, message: 'Removed from saved places.' });
    } else {
      await savedCollection.insertOne({
        user_id: user.id,
        place_id,
        created_at: new Date().toISOString(),
      });
      return NextResponse.json({ saved: true, message: 'Saved to wishlist.' });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error saving place' }, { status: 500 });
  }
}
