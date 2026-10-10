import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCollection } from '@/lib/db/dbAdapter';
import { hashPassword } from '@/lib/auth/session';
import { ResetPasswordSchema } from '@spotdiary/shared';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parseResult = ResetPasswordSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid reset request parameters.', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { token, password } = parseResult.data;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = new Date();
    const nowISO = now.toISOString();

    const resetsCollection = await getCollection('password_resets');

    // ATOMIC TOKEN CONSUMPTION (Task 1):
    // Single-use claim under concurrent requests. If already used or expired, modifiedCount is 0.
    const updateResult = await resetsCollection.updateOne(
      {
        token_hash: tokenHash,
        used: false,
        expires_at: { $gt: nowISO },
      },
      {
        $set: {
          used: true,
          used_at: nowISO,
        },
      }
    );

    if (updateResult.modifiedCount === 0) {
      return NextResponse.json(
        { error: 'Invalid, already used, or expired password reset token.' },
        { status: 400 }
      );
    }

    // Token claimed successfully! Retrieve email associated with token
    const resetRecord = await resetsCollection.findOne({ token_hash: tokenHash });
    if (!resetRecord) {
      return NextResponse.json({ error: 'Reset record not found.' }, { status: 400 });
    }

    // Hash new password securely with bcrypt
    const newPasswordHash = await hashPassword(password);
    const usersCollection = await getCollection('users');

    // Update password and set password_changed_at timestamp to trigger Session Revocation
    await usersCollection.updateOne(
      { email: resetRecord.email },
      {
        $set: {
          password_hash: newPasswordHash,
          password_changed_at: nowISO,
          updated_at: nowISO,
        },
      }
    );

    // Invalidate any remaining pending reset tokens for this user
    await resetsCollection.updateMany(
      { email: resetRecord.email, used: false },
      {
        $set: {
          used: true,
          used_at: nowISO,
          invalidated_reason: 'password_reset_completed',
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Your password has been successfully reset. All active sessions have been signed out.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred while resetting your password.' },
      { status: 500 }
    );
  }
}
