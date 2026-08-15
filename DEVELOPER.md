# InvestSync — Developer Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Getting Started](#getting-started)
5. [Domain Modules](#domain-modules)
6. [API Reference](#api-reference)
7. [Database Schema](#database-schema)
8. [Frontend Pages](#frontend-pages)
9. [Authentication & Security](#authentication--security)
10. [Testing](#testing)

---

## Overview

**InvestSync** is a simulation-only copy-trading platform where:

- Users register as **master traders** or **followers**
- Followers **subscribe** to masters and mirror their trades using MARA-based proportional sizing
- Master traders earn **performance fees** (% of follower profit) and **subscription fees**
- All trades are verified through a **Merkle Tree Ledger** (Proof-of-Execution)
- Trade approvals use **Intent-Based Authorization** with SHA-256 hashing and 60s TTL
- A **paper trading simulator** provides the default broker (no external API keys needed)

> **Disclaimer**: InvestSync is a simulation platform. It is not a broker and does not provide investment advice.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 15)                │
│            apps/web  ·  port 3000  ·  React 19          │
└───────────────────────────┬─────────────────────────────┘
                            │  HTTP / JSON
┌───────────────────────────▼─────────────────────────────┐
│                    API Server (Express)                   │
│            apps/api  ·  port 4000  ·  REST               │
│  ┌──────────┐  ┌───────────┐  ┌───────────────────────┐ │
│  │  Engine   │  │ Merkle    │  │ Intent Auth           │ │
│  │(in-proc) │  │ Ledger    │  │ (SHA-256 + 60s TTL)   │ │
│  └──────────┘  └───────────┘  └───────────────────────┘ │
└───────────────────────────┬─────────────────────────────┘
                            │  mysql2
┌───────────────────────────▼─────────────────────────────┐
│                   MySQL Database                         │
│            packages/db  ·  migrations                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                  Domain Package                          │
│  packages/domain  ·  shared types + pure logic           │
│  finance · mara · merkle-tree · intent-auth              │
│  median-consolidator · schema-adapter                    │
└─────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Monorepo (npm workspaces) | Shared types between API/engine/web without publishing |
| In-process engine | No message queue needed for MVP — engine state is in API memory |
| scrypt password hashing | Memory-hard KDF resistant to GPU/ASIC attacks |
| In-memory sessions | Simple bearer token auth sufficient for demo |
| Paper trading as default broker | Zero external dependencies for running the app |

---

## Project Structure

```
investsync/
├── goal.md                          # Project objectives
├── DEVELOPER.md                     # This document
├── package.json                     # Root monorepo config
├── tsconfig.base.json               # Shared TypeScript config
│
├── packages/
│   ├── domain/                      # Shared business logic & types
│   │   └── src/
│   │       ├── types.ts             # Core interfaces (User, Trade, etc.)
│   │       ├── finance.ts           # Financial calculations
│   │       ├── mara.ts              # MARA algorithm
│   │       ├── median-consolidator.ts
│   │       ├── schema-adapter.ts    # Broker normalization
│   │       ├── intent-auth.ts       # Intent-Based Authorization
│   │       ├── merkle-tree.ts       # Merkle Tree Ledger
│   │       ├── index.ts             # Re-exports
│   │       └── __tests__/
│   │           └── domain.test.ts   # 44 unit tests
│   │
│   └── db/
│       └── migrations/
│           ├── 001_init.sql         # Users, masters, subscriptions, trades, fees
│           └── 002_investsync.sql   # Profiles, paper orders, notifications, intents, merkle
│
├── apps/
│   ├── engine/                      # CopyTradingEngine (trade mirroring logic)
│   │   └── src/index.ts
│   │
│   ├── api/                         # Express REST API
│   │   └── src/
│   │       ├── server.ts            # All endpoints
│   │       └── persistence/
│   │           ├── mysql.ts         # Connection pooling + migration runner
│   │           └── repository.ts    # CRUD operations (InvestSyncRepository)
│   │
│   └── web/                         # Next.js frontend
│       └── app/
│           ├── landing/page.tsx     # Public landing page
│           ├── auth/page.tsx        # Login / Register
│           ├── lib/
│           │   ├── api.ts           # API client (fetch wrapper + typed functions)
│           │   └── mock-data.ts     # Legacy mock data (no longer used by pages)
│           ├── components/
│           │   ├── auth-provider.tsx # React context for auth state
│           │   ├── app-shell.tsx     # Sidebar layout with role-based nav
│           │   └── stat-card.tsx     # Reusable stat card component
│           └── (app)/               # Authenticated app routes
│               ├── page.tsx         # Dashboard (admin only)
│               ├── leaderboard/     # Leaderboard (admin only)
│               ├── masters/         # Master traders list + detail
│               ├── portfolio/       # User portfolio + positions
│               ├── subscriptions/   # Active subscriptions
│               ├── copied-trades/   # Mirrored trade history
│               ├── fees/            # Fee ledger
│               ├── risk/            # Risk manager + drawdown monitor
│               ├── notifications/   # Trade approval notifications
│               ├── broker/          # Broker connections
│               ├── audit/           # Merkle Tree audit trail
│               └── settings/        # User settings + MARA profile
```

---

## Getting Started

### Prerequisites

- **Node.js** v20+ (v24 recommended)
- **MySQL** 8.0+ (optional — app works without DB using in-memory state)

### Environment Variables

```bash
# MySQL (optional — omit for in-memory mode)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=root
MYSQL_DATABASE=investsync

# API
PORT=4000

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Installation & Running

```bash
# Install all dependencies
npm install
cd apps/web && npm install && cd ../..
cd apps/api && npm install && cd ../..
cd apps/engine && npm install && cd ../..
cd packages/domain && npm install && cd ../..

# Build all packages
npm run build

# Start API server (port 4000)
npm run dev

# Start frontend (port 3000) — in another terminal
cd apps/web && npm run dev

# Run tests
npm test
```

---

## Domain Modules

### 1. Finance (`packages/domain/src/finance.ts`)

Core financial utilities shared across the platform.

| Function | Description |
|----------|-------------|
| `round2(value)` | Round to 2 decimal places |
| `calculateProportionalQuantity(params)` | Scale quantity by capital ratio |
| `calculateDrawdownPercent(start, current)` | Compute drawdown % |
| `shouldHaltByRisk(subscription, equity)` | Check if risk controls should block a trade |
| `calculatePerformanceFee(params)` | Performance fee based on high-water mark |
| `defaultRiskControls()` | Default risk settings (20% max DD, not paused) |

### 2. MARA Algorithm (`packages/domain/src/mara.ts`)

**Modified Adaptive Replication Algorithm** — intelligently sizes copied trades.

**Core Equation:**

```
Q_adj = Q_base × C × V × R
```

| Factor | Formula | Description |
|--------|---------|-------------|
| **C** (Capital) | E_F / E_M | Follower equity ÷ Master equity |
| **V** (Volatility) | σ_F / σ_M | Follower vol tolerance ÷ Master vol |
| **R** (Risk) | R_F / R_M | Follower risk score ÷ Master risk score |

**Safety Bound:**

```
Q_max = (FreeMargin × Leverage) / Price
Q_adj = min(Q_adj, Q_max)
```

**Example:**
- Master trades 100 shares at $100
- Master equity: $100K, Follower equity: $50K → C = 0.5
- Equal vol/risk → V = 1, R = 1
- Q_adj = 100 × 0.5 × 1 × 1 = **50 shares**

```typescript
import { calculateMARA } from "@investsync/domain";

const result = calculateMARA({
  masterQuantity: 100,
  masterEquity: 100_000,
  followerEquity: 50_000,
  masterVolatility: 20,
  followerVolatility: 20,
  masterRiskScore: 50,
  followerRiskScore: 50,
  price: 100,
  followerFreeMargin: 50_000,
  followerLeverage: 1,
});
// result.adjustedQuantity → 50
```

### 3. Median-Based Consolidator (`packages/domain/src/median-consolidator.ts`)

Aggregates multiple price feeds into a single tamper-resistant median price.

**Algorithm:**
1. Filter stale feeds (> `maxAgeSec`)
2. Compute raw median
3. Remove outliers beyond ±`outlierThresholdPercent`
4. Recompute filtered median

```typescript
import { consolidatePriceFeeds } from "@investsync/domain";

const price = consolidatePriceFeeds(feeds, 5, 30); // 5% threshold, 30s max age
// price.medianPrice → consolidated fair price
```

### 4. Unified Schema Adapter (`packages/domain/src/schema-adapter.ts`)

Normalises heterogeneous broker payloads into a canonical `TradeSignal` format.

```typescript
import { UnifiedSchemaAdapter, paperTradingAdapter } from "@investsync/domain";

const adapter = new UnifiedSchemaAdapter();
adapter.register("paperTrading", paperTradingAdapter);

const signal = adapter.normalise("paperTrading", rawBrokerPayload);
// signal → { symbol, side, quantity, price, timestamp, source }
```

To add a new broker, implement a `BrokerAdapter` function:

```typescript
const myAdapter: BrokerAdapter = (raw) => ({
  symbol: raw.ticker.toUpperCase(),
  side: raw.action === "B" ? "buy" : "sell",
  quantity: Number(raw.qty),
  price: Number(raw.px),
  timestamp: raw.ts,
  source: "my-broker",
  raw,
});
adapter.register("myBroker", myAdapter);
```

### 5. Intent-Based Authorization (`packages/domain/src/intent-auth.ts`)

Staged trade approval with cryptographic verification.

**Flow:**
1. Master places trade → `createTradeIntent()` generates SHA-256 hash
2. Intent has 60s TTL
3. Follower sees notification and approves/rejects
4. On approval, `verifyIntent()` re-derives hash to verify integrity
5. If TTL expires, intent auto-expires

**Hash formula:**
```
SHA-256(masterUserId | symbol | side | quantity | price | nonce)
```

```typescript
import { createTradeIntent, verifyIntent } from "@investsync/domain";

const intent = createTradeIntent({
  id: "uuid",
  masterUserId: "master-1",
  symbol: "AAPL",
  side: "buy",
  quantity: 10,
  price: 190,
});
// intent.hash → 64-char hex string

const verification = verifyIntent(intent);
// verification.valid → true/false
```

### 6. Merkle Tree Ledger (`packages/domain/src/merkle-tree.ts`)

Append-only audit trail with cryptographic Proof-of-Execution.

**Structure:**
- **Leaf** = `SHA-256(tradeId | symbol | side | qty | price | timestamp)`
- **Internal nodes** = `SHA-256(left || right)`
- Odd leaf count → duplicate last leaf

```typescript
import { MerkleTreeLedger } from "@investsync/domain";

const ledger = new MerkleTreeLedger();

ledger.appendTrade({ tradeId: "t1", symbol: "AAPL", side: "buy", quantity: 10, price: 190, timestamp: "..." });
ledger.appendTrade({ tradeId: "t2", symbol: "MSFT", side: "sell", quantity: 5, price: 425, timestamp: "..." });

const root = ledger.computeRoot();
// root.rootHash → H_root (Proof-of-Execution digest)
// root.leafCount → 2
// root.treeDepth → 1

ledger.verifyLeaf("t1"); // true
```

---

## API Reference

Base URL: `http://localhost:4000`

### Authentication

All authenticated endpoints require `Authorization: Bearer <token>` header.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Register new user |
| POST | `/auth/login` | No | Login, get token |
| GET | `/auth/me` | Yes | Get current user |

**Register body:**
```json
{
  "id": "user-1",
  "name": "John Doe",
  "role": "follower",
  "initialCapital": 100000,
  "password": "secret123"
}
```

### Masters

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/masters` | No | List all master profiles |
| GET | `/masters/:id` | No | Master detail with subs/trades/fees |
| POST | `/masters` | Yes | Create master profile |
| POST | `/become-master` | Yes | Register current user as master |

### Subscriptions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/subscriptions` | Yes | Create subscription |
| POST | `/follow/:masterUserId` | Yes | Follow a master with capital allocation |
| GET | `/followers/:id/subscriptions` | Yes | List follower's subscriptions |
| PATCH | `/subscriptions/:id/risk` | Yes | Update risk controls (pause/maxDD) |

### Trades

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/masters/:id/trades` | Yes | Place master trade (creates intent + notifications) |
| GET | `/trades` | Yes | Get mirrored trades for current user |

### Notifications

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/notifications` | Yes | List pending/historical notifications |
| POST | `/notifications/:id/approve` | Yes | Approve trade (triggers MARA sizing) |
| POST | `/notifications/:id/reject` | Yes | Reject trade notification |

### Risk

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/risk` | Yes | Alerts and subscriptions with drawdown data |

### Profile

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/profile` | Yes | Get user MARA profile (volatility, risk, leverage) |
| PUT | `/profile` | Yes | Update profile settings |

### Fees

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/fees` | Yes | List fee entries (filter by follower/master/sub ID) |
| POST | `/fees/subscription/accrue` | Yes | Accrue monthly subscription fees |

### Audit (Merkle Tree)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/merkle/root` | No | Get current Merkle root hash |
| GET | `/merkle/leaves` | No | List all Merkle tree leaves |
| GET | `/merkle/verify/:tradeId` | No | Verify a trade exists in the Merkle tree |

### Admin-Only

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/leaderboard` | Admin | Master trader leaderboard |
| GET | `/snapshot` | Admin | Full engine state snapshot |

### Paper Trading Simulation

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/simulation/quotes` | No | Live simulated stock prices |
| POST | `/simulation/orders` | Yes | Place paper trade |
| GET | `/simulation/portfolio` | Yes | Portfolio with positions & cash |
| GET | `/simulation/orders` | Yes | User's paper order history |

---

## Database Schema

### Migration 001 — Core Tables

```sql
users(id, name, role, initial_capital, created_at)
credentials(user_id, password_hash)
master_profiles(user_id, display_name, perf_fee, sub_fee, strategy)
subscriptions(id, follower_id, master_id, capital, start_equity, hwm, dd%, pnl, risk_controls)
master_trades(id, master_id, symbol, side, quantity, price, created_at)
mirrored_trades(id, master_trade_id, subscription_id, follower_id, symbol, side, ...)
fee_ledger(id, subscription_id, type, amount, description, created_at)
```

### Migration 002 — InvestSync Extensions

```sql
user_profiles(user_id, volatility_tolerance, risk_score, leverage)
paper_orders(id, user_id, symbol, side, quantity, price, total, status, filled_at)
trade_notifications(id, master_id, follower_id, sub_id, trade_id, symbol, side, ...)
trade_intents(id, master_id, symbol, side, quantity, price, nonce, hash, ttl_ms, status)
merkle_leaves(trade_id, symbol, side, quantity, price, timestamp, hash)
merkle_roots(id, root_hash, leaf_count, tree_depth, computed_at)
```

---

## Frontend Pages

| Route | Access | Description |
|-------|--------|-------------|
| `/landing` | Public | Marketing landing page |
| `/auth` | Public | Login / Register forms |
| `/` | Admin | Dashboard with engine snapshot |
| `/leaderboard` | Admin | Master performance rankings |
| `/masters` | Auth | Browse/search masters, become a master |
| `/masters/[id]` | Auth | Master detail with stats, follow button |
| `/portfolio` | Auth | Paper trading positions & balances |
| `/subscriptions` | Auth | Active subs with pause/resume |
| `/copied-trades` | Auth | Mirrored trade history with filters |
| `/fees` | Auth | Fee ledger |
| `/risk` | Auth | Risk alerts & drawdown monitor |
| `/notifications` | Auth | Trade approval workflow |
| `/broker` | Auth | Broker connections (paper trading default) |
| `/audit` | Auth | Merkle Tree audit trail |
| `/settings` | Auth | Profile, MARA parameters, security info |

### Role-Based Navigation

- **Admin**: Sees Dashboard + Leaderboard in "Admin" section
- **Master/Follower/Both**: Sees Portfolio, Masters, Subscriptions, etc.
- All authenticated users: Broker, Trade Alerts, Audit Trail

---

## Authentication & Security

### Password Storage
- Passwords hashed with **scrypt** (64-byte key derivation, unique salt per user)
- Timing-safe comparison via `crypto.timingSafeEqual`

### Sessions
- Bearer token per session (UUID v4)
- Stored in-memory `Map<token, userId>`
- Token sent in `Authorization: Bearer <token>` header

### Intent-Based Authorization
- Every master trade generates a SHA-256 intent hash
- Followers must approve within 60 seconds
- Hash re-derived on verification to detect tampering
- Stale intents auto-expire

### Merkle Tree Proof-of-Execution
- Every trade (master, mirrored, paper) is appended as a Merkle leaf
- Root hash serves as tamper-evident audit proof
- Leaves can be verified against the tree at any time

### Role System

| Role | Capabilities |
|------|-------------|
| `follower` | Subscribe to masters, view portfolio, approve trades |
| `master` | Place trades, earn fees, all follower capabilities |
| `both` | Master + follower simultaneously |
| `admin` | Full access including dashboard, leaderboard, user management |

---

## Testing

### Running Tests

```bash
# Run all domain tests (44 tests across 12 suites)
cd packages/domain && npm test

# Or from root
npm test
```

### Test Coverage

| Module | Tests | Description |
|--------|-------|-------------|
| finance | 10 | round2, proportional qty, drawdown, risk halt, performance fee |
| MARA | 7 | Capital/vol/risk factors, safety bound, leverage, zero guards |
| Median Consolidator | 7 | Empty, single, odd/even, outliers, stale feeds |
| Schema Adapter | 3 | Register, normalise, unregistered broker error |
| Intent Auth | 6 | Create, verify, tampered hash, expired, rejected, batch expire |
| Merkle Tree | 10 | Empty, append, deterministic, root computation, hydrate |

### Test Framework

Node.js built-in test runner (`node:test` + `node:assert/strict`) with `tsx` for TypeScript execution. No external test dependencies required.

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | v24 |
| Language | TypeScript | 5.8.2 |
| Frontend | Next.js | 15.5.12 |
| UI Framework | React | 19 |
| API | Express | 4.19.2 |
| Database | MySQL | 8.0+ |
| DB Driver | mysql2 | 3.11.3 |
| Password Hashing | scrypt (Node crypto) | built-in |
| Crypto | SHA-256 (Node crypto) | built-in |
| Test Runner | node:test | built-in |
| TS Loader | tsx | 4.21.0 |
