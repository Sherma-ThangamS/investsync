# Copy Trading Platform (Demo MVP)

Demo-first copy trading platform where followers can mirror master trader strategy execution in simulated accounts.

## Workspace

- `apps/api`: REST API and in-memory orchestration
- `apps/engine`: Copy, risk, and fee calculation engine
- `apps/web`: Next.js dashboard shell
- `packages/domain`: Shared domain models and validation helpers
- `packages/db`: MySQL schema migration draft for phase 1

## Quick start

```bash
npm --prefix packages/domain install
npm --prefix apps/engine install
npm --prefix apps/api install
npm --prefix apps/web install

npm --prefix apps/api run dev
```

Then open `http://localhost:4000/health`.

API usage examples are in `docs/api-flow.md`.

## MySQL persistence (Phase 1)

Set `MYSQL_URL` before starting API to enable persistence and auto migrations.

Example:

```bash
export MYSQL_URL='mysql://root:root@localhost:3306/investsync'
npm --prefix apps/api run dev
```

When `MYSQL_URL` is set, API will:

- run SQL files in `packages/db/migrations` once (tracked in `schema_migrations`)
- persist users, credentials, masters, subscriptions, trades, and fee ledger
- hydrate users/masters/subscriptions on startup

Phase 1 includes demo auth/session endpoints:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me` (Bearer token)

## Runtime requirements

- Node.js 20+
- npm 10+

The current implementation uses modern TypeScript + Next.js and is not compatible with very old Node/npm versions.

## Notes

- Simulation only (not a broker, not investment advice)
- No broker/account connectivity in phase 1
