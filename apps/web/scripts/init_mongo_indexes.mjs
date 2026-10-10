import { MongoClient } from 'mongodb';

async function initIndexes() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/spotdiary';
  console.log('Connecting to MongoDB at:', uri.replace(/:([^:@]+)@/, ':****@'));

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();

    console.log('Ensuring collections and indexes...');

    // 1. Users
    const users = db.collection('users');
    await users.createIndex({ email: 1 }, { unique: true });
    await users.createIndex({ id: 1 }, { unique: true, sparse: true });
    console.log('✓ users indexes verified');

    // 2. Password Resets
    const resets = db.collection('password_resets');
    await resets.createIndex({ token_hash: 1 }, { unique: true });
    await resets.createIndex({ email: 1 });
    await resets.createIndex({ expires_at: 1 });
    console.log('✓ password_resets indexes verified');

    // 3. Visits
    const visits = db.collection('visits');
    await visits.createIndex({ user_id: 1, id: 1 });
    await visits.createIndex({ user_id: 1, visited_at: -1 });
    await visits.createIndex({ user_id: 1, place_id: 1 });
    console.log('✓ visits indexes verified');

    // 4. Saved Places
    const saved = db.collection('saved_places');
    await saved.createIndex({ user_id: 1, place_id: 1 }, { unique: true });
    console.log('✓ saved_places indexes verified');

    // 5. Collections
    const collections = db.collection('collections');
    await collections.createIndex({ user_id: 1, id: 1 });
    await collections.createIndex({ visibility: 1 });
    console.log('✓ collections indexes verified');

    // 6. Visit Photos
    const photos = db.collection('visit_photos');
    await photos.createIndex({ visit_id: 1 });
    await photos.createIndex({ user_id: 1 });
    await photos.createIndex({ id: 1 }, { unique: true });
    console.log('✓ visit_photos indexes verified');

    console.log('\nAll database indexes initialized successfully.');
  } finally {
    await client.close();
  }
}

initIndexes().catch((err) => {
  console.error('Error initializing indexes:', err);
  process.exit(1);
});
