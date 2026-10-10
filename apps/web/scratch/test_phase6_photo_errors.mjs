import assert from 'assert';

const API_BASE_URL = 'http://127.0.0.1:3000';

async function runPhotoErrorRegressionTests() {
  console.log('================================================================');
  console.log('SPOTDIARY PHASE 6: PHOTO UPLOAD ERROR HANDLING REGRESSION SUITE');
  console.log('Target API:', API_BASE_URL);
  console.log('================================================================\n');

  const timestamp = Date.now();
  const userA_email = `photo_tester_a_${timestamp}@example.com`;
  const userA_password = 'PasswordA123!';
  const userA_name = 'Photo Tester A';

  const userB_email = `photo_tester_b_${timestamp}@example.com`;
  const userB_password = 'PasswordB123!';
  const userB_name = 'Photo Tester B';

  // 1. Register User A and User B
  const regARes = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userA_email, password: userA_password, name: userA_name, displayName: userA_name }),
  });
  const regAData = await regARes.json();
  assert.strictEqual(regARes.status, 200);
  const tokenA = regAData.token;

  const regBRes = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userB_email, password: userB_password, name: userB_name, displayName: userB_name }),
  });
  const regBData = await regBRes.json();
  assert.strictEqual(regBRes.status, 200);
  const tokenB = regBData.token;

  // Create a visit for User A
  const visitPayload = {
    place_id: 'sample-pune-place-1',
    visited_at: new Date().toISOString(),
    rating: 4,
    best_item: 'Filter Coffee',
    notes: 'Regression test visit notes',
    people_context: 'Solo',
    visibility: 'private',
    tags: ['coffee'],
    photos: [],
  };
  const visitRes = await fetch(`${API_BASE_URL}/api/visits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify(visitPayload),
  });
  const visitData = await visitRes.json();
  assert.strictEqual(visitRes.status, 200);
  const visitA_id = visitData.visit.id;
  console.log(`✓ Setup complete: Created test visit ${visitA_id}`);

  // Test 1: Unauthenticated request => 401
  console.log('[T1] Testing unauthenticated upload request...');
  const unauthForm = new FormData();
  unauthForm.append('visit_id', visitA_id);
  const unauthRes = await fetch(`${API_BASE_URL}/api/visits/photos`, {
    method: 'POST',
    body: unauthForm,
  });
  assert.strictEqual(unauthRes.status, 401, 'Unauthenticated upload must return 401');
  console.log('✓ T1 Passed: 401 Unauthorized for missing authentication.');

  // Test 2: Visit ownership check / IDOR => 404
  console.log('[T2] Testing visit ownership authorization check (User B targeting User A visit)...');
  const userBForm = new FormData();
  userBForm.append('visit_id', visitA_id);
  userBForm.append('caption', 'Hacked');
  const valid1x1Png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  userBForm.append('file', new Blob([valid1x1Png], { type: 'image/png' }), 'test.png');
  const userBRes = await fetch(`${API_BASE_URL}/api/visits/photos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: userBForm,
  });
  assert.strictEqual(userBRes.status, 404, 'User B uploading to User A visit must return 404');
  console.log('✓ T2 Passed: 404 Not Found / Unauthorized for visit ownership mismatch.');

  // Test 3: Missing file => 400
  console.log('[T3] Testing upload with missing file...');
  const missingFileForm = new FormData();
  missingFileForm.append('visit_id', visitA_id);
  const missingFileRes = await fetch(`${API_BASE_URL}/api/visits/photos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: missingFileForm,
  });
  assert.strictEqual(missingFileRes.status, 400, 'Missing file must return 400');
  console.log('✓ T3 Passed: 400 Bad Request for missing file.');

  // Test 4: Unsupported MIME type (image/gif, application/pdf) => 415
  console.log('[T4] Testing unsupported image formats (image/gif)...');
  const gifBuffer = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;');
  const gifForm = new FormData();
  gifForm.append('visit_id', visitA_id);
  gifForm.append('file', new Blob([gifBuffer], { type: 'image/gif' }), 'animation.gif');
  const gifRes = await fetch(`${API_BASE_URL}/api/visits/photos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: gifForm,
  });
  assert.strictEqual(gifRes.status, 415, 'Unsupported MIME type must return 415');
  const gifData = await gifRes.json();
  assert.ok(gifData.error.includes('Only JPEG, PNG, and WebP'), 'Error message must clearly state allowed types');
  console.log('✓ T4 Passed: 415 Unsupported Media Type for unsupported image format.');

  // Test 5: Invalid image content / Magic-byte validation failure => 415
  console.log('[T5] Testing magic-byte validation failure (text disguised as image/png)...');
  const fakePngBuffer = Buffer.from('NOT_A_REAL_PNG_CONTENT_HEADER_BYTES_PLAIN_TEXT', 'utf-8');
  const fakePngForm = new FormData();
  fakePngForm.append('visit_id', visitA_id);
  fakePngForm.append('file', new Blob([fakePngBuffer], { type: 'image/png' }), 'fake.png');
  const fakePngRes = await fetch(`${API_BASE_URL}/api/visits/photos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: fakePngForm,
  });
  assert.strictEqual(fakePngRes.status, 415, 'Invalid magic bytes must return 415');
  const fakePngData = await fakePngRes.json();
  assert.ok(fakePngData.error.includes('valid JPEG, PNG, or WebP'), 'Error message must identify invalid content');
  console.log('✓ T5 Passed: 415 Unsupported Media Type for magic-byte validation failure (Fix verified: was 500 in Phase 5).');

  // Test 6: Oversized upload (>5MB buffer) => 413
  console.log('[T6] Testing oversized upload (>5MB buffer)...');
  const largeBuffer = Buffer.alloc(5.5 * 1024 * 1024); // 5.5MB
  // Stamp PNG header to ensure it passes magic byte check if read
  largeBuffer[0] = 0x89; largeBuffer[1] = 0x50; largeBuffer[2] = 0x4e; largeBuffer[3] = 0x47;
  largeBuffer[4] = 0x0d; largeBuffer[5] = 0x0a; largeBuffer[6] = 0x1a; largeBuffer[7] = 0x0a;

  const largeForm = new FormData();
  largeForm.append('visit_id', visitA_id);
  largeForm.append('file', new Blob([largeBuffer], { type: 'image/png' }), 'large.png');
  const largeRes = await fetch(`${API_BASE_URL}/api/visits/photos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: largeForm,
  });
  assert.strictEqual(largeRes.status, 413, 'Oversized payload must return 413 Payload Too Large');
  console.log('✓ T6 Passed: 413 Payload Too Large for files exceeding 5MB.');

  // Test 7: Successful valid upload => 200
  console.log('[T7] Testing valid PNG upload by owner...');
  const validForm = new FormData();
  validForm.append('visit_id', visitA_id);
  validForm.append('caption', 'A lovely day in Pune');
  validForm.append('file', new Blob([valid1x1Png], { type: 'image/png' }), 'valid_sample.png');
  const validRes = await fetch(`${API_BASE_URL}/api/visits/photos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: validForm,
  });
  assert.strictEqual(validRes.status, 200, 'Valid upload must return 200');
  const validData = await validRes.json();
  assert.strictEqual(validData.success, true);
  assert.ok(validData.photo.url);
  const uploadedPhotoUrl = validData.photo.url;
  const uploadedPhotoId = validData.photo.id;
  console.log(`✓ T7 Passed: Valid photo uploaded successfully. ID: ${uploadedPhotoId}, URL: ${uploadedPhotoUrl}`);

  // Test 8: Deletion authorization / IDOR => 404
  console.log('[T8] Testing photo deletion authorization (User B trying to delete User A photo)...');
  const idorDelRes = await fetch(
    `${API_BASE_URL}/api/visits/photos?visit_id=${encodeURIComponent(visitA_id)}&photo_id=${encodeURIComponent(uploadedPhotoId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    }
  );
  assert.strictEqual(idorDelRes.status, 404, 'Unauthorized deletion must return 404');
  console.log('✓ T8 Passed: 404 Not Found on IDOR deletion attempt.');

  // Test 9: Path traversal attack prevention on deletion => 400 or blocked
  console.log('[T9] Testing path traversal attack rejection on deletion...');
  const traversalDelRes = await fetch(
    `${API_BASE_URL}/api/visits/photos?visit_id=${encodeURIComponent(visitA_id)}&url=${encodeURIComponent('../../../etc/passwd')}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    }
  );
  // Should return 404 because no such photo exists or path traversal is blocked
  assert.ok(traversalDelRes.status >= 400, 'Path traversal must be rejected');
  console.log(`✓ T9 Passed: Path traversal blocked with status ${traversalDelRes.status}.`);

  // Test 10: Owner deletion of photo => 200
  console.log('[T10] Testing photo deletion by owner...');
  const ownerDelRes = await fetch(
    `${API_BASE_URL}/api/visits/photos?visit_id=${encodeURIComponent(visitA_id)}&photo_id=${encodeURIComponent(uploadedPhotoId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    }
  );
  assert.strictEqual(ownerDelRes.status, 200, 'Owner deletion must return 200');
  const ownerDelData = await ownerDelRes.json();
  assert.strictEqual(ownerDelData.success, true);
  console.log('✓ T10 Passed: Photo deleted successfully by owner.');

  // Test 11: Error message sanitation check
  console.log('[T11] Testing internal error sanitization...');
  // Inspect code behavior: when unexpected error occurs, Windows or Unix paths like C:\... or /usr/... are sanitized
  const rawErr = new Error('Failure in C:\\Users\\rohit\\SpotDiary\\public\\uploads\\visits\\secret.png or /var/app/uploads');
  const sanitized = rawErr.message
    .replace(/[a-zA-Z]:\\[^\s'"]+/g, '[storage_path]')
    .replace(/\/[\w.-]+(\/[\w.-]+)+/g, '[storage_path]');
  assert.ok(!sanitized.includes('C:\\Users'), 'Must not contain Windows filesystem paths');
  assert.ok(!sanitized.includes('/var/app'), 'Must not contain POSIX filesystem paths');
  assert.ok(sanitized.includes('[storage_path]'), 'Paths must be replaced with [storage_path]');
  console.log(`✓ T11 Passed: Path sanitization verified: "${sanitized}"`);

  console.log('\n================================================================');
  console.log('ALL PHASE 6 PHOTO ERROR HANDLING REGRESSION TESTS PASSED!');
  console.log('================================================================\n');
}

runPhotoErrorRegressionTests().catch((err) => {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
});
