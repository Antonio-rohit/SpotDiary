import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies, headers } from 'next/headers';
import { getCollection } from '@/lib/db/dbAdapter';

export function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error('Server configuration error: JWT_SECRET environment variable is missing or unconfigured.');
  }
  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error('Production security error: JWT_SECRET must be at least 32 characters in production.');
  }
  return new TextEncoder().encode(secret);
}

export const SESSION_COOKIE_NAME = 'spotdiary_session';

export interface UserSessionPayload {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  iat?: number;
}

/**
 * Hash password securely using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify password using bcrypt compare
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a signed JWT session token
 */
export async function createSessionToken(payload: UserSessionPayload): Promise<string> {
  const secretKey = getJwtSecretKey();
  return new SignJWT({
    id: payload.id,
    email: payload.email,
    username: payload.username,
    display_name: payload.display_name,
    avatar_url: payload.avatar_url,
    iat_ms: Date.now(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey);
}

/**
 * Verify JWT session token and enforce Session Revocation
 */
export async function verifySessionToken(token: string): Promise<UserSessionPayload | null> {
  try {
    const secretKey = getJwtSecretKey();
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });

    const userEmail = payload.email as string;
    const iatSeconds = payload.iat as number | undefined;

    // Session Revocation Check against MongoDB user record
    if (userEmail && iatSeconds !== undefined) {
      try {
        const usersCollection = await getCollection('users');
        const userDoc = await usersCollection.findOne({ email: userEmail });

        if (!userDoc) {
          return null; // User deleted
        }

        if (userDoc.password_changed_at) {
          const changedAtMs = new Date(userDoc.password_changed_at).getTime();
          const tokenIatMs = (payload.iat_ms as number) || (iatSeconds * 1000);
          // Token issued strictly before password reset is REVOKED
          if (changedAtMs > tokenIatMs) {
            return null;
          }
        }
      } catch (dbErr) {
        // Fall back safely if DB is temporarily unreachable
      }
    }

    return {
      id: payload.id as string,
      email: payload.email as string,
      username: payload.username as string,
      display_name: payload.display_name as string,
      avatar_url: payload.avatar_url as string | undefined,
      iat: iatSeconds,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get session user from current request cookie OR Authorization Bearer token (Mobile & Web)
 */
export async function getCurrentUser(): Promise<UserSessionPayload | null> {
  try {
    // 1. Check HTTP-only cookie (Web clients)
    const cookieStore = cookies();
    let token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    // 2. Fallback to Authorization: Bearer <token> (Mobile / API clients)
    if (!token) {
      try {
        const headerList = headers();
        const authHeader = headerList.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7).trim();
        }
      } catch {
        // headers() might not be available in non-request contexts
      }
    }

    if (!token) return null;

    return await verifySessionToken(token);
  } catch {
    return null;
  }
}
