# Housemate Split

A Splitwise-style expense tracker for housemates and shared households. Create groups, log shared expenses with flexible split types, see who owes whom, and record settlements until everyone is even.

## Tech stack

| Layer | Stack |
| --- | --- |
| Client | React, TypeScript, Vite, Tailwind CSS, React Router |
| Server | Node.js, Express, TypeScript, Prisma ORM |
| Database | PostgreSQL |
| Tooling | npm workspaces, concurrently, ESLint, Prettier |

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

| Command | Description |
| --- | --- |
| `npm run dev` | Run client and server with hot reload |
| `npm run build` | Production build for client and server |
| `npm run lint` | Lint client and server |
| `npm run format` | Format with Prettier |
| `npm run test -w server` | Run server unit tests |

## Project structure

```
/
├── client/     React + TypeScript + Vite + Tailwind
├── server/     Express + TypeScript + Prisma + PostgreSQL
└── package.json
```

## Future Work

- Recurring expenses
- Receipt uploads
- Multi-currency support
- Notifications
- Global cross-group balances
- Activity comments
