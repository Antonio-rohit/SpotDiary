const { MongoClient } = require('mongodb');

async function testConnection() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/spotdiary';
  console.log('Attempting connection to:', uri);
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Successfully connected to MongoDB server!');
    const db = client.db('spotdiary');
    console.log('Connected to database:', db.databaseName);

    const ping = await db.command({ ping: 1 });
    console.log('Ping response:', ping);

    const collections = await db.listCollections().toArray();
    console.log('Existing collections:', collections.map(c => c.name));

    await client.close();
    console.log('Connection test completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
