import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db/dbAdapter';
import { hashPassword, createSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { RegisterSchema } from '@spotdiary/shared';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parseResult = RegisterSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Registration validation failed.', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, password, displayName } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();
    const usersCollection = await getCollection('users');

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email: normalizedEmail });
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email address already exists. Please log in.' },
        { status: 400 }
      );
    }

    // Hash password securely with bcrypt
    const password_hash = await hashPassword(password);
    const username = (normalizedEmail.split('@')[0] || 'user').replace(/[^a-z0-9_]/g, '_');
    const userDoc = {
      email: normalizedEmail,
      password_hash,
      display_name: displayName?.trim() || 'SpotDiary Member',
      username,
      avatar_url: '',
      bio: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const insertResult = await usersCollection.insertOne(userDoc);
    const userId = insertResult.insertedId ? insertResult.insertedId.toString() : userDoc.username;

    const userPayload = {
      id: userId,
      email: normalizedEmail,
      username,
      display_name: userDoc.display_name,
      avatar_url: '',
    };

    const token = await createSessionToken(userPayload);

    const response = NextResponse.json({
      success: true,
      user: userPayload,
      token,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred during registration.' },
      { status: 500 }
    );
  }
}
