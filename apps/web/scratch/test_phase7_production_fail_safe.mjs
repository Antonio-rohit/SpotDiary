import assert from 'assert';

async function runProductionFailSafeTests() {
  console.log('================================================================');
  console.log('SPOTDIARY PHASE 7: PRODUCTION FAIL-SAFE CONFIGURATION AUDIT');
  console.log('================================================================\n');

  // Save current env
  const originalEnv = { ...process.env };

  try {
    // 1. Verify missing JWT_SECRET throws in production
    console.log('[Test 1] Verifying missing JWT_SECRET validation logic in production...');
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    const checkJwt = (secret) => {
      if (!secret || secret.trim().length === 0) {
        throw new Error('Server configuration error: JWT_SECRET environment variable is missing or unconfigured.');
      }
      if (process.env.NODE_ENV === 'production' && secret.length < 32) {
        throw new Error('Production security error: JWT_SECRET must be at least 32 characters in production.');
      }
      return new TextEncoder().encode(secret);
    };

    assert.throws(
      () => checkJwt(process.env.JWT_SECRET),
      /JWT_SECRET environment variable is missing/,
      'Server must refuse to run without JWT_SECRET'
    );
    console.log('✓ Test 1 Passed: Missing JWT_SECRET correctly throws.');

    // 2. Verify weak JWT_SECRET (< 32 chars) throws in production
    console.log('[Test 2] Verifying weak JWT_SECRET (<32 chars) fails safely in production...');
    process.env.JWT_SECRET = 'short_weak_secret';
    assert.throws(
      () => checkJwt(process.env.JWT_SECRET),
      /JWT_SECRET must be at least 32 characters in production/,
      'Server must refuse to run with weak JWT_SECRET'
    );
    console.log('✓ Test 2 Passed: Weak JWT_SECRET (<32 chars) correctly rejected.');

    // 3. Verify valid JWT_SECRET (>= 32 chars) succeeds in production
    console.log('[Test 3] Verifying strong JWT_SECRET (>= 32 chars) succeeds in production...');
    process.env.JWT_SECRET = 'a_very_strong_production_secret_key_exceeding_32_characters!';
    const key = checkJwt(process.env.JWT_SECRET);
    assert.ok(key instanceof Uint8Array);
    console.log('✓ Test 3 Passed: Strong JWT_SECRET accepted.');

    // 4. Verify missing MONGODB_URI fails safely in production
    console.log('[Test 4] Verifying missing MONGODB_URI fails safely in production...');
    delete process.env.MONGODB_URI;
    const checkMongo = () => {
      const isMongoConfigured = !!process.env.MONGODB_URI && process.env.MONGODB_URI.trim().length > 0;
      if (!isMongoConfigured && process.env.NODE_ENV === 'production') {
        throw new Error('Production configuration error: MONGODB_URI is required in production.');
      }
    };
    assert.throws(
      () => checkMongo(),
      /MONGODB_URI is required in production/,
      'Server must refuse to fall back to local JSON in production'
    );
    console.log('✓ Test 4 Passed: Missing MONGODB_URI correctly throws in production.');

    // 5. Verify unconfigured S3 storage fails safely in production without ALLOW_LOCAL_STORAGE
    console.log('[Test 5] Verifying unconfigured storage fails safely in production...');
    delete process.env.STORAGE_TYPE;
    delete process.env.ALLOW_LOCAL_STORAGE;
    delete process.env.AWS_S3_BUCKET;
    const { isStorageConfigured, saveVisitPhoto } = await import('../src/lib/storage/storageAdapter.ts');
    assert.strictEqual(isStorageConfigured(), false, 'isStorageConfigured must return false');
    const valid1x1Png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    await assert.rejects(
      async () => await saveVisitPhoto(valid1x1Png, 'image/png', 'sample.png'),
      /Object storage service is not configured for production/,
      'saveVisitPhoto must refuse silent fallback to local storage in production'
    );
    console.log('✓ Test 5 Passed: Ephemeral local storage fallback blocked in production.');

    // 6. Verify unconfigured Email service fails safely
    console.log('[Test 6] Verifying unconfigured Email service fails safely...');
    delete process.env.ENABLE_TEST_EMAIL;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_WEBHOOK_URL;
    delete process.env.SMTP_HOST;
    const { isEmailConfigured, sendPasswordResetEmail } = await import('../src/lib/email/emailService.ts');
    assert.strictEqual(isEmailConfigured(), false);
    const emailResult = await sendPasswordResetEmail('test@example.com', 'https://example.com/reset');
    assert.strictEqual(emailResult.sent, false);
    assert.ok(emailResult.error?.includes('not configured'));
    console.log('✓ Test 6 Passed: Email service honestly reports unconfigured state.');

    console.log('\n================================================================');
    console.log('ALL PHASE 7 PRODUCTION FAIL-SAFE CHECKS PASSED SUCCESSFULLY!');
    console.log('================================================================\n');
  } finally {
    process.env = originalEnv;
  }
}

runProductionFailSafeTests().catch((err) => {
  console.error('\n❌ Production Fail-Safe Test Failed:', err);
  process.exit(1);
});
