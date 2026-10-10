import assert from 'assert';
import { parseNaturalLanguageMemoryQuery, filterVisits } from '../../../packages/shared/dist/index.js';

const API_BASE_URL = 'http://127.0.0.1:3000';

async function runPhase5E2ETests() {
  console.log('================================================================');
  console.log('SPOTDIARY PHASE 5: END-TO-END FUNCTIONAL, SECURITY & CONSISTENCY');
  console.log('Target API:', API_BASE_URL);
  console.log('================================================================\n');

  const timestamp = Date.now();
  const userA_email = `user_a_${timestamp}@example.com`;
  const userA_password = 'PasswordA123!';
  const userA_name = 'User Alpha';

  const userB_email = `user_b_${timestamp}@example.com`;
  const userB_password = 'PasswordB123!';
  const userB_name = 'User Beta';

  let tokenA = null;
  let tokenB = null;
  let userA_id = null;
  let userB_id = null;

  // ----------------------------------------------------
  // WORKFLOW A: AUTHENTICATION & MULTI-USER ISOLATION
  // ----------------------------------------------------
  console.log('--- WORKFLOW A: Authentication, Sessions & Password Reset Revocation ---');

  // 1. Register User A
  console.log('[A.1] Register User A (Bearer + Cookie response)...');
  const regARes = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userA_email, password: userA_password, name: userA_name, displayName: userA_name }),
  });
  const regAData = await regARes.json();
  assert.strictEqual(regARes.status, 200);
  assert.strictEqual(regAData.success, true);
  assert.ok(regAData.token);
  tokenA = regAData.token;
  userA_id = regAData.user.id;
  console.log(`✓ User A registered. ID: ${userA_id}`);

  // 2. Register User B
  console.log('[A.2] Register User B...');
  const regBRes = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userB_email, password: userB_password, name: userB_name, displayName: userB_name }),
  });
  const regBData = await regBRes.json();
  assert.strictEqual(regBRes.status, 200);
  tokenB = regBData.token;
  userB_id = regBData.user.id;
  console.log(`✓ User B registered. ID: ${userB_id}`);

  // 3. Verify session restoration (Bearer vs Cookie)
  console.log('[A.3] Verify session restoration for User A via Bearer header...');
  const meRes = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const meData = await meRes.json();
  assert.strictEqual(meRes.status, 200);
  assert.strictEqual(meData.authenticated, true);
  assert.strictEqual(meData.user.email, userA_email);
  console.log('✓ User A session successfully restored via Bearer token.');

  // 4. Test Web Cookie Authentication
  console.log('[A.4] Verify session restoration via Cookie header...');
  const cookieMeRes = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { Cookie: `spotdiary_session=${tokenA}` },
  });
  const cookieMeData = await cookieMeRes.json();
  assert.strictEqual(cookieMeRes.status, 200);
  assert.strictEqual(cookieMeData.authenticated, true);
  console.log('✓ User A session successfully restored via Cookie header.');

  // 5. Test Password Reset Session Revocation
  console.log('[A.5] Test Password Reset and Session Revocation for User A...');
  const initialTokenA = tokenA;

  // Connect to MongoDB directly to insert test password reset record
  const { MongoClient } = await import('mongodb');
  const mongoClient = new MongoClient('mongodb://127.0.0.1:27017/spotdiary');
  await mongoClient.connect();
  const db = mongoClient.db('spotdiary');
  const resetsCollection = db.collection('password_resets');
  const crypto = await import('crypto');
  const rawResetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await resetsCollection.insertOne({
    user_id: userA_id,
    email: userA_email,
    token_hash: resetTokenHash,
    expires_at: expiresAt,
    used: false,
    created_at: new Date().toISOString(),
  });
  await mongoClient.close();

  // Complete password reset with new password
  const newPasswordA = 'NewPasswordA2026!';
  const resetRes = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: rawResetToken, password: newPasswordA }),
  });
  const resetData = await resetRes.json();
  assert.strictEqual(resetRes.status, 200);
  assert.strictEqual(resetData.success, true);
  console.log('✓ Password reset completed successfully.');

  // VERIFY: Old token issued BEFORE reset must now be rejected!
  console.log('[A.6] Verify that old session token issued before reset is REJECTED...');
  const oldSessionCheck = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${initialTokenA}` },
  });
  const oldSessionData = await oldSessionCheck.json();
  assert.strictEqual(oldSessionData.authenticated, false, 'Old session token issued before password reset must be revoked');
  console.log('✓ Old session token was rejected as revoked!');

  // Log in with new password to get active token for User A
  console.log('[A.7] Log in User A with new password...');
  const loginRes = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userA_email, password: newPasswordA }),
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginRes.status, 200);
  assert.strictEqual(loginData.success, true);
  tokenA = loginData.token;
  console.log('✓ User A logged in with new password. New token received.');

  // ----------------------------------------------------
  // WORKFLOW B: PLACE DISCOVERY & WISHLIST
  // ----------------------------------------------------
  console.log('\n--- WORKFLOW B: Place Discovery & Wishlist ---');
  console.log('[B.1] Search Pune cafes in Baner...');
  const placesRes = await fetch(`${API_BASE_URL}/api/places/search?locality=Baner&category=Cafes`);
  const placesData = await placesRes.json();
  assert.strictEqual(placesRes.status, 200);
  assert.ok(Array.isArray(placesData.places) && placesData.places.length > 0);
  const samplePlace = placesData.places[0];
  console.log(`✓ Discovery returned ${placesData.places.length} places. Sample: "${samplePlace.name}" (${samplePlace.id})`);

  // Place details endpoint
  console.log('[B.2] Get place details by ID...');
  const detailRes = await fetch(`${API_BASE_URL}/api/places/${encodeURIComponent(samplePlace.id)}`);
  const detailData = await detailRes.json();
  assert.strictEqual(detailRes.status, 200);
  assert.strictEqual(detailData.place.id, samplePlace.id);
  console.log(`✓ Place details retrieved: ${detailData.place.name}`);

  // User A saves place
  console.log('[B.3] User A saves place to wishlist...');
  const saveARes = await fetch(`${API_BASE_URL}/api/places/saved`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ place_id: samplePlace.id, place: samplePlace }),
  });
  const saveAData = await saveARes.json();
  assert.strictEqual(saveAData.saved, true);

  // User B's wishlist should NOT have User A's saved place
  console.log('[B.4] Verify User B wishlist does NOT see User A saved place...');
  const getSavedBRes = await fetch(`${API_BASE_URL}/api/places/saved`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const getSavedBData = await getSavedBRes.json();
  const userBHasPlace = getSavedBData.places.some((p) => p.id === samplePlace.id);
  assert.strictEqual(userBHasPlace, false, "User B must not see User A's saved place");
  console.log("✓ Wishlist isolation verified between User A and User B.");

  // ----------------------------------------------------
  // WORKFLOW C: VISIT DIARY & CROSS-USER AUTHORIZATION
  // ----------------------------------------------------
  console.log('\n--- WORKFLOW C: Visit Diary & IDOR Authorization ---');

  // User A creates a visit
  console.log('[C.1] User A logs a visit...');
  const visitPayload = {
    place_id: samplePlace.id,
    visited_at: '2026-08-15T15:30:00.000Z',
    rating: 5,
    best_item: 'Classic Cold Coffee',
    notes: 'Peaceful garden ambience with gentle breeze.',
    people_context: 'Partner',
    visibility: 'private',
    tags: ['coffee', 'pune', 'date'],
    photos: [],
  };

  const createVisitRes = await fetch(`${API_BASE_URL}/api/visits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify(visitPayload),
  });
  const createVisitData = await createVisitRes.json();
  assert.strictEqual(createVisitRes.status, 200);
  assert.strictEqual(createVisitData.success, true);
  const visitA_id = createVisitData.visit.id;
  console.log(`✓ Visit created for User A. Visit ID: ${visitA_id}`);

  // User B queries visits: User A's private visit must NOT be present
  console.log("[C.2] Verify User B cannot view User A's visit...");
  const getVisitsBRes = await fetch(`${API_BASE_URL}/api/visits`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const getVisitsBData = await getVisitsBRes.json();
  const userBSeesVisitA = getVisitsBData.visits.some((v) => v.id === visitA_id);
  assert.strictEqual(userBSeesVisitA, false, "User B must not see User A's visits");
  console.log("✓ User B does not see User A's private visit.");

  // IDOR TEST: User B attempts to EDIT User A's visit!
  console.log("[C.3] IDOR Attack Test: User B attempts to edit User A's visit...");
  const maliciousEditRes = await fetch(`${API_BASE_URL}/api/visits`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({
      id: visitA_id,
      best_item: 'HACKED_BY_B',
      rating: 1,
    }),
  });
  assert.strictEqual(maliciousEditRes.status, 404, 'User B must be rejected when trying to edit User A visit');
  console.log("✓ Malicious edit blocked with 404 (IDOR prevented).");

  // IDOR TEST: User B attempts to DELETE User A's visit!
  console.log("[C.4] IDOR Attack Test: User B attempts to delete User A's visit...");
  const maliciousDelRes = await fetch(`${API_BASE_URL}/api/visits?id=${encodeURIComponent(visitA_id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert.strictEqual(maliciousDelRes.status, 404, 'User B must be rejected when trying to delete User A visit');
  console.log("✓ Malicious deletion blocked with 404 (IDOR prevented).");

  // Legitimate update by User A
  console.log('[C.5] User A edits own visit...');
  const editARes = await fetch(`${API_BASE_URL}/api/visits`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      id: visitA_id,
      best_item: 'Specialty Cold Coffee with Sea Salt Cream',
      rating: 5,
    }),
  });
  const editAData = await editARes.json();
  assert.strictEqual(editARes.status, 200);
  assert.strictEqual(editAData.visit.best_item, 'Specialty Cold Coffee with Sea Salt Cream');
  console.log('✓ Legitimate edit by User A succeeded.');

  // ----------------------------------------------------
  // WORKFLOW D: VISIT PHOTOGRAPHS
  // ----------------------------------------------------
  console.log('\n--- WORKFLOW D: Visit Photographs & Security ---');

  // Test 1: Upload valid PNG image
  console.log('[D.1] Upload valid PNG photograph by User A...');
  const samplePngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const pngBuffer = Buffer.from(samplePngBase64, 'base64');

  const formDataValid = new FormData();
  formDataValid.append('visit_id', visitA_id);
  formDataValid.append('caption', 'Front garden patio');
  formDataValid.append('file', new Blob([pngBuffer], { type: 'image/png' }), 'garden.png');

  const uploadValidRes = await fetch(`${API_BASE_URL}/api/visits/photos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: formDataValid,
  });
  const uploadValidData = await uploadValidRes.json();
  assert.strictEqual(uploadValidRes.status, 200);
  assert.ok(uploadValidData.photo.url);
  const photoUrl = uploadValidData.photo.url;
  console.log(`✓ Photo uploaded successfully. URL: ${photoUrl}`);

  // Test 2: Reject oversized file (>5 MB)
  console.log('[D.2] Verify oversized file (>5MB) rejection...');
  const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
  const formLarge = new FormData();
  formLarge.append('visit_id', visitA_id);
  formLarge.append('file', new Blob([largeBuffer], { type: 'image/png' }), 'huge.png');

  const uploadLargeRes = await fetch(`${API_BASE_URL}/api/visits/photos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: formLarge,
  });
  assert.ok(uploadLargeRes.status >= 400, 'Server must reject >5MB payload');
  console.log(`✓ Oversized upload rejected with status ${uploadLargeRes.status}`);

  // Test 3: Reject spoofed file (text/exe masquerading as png)
  console.log('[D.3] Verify spoofed content (invalid magic bytes) rejection...');
  const textBuffer = Buffer.from('This is a plain text file pretending to be an image.', 'utf-8');
  const formSpoofed = new FormData();
  formSpoofed.append('visit_id', visitA_id);
  formSpoofed.append('file', new Blob([textBuffer], { type: 'image/png' }), 'spoofed.png');

  const uploadSpoofedRes = await fetch(`${API_BASE_URL}/api/visits/photos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: formSpoofed,
  });
  assert.ok(uploadSpoofedRes.status >= 400, 'Server must reject invalid magic bytes');
  console.log(`✓ Spoofed file rejected with status ${uploadSpoofedRes.status}`);

  // Test 4: IDOR on photo deletion: User B tries to delete User A's photo!
  console.log("[D.4] IDOR Attack Test: User B attempts to delete User A's photo...");
  const maliciousPhotoDelRes = await fetch(
    `${API_BASE_URL}/api/visits/photos?visit_id=${encodeURIComponent(visitA_id)}&url=${encodeURIComponent(photoUrl)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    }
  );
  assert.strictEqual(maliciousPhotoDelRes.status, 404, 'User B must not be able to delete User A photo');
  console.log("✓ Malicious photo deletion blocked with 404 (IDOR prevented).");

  // Legitimate photo deletion by User A
  console.log('[D.5] User A deletes own photograph...');
  const legitimatePhotoDelRes = await fetch(
    `${API_BASE_URL}/api/visits/photos?visit_id=${encodeURIComponent(visitA_id)}&url=${encodeURIComponent(photoUrl)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    }
  );
  const legitimatePhotoDelData = await legitimatePhotoDelRes.json();
  assert.strictEqual(legitimatePhotoDelRes.status, 200);
  assert.strictEqual(legitimatePhotoDelData.success, true);
  console.log('✓ Photograph deleted successfully by owner.');

  // ----------------------------------------------------
  // WORKFLOW E: COLLECTIONS & PRIVACY AUTHORIZATION
  // ----------------------------------------------------
  console.log('\n--- WORKFLOW E: Collections & Privacy Authorization ---');

  // User A creates a PRIVATE collection
  console.log('[E.1] User A creates a PRIVATE collection...');
  const createCollRes = await fetch(`${API_BASE_URL}/api/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      title: "User A's Secret Spots",
      description: 'Hidden gems only for me',
      visibility: 'private',
      place_ids: [samplePlace.id],
    }),
  });
  const createCollData = await createCollRes.json();
  assert.strictEqual(createCollRes.status, 200);
  const collA_id = createCollData.collection.id;
  console.log(`✓ Private collection created. ID: ${collA_id}`);

  // User B lists collections: Private collection of User A must NOT appear
  console.log('[E.2] Verify User B does NOT see User A private collection in list...');
  const getCollsBRes = await fetch(`${API_BASE_URL}/api/collections`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const getCollsBData = await getCollsBRes.json();
  const userBSeesPrivateColl = getCollsBData.collections.some((c) => c.id === collA_id);
  assert.strictEqual(userBSeesPrivateColl, false, 'Private collection must not appear in User B collection list');
  console.log('✓ Private collection hidden from User B list.');

  // User B attempts direct GET /api/collections/[id] on User A's private collection
  console.log('[E.3] Verify User B gets 404 when directly accessing User A private collection...');
  const directGetBRes = await fetch(`${API_BASE_URL}/api/collections/${encodeURIComponent(collA_id)}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert.strictEqual(directGetBRes.status, 404, 'Direct access to private collection by another user must return 404');
  console.log('✓ Direct unauthorized access returned 404.');

  // IDOR TEST: User B attempts to UPDATE User A's collection
  console.log('[E.4] IDOR Attack Test: User B attempts to update User A collection...');
  const updateCollBRes = await fetch(`${API_BASE_URL}/api/collections/${encodeURIComponent(collA_id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ title: 'Hacked Collection' }),
  });
  assert.strictEqual(updateCollBRes.status, 403, 'User B must receive 403 Forbidden');
  console.log('✓ Malicious collection update blocked with 403 Forbidden.');

  // User A updates collection to PUBLIC
  console.log('[E.5] User A changes collection visibility to PUBLIC...');
  const updateCollARes = await fetch(`${API_BASE_URL}/api/collections/${encodeURIComponent(collA_id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ visibility: 'public' }),
  });
  assert.strictEqual(updateCollARes.status, 200);

  // Now User B CAN view the public collection
  console.log('[E.6] Verify User B can now view the collection since it is PUBLIC...');
  const viewPublicBRes = await fetch(`${API_BASE_URL}/api/collections/${encodeURIComponent(collA_id)}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const viewPublicBData = await viewPublicBRes.json();
  assert.strictEqual(viewPublicBRes.status, 200);
  assert.strictEqual(viewPublicBData.collection.id, collA_id);
  console.log('✓ User B successfully retrieved now-public collection.');

  // Clean up collection
  await fetch(`${API_BASE_URL}/api/collections/${encodeURIComponent(collA_id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  console.log('✓ Test collection deleted.');

  // ----------------------------------------------------
  // WORKFLOW F: NATURAL LANGUAGE MEMORY SEARCH
  // ----------------------------------------------------
  console.log('\n--- WORKFLOW F: Personal Memory Search ---');
  const query1 = 'Where did I have cold coffee?';
  const parsed1 = parseNaturalLanguageMemoryQuery(query1);
  assert.strictEqual(parsed1.extractedFilters.bestItem, 'cold coffee');
  console.log(`✓ Query parsed: "${query1}" -> item: ${parsed1.extractedFilters.bestItem}`);

  const query2 = 'Where did I go with my partner in Baner?';
  const parsed2 = parseNaturalLanguageMemoryQuery(query2);
  assert.strictEqual(parsed2.extractedFilters.peopleContext, 'Partner');
  assert.strictEqual(parsed2.extractedFilters.locality, 'Baner');
  console.log(`✓ Query parsed: "${query2}" -> with: ${parsed2.extractedFilters.peopleContext}, locality: ${parsed2.extractedFilters.locality}`);

  // Clean up visit
  await fetch(`${API_BASE_URL}/api/visits?id=${encodeURIComponent(visitA_id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  console.log('✓ Test visit cleaned up.');

  console.log('\n================================================================');
  console.log('ALL PHASE 5 E2E & SECURITY INTEGRATION TESTS PASSED (100%)');
  console.log('================================================================');
}

runPhase5E2ETests().catch((err) => {
  console.error('\n❌ PHASE 5 TEST SUITE FAILED:', err);
  process.exit(1);
});
