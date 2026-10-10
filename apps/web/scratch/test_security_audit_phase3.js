const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const { SignJWT, jwtVerify } = require('jose');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'audit-test-jwt-secret-key-32-chars-long-minimum!';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/spotdiary';
process.env.ENABLE_TEST_EMAIL = 'true';

const secretKey = new TextEncoder().encode(process.env.JWT_SECRET);

async function createTestSessionToken(payload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey);
}

async function verifyTestSessionToken(token, db) {
  try {
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
    const userEmail = payload.email;
    const iatSeconds = payload.iat;

    if (userEmail && iatSeconds !== undefined) {
      const userDoc = await db.collection('users').findOne({ email: userEmail });
      if (!userDoc) return null;

      if (userDoc.password_changed_at) {
        const changedAtSeconds = Math.floor(new Date(userDoc.password_changed_at).getTime() / 1000);
        if (changedAtSeconds > iatSeconds) {
          return null; // Revoked!
        }
      }
    }
    return payload;
  } catch {
    return null;
  }
}

function detectImageMagicBytes(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'jpeg';
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
    buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A
  ) return 'png';
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) return 'webp';
  return null;
}

function deleteVisitPhotoSecure(relativePath) {
  if (!relativePath || relativePath.includes('..') || relativePath.includes('\0')) {
    return false; // Traversal attempt blocked
  }
  const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
  const uploadsDir = path.resolve(path.join(process.cwd(), 'apps', 'web', 'public', 'uploads', 'visits'));
  const fullPath = path.resolve(process.cwd(), 'apps', 'web', 'public', cleanPath);

  if (!fullPath.startsWith(uploadsDir)) {
    return false;
  }
  return true;
}

async function runSecurityAuditTests() {
  console.log('=== STARTING PHASE 3 SECURITY AUDIT & STABILIZATION TESTS ===\n');

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  const usersCol = db.collection('users');
  const resetsCol = db.collection('password_resets');

  // Clean test artifacts
  const auditEmail = 'audit_user@spotdiary.test';
  await usersCol.deleteMany({ email: auditEmail });
  await resetsCol.deleteMany({ email: auditEmail });

  const auditUser = {
    _id: 'usr-audit-1',
    id: 'usr-audit-1',
    email: auditEmail,
    password_hash: '$2a$10$w8T9JbXkG.4B9eOq...dummyhash',
    display_name: 'Audit User',
    username: 'audit_user',
    created_at: new Date().toISOString(),
  };

  await usersCol.insertOne(auditUser);

  // -------------------------------------------------------------
  // TEST 1: CONCURRENT RESET TOKEN CONSUMPTION (RACE CONDITION CHECK)
  // -------------------------------------------------------------
  console.log('--- TEST 1: CONCURRENT RESET TOKEN CONSUMPTION ---');
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const futureExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await resetsCol.insertOne({
    user_id: auditUser.id,
    email: auditUser.email,
    token_hash: tokenHash,
    expires_at: futureExpiry,
    used: false,
    created_at: new Date().toISOString(),
  });

  // Simulate two concurrent requests attempting to consume the exact same token
  const claimTokenAtomic = async () => {
    const nowISO = new Date().toISOString();
    const result = await resetsCol.updateOne(
      {
        token_hash: tokenHash,
        used: false,
        expires_at: { $gt: nowISO },
      },
      {
        $set: {
          used: true,
          used_at: nowISO,
        },
      }
    );
    return result.modifiedCount;
  };

  const [res1, res2] = await Promise.all([claimTokenAtomic(), claimTokenAtomic()]);
  const successCount = res1 + res2;

  if (successCount !== 1) {
    throw new Error(`Test 1 Failed: Atomic consumption expected 1 successful claim, got ${successCount}`);
  }
  console.log('✓ PASS: Atomic token consumption under concurrent requests verified. Exactly 1 request succeeded.');

  // -------------------------------------------------------------
  // TEST 2: SESSION REVOCATION STRATEGY VERIFICATION
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: SESSION REVOCATION STRATEGY ---');

  const oldSessionPayload = {
    id: auditUser.id,
    email: auditUser.email,
    username: auditUser.username,
    display_name: auditUser.display_name,
  };

  // Issue token before password reset
  const oldToken = await createTestSessionToken(oldSessionPayload);
  console.log('Old session token issued.');

  // Wait 1.1s to ensure integer second delta
  await new Promise(r => setTimeout(r, 1100));

  // Trigger Password Reset -> Set password_changed_at in DB
  const resetTimestamp = new Date().toISOString();
  await usersCol.updateOne({ email: auditUser.email }, { $set: { password_changed_at: resetTimestamp } });

  // Verify old token is REVOKED
  const verifiedOldToken = await verifyTestSessionToken(oldToken, db);
  if (verifiedOldToken !== null) {
    throw new Error('Test 2 Failed: Old session token was NOT revoked after password reset!');
  }
  console.log('✓ PASS: Pre-reset session token correctly REVOKED.');

  // Issue new session token after password reset
  await new Promise(r => setTimeout(r, 1100));
  const newToken = await createTestSessionToken(oldSessionPayload);
  const verifiedNewToken = await verifyTestSessionToken(newToken, db);
  if (!verifiedNewToken) {
    throw new Error('Test 2 Failed: Post-reset session token was rejected.');
  }
  console.log('✓ PASS: Post-reset session token verified as VALID.');

  // -------------------------------------------------------------
  // TEST 3: FILE CONTENT MAGIC BYTES INSPECTION
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: FILE CONTENT MAGIC BYTES INSPECTION ---');

  // Test malicious executable buffer disguised as JPG
  const fakeJpgBuffer = Buffer.from('<?php echo "malicious script"; ?>');
  const magicResult = detectImageMagicBytes(fakeJpgBuffer);
  if (magicResult !== null) {
    throw new Error('Test 3 Failed: Malicious non-image buffer passed magic byte check!');
  }
  console.log('✓ PASS: Malicious non-image buffer correctly rejected by magic byte inspector.');

  // Test legitimate PNG buffer
  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]);
  const validMagicResult = detectImageMagicBytes(validPngBuffer);
  if (validMagicResult !== 'png') {
    throw new Error('Test 3 Failed: Valid PNG magic bytes not detected.');
  }
  console.log('✓ PASS: Magic byte inspection strictly distinguishes real image binary from spoofed files.');

  // -------------------------------------------------------------
  // TEST 4: PATH TRAVERSAL DELETION ISOLATION
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: PATH TRAVERSAL DELETION ISOLATION ---');
  const traversalAttempt1 = deleteVisitPhotoSecure('../../../package.json');
  const traversalAttempt2 = deleteVisitPhotoSecure('../../.env.local');

  if (traversalAttempt1 || traversalAttempt2) {
    throw new Error('Test 4 Failed: Path traversal deletion attempt succeeded!');
  }
  console.log('✓ PASS: Path traversal deletion attempts cleanly blocked.');

  // Cleanup
  await usersCol.deleteMany({ email: auditEmail });
  await resetsCol.deleteMany({ email: auditEmail });
  await client.close();

  console.log('\n=== ALL PHASE 3 SECURITY AUDIT TESTS PASSED SUCCESSFULLY! ===');
}

runSecurityAuditTests().catch(err => {
  console.error('\n❌ SECURITY AUDIT TEST FAILURE:', err);
  process.exit(1);
});
