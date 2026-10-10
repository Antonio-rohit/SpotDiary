import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getCollection } from '@/lib/db/dbAdapter';
import { CollectionEditSchema } from '@spotdiary/shared';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Collection ID is required' }, { status: 400 });
    }

    const user = await getCurrentUser();
    const collectionsCollection = await getCollection('collections');
    const doc = await collectionsCollection.findOne({ id });

    if (!doc) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    // Privacy Authorization: Private collection can only be viewed by its owner
    if (doc.visibility === 'private' && (!user || user.id !== doc.user_id)) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    const placeIds = doc.place_ids || doc.placeIds || [];
    const placesCollection = await getCollection('places');
    const placesCursor = await placesCollection.find({ id: { $in: placeIds } });
    const rawPlaces = await placesCursor.toArray();

    // Preserve place order as defined in place_ids
    const places = placeIds
      .map((pId: string) => rawPlaces.find((p: any) => p.id === pId))
      .filter(Boolean);

    return NextResponse.json({
      collection: {
        id: doc.id,
        user_id: doc.user_id,
        title: doc.title,
        description: doc.description || '',
        visibility: doc.visibility || 'public',
        place_ids: placeIds,
        places_count: placeIds.length,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        places,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error fetching collection' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Collection ID is required' }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const collectionsCollection = await getCollection('collections');
    const existingDoc = await collectionsCollection.findOne({ id });

    if (!existingDoc) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    // Server Ownership Authorization Check
    if (existingDoc.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You do not own this collection' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const parsePayload = {
      title: body.title,
      description: body.description,
      visibility: body.visibility,
      place_ids: body.place_ids !== undefined ? body.place_ids : body.placeIds,
    };

    const parseResult = CollectionEditSchema.safeParse(parsePayload);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Collection update validation failed.', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { title, description, visibility, place_ids } = parseResult.data;

    const updateFields: any = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updateFields.title = title.trim();
    if (description !== undefined) updateFields.description = description.trim();
    if (visibility !== undefined) updateFields.visibility = visibility;
    if (place_ids !== undefined) {
      const uniquePlaceIds = Array.from(new Set(place_ids.filter((pId: string) => pId.trim().length > 0)));
      if (uniquePlaceIds.length > 50) {
        return NextResponse.json({ error: 'Collections cannot exceed 50 places.' }, { status: 400 });
      }
      updateFields.place_ids = uniquePlaceIds;
    }

    await collectionsCollection.updateOne({ id, user_id: user.id }, { $set: updateFields });

    const updatedDoc = await collectionsCollection.findOne({ id, user_id: user.id });

    return NextResponse.json({
      success: true,
      collection: {
        id: updatedDoc.id,
        user_id: updatedDoc.user_id,
        title: updatedDoc.title,
        description: updatedDoc.description || '',
        visibility: updatedDoc.visibility || 'public',
        place_ids: updatedDoc.place_ids || [],
        places_count: (updatedDoc.place_ids || []).length,
        created_at: updatedDoc.created_at,
        updated_at: updatedDoc.updated_at,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error updating collection' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Collection ID is required' }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const collectionsCollection = await getCollection('collections');
    const result = await collectionsCollection.deleteOne({ id, user_id: user.id });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Collection not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Collection deleted successfully.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error deleting collection' }, { status: 500 });
  }
}
