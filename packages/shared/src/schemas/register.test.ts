import assert from 'node:assert';
import { test } from 'node:test';
import { RegisterSchema } from './index';

test('RegisterSchema: accepts valid standard registration', () => {
  const input = {
    email: 'user@example.com',
    password: 'password123',
    displayName: 'Rohit Sharma',
  };
  const result = RegisterSchema.safeParse(input);
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.data.email, 'user@example.com');
    assert.strictEqual(result.data.password, 'password123');
    assert.strictEqual(result.data.displayName, 'Rohit Sharma');
  }
});

test('RegisterSchema: accepts registration without displayName', () => {
  const input = {
    email: 'user@example.com',
    password: 'password123',
  };
  const result = RegisterSchema.safeParse(input);
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.data.displayName, undefined);
  }
});

test('RegisterSchema: accepts registration with empty string displayName', () => {
  const input = {
    email: 'user@example.com',
    password: 'password123',
    displayName: '',
  };
  const result = RegisterSchema.safeParse(input);
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.data.displayName, undefined);
  }
});

test('RegisterSchema: accepts registration with "name" alias', () => {
  const input = {
    email: 'user@example.com',
    password: 'password123',
    name: 'Rohit Sharma',
  };
  const result = RegisterSchema.safeParse(input);
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.data.displayName, 'Rohit Sharma');
  }
});

test('RegisterSchema: accepts registration with "display_name" alias', () => {
  const input = {
    email: 'user@example.com',
    password: 'password123',
    display_name: 'Rohit Sharma',
  };
  const result = RegisterSchema.safeParse(input);
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.data.displayName, 'Rohit Sharma');
  }
});

test('RegisterSchema: trims and normalizes email address', () => {
  const input = {
    email: '  User.Test@Example.COM  ',
    password: 'password123',
  };
  const result = RegisterSchema.safeParse(input);
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.data.email, 'user.test@example.com');
  }
});

test('RegisterSchema: rejects password under 8 characters', () => {
  const input = {
    email: 'user@example.com',
    password: 'short',
    displayName: 'Rohit',
  };
  const result = RegisterSchema.safeParse(input);
  assert.strictEqual(result.success, false);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    assert.ok(errors.password);
    assert.strictEqual(errors.password[0], 'Password must be at least 8 characters long');
  }
});

test('RegisterSchema: rejects invalid email format', () => {
  const input = {
    email: 'not-an-email',
    password: 'password123',
  };
  const result = RegisterSchema.safeParse(input);
  assert.strictEqual(result.success, false);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    assert.ok(errors.email);
    assert.strictEqual(errors.email[0], 'Please enter a valid email address');
  }
});

test('RegisterSchema: rejects displayName of 1 character', () => {
  const input = {
    email: 'user@example.com',
    password: 'password123',
    displayName: 'R',
  };
  const result = RegisterSchema.safeParse(input);
  assert.strictEqual(result.success, false);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    assert.ok(errors.displayName);
    assert.strictEqual(errors.displayName[0], 'Display name must be at least 2 characters');
  }
});

test('RegisterSchema: rejects empty payload with missing required fields', () => {
  const result = RegisterSchema.safeParse({});
  assert.strictEqual(result.success, false);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    assert.ok(errors.email);
    assert.ok(errors.password);
  }
});
