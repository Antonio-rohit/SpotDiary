import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getCollection } from '@/lib/db/dbAdapter';

export async function GET() {
  try {
    const userPayload = await getCurrentUser();
    if (!userPayload) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    try {
      const usersCollection = await getCollection('users');
      const userDoc = await usersCollection.findOne({ email: userPayload.email });
      if (userDoc) {
        const userId = userDoc._id ? userDoc._id.toString() : userDoc.id || userDoc.username;
        return NextResponse.json({
          authenticated: true,
          user: {
            id: userId,
            email: userDoc.email,
            username: userDoc.username,
            display_name: userDoc.display_name,
            avatar_url: userDoc.avatar_url || '',
            bio: userDoc.bio || '',
          },
        });
      }
    } catch {
      // Fallback to token payload
    }

    return NextResponse.json({
      authenticated: true,
      user: userPayload,
    });
  } catch {
    return NextResponse.json({ authenticated: false, user: null });
  }
}
