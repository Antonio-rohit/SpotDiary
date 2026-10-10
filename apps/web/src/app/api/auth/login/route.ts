import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db/dbAdapter';
import { comparePassword, createSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { LoginSchema } from '@spotdiary/shared';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parseResult = LoginSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Please provide a valid email and password.', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, password } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();
    const usersCollection = await getCollection('users');

    const user = await usersCollection.findOne({ email: normalizedEmail });
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const isValidPassword = await comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const userId = user._id ? user._id.toString() : user.id || user.username;
    const userPayload = {
      id: userId,
      email: user.email,
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url || '',
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
      { error: error.message || 'An unexpected error occurred during login.' },
      { status: 500 }
    );
  }
}
