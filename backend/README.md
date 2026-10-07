# Equipment Service Platform API

Dependency-free Node.js backend for the DataQuest service-management brief. It uses the built-in `node:sqlite` driver, password hashing with scrypt, signed bearer tokens, role-based access control, audit events, notifications, lifecycle validation, inventory reservations, technician matching, and exception/reassignment flows.

## Run

Use Node.js 22.5+ (Node 24 is included with Codex). From this folder:

```powershell
Copy-Item .env.example .env
$env:JWT_SECRET = 'use-a-long-random-production-secret'
$env:ADMIN_PASSWORD = 'choose-a-strong-password'
npm run seed:admin
npm run seed:technicians
npm start
```

The API starts at `http://localhost:3000`; data is persisted in `backend/data/service-platform.sqlite`.

`seed:technicians` loads the 15 provided Chennai-area technician profiles, with their IDs, ratings, location, common skill set, and specialist focus. Set `DEMO_TECHNICIAN_PASSWORD` before running it if they need a password other than the demo default.

## Key endpoints

| Purpose | Endpoint |
| --- | --- |
| Register/login | `POST /auth/register`, `POST /auth/login` |
| Machine and part master data | `GET/POST /machines`, `GET/POST /parts` |
| Create/list request | `GET/POST /requests` |
| Request detail/history | `GET /requests/:id` |
| Approve and auto-assign | `POST /requests/:id/approve` |
| Field-work workflow | `POST /requests/:id/start`, `/complete`, `/exception`, `/reassign` |
| Field proof | `POST /requests/:id/logs`, `/attachments` |
| Operations view | `GET /dashboard`, `GET /notifications` |

Send `Authorization: Bearer <token>` on all routes except `/health` and authentication routes. Only an administrator can create dispatcher/admin accounts; public self-registration is intentionally limited to requesters and technicians.

### Recommended demo sequence

1. Seed the first administrator, then use it to create a dispatcher, a skilled technician, an active machine, and inventory parts. (`ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_SITE` optionally customise the seeded account.)
2. Create a request. It begins as `pending_approval`.
3. Approve it as a dispatcher. Required inventory is atomically reserved and a site-matched technician with all required skills is selected, or the request becomes an `exception`.
4. The assigned technician starts, logs work/attachments, and completes with a verification note. Every important change is retained in `audit_events`.

## Production notes

Set a unique `JWT_SECRET`, place the API behind TLS, replace permissive CORS with the frontend origin, add rate limiting, migrate SQLite to a managed database, and store attachment files in object storage rather than accepting arbitrary public URLs.

## Issue categories

When creating a request, optionally send `issue_type` as `unexpected_breakdown`, `overheating`, or `excessive_vibration`. The API applies the six common skills (mechanical, electrical, instrumentation, troubleshooting, safety, and data interpretation), then chooses a local technician whose specialty matches the issue. With an equal workload, the higher-rated technician is chosen.
