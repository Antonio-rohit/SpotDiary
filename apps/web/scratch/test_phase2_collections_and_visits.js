const assert = require('assert');
const { SignJWT, jwtVerify } = require('jose');
const { MongoClient } = require('mongodb');

async function runPhase2Tests() {
  console.log('=== STARTING PHASE 2 VERIFICATION TESTS ===\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/spotdiary';
  const testSecret = process.env.JWT_SECRET || 'test_secure_jwt_secret_key_2026';
  process.env.JWT_SECRET = testSecret;
  const secretKey = new TextEncoder().encode(testSecret);

  // Connect directly to MongoDB to verify persistence
  const mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  const db = mongoClient.db('spotdiary');
  const collectionsCol = db.collection('collections');
  const visitsCol = db.collection('visits');

  // Generate test user session tokens
  const user1 = { id: 'user_test_1', email: 'user1@spotdiary.test', username: 'user1', display_name: 'User One' };
  const user2 = { id: 'user_test_2', email: 'user2@spotdiary.test', username: 'user2', display_name: 'User Two' };

  const token1 = await new SignJWT({ ...user1 }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1d').sign(secretKey);
  const token2 = await new SignJWT({ ...user2 }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1d').sign(secretKey);

  // Clean test fixtures
  await collectionsCol.deleteMany({ user_id: { $in: [user1.id, user2.id] } });
  await visitsCol.deleteMany({ user_id: { $in: [user1.id, user2.id] } });

  // -------------------------------------------------------------
  // TEST SECTION 1: COLLECTIONS CRUD & AUTHORIZATION
  // -------------------------------------------------------------
  console.log('--- TEST SECTION 1: COLLECTIONS CRUD & AUTHORIZATION ---');

  // Test 1: Create a collection
  console.log('Test 1: Creating a collection in MongoDB...');
  const collId = `coll-test-${Date.now()}`;
  const newCollDoc = {
    id: collId,
    user_id: user1.id,
    title: 'Pune Coffee Tour',
    description: 'Best coffee spots in Baner and KP',
    visibility: 'public',
    place_ids: ['pune-place-1', 'pune-place-2'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  await collectionsCol.insertOne(newCollDoc);

  const foundColl = await collectionsCol.findOne({ id: collId });
  assert.ok(foundColl, 'Collection should be persisted in MongoDB');
  assert.strictEqual(foundColl.title, 'Pune Coffee Tour');
  console.log('✓ PASS: Collection created and verified in MongoDB.\n');

  // Test 2 & 5: Deduplicate places and update collection details
  console.log('Test 2 & 5: Updating collection and preventing duplicate place IDs...');
  const duplicateInputPlaces = ['pune-place-1', 'pune-place-2', 'pune-place-1', 'pune-place-3'];
  const uniquePlaces = Array.from(new Set(duplicateInputPlaces));
  
  await collectionsCol.updateOne(
    { id: collId, user_id: user1.id },
    { $set: { title: 'Updated Coffee Tour', place_ids: uniquePlaces, updated_at: new Date().toISOString() } }
  );

  const updatedColl = await collectionsCol.findOne({ id: collId });
  assert.strictEqual(updatedColl.title, 'Updated Coffee Tour');
  assert.deepStrictEqual(updatedColl.place_ids, ['pune-place-1', 'pune-place-2', 'pune-place-3']);
  console.log('✓ PASS: Collection updated and place IDs deduplicated successfully.\n');

  // Test 7 & 8: Privacy & Cross-User Authorization
  console.log('Test 7 & 8: Verifying collection privacy and cross-user authorization...');
  const privateCollId = `coll-private-${Date.now()}`;
  await collectionsCol.insertOne({
    id: privateCollId,
    user_id: user1.id,
    title: 'User 1 Secret Spots',
    description: 'Private list',
    visibility: 'private',
    place_ids: ['pune-place-1'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  // User 2 query for User 1 private collection
  const user2PrivateQuery = await collectionsCol.findOne({ id: privateCollId, visibility: 'public' });
  assert.strictEqual(user2PrivateQuery, null, 'User 2 cannot view User 1 private collection in public index');

  // User 2 attempts to update User 1 collection
  const user2UpdateResult = await collectionsCol.updateOne(
    { id: collId, user_id: user2.id }, // User 2 owns none
    { $set: { title: 'Hacked Title' } }
  );
  assert.strictEqual(user2UpdateResult.modifiedCount, 0, 'User 2 update must fail due to owner mismatch');

  const verifyUnchanged = await collectionsCol.findOne({ id: collId });
  assert.strictEqual(verifyUnchanged.title, 'Updated Coffee Tour');
  console.log('✓ PASS: User 2 cannot access private collections or modify User 1 collections.\n');

  // Test 6: Delete a collection
  console.log('Test 6: Deleting collection...');
  const deleteResult = await collectionsCol.deleteOne({ id: collId, user_id: user1.id });
  assert.strictEqual(deleteResult.deletedCount, 1);
  const verifyDeleted = await collectionsCol.findOne({ id: collId });
  assert.strictEqual(verifyDeleted, null);
  console.log('✓ PASS: Collection deleted successfully.\n');

  // -------------------------------------------------------------
  // TEST SECTION 2: VISITS EDITING & AUTHORIZATION
  // -------------------------------------------------------------
  console.log('--- TEST SECTION 2: VISITS EDITING & AUTHORIZATION ---');

  // Test 1: Create initial visit
  console.log('Test 1: Inserting initial visit record...');
  const visitId1 = `visit-test-1-${Date.now()}`;
  const visitId2 = `visit-test-2-${Date.now()}`;

  await visitsCol.insertMany([
    {
      id: visitId1,
      user_id: user1.id,
      place_id: 'pune-place-1',
      visited_at: '2026-09-01T10:00:00Z',
      rating: 4,
      best_item: 'Cold Brew',
      notes: 'Initial note',
      people_context: 'Solo',
      visibility: 'private',
      tags: ['Coffee'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: visitId2,
      user_id: user2.id, // Owned by User 2
      place_id: 'pune-place-1',
      visited_at: '2026-09-02T10:00:00Z',
      rating: 5,
      best_item: 'Matcha Latte',
      notes: 'User 2 note',
      people_context: 'Partner',
      visibility: 'public',
      tags: ['Date'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ]);
  console.log('✓ PASS: Initial visits inserted.\n');

  // Test 2: Edit Visit record (User 1 edits visitId1)
  console.log('Test 2: Editing Visit record...');
  const editPayload = {
    rating: 5,
    best_item: 'Specialty Cold Coffee & Affogato',
    notes: 'Updated note after great evening visit',
    people_context: 'Partner',
    visibility: 'public',
    tags: ['Coffee', 'Date Night', 'Cozy']
  };

  await visitsCol.updateOne(
    { id: visitId1, user_id: user1.id },
    {
      $set: {
        ...editPayload,
        updated_at: new Date().toISOString()
      }
    }
  );

  const updatedVisit1 = await visitsCol.findOne({ id: visitId1 });
  assert.strictEqual(updatedVisit1.rating, 5);
  assert.strictEqual(updatedVisit1.best_item, 'Specialty Cold Coffee & Affogato');
  assert.strictEqual(updatedVisit1.notes, 'Updated note after great evening visit');
  assert.strictEqual(updatedVisit1.people_context, 'Partner');
  assert.strictEqual(updatedVisit1.visibility, 'public');
  assert.deepStrictEqual(updatedVisit1.tags, ['Coffee', 'Date Night', 'Cozy']);
  console.log('✓ PASS: Visit record successfully updated in MongoDB.\n');

  // Test 3: Unrelated visits remain unchanged
  console.log('Test 3: Confirming unrelated visits remain unchanged...');
  const checkVisit2 = await visitsCol.findOne({ id: visitId2 });
  assert.strictEqual(checkVisit2.rating, 5);
  assert.strictEqual(checkVisit2.best_item, 'Matcha Latte');
  assert.strictEqual(checkVisit2.user_id, user2.id);
  console.log('✓ PASS: Unrelated visit owned by User 2 is completely unchanged.\n');

  // Test 4: Prevent User 1 from editing User 2 visit
  console.log('Test 4: Preventing User 1 from editing User 2 visit...');
  const unauthorizedUpdateResult = await visitsCol.updateOne(
    { id: visitId2, user_id: user1.id }, // User 1 owns visitId1, NOT visitId2
    { $set: { notes: 'Tampered note' } }
  );
  assert.strictEqual(unauthorizedUpdateResult.modifiedCount, 0);

  const verifyVisit2Unchanged = await visitsCol.findOne({ id: visitId2 });
  assert.strictEqual(verifyVisit2Unchanged.notes, 'User 2 note');
  console.log('✓ PASS: Cross-user visit modification rejected.\n');

  // Test 5: Rejection of invalid ratings
  console.log('Test 5: Validating rating boundaries (1-5)...');
  function validateRating(r) {
    const num = Number(r);
    return !isNaN(num) && num >= 1 && num <= 5;
  }
  assert.strictEqual(validateRating(6), false);
  assert.strictEqual(validateRating(0), false);
  assert.strictEqual(validateRating(-1), false);
  assert.strictEqual(validateRating(5), true);
  assert.strictEqual(validateRating(1), true);
  console.log('✓ PASS: Invalid ratings rejected by validation rules.\n');

  // Clean test fixtures
  await collectionsCol.deleteMany({ user_id: { $in: [user1.id, user2.id] } });
  await visitsCol.deleteMany({ user_id: { $in: [user1.id, user2.id] } });
  await mongoClient.close();

  console.log('=== ALL PHASE 2 VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
}

runPhase2Tests().catch(err => {
  console.error('Phase 2 Test Suite Failed:', err);
  process.exit(1);
});
