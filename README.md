# Housemate Split

A Splitwise-style expense tracker for housemates and shared households. Create groups, log shared expenses with flexible split types, see who owes whom, and record settlements until everyone is even.

## Tech stack

| Layer    | Stack                                               |
| -------- | --------------------------------------------------- |
| Client   | React, TypeScript, Vite, Tailwind CSS, React Router |
| Server   | Node.js, Express, TypeScript, Prisma ORM            |
| Database | PostgreSQL                                          |
| Tooling  | npm workspaces, concurrently, ESLint, Prettier      |

## Features

- Email/password auth with JWT sessions
- Groups with invite-by-email membership
- Expenses with EQUAL, PERCENTAGE, EXACT, and ITEMIZED splits
- Per-member balances and simplified settlement suggestions
- Activity feed derived from expenses and settlements
- Loading states, empty states, and toast notifications for API feedback

## Screenshots

_Add screenshots here once you have them (dashboard, group detail, add expense, settlements)._

Suggested placements:

1. Dashboard with group cards
2. Group page showing balances and suggested settlements
3. Add expense form (itemized or percentage)
4. Activity feed

## Running locally

### Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL running locally (or a reachable instance)

### Setup

1. **Install dependencies** from the repo root:

   ```bash
   npm install
   ```

2. **Configure the server environment**:

   ```bash
   cp server/.env.example server/.env
   ```

   Set at least:

   - `DATABASE_URL` — PostgreSQL connection string
   - `JWT_SECRET` — a long random string
   - `PORT` — API port (default `3001`)

3. **Apply database migrations**:

   ```bash
   npm run prisma:migrate -w server
   ```

4. **Start development** (client + server):

   ```bash
   npm run dev
   ```

   - App: [http://localhost:5173](http://localhost:5173)
   - API: [http://localhost:3001](http://localhost:3001)
   - Health: [http://localhost:3001/api/v1/health](http://localhost:3001/api/v1/health)

   Vite proxies `/api` to the Express server.

### Useful scripts

| Command                  | Description                            |
| ------------------------ | -------------------------------------- |
| `npm run dev`            | Run client and server with hot reload  |
| `npm run build`          | Production build for client and server |
| `npm run lint`           | Lint client and server                 |
| `npm run format`         | Format with Prettier                   |
| `npm run test -w server` | Run server unit tests                  |

## Project structure

```
/
├── client/     React + TypeScript + Vite + Tailwind
├── server/     Express + TypeScript + Prisma + PostgreSQL
├── infra/      Terraform (Vercel frontend + Neon Postgres)
└── package.json
```

## Infrastructure (Terraform)

Terraform under `/infra` manages:

| Managed by Terraform                                                    | Still manual (not Terraform-managed)                            |
| ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| Vercel frontend project (Vite app in `client/`, GitHub auto-deploys)    | **Render backend** at `https://split-tracker-0uxz.onrender.com` |
| Neon PostgreSQL project + connection string                             | Wiring `DATABASE_URL` / `JWT_SECRET` (and friends) into Render  |
| `VITE_API_URL` on the Vercel project (defaults to the Render URL above) | Re-creating or reconfiguring the Render web service itself      |

### Apply from `/infra`

1. Copy the example vars file and fill in real tokens (never commit `terraform.tfvars`):

   ```bash
   cd infra
   cp terraform.tfvars.example terraform.tfvars
   ```

2. Initialize, preview, and apply:

   ```bash
   terraform init
   terraform plan
   terraform apply
   ```

3. After apply, read outputs:

   ```bash
   terraform output vercel_project_url
   terraform output -raw neon_connection_string
   ```

Use the Neon connection string as `DATABASE_URL` on Render (see below). `VITE_API_URL` on Vercel already defaults to `https://split-tracker-0uxz.onrender.com`; change `vite_api_url` in `terraform.tfvars` and re-apply only if the backend URL changes.

### Redeploy the backend on Render (manual)

The Express API is **not** managed by Terraform. To create or redeploy it on Render:

1. In the [Render dashboard](https://dashboard.render.com/), create a **Web Service** and connect the same GitHub repo used for this project.
2. Configure the service for the monorepo API:
   - **Root Directory:** leave blank (repo root), so npm workspaces resolve correctly
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run prisma:generate -w server && npm run build -w server`
   - **Start Command:** `npm run start -w server`
3. Set environment variables on the Render service:
   - `DATABASE_URL` — copy from `terraform output -raw neon_connection_string` (Neon, Terraform-managed)
   - `JWT_SECRET` — a long random secret (not stored in Terraform)
   - `PORT` — Render usually injects this; if you set it, match what the service expects (the app defaults to `3001` locally)
   - Any other server vars from `server/.env.example` as needed
4. On first deploy (or after schema changes), run migrations against Neon — e.g. from a one-off Render shell / local machine with the same `DATABASE_URL`:

   ```bash
   npm run prisma:migrate -w server
   ```

   For production-style deploys, prefer `npx prisma migrate deploy` in the `server` workspace once migrations are committed.

5. Trigger a deploy (push to the connected branch, or **Manual Deploy** in Render). Confirm health at `https://split-tracker-0uxz.onrender.com/api/v1/health`.

## Future Work

- Recurring expenses
- Receipt uploads
- Multi-currency support
- Notifications
- Global cross-group balances
- Activity comments
