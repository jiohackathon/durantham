import crypto from 'node:crypto';

const secret = () => process.env.JWT_SECRET || 'development-only-change-me';
const b64 = (value) => Buffer.from(value).toString('base64url');
const json = (value) => b64(JSON.stringify(value));

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  if (typeof password !== 'string' || password.length < 8) throw new Error('Password must be at least 8 characters');
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [salt, expected] = stored.split(':');
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

export function issueToken(user) {
  const header = json({ alg: 'HS256', typ: 'JWT' });
  const payload = json({ sub: user.id, role: user.role, email: user.email, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 });
  const signature = crypto.createHmac('sha256', secret()).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token) {
  const [header, payload, signature] = (token || '').split('.');
  if (!header || !payload || !signature) throw new Error('Invalid token');
  const expected = crypto.createHmac('sha256', secret()).update(`${header}.${payload}`).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error('Invalid token');
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  if (data.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  return data;
}
