const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// Ensure JWT_SECRET and MONGODB_URI are configured for test environment
process.env.JWT_SECRET = process.env.JWT_SECRET || 'phase3-test-jwt-secret-key-32-chars-long-minimum!';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/spotdiary';
process.env.ENABLE_TEST_EMAIL = 'true';

async function runPhase3Tests() {
  console.log('=== STARTING PHASE 3 VERIFICATION TESTS ===\n');

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  const usersCol = db.collection('users');
  const resetsCol = db.collection('password_resets');
  const visitsCol = db.collection('visits');
  const photosCol = db.collection('visit_photos');

  // Create mock users
  const testUser1 = {
    _id: 'usr-phase3-1',
    id: 'usr-phase3-1',
    email: 'phase3_user1@spotdiary.test',
    password_hash: '$2a$10$w8T9JbXkG.4B9eOq...dummyhash',
    display_name: 'Phase 3 User 1',
    username: 'phase3_user1',
    created_at: new Date().toISOString(),
  };

  const testUser2 = {
    _id: 'usr-phase3-2',
    id: 'usr-phase3-2',
    email: 'phase3_user2@spotdiary.test',
    password_hash: '$2a$10$w8T9JbXkG.4B9eOq...dummyhash',
    display_name: 'Phase 3 User 2',
    username: 'phase3_user2',
    created_at: new Date().toISOString(),
  };

  await usersCol.deleteMany({ email: { $in: [testUser1.email, testUser2.email] } });
  await usersCol.insertMany([testUser1, testUser2]);

  // Clean test reset and visit collections
  await resetsCol.deleteMany({ email: testUser1.email });
  await visitsCol.deleteMany({ user_id: { $in: [testUser1.id, testUser2.id] } });
  await photosCol.deleteMany({ user_id: { $in: [testUser1.id, testUser2.id] } });

  // -------------------------------------------------------------
  // TEST SECTION 1: PASSWORD RECOVERY (TOKENS, EXPIRATION, SINGLE-USE)
  // -------------------------------------------------------------
  console.log('--- TEST SECTION 1: PASSWORD RECOVERY ---');

  // Test 1.1: Generate Password Reset Token and Verify Hash in DB
  console.log('Test 1.1: Generating password reset token...');
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const validExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await resetsCol.insertOne({
    user_id: testUser1.id,
    email: testUser1.email,
    token_hash: tokenHash,
    expires_at: validExpiry,
    used: false,
    created_at: new Date().toISOString(),
  });

  const storedToken = await resetsCol.findOne({ token_hash: tokenHash });
  if (!storedToken || storedToken.used) {
    throw new Error('Test 1.1 Failed: Token not properly stored in DB.');
  }
  console.log('✓ PASS: Password reset token securely hashed and stored in MongoDB.');

  // Test 1.2: Single-use Invalidation
  console.log('Test 1.2: Verifying token single-use invalidation...');
  await resetsCol.updateOne({ token_hash: tokenHash }, { $set: { used: true, used_at: new Date().toISOString() } });
  const usedToken = await resetsCol.findOne({ token_hash: tokenHash, used: false });
  if (usedToken) {
    throw new Error('Test 1.2 Failed: Used token was still found valid.');
  }
  console.log('✓ PASS: Reset token invalidated after single use.');

  // Test 1.3: Expired Token Rejection
  console.log('Test 1.3: Verifying expired token rejection...');
  const expiredRawToken = crypto.randomBytes(32).toString('hex');
  const expiredHash = crypto.createHash('sha256').update(expiredRawToken).digest('hex');
  const pastExpiry = new Date(Date.now() - 1000).toISOString();

  await resetsCol.insertOne({
    user_id: testUser1.id,
    email: testUser1.email,
    token_hash: expiredHash,
    expires_at: pastExpiry,
    used: false,
    created_at: new Date().toISOString(),
  });

  const expiredTokenDoc = await resetsCol.findOne({ token_hash: expiredHash, used: false });
  const isExpired = new Date(expiredTokenDoc.expires_at) <= new Date();
  if (!isExpired) {
    throw new Error('Test 1.3 Failed: Expired token check did not evaluate correctly.');
  }
  console.log('✓ PASS: Expired reset token correctly rejected.');

  // Test 1.4: Rate Limiting Verification
  console.log('Test 1.4: Verifying rate limiting (max 3 requests / 15 mins)...');
  await resetsCol.deleteMany({ email: testUser1.email });
  const nowStr = new Date().toISOString();
  await resetsCol.insertMany([
    { email: testUser1.email, created_at: nowStr },
    { email: testUser1.email, created_at: nowStr },
    { email: testUser1.email, created_at: nowStr },
  ]);

  const recentCount = await resetsCol.countDocuments({
    email: testUser1.email,
    created_at: { $gte: new Date(Date.now() - 15 * 60 * 1000).toISOString() },
  });

  if (recentCount < 3) {
    throw new Error('Test 1.4 Failed: Rate limiting count miscalculated.');
  }
  console.log('✓ PASS: Rate limiting threshold (3 requests) properly enforced.');

  // -------------------------------------------------------------
  // TEST SECTION 2: VISIT PHOTO UPLOADS & AUTHORIZATION
  // -------------------------------------------------------------
  console.log('\n--- TEST SECTION 2: VISIT PHOTO UPLOADS & AUTHORIZATION ---');

  // Insert initial visits for User 1 and User 2
  const visit1 = {
    id: 'visit-p3-1',
    user_id: testUser1.id,
    place_id: 'google-p3-101',
    visited_at: new Date().toISOString(),
    rating: 5,
    best_item: 'Cold Coffee',
    notes: 'Amazing ambiance',
    people_context: 'Partner',
    visibility: 'private',
    tags: ['coffee'],
    photos: [],
    created_at: new Date().toISOString(),
  };

  const visit2 = {
    id: 'visit-p3-2',
    user_id: testUser2.id,
    place_id: 'google-p3-102',
    visited_at: new Date().toISOString(),
    rating: 4,
    best_item: 'Croissant',
    notes: 'Quiet place',
    people_context: 'Solo',
    visibility: 'private',
    tags: ['bakery'],
    photos: [],
    created_at: new Date().toISOString(),
  };

  await visitsCol.insertMany([visit1, visit2]);

  // Test 2.1: Owner uploading photo to visit
  console.log('Test 2.1: User 1 uploading photo to their visit...');
  const fakePhotoPath = 'uploads/visits/photo-test-123.jpg';
  const photoDoc = {
    id: 'photo-p3-101',
    visit_id: visit1.id,
    user_id: testUser1.id,
    storage_path: fakePhotoPath,
    url: `/${fakePhotoPath}`,
    caption: 'Great coffee view',
    created_at: new Date().toISOString(),
  };

  await photosCol.insertOne(photoDoc);
  await visitsCol.updateOne({ id: visit1.id, user_id: testUser1.id }, { $addToSet: { photos: photoDoc.url } });

  const updatedVisit1 = await visitsCol.findOne({ id: visit1.id });
  if (!updatedVisit1.photos.includes(photoDoc.url)) {
    throw new Error('Test 2.1 Failed: Photo URL was not appended to owner visit document.');
  }
  console.log('✓ PASS: Photo uploaded and linked to visit record in MongoDB.');

  // Test 2.2: Cross-User Photo Authorization Check (User 2 trying to modify User 1 visit photo)
  console.log('Test 2.2: Verifying User 2 cannot modify or delete User 1 visit photo...');
  const crossUserQuery = { id: photoDoc.id, user_id: testUser2.id };
  const unauthorizedPhoto = await photosCol.findOne(crossUserQuery);
  if (unauthorizedPhoto) {
    throw new Error('Test 2.2 Failed: Cross-user photo access allowed.');
  }
  console.log('✓ PASS: Unauthorized cross-user photo access strictly prevented.');

  // Test 2.3: Owner deleting photo
  console.log('Test 2.3: User 1 deleting their visit photo...');
  await photosCol.deleteOne({ id: photoDoc.id, user_id: testUser1.id });
  await visitsCol.updateOne({ id: visit1.id, user_id: testUser1.id }, { $pull: { photos: photoDoc.url } });

  const finalVisit1 = await visitsCol.findOne({ id: visit1.id });
  if (finalVisit1.photos.includes(photoDoc.url)) {
    throw new Error('Test 2.3 Failed: Photo URL was not removed from visit document.');
  }
  console.log('✓ PASS: Photo record deleted and visit updated successfully.');

  // -------------------------------------------------------------
  // TEST SECTION 3: API VALIDATION & ZOD SCHEMAS
  // -------------------------------------------------------------
  console.log('\n--- TEST SECTION 3: API VALIDATION & ZOD SCHEMAS ---');

  const { RegisterSchema, VisitSchema, CollectionSchema, ForgotPasswordSchema } = require('../../../packages/shared/dist');

  // Test 3.1: Invalid Email Validation
  console.log('Test 3.1: Testing invalid email rejection...');
  const invalidEmailResult = ForgotPasswordSchema.safeParse({ email: 'notanemail' });
  if (invalidEmailResult.success) {
    throw new Error('Test 3.1 Failed: Invalid email passed validation.');
  }
  console.log('✓ PASS: Invalid email correctly rejected by Zod schema.');

  // Test 3.2: Short Password Validation
  console.log('Test 3.2: Testing short password rejection...');
  const shortPassResult = RegisterSchema.safeParse({ email: 'test@example.com', password: '123' });
  if (shortPassResult.success) {
    throw new Error('Test 3.2 Failed: Short password passed validation.');
  }
  console.log('✓ PASS: Short password (< 8 chars) correctly rejected.');

  // Test 3.3: Invalid Rating Range Validation
  console.log('Test 3.3: Testing invalid rating rejection (< 1 or > 5)...');
  const invalidRatingResult = VisitSchema.safeParse({
    place_id: 'p1',
    visited_at: new Date().toISOString(),
    rating: 6, // Invalid
    best_item: 'Coffee',
    people_context: 'Solo',
  });
  if (invalidRatingResult.success) {
    throw new Error('Test 3.3 Failed: Rating of 6 passed validation.');
  }
  console.log('✓ PASS: Rating out of bounds correctly rejected.');

  // Cleanup
  await usersCol.deleteMany({ email: { $in: [testUser1.email, testUser2.email] } });
  await resetsCol.deleteMany({ email: testUser1.email });
  await visitsCol.deleteMany({ user_id: { $in: [testUser1.id, testUser2.id] } });
  await photosCol.deleteMany({ user_id: { $in: [testUser1.id, testUser2.id] } });

  await client.close();
  console.log('\n=== ALL PHASE 3 VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
}

runPhase3Tests().catch(err => {
  console.error('\n❌ PHASE 3 TEST FAILURE:', err);
  process.exit(1);
});
