import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI || '';
const options = {
  maxPoolSize: 20,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
};

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

export function isMongoConfigured(): boolean {
  return !!process.env.MONGODB_URI && process.env.MONGODB_URI.trim().length > 0;
}

export async function getMongoClient(): Promise<MongoClient> {
  if (!isMongoConfigured()) {
    throw new Error(
      'Database configuration error: MONGODB_URI is not set in environment variables. Please configure MONGODB_URI in apps/web/.env.local.'
    );
  }

  const connectionUri = process.env.MONGODB_URI || uri;

  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      client = new MongoClient(connectionUri, options);
      global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    if (!clientPromise) {
      client = new MongoClient(connectionUri, options);
      clientPromise = client.connect();
    }
  }

  return clientPromise;
}

export async function getDb(dbName = 'spotdiary'): Promise<Db> {
  const client = await getMongoClient();
  return client.db(dbName);
}
