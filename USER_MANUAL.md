# Duramint user manual

## What this application does

Duramint records machine faults, sends them for approval, assigns a suitable technician, and tracks work through completion. The three issue categories are Unexpected Machine Breakdown, Overheating, and Excessive Vibration.

## Open the application

The web address is `http://localhost:5173` when running locally. The backend must also be running at `http://localhost:3000`.

## Sign in

Use the account created for your role. For a local demo, an administrator can be created with:

```powershell
cd backend
$env:DEMO_USER_EMAIL = 'admin@duramint.local'
$env:DEMO_USER_NAME = 'Duramint Admin'
$env:DEMO_USER_PASSWORD = 'Admin12345!'
$env:DEMO_USER_ROLE = 'admin'
npm.cmd run demo:user
```

Do not use this example password for a public deployment.

## Roles

| Role | Main permissions |
| --- | --- |
| Administrator | Create users, machines, and parts; approve, assign, and reassign requests. |
| Dispatcher | Approve, assign, and reassign requests; view operations data. |
| Requester | Create requests and view their own requests. |
| Technician | View assigned requests, start work, report exceptions, add work logs, and complete work. |

## Service-request workflow

1. A requester creates a service request and chooses the machine, issue category, priority, and description.
2. The request is `pending approval`.
3. An administrator or dispatcher approves it. Duramint matches a technician by site, common skills, specialist skills, workload, and rating.
4. The request becomes `assigned`, or `exception` if no suitable technician is available.
5. The assigned technician starts work, adds notes if needed, then completes it with a verification note.

## Run locally

Open two PowerShell windows.

**Backend window**

```powershell
cd "C:\path\to\durantham\backend"
npm.cmd install
$env:DEMO_PASSWORD = 'ChooseADemoPassword'
npm.cmd run seed:demo
npm.cmd start
```

**Frontend window**

```powershell
cd "C:\path\to\durantham\frontend"
npm.cmd install
npm.cmd start
```

The frontend prints the local address to open. This project uses `npm.cmd start`, not `npm run dev`.

## Important local-demo limitation

The present version stores accounts, machines, and requests in a local SQLite file on each computer. Therefore teammates running their own copies have separate accounts and requests. The shared Supabase project currently provides the technician catalog only.

## Publishing as one shared website

For a shared website, all application data must be stored in Supabase Postgres, not in the local SQLite file. Once that migration is complete, create the administrator account once in the hosted database; all users then sign in through the same website.

This repository is ready for a simple one-URL Render deployment: the Node service serves both the frontend and API. In Render, create a **Web Service** from this GitHub repository, set **Root Directory** to `backend`, **Build Command** to `npm install`, **Start Command** to `npm start`, and **Health Check Path** to `/health`. Add `NODE_VERSION=24.21.0`, `AUTO_SEED_DEMO=true`, a long `DEMO_ADMIN_PASSWORD`, and a long `JWT_SECRET` in Render's environment-variable page, then deploy. The public `onrender.com` address is the address to share.

This is a hackathon demo deployment. Render Free services sleep after 15 minutes without requests, so the first request afterwards can take about a minute. Its local files are erased after a restart or redeploy; the service recreates the admin, technicians, and machines from the configured environment variables, but request history is not durable.

For durable shared data, the next step is to migrate users, machines, requests, and workflow data to Supabase Postgres. The existing Supabase technician tables can remain unchanged.

## Security checklist before sharing a public URL

- Use a long, unique `JWT_SECRET` only in the host's secret/environment-variable settings.
- Change all demonstration passwords.
- Never commit `.env` files or Supabase service-role keys.
- Restrict API CORS to the actual frontend URL.
- Replace the local-only demo-user script with a protected administrator-creation workflow.
