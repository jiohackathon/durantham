import { createDatabase, one, run } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

const email = String(process.env.DEMO_USER_EMAIL || '').trim().toLowerCase();
const password = process.env.DEMO_USER_PASSWORD;
const name = String(process.env.DEMO_USER_NAME || '').trim();
const role = String(process.env.DEMO_USER_ROLE || 'admin').trim();

if (!email || !password || !name) throw new Error('Set DEMO_USER_EMAIL, DEMO_USER_PASSWORD, and DEMO_USER_NAME.');
if (!['admin', 'dispatcher', 'requester', 'technician'].includes(role)) throw new Error('DEMO_USER_ROLE must be admin, dispatcher, requester, or technician.');
if (password.length < 8) throw new Error('DEMO_USER_PASSWORD must be at least 8 characters.');

const db = createDatabase();
const existing = one(db, 'SELECT id FROM users WHERE email=?', email);
if (existing) {
  run(db, 'UPDATE users SET name=?, password_hash=?, role=?, active=1 WHERE id=?', name, hashPassword(password), role, existing.id);
  console.log(`Updated ${role} account: ${email}`);
} else {
  run(db, 'INSERT INTO users (name,email,password_hash,role,skills) VALUES (?,?,?,?,?)', name, email, hashPassword(password), role, '[]');
  console.log(`Created ${role} account: ${email}`);
}
db.close();
