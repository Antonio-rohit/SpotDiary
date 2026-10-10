import { NextResponse } from 'next/server';
import { isMongoConfigured, getDb } from '@/lib/db/mongodb';

export async function GET() {
  try {
    const configured = isMongoConfigured();
    if (!configured) {
      return NextResponse.json({
        connected: false,
        configured: false,
        message: 'MONGODB_URI environment variable is not set.',
      });
    }

    const db = await getDb();
    const adminDb = db.admin();
    const pingResult = await adminDb.ping();

    const collections = await db.listCollections().toArray();

    return NextResponse.json({
      connected: true,
      configured: true,
      database: db.databaseName,
      ping: pingResult,
      collections: collections.map((c) => c.name),
      message: 'Successfully connected to MongoDB database.',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        connected: false,
        configured: isMongoConfigured(),
        error: error.message || 'Failed to connect to MongoDB',
      },
      { status: 500 }
    );
  }
}
