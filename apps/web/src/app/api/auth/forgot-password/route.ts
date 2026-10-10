import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCollection } from '@/lib/db/dbAdapter';
import { ForgotPasswordSchema } from '@spotdiary/shared';
import { isEmailConfigured, sendPasswordResetEmail } from '@/lib/email/emailService';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parseResult = ForgotPasswordSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid email address provided.', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const normalizedEmail = parseResult.data.email.toLowerCase().trim();

    // Check rate limiting: max 3 requests per 15 minutes for the same email
    const resetsCollection = await getCollection('password_resets');
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const recentRequestsCount = await resetsCollection.countDocuments({
      email: normalizedEmail,
      created_at: { $gte: fifteenMinutesAgo },
    });

    if (recentRequestsCount >= 3) {
      return NextResponse.json(
        { error: 'Too many password reset requests. Please wait 15 minutes before trying again.' },
        { status: 429 }
      );
    }

    // Verify email delivery configuration
    if (!isEmailConfigured()) {
      return NextResponse.json(
        { error: 'Password reset email delivery service is not configured on the server. Please set SMTP_HOST and SMTP_USER or RESEND_API_KEY in environment variables.' },
        { status: 503 }
      );
    }

    const usersCollection = await getCollection('users');
    const userDoc = await usersCollection.findOne({ email: normalizedEmail });

    // If user exists, generate token and dispatch email
    if (userDoc) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

      const resetDoc = {
        user_id: userDoc._id ? userDoc._id.toString() : userDoc.id,
        email: normalizedEmail,
        token_hash: tokenHash,
        expires_at: expiresAt,
        used: false,
        created_at: new Date().toISOString(),
      };

      await resetsCollection.insertOne(resetDoc);

      // Safe URL construction preventing Host header injection vulnerability
      const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
      let resetUrl: string;
      if (appUrl) {
        resetUrl = `${appUrl.replace(/\/$/, '')}/reset-password?token=${rawToken}`;
      } else {
        const requestHost = request.headers.get('host') || 'localhost:3000';
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        resetUrl = `${protocol}://${requestHost}/reset-password?token=${rawToken}`;
      }

      await sendPasswordResetEmail(normalizedEmail, resetUrl);
    }

    // Return generic response without revealing account existence
    return NextResponse.json({
      success: true,
      message: 'If an account exists with that email address, a password reset link has been sent.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred while requesting password reset.' },
      { status: 500 }
    );
  }
}
