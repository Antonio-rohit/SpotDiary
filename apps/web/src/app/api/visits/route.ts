import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getCollection } from '@/lib/db/dbAdapter';
import { VisitSchema, VisitEditSchema } from '@spotdiary/shared';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ visits: [], authenticated: false });
    }

    const visitsCollection = await getCollection('visits');
    const visitsCursor = await visitsCollection.find({ user_id: user.id });
    const visits = await visitsCursor.toArray();

    return NextResponse.json({ visits, authenticated: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error fetching visits' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in first.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parseResult = VisitSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Visit validation failed.', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { place_id, visited_at, rating, best_item, notes, people_context, visibility, tags, photos } = parseResult.data;
    const visitsCollection = await getCollection('visits');

    const newVisitDoc = {
      id: `visit-${Date.now()}`,
      user_id: user.id,
      place_id,
      visited_at: visited_at || new Date().toISOString(),
      rating,
      best_item: best_item.trim(),
      notes: notes ? notes.trim() : '',
      people_context,
      visibility,
      tags: tags || [],
      photos: photos || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await visitsCollection.insertOne(newVisitDoc);

    return NextResponse.json({ success: true, visit: newVisitDoc });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error creating visit' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in first.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Visit ID is required.' }, { status: 400 });
    }

    const visitsCollection = await getCollection('visits');
    const result = await visitsCollection.deleteOne({ id, user_id: user.id });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Visit record not found or unauthorized.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Visit record deleted.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error deleting visit' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in first.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parseResult = VisitEditSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Visit edit validation failed.', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { id, visited_at, rating, best_item, notes, people_context, visibility, tags } = parseResult.data;
    const visitsCollection = await getCollection('visits');
    const existingVisit = await visitsCollection.findOne({ id, user_id: user.id });

    if (!existingVisit) {
      return NextResponse.json({ error: 'Visit record not found or unauthorized.' }, { status: 404 });
    }

    const updateFields: any = {
      updated_at: new Date().toISOString(),
    };

    if (visited_at !== undefined) updateFields.visited_at = visited_at;
    if (rating !== undefined) updateFields.rating = rating;
    if (best_item !== undefined) updateFields.best_item = best_item.trim();
    if (notes !== undefined) updateFields.notes = notes.trim();
    if (people_context !== undefined) updateFields.people_context = people_context;
    if (visibility !== undefined) updateFields.visibility = visibility;
    if (tags !== undefined) updateFields.tags = tags;

    await visitsCollection.updateOne({ id, user_id: user.id }, { $set: updateFields });

    const updatedVisit = await visitsCollection.findOne({ id, user_id: user.id });

    return NextResponse.json({ success: true, visit: updatedVisit });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error updating visit' }, { status: 500 });
  }
}
