import { createDatabase, one, run } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import { COMMON_SKILLS } from '../src/domain.js';

const db = createDatabase();
const password = process.env.DEMO_PASSWORD || 'Demo123!';
const email = 'dispatcher@duramint.local';

let dispatcher = one(db, 'SELECT * FROM users WHERE email=?', email);
if (!dispatcher) {
  const result = run(db, 'INSERT INTO users (name,email,password_hash,role,site,skills) VALUES (?,?,?,?,?,?)', 'Duramint Dispatcher', email, hashPassword(password), 'dispatcher', 'Ambattur Industrial Estate', '[]');
  dispatcher = one(db, 'SELECT * FROM users WHERE id=?', result.lastInsertRowid);
}

const machines = [
  ['M-104', 'Hydraulic Press 04', 'Ambattur Industrial Estate'],
  ['M-221', 'CNC Router 12', 'Sriperumbudur'],
  ['M-086', 'Conveyor Line 02', 'Padi']
];
for (const [code, name, site] of machines) {
  if (!one(db, 'SELECT id FROM machines WHERE code=?', code)) run(db, 'INSERT INTO machines (code,name,site,required_skills) VALUES (?,?,?,?)', code, name, site, JSON.stringify(COMMON_SKILLS));
}

const machine104 = one(db, 'SELECT id FROM machines WHERE code=?', 'M-104');
const machine221 = one(db, 'SELECT id FROM machines WHERE code=?', 'M-221');
const machine086 = one(db, 'SELECT id FROM machines WHERE code=?', 'M-086');
const karthik = one(db, 'SELECT id FROM users WHERE technician_id=?', 'MB-T003');
const common = JSON.stringify(COMMON_SKILLS);
const samples = [
  [machine104.id, 'Motor overheating inspection', 'Motor temperature crossed its operating threshold.', 'overheating', 'urgent', common, JSON.stringify(['Thermal Inspection']), 'pending_approval', null],
  [machine221.id, 'CNC control diagnostics', 'Intermittent control-panel fault reported by operators.', 'unexpected_breakdown', 'high', common, JSON.stringify(['PLC Troubleshooting']), 'assigned', karthik?.id ?? null],
  [machine086.id, 'Conveyor vibration assessment', 'Abnormal vibration detected on conveyor drive.', 'excessive_vibration', 'medium', common, JSON.stringify(['Vibration Analysis']), 'exception', null]
];
for (const [machineId, title, description, issueType, priority, requiredSkills, preferredSkills, status, assignedTo] of samples) {
  if (!one(db, 'SELECT id FROM service_requests WHERE title=?', title)) {
    run(db, 'INSERT INTO service_requests (machine_id,requester_id,title,description,issue_type,priority,required_skills,preferred_skills,status,assigned_to) VALUES (?,?,?,?,?,?,?,?,?,?)', machineId, dispatcher.id, title, description, issueType, priority, requiredSkills, preferredSkills, status, assignedTo);
  }
}

console.log(`Demo dispatcher is ready: ${email}`);
console.log(`Demo password: ${password}`);
console.log('Demo machines and service requests are ready. Existing records were left unchanged.');
db.close();
