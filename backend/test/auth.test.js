import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, issueToken, verifyToken } from '../src/auth.js';

test('password hashes are verifiable and tokens preserve identity', () => {
  process.env.JWT_SECRET = 'test-secret';
  const hash = hashPassword('long-enough-password');
  assert.equal(verifyPassword('long-enough-password', hash), true);
  assert.equal(verifyPassword('wrong-password', hash), false);
  const claims = verifyToken(issueToken({ id: 7, email: 'a@example.com', role: 'dispatcher' }));
  assert.equal(claims.sub, 7);
  assert.equal(claims.role, 'dispatcher');
});
