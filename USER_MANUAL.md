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
5. The assigned technician opens **Service Requests**, selects **Start work**, adds notes if needed, then selects **Complete** and supplies a verification note.
6. An administrator or dispatcher can select **Reassign** for an assigned, in-progress, or exception request. They choose another active technician and enter a reason. They can select **Cancel** for a pending, assigned, or exception request. Requests are never deleted, so the demo retains its history.

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

## Save shared-database settings once per laptop

The `$env:` commands apply only to the current PowerShell window. To avoid entering them every time, create a private `backend\.env` file once. It is ignored by Git and must never be sent to WhatsApp or pushed to GitHub.

```powershell
cd "C:\path\to\durantham\backend"
Copy-Item .env.example .env
notepad .env
```

In `.env`, set `APP_DATABASE=supabase`, the project's `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and one long `JWT_SECRET`. On the first laptop only, also set `AUTO_SEED_DEMO=true` and choose the administrator details. Start once to seed the shared account, then change `AUTO_SEED_DEMO=false`.

After that, every later start on that laptop is simply:

```powershell
cd "C:\path\to\durantham\backend"
npm.cmd start
```

For a multi-laptop local test, each laptop needs its own private `.env` with the same Supabase URL, Secret key, and JWT secret. They do **not** need to seed the administrator again.

## Shared website mode — all laptops use the same data

For the shared production-style demo, Duramint stores users, machines, requests, assignments, logs, notifications, and audit entries in Supabase Postgres. Each person opens the same website URL; they do not install Node.js or create an administrator on their own laptop.

The old local SQLite mode still works for offline development. Shared mode is enabled only when `APP_DATABASE=supabase` is set on the backend host.

### Set up the shared database once

1. In Supabase, open **SQL Editor**.
2. Open `supabase/migrations/001_duramint_shared_app.sql` from this repository and run its full contents once.
3. The migration adds only tables named `duramint_*`; it does not change the existing technician tables.
4. In **Project Settings → API**, copy the **service_role** key. Keep it private: it belongs only in the backend host’s environment variables, never in frontend code or Git.

### Deploy the one-URL website on Render

Create a Render **Web Service** from the GitHub repository with:

```text
Root Directory: backend
Build Command: npm install
Start Command: npm start
Health Check Path: /health
```

Add these environment variables in Render:

```text
NODE_VERSION=24.21.0
APP_DATABASE=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=<private sb_secret key>
AUTO_SEED_DEMO=true
DEMO_ADMIN_EMAIL=admin@duramint.local
DEMO_ADMIN_NAME=Duramint Administrator
DEMO_ADMIN_PASSWORD=<choose a strong password>
JWT_SECRET=<long random value>
```

Deploy, then share the public `onrender.com` URL. The first deployment creates the administrator, technicians, and machines in the common Supabase database. It does not reset or overwrite them on later deployments.

### Sign in to the shared website

Use the email and password configured in Render as `DEMO_ADMIN_EMAIL` and `DEMO_ADMIN_PASSWORD`. Every laptop uses those same shared records. Administrators can add other administrators, dispatchers, technicians, and requesters from **Settings → Add user** in the website.

Render Free services may sleep after 15 minutes without traffic, so the first visit afterwards can take about a minute. Unlike SQLite, the Supabase data remains available after a Render restart or redeploy.

## Security checklist before sharing a public URL

- Use a long, unique `JWT_SECRET` only in the host's secret/environment-variable settings.
- Change all demonstration passwords.
- Never commit `.env` files or Supabase service-role keys.
- Restrict API CORS to the actual frontend URL.
- Replace the local-only demo-user script with a protected administrator-creation workflow.
