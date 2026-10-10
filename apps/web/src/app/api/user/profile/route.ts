import { NextResponse } from 'next/server';
import { getCurrentUser, createSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { getCollection } from '@/lib/db/dbAdapter';
import { ProfileEditSchema } from '@spotdiary/shared';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const usersCollection = await getCollection('users');
    const userDoc = await usersCollection.findOne({ email: user.email });

    if (!userDoc) {
      return NextResponse.json({ profile: user, authenticated: true });
    }

    const userId = userDoc._id ? userDoc._id.toString() : userDoc.id || userDoc.username;
    return NextResponse.json({
      profile: {
        id: userId,
        email: userDoc.email,
        username: userDoc.username,
        display_name: userDoc.display_name,
        avatar_url: userDoc.avatar_url || '',
        bio: userDoc.bio || '',
        created_at: userDoc.created_at,
        updated_at: userDoc.updated_at,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error fetching profile' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const usersCollection = await getCollection('users');
    const existingUserDoc = await usersCollection.findOne({ email: user.email });

    const parsePayload = {
      display_name: body.display_name !== undefined ? body.display_name : existingUserDoc?.display_name || user.display_name,
      username: body.username !== undefined ? body.username : existingUserDoc?.username || user.username,
      bio: body.bio !== undefined ? body.bio : existingUserDoc?.bio || '',
      avatar_url: body.avatar_url !== undefined ? body.avatar_url : existingUserDoc?.avatar_url || '',
    };

    const parseResult = ProfileEditSchema.safeParse(parsePayload);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Profile validation failed.', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { display_name, username, bio, avatar_url } = parseResult.data;

    // Ensure username uniqueness if changed
    if (username !== existingUserDoc?.username) {
      const existingUsername = await usersCollection.findOne({ username });
      if (existingUsername) {
        return NextResponse.json({ error: 'Username is already taken by another member.' }, { status: 400 });
      }
    }

    const updateFields = {
      display_name: display_name.trim(),
      username: username.trim(),
      bio: bio ? bio.trim() : '',
      avatar_url: avatar_url || '',
      updated_at: new Date().toISOString(),
    };

    await usersCollection.updateOne({ email: user.email }, { $set: updateFields });

    const updatedUser = {
      id: user.id,
      email: user.email,
      username: updateFields.username,
      display_name: updateFields.display_name,
      avatar_url: updateFields.avatar_url,
      bio: updateFields.bio,
    };

    const token = await createSessionToken(updatedUser);
    const response = NextResponse.json({ success: true, profile: updatedUser });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error updating profile' }, { status: 500 });
  }
}
