import { createDatabase, one, run } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import { TECHNICIANS } from '../src/domain.js';

const db = createDatabase();
const password = process.env.DEMO_TECHNICIAN_PASSWORD || 'Technician123!';
let inserted = 0;
for (const technician of TECHNICIANS) {
  if (one(db, 'SELECT id FROM users WHERE technician_id=?', technician.technicianId)) continue;
  const email = `${technician.technicianId.toLowerCase()}@service-demo.local`;
  run(db, 'INSERT INTO users (technician_id,name,email,password_hash,role,site,skills,skill_focus,rating) VALUES (?,?,?,?,?,?,?,?,?)', technician.technicianId, technician.name, email, hashPassword(password), 'technician', technician.site, JSON.stringify(technician.skills), technician.skillFocus, technician.rating);
  inserted++;
}
console.log(`${inserted} technicians added. Existing technician IDs were left unchanged.`);
console.log('Demo technician password is the value of DEMO_TECHNICIAN_PASSWORD, or Technician123! if it was not set.');
db.close();
