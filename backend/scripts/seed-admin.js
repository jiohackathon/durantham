import { createDatabase, one, run } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

const email = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 8) {
  throw new Error('Set ADMIN_PASSWORD to a password of at least 8 characters before seeding.');
}

const db = createDatabase();
if (one(db, 'SELECT id FROM users WHERE email=?', email)) {
  console.log(`Administrator ${email} already exists; no change made.`);
} else {
  run(db, 'INSERT INTO users (name,email,password_hash,role,site,skills) VALUES (?,?,?,?,?,?)', process.env.ADMIN_NAME || 'Platform Administrator', email, hashPassword(password), 'admin', process.env.ADMIN_SITE || 'HQ', '[]');
  console.log(`Administrator ${email} created.`);
}
db.close();
