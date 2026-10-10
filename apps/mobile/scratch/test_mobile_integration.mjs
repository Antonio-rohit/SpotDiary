import assert from 'assert';
import { parseNaturalLanguageMemoryQuery, filterVisits } from '../../../packages/shared/dist/index.js';

const API_BASE_URL = 'http://127.0.0.1:3000';

async function runMobileIntegrationTests() {
  console.log('====================================================');
  console.log('SPOTDIARY PHASE 4: EXPO MOBILE INTEGRATION TEST SUITE');
  console.log('Target API:', API_BASE_URL);
  console.log('====================================================\n');

  const testEmail = `mobile_tester_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const testName = 'Mobile Integration Tester';
  let authToken = null;
  let testUserId = null;
  let samplePlaceId = null;
  let createdVisitId = null;
  let createdCollectionId = null;

  // ----------------------------------------------------
  // TEST 1: Mobile User Registration (Dual Auth with Token)
  // ----------------------------------------------------
  console.log('[Test 1] Testing Mobile User Registration...');
  const regRes = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      name: testName,
      displayName: testName,
    }),
  });

  const regData = await regRes.json();
  assert.strictEqual(regRes.status, 200, `Registration should succeed: ${JSON.stringify(regData)}`);
  assert.strictEqual(regData.success, true);
  assert.ok(regData.token, 'Mobile register must return Bearer JWT token in response JSON');
  assert.ok(regData.user, 'Mobile register must return user object');
  authToken = regData.token;
  testUserId = regData.user.id;
  console.log('✓ Mobile Registration succeeded. Token received:', authToken.substring(0, 20) + '...');

  // ----------------------------------------------------
  // TEST 2: Session Verification via Bearer Header
  // ----------------------------------------------------
  console.log('\n[Test 2] Testing Session Verification (GET /api/auth/me) with Bearer token...');
  const meRes = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const meData = await meRes.json();
  assert.strictEqual(meRes.status, 200);
  assert.strictEqual(meData.authenticated, true);
  assert.strictEqual(meData.user.email, testEmail);
  console.log('✓ Bearer token authentication verified for current user:', meData.user.email);

  // ----------------------------------------------------
  // TEST 3: Mobile User Login
  // ----------------------------------------------------
  console.log('\n[Test 3] Testing Mobile Login (POST /api/auth/login)...');
  const loginRes = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginRes.status, 200);
  assert.strictEqual(loginData.success, true);
  assert.ok(loginData.token, 'Mobile login must return JWT token in JSON');
  authToken = loginData.token;
  console.log('✓ Mobile Login succeeded. Token refreshed.');

  // ----------------------------------------------------
  // TEST 4: Unauthorized Request Handling
  // ----------------------------------------------------
  console.log('\n[Test 4] Testing Unauthorized Requests (without token / invalid token)...');
  const unauthRes = await fetch(`${API_BASE_URL}/api/auth/me`);
  const unauthData = await unauthRes.json();
  assert.strictEqual(unauthData.authenticated, false, 'Unauthenticated request must return authenticated: false');

  const invalidTokenRes = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { Authorization: 'Bearer invalid_garbage_token' },
  });
  const invalidTokenData = await invalidTokenRes.json();
  assert.strictEqual(invalidTokenData.authenticated, false, 'Invalid token must return authenticated: false');
  console.log('✓ Unauthorized and invalid token requests rejected gracefully.');

  // ----------------------------------------------------
  // TEST 5: Real Place Discovery & Search
  // ----------------------------------------------------
  console.log('\n[Test 5] Testing Real Place Discovery (GET /api/places/search)...');
  const placesRes = await fetch(`${API_BASE_URL}/api/places/search?locality=Baner`);
  const placesData = await placesRes.json();
  assert.strictEqual(placesRes.status, 200);
  assert.ok(Array.isArray(placesData.places), 'Response places must be an array');
  assert.ok(placesData.places.length > 0, 'Must return real Pune places');
  samplePlaceId = placesData.places[0].id;
  const samplePlaceName = placesData.places[0].name;
  console.log(`✓ Place Discovery returned ${placesData.places.length} places. Sample: "${samplePlaceName}" (${samplePlaceId})`);

  // ----------------------------------------------------
  // TEST 6: Place Details by ID
  // ----------------------------------------------------
  console.log('\n[Test 6] Testing Place Details by ID (GET /api/places/[id])...');
  const placeDetailRes = await fetch(`${API_BASE_URL}/api/places/${encodeURIComponent(samplePlaceId)}`);
  const placeDetailData = await placeDetailRes.json();
  assert.strictEqual(placeDetailRes.status, 200);
  assert.ok(placeDetailData.place, 'Must return place details');
  assert.strictEqual(placeDetailData.place.id, samplePlaceId);
  console.log('✓ Place Details endpoint returned place correctly:', placeDetailData.place.name);

  // ----------------------------------------------------
  // TEST 7: Saved Wishlist Places
  // ----------------------------------------------------
  console.log('\n[Test 7] Testing Saved Places Wishlist Toggle & Retrieval...');
  const samplePlaceObj = placesData.places[0];
  const saveRes = await fetch(`${API_BASE_URL}/api/places/saved`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ place_id: samplePlaceId, place: samplePlaceObj }),
  });
  const saveData = await saveRes.json();
  assert.strictEqual(saveRes.status, 200);
  assert.strictEqual(saveData.saved, true);

  // Retrieve saved places
  const getSavedRes = await fetch(`${API_BASE_URL}/api/places/saved`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const getSavedData = await getSavedRes.json();
  assert.strictEqual(getSavedRes.status, 200);
  assert.strictEqual(getSavedData.authenticated, true);
  const isPresent = getSavedData.places.some((p) => p.id === samplePlaceId);
  assert.strictEqual(isPresent, true, 'Saved place must appear in user wishlist');
  console.log('✓ Place successfully added to wishlist and retrieved.');

  // Unsave place
  const unsaveRes = await fetch(`${API_BASE_URL}/api/places/saved`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ place_id: samplePlaceId }),
  });
  const unsaveData = await unsaveRes.json();
  assert.strictEqual(unsaveData.saved, false);
  console.log('✓ Place successfully removed from wishlist.');

  // ----------------------------------------------------
  // TEST 8: Visit Creation, Retrieval, Editing & Deletion
  // ----------------------------------------------------
  console.log('\n[Test 8] Testing Visit CRUD Operations...');
  const createVisitRes = await fetch(`${API_BASE_URL}/api/visits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      place_id: samplePlaceId,
      visited_at: new Date().toISOString(),
      rating: 5,
      best_item: 'Cold Coffee',
      notes: 'Amazing brew with great balcony seating and pleasant Pune breeze.',
      people_context: 'Partner',
      visibility: 'private',
      tags: ['coffee', 'baner', 'date'],
      photos: [],
    }),
  });
  const createVisitData = await createVisitRes.json();
  assert.strictEqual(createVisitRes.status, 200);
  assert.strictEqual(createVisitData.success, true);
  assert.ok(createVisitData.visit.id);
  createdVisitId = createVisitData.visit.id;
  console.log('✓ Visit logged successfully. Visit ID:', createdVisitId);

  // Fetch visits
  const getVisitsRes = await fetch(`${API_BASE_URL}/api/visits`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const getVisitsData = await getVisitsRes.json();
  assert.strictEqual(getVisitsRes.status, 200);
  assert.strictEqual(getVisitsData.authenticated, true);
  const foundVisit = getVisitsData.visits.find((v) => v.id === createdVisitId);
  assert.ok(foundVisit, 'Logged visit must be retrieved for owner');
  assert.strictEqual(foundVisit.best_item, 'Cold Coffee');
  console.log('✓ User visit retrieved from MongoDB successfully.');

  // Edit visit
  const editVisitRes = await fetch(`${API_BASE_URL}/api/visits`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      id: createdVisitId,
      best_item: 'Vietnamese Iced Coffee',
      notes: 'Updated note: Highly recommended specialty roast.',
      rating: 4,
      people_context: 'Friends',
      visibility: 'public',
      tags: ['vietnamese', 'specialty'],
    }),
  });
  const editVisitData = await editVisitRes.json();
  assert.strictEqual(editVisitRes.status, 200);
  assert.strictEqual(editVisitData.success, true);
  assert.strictEqual(editVisitData.visit.best_item, 'Vietnamese Iced Coffee');
  assert.strictEqual(editVisitData.visit.rating, 4);
  console.log('✓ Visit edited and validated successfully.');

  // ----------------------------------------------------
  // TEST 9: Visit Photograph Upload & Deletion
  // ----------------------------------------------------
  console.log('\n[Test 9] Testing Visit Photograph Upload and Deletion...');
  // Create a minimal 1x1 valid PNG buffer
  const samplePngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const pngBuffer = Buffer.from(samplePngBase64, 'base64');

  const formData = new FormData();
  formData.append('visit_id', createdVisitId);
  formData.append('caption', 'Sunset view from cafe balcony');
  formData.append('file', new Blob([pngBuffer], { type: 'image/png' }), 'test_balcony.png');

  const uploadPhotoRes = await fetch(`${API_BASE_URL}/api/visits/photos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
    body: formData,
  });

  const uploadPhotoData = await uploadPhotoRes.json();
  assert.strictEqual(uploadPhotoRes.status, 200, `Photo upload failed: ${JSON.stringify(uploadPhotoData)}`);
  assert.strictEqual(uploadPhotoData.success, true);
  assert.ok(uploadPhotoData.photo.url);
  const uploadedPhotoUrl = uploadPhotoData.photo.url;
  console.log('✓ Photograph uploaded successfully. URL:', uploadedPhotoUrl);

  // Delete photograph
  const deletePhotoRes = await fetch(
    `${API_BASE_URL}/api/visits/photos?visit_id=${encodeURIComponent(createdVisitId)}&url=${encodeURIComponent(uploadedPhotoUrl)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    }
  );
  const deletePhotoData = await deletePhotoRes.json();
  assert.strictEqual(deletePhotoRes.status, 200);
  assert.strictEqual(deletePhotoData.success, true);
  console.log('✓ Photograph deleted successfully.');

  // ----------------------------------------------------
  // TEST 10: Collection CRUD & Privacy
  // ----------------------------------------------------
  console.log('\n[Test 10] Testing Collection CRUD & Visibility...');
  const createCollRes = await fetch(`${API_BASE_URL}/api/collections`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      title: 'Hidden Pune Work Cafes',
      description: 'Quiet coffee shops with fast Wi-Fi and power sockets',
      visibility: 'private',
      place_ids: [samplePlaceId],
    }),
  });
  const createCollData = await createCollRes.json();
  assert.strictEqual(createCollRes.status, 200);
  assert.strictEqual(createCollData.success, true);
  createdCollectionId = createCollData.collection.id;
  assert.strictEqual(createCollData.collection.visibility, 'private');
  console.log('✓ Private collection created successfully. Collection ID:', createdCollectionId);

  // Retrieve user collections
  const getCollsRes = await fetch(`${API_BASE_URL}/api/collections`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const getCollsData = await getCollsRes.json();
  assert.strictEqual(getCollsRes.status, 200);
  const foundColl = getCollsData.collections.find((c) => c.id === createdCollectionId);
  assert.ok(foundColl, 'Private collection must be visible to owner');
  console.log('✓ Private collection retrieved by owner.');

  // Update collection to public
  const updateCollRes = await fetch(`${API_BASE_URL}/api/collections/${encodeURIComponent(createdCollectionId)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      title: 'Hidden Pune Work Cafes (Updated)',
      visibility: 'public',
    }),
  });
  const updateCollData = await updateCollRes.json();
  assert.strictEqual(updateCollRes.status, 200);
  assert.strictEqual(updateCollData.collection.visibility, 'public');
  console.log('✓ Collection updated to public.');

  // Delete collection
  const deleteCollRes = await fetch(`${API_BASE_URL}/api/collections/${encodeURIComponent(createdCollectionId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const deleteCollData = await deleteCollRes.json();
  assert.strictEqual(deleteCollRes.status, 200);
  assert.strictEqual(deleteCollData.success, true);
  console.log('✓ Collection deleted successfully.');

  // ----------------------------------------------------
  // TEST 11: Personal Natural-Language Memory Search
  // ----------------------------------------------------
  console.log('\n[Test 11] Testing Natural Language Memory Search Engine...');
  
  // Query A: "Where did I go with my friends?"
  const nlQueryA = 'Where did I go with my friends?';
  const interpA = parseNaturalLanguageMemoryQuery(nlQueryA);
  assert.ok(interpA.confidence > 0);
  assert.strictEqual(interpA.extractedFilters.peopleContext, 'Friends');
  console.log(`✓ Query parsed: "${nlQueryA}" -> Extracted: People: ${interpA.extractedFilters.peopleContext} (Confidence: ${Math.round(interpA.confidence * 100)}%)`);

  // Query B: "Where did I have cold coffee?"
  const nlQueryB = 'Where did I have cold coffee?';
  const interpB = parseNaturalLanguageMemoryQuery(nlQueryB);
  assert.ok(interpB.confidence > 0);
  assert.strictEqual(interpB.extractedFilters.bestItem, 'cold coffee');
  console.log(`✓ Query parsed: "${nlQueryB}" -> Extracted: Best Item: ${interpB.extractedFilters.bestItem} (Confidence: ${Math.round(interpB.confidence * 100)}%)`);

  // Test filterVisits with the visit we created using extracted structured filters
  const mockVisitRecord = {
    id: createdVisitId,
    user_id: testUserId,
    place_id: samplePlaceId,
    visited_at: new Date().toISOString(),
    rating: 4,
    best_item: 'Vietnamese Iced Coffee',
    notes: 'Highly recommended specialty roast.',
    people_context: 'Friends',
    visibility: 'public',
    tags: ['vietnamese', 'specialty'],
    photos: [],
    place: {
      id: samplePlaceId,
      name: samplePlaceName,
      locality: 'Baner',
      category: 'Cafes',
    },
  };

  const filteredA = filterVisits([mockVisitRecord], {
    peopleContext: interpA.extractedFilters.peopleContext,
  });
  assert.strictEqual(filteredA.length, 1, 'filterVisits must find visit matching with friends');
  assert.strictEqual(filteredA[0].id, createdVisitId);

  const mockVisitColdCoffee = {
    ...mockVisitRecord,
    best_item: 'Cold Coffee with ice cream',
  };
  const filteredB = filterVisits([mockVisitColdCoffee], {
    bestItem: interpB.extractedFilters.bestItem,
  });
  assert.strictEqual(filteredB.length, 1, 'filterVisits must find visit matching cold coffee');
  console.log('✓ Natural language memory search correctly matched the visit records across queries!');

  // ----------------------------------------------------
  // CLEANUP: Delete test visit
  // ----------------------------------------------------
  console.log('\n[Cleanup] Deleting test visit record...');
  const delVisitRes = await fetch(`${API_BASE_URL}/api/visits?id=${encodeURIComponent(createdVisitId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const delVisitData = await delVisitRes.json();
  assert.strictEqual(delVisitRes.status, 200);
  assert.strictEqual(delVisitData.success, true);
  console.log('✓ Test visit deleted.');

  console.log('\n====================================================');
  console.log('ALL MOBILE INTEGRATION TESTS PASSED SUCCESSFULLY! (11/11)');
  console.log('====================================================');
}

runMobileIntegrationTests().catch((err) => {
  console.error('\n❌ INTEGRATION TEST FAILED:', err);
  process.exit(1);
});
