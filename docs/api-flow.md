# API Flow (Phase 1 Demo)

Base URL: `http://localhost:4000`

Optional persistent mode:

```bash
export MYSQL_URL='mysql://user:password@localhost:3306/copytrading'
npm --prefix apps/api run dev
```

## 1) Register users (returns bearer token)

```bash
MASTER=$(curl -sS -X POST http://localhost:4000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"id":"u_master","name":"Master One","role":"master","initialCapital":100000,"password":"pass123"}')

FOLLOWER=$(curl -sS -X POST http://localhost:4000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"id":"u_follower","name":"Follower One","role":"follower","initialCapital":25000,"password":"pass123"}')

MASTER_TOKEN=$(echo "$MASTER" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
FOLLOWER_TOKEN=$(echo "$FOLLOWER" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
```

## 2) Create master profile

```bash
curl -X POST http://localhost:4000/masters \
  -H 'Content-Type: application/json' \
  -d '{
    "userId":"u_master",
    "displayName":"Master One",
    "performanceFeePercent":20,
    "monthlySubscriptionFee":49,
    "strategyDescription":"Momentum swing strategy"
  }'
```

## 3) Subscribe follower to master

```bash
curl -X POST http://localhost:4000/subscriptions \
  -H 'Content-Type: application/json' \
  -d '{
    "id":"sub_1",
    "followerUserId":"u_follower",
    "masterUserId":"u_master",
    "allocatedCapital":10000
  }'
```

## 4) Optional risk controls

```bash
curl -X PATCH http://localhost:4000/subscriptions/sub_1/risk \
  -H "Authorization: Bearer $FOLLOWER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"paused":false,"maxDrawdownPercent":12}'
```

## 5) Place master trade (mirrors to followers)

```bash
curl -X POST http://localhost:4000/masters/u_master/trades \
  -H "Authorization: Bearer $MASTER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"symbol":"AAPL","side":"buy","quantity":100,"price":180}'
```

## 6) Accrue monthly subscription dues (tracked only)

```bash
curl -X POST http://localhost:4000/fees/subscription/accrue
```

## 7) Read leaderboard and snapshot

```bash
curl http://localhost:4000/leaderboard
curl http://localhost:4000/snapshot
```

## Compliance notes

- Simulation only
- Not a broker
- Not investment advice
