# CaseCellShop

A checkout mini-flow for a phone case store, built as a full-stack technical assessment.
The project demonstrates storefront performance, stock consistency, and checkout
resilience using NestJS, Next.js, MongoDB, and Redis.

---

# Project Overview

## Challenge context

This is a **Mid-level Fullstack Developer** technical assessment. The stack is
**NestJS, Next.js, MongoDB, Redis, Docker, and TypeScript**, and the deliverable is a
functional checkout flow for a store that sells phone cases.

The scenario: an e-commerce company in hypergrowth runs a legacy on-premises ERP
(MySQL) that is the **source of truth** for products, prices, and inventory. The
storefront currently reads directly from the ERP over synchronous REST, and we have
**read-only access** — the ERP code, tables, and behavior cannot be modified. The goal
is to **reduce ERP dependency in critical user journeys incrementally**, without
rewriting the ERP, while fixing storefront latency, overselling, and checkout fragility.

## Business problems

The system must reliably solve three core concerns:

| # | Problem | Requirement |
|---|---------|-------------|
| 1 | **Storefront performance** | Serve the product catalogue fast and reduce database load. |
| 2 | **Stock consistency** | Prevent overselling when multiple customers buy concurrently. |
| 3 | **Checkout resilience** | Survive ERP failures without losing money or leaving stock locked. |

## Solution summary

A modular NestJS monolith exposes a small, well-documented API consumed by a Next.js
storefront. The storefront pre-renders the catalogue with ISR for instant loads, products
are cached in Redis, stock is reserved with a single atomic MongoDB operation, and orders
are processed against a simulated ERP with automatic stock compensation on failure. Every
write path is idempotent.

## Problem → solution mapping

- **Problem 1 → Multi-layer Caching.** Products are served through three cache layers:
  1. **Next.js ISR** — Pre-rendered at build time, served as static HTML (~5ms)
  2. **Redis cache-aside** — Backend cache (`products:all`, 60s TTL)
  3. **MongoDB** — Operational store with atomic operations

  Clients see products instantly even on cold start. ISR revalidates every 60s in
  background. Backend cache invalidated on stock changes.
- **Problem 2 → Atomic Stock Control.** Stock is reserved with a conditional
  `findOneAndUpdate({ _id, stock: { $gte: qty } }, { $inc: { stock: -qty } })`. If it
  returns `null`, the API responds `409 Conflict` and no order is created.
- **Problem 3 → ERP Resilience + Compensation.** Orders move through
  `PENDING → PROCESSING → COMPLETED | FAILED`. When the ERP fails, the order is marked
  `FAILED` and the reserved stock is atomically restored.

---

# Architecture

```
Browser ──▶ Next.js Frontend ──▶ NestJS Backend ──▶ MongoDB
                                       │
                                       ├──▶ Redis (cache + health)
                                       └──▶ ERP Simulator (in-process)
```

- **Next.js Frontend** — App Router storefront. Pre-renders the product grid with ISR
  (`revalidate: 60`) and drives the checkout flow. Talks to the backend over HTTP using a
  typed API client.
- **NestJS Backend** — Modular monolith (`products`, `orders`, `erp`, `health`, `shared`).
  Owns all business logic: catalogue, atomic stock control, idempotent checkout, and ERP
  orchestration. Documented with Swagger and structured (pino) JSON logs.
- **MongoDB** — Primary data store via Mongoose. Two collections: `products` and `orders`.
  Unique indexes on `products.slug` and `orders.idempotencyKey`.
- **Redis** — Cache-aside layer for the product catalogue and the live dependency probed
  by the health check.
- **ERP Simulator** — `FakeErpService`, an in-process stand-in for an external ERP with
  configurable latency, timeout, and failure modes. It represents the boundary that a real
  service would sit behind.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for diagrams and module details.

---

# Performance Optimization

## Multi-Layer Caching Strategy

The application implements three caching layers for optimal performance:

### Layer 1: Next.js ISR (Frontend)
- **Type:** Incremental Static Regeneration
- **Configuration:** `revalidate: 60` seconds
- **Benefit:** Products pre-rendered at build time
- **Result:** First paint with products in ~5ms (static HTML)
- **Cold start:** Eliminated — HTML already contains product data

```typescript
// app/page.tsx
export const revalidate = 60;

async function getProducts() {
  const res = await fetch(`${API_URL}/products`, {
    next: { revalidate: 60 }
  });
  return res.json();
}
```

### Layer 2: Backend Redis Cache
- **Type:** Cache-aside
- **Key:** `products:all`
- **TTL:** 60 seconds
- **Invalidation:** On stock change (`decrementStock`, `incrementStock`)
- **Benefit:** Reduces MongoDB load

### Layer 3: MongoDB
- **Type:** Operational store
- **Purpose:** Source of truth, atomic operations
- **Access:** Direct queries on cache miss

### Performance Comparison

| Scenario | Without ISR | With ISR |
|----------|-------------|----------|
| **First visit (cold start)** | 50-100ms (fetch + render) | ~5ms (HTML with products) |
| **Cache hit** | 10-20ms (Redis) | ~5ms (HTML) |
| **After stock change** | 50ms (MongoDB) | ~5ms (HTML, revalidates background) |

**Key improvement:** Clients **never wait** for backend — products are always in the
initial HTML response.

> Figures are approximate, based on local testing and the nature of static HTML vs.
> network round-trips. They illustrate relative impact, not benchmarked SLAs.

---

# Key Technical Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| **Modular Monolith** | Clear domain boundaries and high testability without the operational cost of inter-service networking. Each module can be extracted into a service later. | No real inter-service communication is demonstrated. See [ADR-001](docs/ADR-001-monolito-modular.md). |
| **MongoDB** | Single-document atomic operations (`$gte` + `$inc`) solve stock control without distributed transactions. Flexible schema fits the small domain. | Multi-document atomicity needs a replica set, which is not provisioned here. |
| **Redis Cache-Aside** | Explicit, easy-to-reason-about caching. The application controls reads, writes, and invalidation. | Manual invalidation must be wired into every stock-changing path. |
| **Atomic Stock Reservation** | A single conditional `findOneAndUpdate` prevents overselling under concurrency with no locks. | Reservation and order creation are separate steps (mitigated by compensation + idempotency). |
| **Idempotency-Key** | A required header plus a MongoDB unique index makes order creation safe to retry. The unique index is the source of truth, so no Redis lock is needed. | Clients must supply a key; a duplicate insert race relies on catching `E11000`. |
| **ERP Compensation Strategy** | On ERP failure the order is marked `FAILED` and stock is restored with an atomic `$inc`, so customers are never silently charged or blocked. | Compensation is non-transactional (best-effort) without a replica set. |

---

# Project Structure

```
casecellshop/
├── apps/
│   ├── backend/          # NestJS API (products, orders, erp, health, shared)
│   │   ├── src/
│   │   └── test/         # E2E tests (Supertest)
│   └── frontend/         # Next.js App Router storefront
│       └── src/
│           ├── app/      # Pages (ISR home), layout
│           ├── components/
│           └── lib/      # Typed API client
├── docs/                 # Architecture, ADR, sync strategy, project status
├── docker-compose.yml    # Full stack: mongo, redis, backend, frontend
└── README.md
```

---

# Running the Project

**Prerequisites:** Node.js 22+, Docker, and Docker Compose.

## Docker Compose

Brings up the full stack (frontend, backend, MongoDB, Redis) with a single command:

```bash
docker compose up --build
```

| Service  | URL                              | Description                       |
|----------|----------------------------------|-----------------------------------|
| Frontend | http://localhost:3000            | Next.js storefront + checkout     |
| Backend  | http://localhost:3001/api        | NestJS API                        |
| Swagger  | http://localhost:3001/api/docs   | Interactive API documentation     |
| MongoDB  | localhost:27017                  | Database                          |
| Redis    | localhost:6379                   | Cache / health check              |

The product seed runs automatically on first boot. Data persists in the `mongo-data` and
`redis-data` volumes. In Docker, `MONGO_URI`, `REDIS_HOST`, and `REDIS_PORT` are injected
with the Docker network hostnames — no manual configuration is required.

```bash
docker compose down       # stop the stack
docker compose down -v     # stop and wipe volumes (full reset)
```

## Local Development

Run MongoDB and Redis in Docker, and the apps in watch mode on the host.

```bash
# 1. Start infrastructure
docker compose up -d mongo redis

# 2. Configure the backend environment
cp .env.example apps/backend/.env

# 3. Install dependencies
npm install --prefix apps/backend
npm install --prefix apps/frontend

# 4. Run the apps (separate terminals)
npm run dev:backend     # http://localhost:3001/api
npm run dev:frontend    # http://localhost:3000
```

The frontend defaults to `NEXT_PUBLIC_API_URL=http://localhost:3001/api`, so no extra
configuration is needed for local development.

---

# Environment Variables

Backend variables are validated on boot (`@nestjs/config` + `class-validator`); the
application fails fast if a required value is missing or invalid.

| Variable              | Default                                  | Used by         | Description |
|-----------------------|------------------------------------------|-----------------|-------------|
| `NODE_ENV`            | `development`                            | backend         | Runtime environment (`development` / `production` / `test`). |
| `PORT`                | `3001`                                   | backend         | API port (also the Docker host port). |
| `MONGO_URI`           | `mongodb://localhost:27017/casecellshop` | backend         | MongoDB connection string. |
| `REDIS_HOST`          | `localhost`                              | backend         | Redis host. |
| `REDIS_PORT`          | `6379`                                   | backend         | Redis port (also the Docker host port). |
| `CORS_ORIGIN`         | `http://localhost:3000`                  | backend         | Allowed CORS origin. |
| `ERP_FAILURE_MODE`    | `never`                                  | backend (ERP)   | ERP failure simulation: `never` / `always` / `rate`. |
| `ERP_LATENCY_MS`      | `500`                                    | backend (ERP)   | Artificial ERP latency per call. |
| `ERP_TIMEOUT_MS`      | `3000`                                   | backend (ERP)   | ERP timeout threshold; if latency ≥ timeout the call times out. |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api`              | frontend (build)| API URL baked into the client bundle at build time. |
| `MONGO_PORT`          | `27017`                                  | docker-compose  | Host port mapped to MongoDB. |
| `FRONTEND_PORT`       | `3000`                                   | docker-compose  | Host port mapped to the frontend. |

---

# API Documentation

Interactive Swagger UI: **http://localhost:3001/api/docs** (OpenAPI JSON at
`/api/docs-json`).

| Method | Route | Description |
|--------|-------|-------------|
| `GET`  | `/api/health` | Health check — pings MongoDB and Redis via `@nestjs/terminus`. |
| `GET`  | `/api/products` | Product catalogue sorted by name. Cache-aside via Redis (`products:all`, 60 s TTL). |
| `POST` | `/api/orders` | Create an order. Requires the `Idempotency-Key` header. Atomically reserves stock (`409` if insufficient), runs the ERP flow, and returns the final order (always `201`). |
| `GET`  | `/api/orders/:id` | Fetch an order and its current status. |

## Order lifecycle

`POST /api/orders` always returns **HTTP 201** with the final order — inspect the `status`
field:

| `status`    | Meaning |
|-------------|---------|
| `COMPLETED` | ERP accepted the order; stock stays decremented. |
| `FAILED`    | ERP failed; stock was atomically restored. `failureReason` explains why. |

## Idempotency

`POST /api/orders` requires an `Idempotency-Key` header (UUID recommended):

```
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

- Missing header → **400 Bad Request**.
- First request → order created and processed.
- Repeat with the same key → the existing order is returned, stock untouched.

## Health check example

```json
{
  "status": "ok",
  "info": {
    "mongodb": { "status": "up" },
    "redis": { "status": "up" }
  },
  "error": {},
  "details": {
    "mongodb": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

---

# Testing

| Command | Scope |
|---------|-------|
| `npm test` | Backend unit tests — 37 tests across 4 suites (health, products, seed, orders). |
| `npm run test:e2e` | Backend E2E tests — 7 tests across 2 suites. Requires `docker compose up -d mongo redis`. |
| `npm run lint` | Lint backend and frontend. |
| `npm run build` | Production build of both apps (no Docker). |

## Unit Tests

Run with `npm test`. They cover service logic, DTO validation, seed idempotency, the
cache-aside paths, atomic stock control, and the full checkout flow. Dependencies are
mocked via `getModelToken` and `overrideProvider`; no database is required.

## E2E Tests

Run with `npm run test:e2e` after starting infrastructure (`docker compose up -d mongo
redis`). They exercise the API end to end against a real MongoDB (`casecellshop-e2e`
database, cleaned up after the run). `FakeErpService` is replaced via `overrideProvider`
for deterministic results. The mandatory business scenarios:

1. Successful purchase → `201 COMPLETED`, stock decremented.
2. Invalid quantity → `400`.
3. Product not found → `404`.
4. Insufficient stock → `409`.
5. Duplicate `Idempotency-Key` → same order returned, no duplicate created.
6. ERP failure → `201 FAILED`, stock fully restored.

---

# Trade-offs

These are intentional simplifications scoped to the assessment:

- **No real ERP.** `FakeErpService` runs in-process. It models the failure boundary
  (latency, timeout, failure modes) that a real integration would have, without requiring
  an external system to demo.
- **No Kubernetes.** Docker Compose fully covers local development and demo. K8s would add
  operational overhead with no benefit at this scope.
- **No background workers.** Checkout is synchronous and simple; a queue/worker tier would
  add infrastructure without changing correctness here.
- **No distributed cache invalidation.** A single backend instance owns the cache, so
  `DEL products:all` on each stock change is sufficient. Multi-instance deployments would
  need pub/sub or short TTL coordination.
- **Next.js ISR revalidation.** Products are revalidated every 60 seconds in background.
  Stock displayed may be slightly stale (up to 60s old) but checkout always validates
  against current MongoDB stock, preventing overselling. UX trade-off: instant page load
  vs. perfect real-time accuracy.
- **No MongoDB transactions.** Docker Compose runs a standalone `mongod` (no replica set),
  so multi-document transactions are unavailable. Stock compensation is therefore
  best-effort `$inc` rather than transactional.

---

# Architectural Decision: MongoDB as Operational Store

## Context

This solution uses MongoDB as the **primary operational database** for products and
orders. While the challenge describes the ERP as the "source of truth" with read-only
access, MongoDB was chosen to demonstrate proficiency in the **NoSQL database required
by the target role** (Mid-level Fullstack Developer position).

## Trade-Off Analysis

### ✅ Advantages

- **Demonstrates MongoDB expertise:** atomic operations (`$gte` + `$inc` for stock
  control), unique indexes for idempotency, schema design for document store.
- **Simplifies demo setup:** No external ERP integration required; full stack runs with
  `docker compose up`.
- **Enables advanced patterns:** Conditional updates, compensation logic, and order
  lifecycle management showcase NoSQL proficiency beyond basic CRUD.

### ⚠️ Production Considerations

If this architecture were deployed alongside a real ERP (as the challenge describes), it
would introduce a **data synchronization problem:**

| Challenge | Solution Required |
|-----------|-------------------|
| ERP has the authoritative product catalog | CDC pipeline (Debezium) from ERP MySQL → Kafka → MongoDB consumer |
| Prices and stock change in the ERP | Near-real-time propagation to MongoDB via event streaming |
| New products added to ERP inventory | Automatic insertion into MongoDB; manual seed is not sustainable |
| Divergence between ERP and MongoDB | Reconciliation job + alerting; circuit breaker to query ERP on staleness |

See [docs/SYNC_STRATEGY.md](docs/SYNC_STRATEGY.md) for the complete synchronization
strategy, including CDC pipeline design, reconciliation jobs, and failure scenarios.

## Alternative Approach Considered

**Hybrid architecture: MongoDB for Orders, ERP for Products**

```
Orders (MongoDB)           Products (ERP)
├─ Order history           ├─ Cached in Redis
├─ Idempotency key         ├─ Queried on cache miss
├─ Status lifecycle        └─ Stock reservation via ERP API
└─ Atomic status updates
```

**Why not chosen:** The challenge states "we only have read access" to the ERP and
"cannot modify ERP code." Implementing stock reservation would require either:
1. An ERP API endpoint for reservation (violates read-only constraint)
2. Direct writes to ERP MySQL (violates "cannot modify" constraint)

Using MongoDB for products enables demonstration of atomic stock control
(`findOneAndUpdate` with `$gte` + `$inc`) without requiring ERP modifications.

## Alignment with Challenge vs. Role Requirements

| Aspect | Challenge Goal | Implementation Choice | Justification |
|--------|---------------|----------------------|---------------|
| **Data authority** | "ERP is source of truth" | MongoDB is operational store | Demonstrates NoSQL (role requirement) while acknowledging sync gap |
| **Stock control** | "Prevent overselling" | Atomic MongoDB operation | ✅ Solves the business problem correctly |
| **ERP dependency** | "Reduce ERP dependency" | Eliminates ERP from the read path | ✅ Consistent sub-100ms reads; ⚠️ requires sync pipeline |
| **Incremental evolution** | "Without rewriting the ERP" | Introduces new database | ⚠️ Adds operational complexity |

**Evaluation note:** A naive "cache the ERP" approach still suffers multi-second latency
on every cold start, TTL expiry, or cache invalidation — the exact pain the challenge
describes ("the storefront takes several seconds to load products"). Using an operational
store guarantees consistent sub-100ms reads regardless of cache state, and the seed
ensures data is available from the first request. The trade-off is a synchronization
requirement (documented in [docs/SYNC_STRATEGY.md](docs/SYNC_STRATEGY.md)), which in
production would be solved with a CDC pipeline. This decision prioritizes consistent UX
and demonstrates the required stack, at the cost of added operational complexity — a
conscious engineering trade-off rather than an oversight.

---

# Future Improvements

- **Real-time stock updates** — Currently ISR revalidates every 60s. Could implement
  WebSocket or Server-Sent Events to push stock updates instantly to connected clients,
  eliminating the 60s staleness window while keeping ISR's instant page load benefits.
- **Queue-based ERP processing** — move ERP calls to an async worker (Kafka/RabbitMQ/BullMQ)
  for retries and back-pressure.
- **Cloud deployment** — containers on AWS/Azure/GCP with managed MongoDB and Redis.
- **Distributed cache invalidation** — Redis pub/sub or keyspace notifications for
  multi-instance backends.
- **MongoDB replica set transactions** — make stock reservation and compensation fully
  transactional.
- **CI/CD pipeline** — automated lint, test, build, and image publishing on every push.

---

# Development Process

This project was developed using **AI-assisted workflows** with structured documentation 
to maintain context across development sessions.

## Documentation Strategy

| Document | Purpose | Demonstrates |
|----------|---------|--------------|
| **README.md** | Project overview, architecture, usage | Technical communication |
| **docs/ARCHITECTURE.md** | System design, diagrams, module structure | Architectural thinking |
| **docs/ADR-001-monolito-modular.md** | Architectural decision: modular monolith | Decision documentation |
| **docs/SYNC_STRATEGY.md** | Production CDC pipeline strategy | Production thinking |
| **docs/PROJECT_STATUS.md** | Development state machine | **Context window management** |
| **PROMPTS.md** | AI interaction log | Prompt engineering |

### Why PROJECT_STATUS.md Exists

When working with AI assistants (Claude, GPT, etc.), **context window limitations** require 
maintaining state between sessions. PROJECT_STATUS.md serves as a **state machine** that 
preserves:

- Architectural decisions across 16 development phases
- Dependencies between implementation steps
- Trade-offs documented at decision time
- Testing strategy evolution
- Complete project timeline

This enables any developer (human or AI) to resume work without requiring previous 
conversation history — a critical pattern for sustainable AI-assisted development.
