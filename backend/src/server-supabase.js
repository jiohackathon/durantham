import http from 'node:http';
import fs from 'node:fs';
import nodePath from 'node:path';
import { URL, fileURLToPath } from 'node:url';
import { hashPassword, verifyPassword, issueToken, verifyToken } from './auth.js';
import { COMMON_SKILLS, ISSUE_TYPES, TECHNICIANS } from './domain.js';

const PORT = Number(process.env.PORT || 3000);
const corsOrigin = process.env.CORS_ORIGIN || '*';
const frontendRoot = nodePath.resolve(nodePath.dirname(fileURLToPath(import.meta.url)), '../../frontend');
const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error('APP_DATABASE=supabase requires SUPABASE_URL and SUPABASE_SECRET_KEY. Keep the secret key only in server environment variables.');
}

const roles = (...allowed) => (user) => allowed.includes(user.role);
const now = () => new Date().toISOString();
const apiBase = `${supabaseUrl}/rest/v1`;
const tables = {
  users: 'duramint_users', machines: 'duramint_machines', parts: 'duramint_parts', requests: 'duramint_service_requests',
  reservations: 'duramint_part_reservations', logs: 'duramint_task_logs', attachments: 'duramint_attachments',
  notifications: 'duramint_notifications', audit: 'duramint_audit_events'
};

function query(params = {}) { const value = new URLSearchParams(); for (const [key, item] of Object.entries(params)) if (item != null) value.set(key, item); return value.toString(); }
async function rest(table, { method = 'GET', params, body, prefer = '' } = {}) {
  const response = await fetch(`${apiBase}/${table}${params ? `?${query(params)}` : ''}`, {
    method,
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: prefer },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Shared database request failed (${response.status}): ${detail}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
const list = (table, params = {}) => rest(table, { params: { select: '*', ...params } });
async function one(table, params = {}) { return (await list(table, { ...params, limit: '1' }))[0] || null; }
async function insert(table, body) { return (await rest(table, { method: 'POST', body, prefer: 'return=representation' }))[0]; }
async function update(table, params, body) { return (await rest(table, { method: 'PATCH', params, body, prefer: 'return=representation' }))[0] || null; }
const equal = value => `eq.${value}`;
const isTrue = 'is.true';

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin, 'Access-Control-Allow-Headers': 'Authorization, Content-Type' });
  res.end(JSON.stringify(body));
}
function serveFrontend(res, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const target = nodePath.resolve(frontendRoot, relative);
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.ico': 'image/x-icon' };
  if (!target.startsWith(`${frontendRoot}${nodePath.sep}`) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) return false;
  res.writeHead(200, { 'Content-Type': mime[nodePath.extname(target)] || 'application/octet-stream' });
  fs.createReadStream(target).pipe(res);
  return true;
}
async function body(req) {
  let raw = ''; for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error('Body must be valid JSON'), { status: 400 }); }
}
async function audit(actorId, entityType, entityId, action, metadata = {}) {
  await insert(tables.audit, { actor_id: actorId, entity_type: entityType, entity_id: entityId, action, metadata });
}
async function notify(userId, message) { if (userId) await insert(tables.notifications, { user_id: userId, message }); }
function publicUser(user) { return { id: user.id, name: user.name, email: user.email, role: user.role, site: user.site }; }
async function requireUser(req) {
  const value = req.headers.authorization || '';
  if (!value.startsWith('Bearer ')) throw Object.assign(new Error('Authentication required'), { status: 401 });
  const claims = verifyToken(value.slice(7));
  const user = await one(tables.users, { id: equal(claims.sub) });
  if (!user || !user.active) throw Object.assign(new Error('Account is unavailable'), { status: 401 });
  return user;
}
function allowed(user, predicate) { if (!predicate(user)) throw Object.assign(new Error('Insufficient permission'), { status: 403 }); }

async function requestRows() {
  const [requests, machines, users] = await Promise.all([list(tables.requests, { order: 'created_at.desc' }), list(tables.machines), list(tables.users)]);
  const machineById = new Map(machines.map(machine => [String(machine.id), machine]));
  const userById = new Map(users.map(user => [String(user.id), user]));
  return requests.map(row => ({
    ...row,
    required_skills: row.required_skills || [], preferred_skills: row.preferred_skills || [], required_parts: row.required_parts || [],
    machine_code: machineById.get(String(row.machine_id))?.code, machine_name: machineById.get(String(row.machine_id))?.name,
    site: machineById.get(String(row.machine_id))?.site, requester_name: userById.get(String(row.requester_id))?.name,
    technician_name: userById.get(String(row.assigned_to))?.name
  }));
}
async function getRequest(id) { return (await requestRows()).find(row => String(row.id) === String(id)) || null; }
async function bestTechnician(request) {
  const [technicians, active] = await Promise.all([
    list(tables.users, { role: equal('technician'), active: isTrue }),
    list(tables.requests, { status: 'in.(assigned,in_progress)' })
  ]);
  const workload = new Map();
  for (const item of active) workload.set(String(item.assigned_to), (workload.get(String(item.assigned_to)) || 0) + 1);
  return technicians
    .filter(technician => technician.site === request.site && request.required_skills.every(skill => (technician.skills || []).includes(skill)) && (!request.preferred_skills.length || request.preferred_skills.some(skill => (technician.skills || []).includes(skill))))
    .sort((a, b) => (workload.get(String(a.id)) || 0) - (workload.get(String(b.id)) || 0) || Number(b.rating || 0) - Number(a.rating || 0))[0];
}
async function transition(user, request, next, note) {
  const legal = { pending_approval: ['approved', 'cancelled'], approved: ['assigned', 'exception', 'cancelled'], assigned: ['in_progress', 'exception', 'cancelled'], in_progress: ['completed', 'exception'], exception: ['assigned', 'cancelled'] };
  if (!legal[request.status]?.includes(next)) throw Object.assign(new Error(`Cannot move ${request.status} request to ${next}`), { status: 409 });
  await update(tables.requests, { id: equal(request.id) }, { status: next, updated_at: now(), completed_at: next === 'completed' ? now() : request.completed_at });
  if (note) await insert(tables.logs, { request_id: request.id, author_id: user.id, note, status: next });
  await audit(user.id, 'service_request', request.id, `status_changed_to_${next}`);
}

async function seedHostedDemo() {
  if (process.env.AUTO_SEED_DEMO !== 'true') return;
  const password = process.env.DEMO_ADMIN_PASSWORD;
  if (!password || password.length < 8) throw new Error('AUTO_SEED_DEMO requires DEMO_ADMIN_PASSWORD with at least 8 characters.');
  const email = String(process.env.DEMO_ADMIN_EMAIL || 'admin@duramint.local').trim().toLowerCase();
  let admin = await one(tables.users, { email: equal(email) });
  if (!admin) admin = await insert(tables.users, { name: process.env.DEMO_ADMIN_NAME || 'Duramint Administrator', email, password_hash: hashPassword(password), role: 'admin', site: 'Ambattur Industrial Estate', skills: [] });
  for (const technician of TECHNICIANS) {
    if (!await one(tables.users, { technician_id: equal(technician.technicianId) })) {
      await insert(tables.users, { technician_id: technician.technicianId, name: technician.name, email: `${technician.technicianId.toLowerCase()}@service-demo.local`, password_hash: hashPassword(process.env.DEMO_TECHNICIAN_PASSWORD || 'Technician123!'), role: 'technician', site: technician.site, skills: technician.skills, skill_focus: technician.skillFocus, rating: technician.rating });
    }
  }
  for (const [code, name, site] of [['M-104', 'Hydraulic Press 04', 'Ambattur Industrial Estate'], ['M-221', 'CNC Router 12', 'Sriperumbudur'], ['M-086', 'Conveyor Line 02', 'Padi']]) {
    if (!await one(tables.machines, { code: equal(code) })) await insert(tables.machines, { code, name, site, required_skills: COMMON_SKILLS });
  }
  console.log(`Shared Supabase demo is ready. Administrator: ${email}`);
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host}`); const path = url.pathname;
  if (req.method === 'GET' && (path === '/' || /\.(?:html|js|css|ico)$/.test(path))) { if (serveFrontend(res, path)) return; }
  if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true, database: 'supabase', time: now() });
  if (req.method === 'GET' && path === '/catalog/technicians') {
    const technicians = (await list(tables.users, { role: equal('technician'), active: isTrue, order: 'rating.desc' })).map(person => ({ technician_id: person.technician_id, name: person.name, location: person.site, skill_focus: person.skill_focus, rating: person.rating, issue_type: (person.skills || []).find(skill => Object.values(ISSUE_TYPES).some(issue => issue.preferredSkills.includes(skill))) || 'general' }));
    return send(res, 200, { source: 'supabase_shared_app', technicians });
  }
  if (req.method === 'GET' && path === '/catalog/issue-types') return send(res, 200, { source: 'supabase_shared_app', issue_types: Object.entries(ISSUE_TYPES).map(([issue_type, value]) => ({ issue_type, label: value.label })) });
  const payload = ['POST', 'PATCH'].includes(req.method) ? await body(req) : {};
  if (req.method === 'POST' && path === '/auth/register') {
    const { name, email, password, role = 'requester', site = null, skills = [] } = payload;
    if (!name || !email || !password) throw Object.assign(new Error('name, email and password are required'), { status: 400 });
    if (!['requester', 'technician'].includes(role)) throw Object.assign(new Error('Public registration permits requester or technician only'), { status: 403 });
    if (await one(tables.users, { email: equal(String(email).toLowerCase()) })) throw Object.assign(new Error('An account with that email already exists'), { status: 409 });
    const user = await insert(tables.users, { name, email: String(email).toLowerCase(), password_hash: hashPassword(password), role, site, skills });
    await audit(user.id, 'user', user.id, 'registered');
    return send(res, 201, { user: publicUser(user), token: issueToken(user) });
  }
  if (req.method === 'POST' && path === '/auth/login') {
    const user = await one(tables.users, { email: equal(String(payload.email || '').toLowerCase()) });
    if (!user || !verifyPassword(payload.password || '', user.password_hash)) throw Object.assign(new Error('Invalid email or password'), { status: 401 });
    return send(res, 200, { token: issueToken(user), user: publicUser(user) });
  }
  const user = await requireUser(req);
  if (req.method === 'GET' && path === '/me') return send(res, 200, { ...publicUser(user), skills: user.skills || [], active: user.active });
  if (req.method === 'GET' && path === '/notifications') return send(res, 200, await list(tables.notifications, { user_id: equal(user.id), order: 'created_at.desc' }));
  if (req.method === 'GET' && path === '/users') {
    allowed(user, roles('admin'));
    const users = await list(tables.users, { order: 'role.asc,name.asc' });
    return send(res, 200, users.map(person => ({ ...publicUser(person), technician_id: person.technician_id, skills: person.skills || [], skill_focus: person.skill_focus, rating: person.rating, active: person.active, created_at: person.created_at })));
  }
  if (req.method === 'POST' && path === '/users') {
    allowed(user, roles('admin')); const { name, email, password, role, site = null, skills = [] } = payload;
    if (!name || !email || !password || !role) throw Object.assign(new Error('name, email, password and role are required'), { status: 400 });
    if (!['admin', 'dispatcher', 'technician', 'requester'].includes(role)) throw Object.assign(new Error('Invalid user role'), { status: 400 });
    const created = await insert(tables.users, { name, email: String(email).toLowerCase(), password_hash: hashPassword(password), role, site, skills });
    await audit(user.id, 'user', created.id, 'created'); return send(res, 201, { ...publicUser(created), skills: created.skills || [] });
  }
  if (req.method === 'GET' && path === '/technicians') { allowed(user, roles('admin', 'dispatcher')); return send(res, 200, await list(tables.users, { role: equal('technician'), active: isTrue, order: 'rating.desc' })); }
  if (req.method === 'GET' && path === '/machines') return send(res, 200, await list(tables.machines, { order: 'site.asc,code.asc' }));
  if (req.method === 'POST' && path === '/machines') { allowed(user, roles('admin', 'dispatcher')); const { code, name, site, required_skills = [] } = payload; if (!code || !name || !site) throw Object.assign(new Error('code, name and site are required'), { status: 400 }); const machine = await insert(tables.machines, { code, name, site, required_skills }); await audit(user.id, 'machine', machine.id, 'created'); return send(res, 201, machine); }
  if (req.method === 'GET' && path === '/parts') { allowed(user, roles('admin', 'dispatcher', 'technician')); return send(res, 200, await list(tables.parts, { order: 'name.asc' })); }
  if (req.method === 'POST' && path === '/parts') { allowed(user, roles('admin', 'dispatcher')); const { sku, name, quantity = 0, reorder_level = 0 } = payload; if (!sku || !name || !Number.isInteger(quantity) || quantity < 0) throw Object.assign(new Error('sku, name and non-negative integer quantity are required'), { status: 400 }); const part = await insert(tables.parts, { sku, name, quantity, reorder_level }); await audit(user.id, 'part', part.id, 'created'); return send(res, 201, part); }
  if (req.method === 'GET' && path === '/requests') { let rows = await requestRows(); if (user.role === 'requester') rows = rows.filter(row => String(row.requester_id) === String(user.id)); if (user.role === 'technician') rows = rows.filter(row => String(row.assigned_to) === String(user.id)); if (url.searchParams.get('status')) rows = rows.filter(row => row.status === url.searchParams.get('status')); return send(res, 200, rows); }
  if (req.method === 'POST' && path === '/requests') {
    const { machine_id, title, description = '', issue_type = null, priority = 'medium', required_skills = [], required_parts = [], due_at = null } = payload;
    const machine = await one(tables.machines, { id: equal(machine_id) }); const issue = issue_type && ISSUE_TYPES[issue_type];
    if (!machine || machine.status !== 'active') throw Object.assign(new Error('Machine must exist and be active'), { status: 400 });
    if (issue_type && !issue) throw Object.assign(new Error(`issue_type must be one of: ${Object.keys(ISSUE_TYPES).join(', ')}`), { status: 400 });
    if (!title || !['low', 'medium', 'high', 'urgent'].includes(priority) || !Array.isArray(required_parts) || !Array.isArray(required_skills)) throw Object.assign(new Error('Invalid request fields'), { status: 400 });
    const record = await insert(tables.requests, { machine_id, requester_id: user.id, title, description, issue_type, priority, required_skills: issue ? [...new Set([...COMMON_SKILLS, ...required_skills])] : required_skills, preferred_skills: issue ? issue.preferredSkills : [], required_parts, due_at });
    await audit(user.id, 'service_request', record.id, 'created', { issue_type }); return send(res, 201, await getRequest(record.id));
  }
  const match = path.match(/^\/requests\/(\d+)(?:\/(approve|start|complete|reassign|exception|logs|attachments))?$/);
  if (match) {
    const id = Number(match[1]), action = match[2], request = await getRequest(id);
    if (!request) throw Object.assign(new Error('Service request not found'), { status: 404 });
    if (!action && req.method === 'GET') { if ((user.role === 'requester' && String(request.requester_id) !== String(user.id)) || (user.role === 'technician' && String(request.assigned_to) !== String(user.id))) throw Object.assign(new Error('Insufficient permission'), { status: 403 }); return send(res, 200, request); }
    if (req.method === 'POST' && action === 'approve') {
      allowed(user, roles('admin', 'dispatcher')); if (request.status !== 'pending_approval') throw Object.assign(new Error('Only pending requests can be approved'), { status: 409 });
      await transition(user, request, 'approved', 'Request approved'); const technician = payload.technician_id ? await one(tables.users, { id: equal(payload.technician_id), role: equal('technician'), active: isTrue }) : await bestTechnician(request);
      if (technician) { await update(tables.requests, { id: equal(id) }, { assigned_to: technician.id, updated_at: now() }); await transition(user, { ...request, status: 'approved' }, 'assigned', `Assigned to ${technician.name}`); await notify(technician.id, `You were assigned request #${id}: ${request.title}`); } else await transition(user, { ...request, status: 'approved' }, 'exception', 'No qualified technician available');
      return send(res, 200, await getRequest(id));
    }
    if (req.method === 'POST' && action === 'start') { if (user.role !== 'technician' || String(request.assigned_to) !== String(user.id)) throw Object.assign(new Error('Only the assigned technician can start work'), { status: 403 }); await transition(user, request, 'in_progress', payload.note || 'Work started'); return send(res, 200, await getRequest(id)); }
    if (req.method === 'POST' && action === 'complete') { if (user.role !== 'technician' || String(request.assigned_to) !== String(user.id)) throw Object.assign(new Error('Only the assigned technician can complete work'), { status: 403 }); if (!payload.verification_note) throw Object.assign(new Error('verification_note is required'), { status: 400 }); await transition(user, request, 'completed', payload.verification_note); await notify(request.requester_id, `Request #${id} has been completed`); return send(res, 200, await getRequest(id)); }
    if (req.method === 'POST' && action === 'reassign') { allowed(user, roles('admin', 'dispatcher')); const technician = await one(tables.users, { id: equal(payload.technician_id), role: equal('technician'), active: isTrue }); if (!technician) throw Object.assign(new Error('Active technician not found'), { status: 404 }); await update(tables.requests, { id: equal(id) }, { assigned_to: technician.id, status: 'assigned', updated_at: now() }); await insert(tables.logs, { request_id: id, author_id: user.id, note: payload.reason || `Reassigned to ${technician.name}`, status: 'assigned' }); await audit(user.id, 'service_request', id, 'reassigned', { technician_id: technician.id }); await notify(technician.id, `You were assigned request #${id}: ${request.title}`); return send(res, 200, await getRequest(id)); }
    if (req.method === 'POST' && action === 'exception') { allowed(user, roles('admin', 'dispatcher', 'technician')); if (user.role === 'technician' && String(request.assigned_to) !== String(user.id)) throw Object.assign(new Error('Only the assigned technician can report an exception'), { status: 403 }); await transition(user, request, 'exception', payload.note || 'Operational exception reported'); await notify(request.requester_id, `Request #${id} needs attention`); return send(res, 200, await getRequest(id)); }
    if (req.method === 'POST' && action === 'logs') { if ((user.role === 'requester' && String(request.requester_id) !== String(user.id)) || (user.role === 'technician' && String(request.assigned_to) !== String(user.id))) throw Object.assign(new Error('Insufficient permission'), { status: 403 }); if (!payload.note) throw Object.assign(new Error('note is required'), { status: 400 }); const log = await insert(tables.logs, { request_id: id, author_id: user.id, note: payload.note, status: request.status }); await audit(user.id, 'service_request', id, 'log_added'); return send(res, 201, log); }
    if (req.method === 'POST' && action === 'attachments') { if ((user.role === 'requester' && String(request.requester_id) !== String(user.id)) || (user.role === 'technician' && String(request.assigned_to) !== String(user.id))) throw Object.assign(new Error('Insufficient permission'), { status: 403 }); if (!payload.url) throw Object.assign(new Error('url is required'), { status: 400 }); const attachment = await insert(tables.attachments, { request_id: id, author_id: user.id, url: payload.url, kind: payload.kind || 'document' }); await audit(user.id, 'service_request', id, 'attachment_added'); return send(res, 201, attachment); }
  }
  if (req.method === 'GET' && path === '/dashboard') { allowed(user, roles('admin', 'dispatcher')); const [requests, parts] = await Promise.all([requestRows(), list(tables.parts)]); const byStatus = Object.entries(requests.reduce((grouped, item) => ({ ...grouped, [item.status]: (grouped[item.status] || 0) + 1 }), {})).map(([status, count]) => ({ status, count })); const active = request => !['completed', 'cancelled'].includes(request.status); return send(res, 200, { byStatus, urgent: requests.filter(request => active(request) && ['urgent', 'high'].includes(request.priority)), lowStock: parts.filter(part => part.quantity <= part.reorder_level), overdue: requests.filter(request => active(request) && request.due_at && new Date(request.due_at) < new Date()) }); }
  throw Object.assign(new Error('Route not found'), { status: 404 });
}

await seedHostedDemo();
http.createServer((req, res) => handler(req, res).catch(error => send(res, error.status || 500, { error: error.message || 'Internal server error' }))).listen(PORT, () => console.log(`Shared Supabase API running at http://localhost:${PORT}`));
