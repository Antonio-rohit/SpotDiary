const { MongoClient } = require('mongodb');

async function seedDatabase() {
  const uri = 'mongodb://127.0.0.1:27017';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB server at', uri);
    const db = client.db('spotdiary');

    // Create collections
    await db.createCollection('users').catch(() => {});
    await db.createCollection('saved_places').catch(() => {});
    await db.createCollection('visits').catch(() => {});
    await db.createCollection('places').catch(() => {});
    await db.createCollection('collections').catch(() => {});

    // Insert initial place record if empty
    const placesCount = await db.collection('places').countDocuments();
    if (placesCount === 0) {
      await db.collection('places').insertMany([
        {
          id: 'pune-place-1',
          name: 'The Alleyway Café & Bistro',
          category: 'Cafes',
          locality: 'Baner',
          city: 'Pune',
          rating_avg: 4.9,
          reviews_count: 809,
          created_at: new Date().toISOString()
        },
        {
          id: 'pune-place-2',
          name: 'Botanica Garden Cafe',
          category: 'Date Night',
          locality: 'Koregaon Park',
          city: 'Pune',
          rating_avg: 4.8,
          reviews_count: 754,
          created_at: new Date().toISOString()
        }
      ]);
      console.log('Seeded initial places into spotdiary database.');
    }

    console.log('Database spotdiary is created and initialized successfully!');
    const collections = await db.listCollections().toArray();
    console.log('Active collections in spotdiary:', collections.map(c => c.name));

    await client.close();
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed database:', error.message);
    process.exit(1);
  }
}

seedDatabase();
