import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getCollection } from '@/lib/db/dbAdapter';
import { CollectionSchema } from '@spotdiary/shared';

export async function GET() {
  try {
    const user = await getCurrentUser();
    const collectionsCollection = await getCollection('collections');

    let query: any = { visibility: 'public' };
    if (user) {
      query = {
        $or: [
          { visibility: 'public' },
          { user_id: user.id }
        ]
      };
    }

    const cursor = await collectionsCollection.find(query);
    const rawCollections = await cursor.toArray();

    const collections = rawCollections.map((doc: any) => ({
      id: doc.id,
      user_id: doc.user_id,
      title: doc.title,
      description: doc.description || '',
      visibility: doc.visibility || 'public',
      place_ids: doc.place_ids || doc.placeIds || [],
      places_count: (doc.place_ids || doc.placeIds || []).length,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
    }));

    return NextResponse.json({
      collections,
      authenticated: !!user,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error fetching collections' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to create a collection.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsePayload = {
      title: body.title,
      description: body.description,
      visibility: body.visibility || 'public',
      place_ids: body.place_ids || body.placeIds || [],
    };

    const parseResult = CollectionSchema.safeParse(parsePayload);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Collection validation failed.', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { title, description, visibility, place_ids } = parseResult.data;

    // Deduplicate place IDs and limit max places per collection (50 max)
    const uniquePlaceIds = Array.from(new Set(place_ids.filter((id: string) => id.trim().length > 0)));
    if (uniquePlaceIds.length > 50) {
      return NextResponse.json(
        { error: 'Collections cannot exceed 50 places.' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const newCollectionDoc = {
      id: `coll-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user_id: user.id,
      title: title.trim(),
      description: description ? description.trim() : '',
      visibility,
      place_ids: uniquePlaceIds,
      created_at: now,
      updated_at: now,
    };

    const collectionsCollection = await getCollection('collections');
    await collectionsCollection.insertOne(newCollectionDoc);

    return NextResponse.json({
      success: true,
      collection: {
        ...newCollectionDoc,
        places_count: uniquePlaceIds.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error creating collection' },
      { status: 500 }
    );
  }
}
