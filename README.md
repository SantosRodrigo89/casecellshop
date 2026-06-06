# CaseCellShop

A checkout mini-flow for a phone case store, built as a full-stack technical assessment.
The project demonstrates storefront performance, stock consistency, and checkout
resilience using NestJS, Next.js, MongoDB, and Redis.

---

# Project Overview

## Challenge context

The challenge is a Fullstack Engineer technical assessment. The stack is
**NestJS, Next.js, MongoDB, Redis, Docker, and TypeScript**, and the deliverable is a
functional checkout flow for a store that sells phone cases.

## Business problems

The system must reliably solve three core concerns:

| # | Problem | Requirement |
|---|---------|-------------|
| 1 | **Storefront performance** | Serve the product catalogue fast and reduce database load. |
| 2 | **Stock consistency** | Prevent overselling when multiple customers buy concurrently. |
| 3 | **Checkout resilience** | Survive ERP failures without losing money or leaving stock locked. |

## Solution summary

A modular NestJS monolith exposes a small, well-documented API consumed by a Next.js
storefront. Products are cached in Redis, stock is reserved with a single atomic MongoDB
operation, and orders are processed against a simulated ERP with automatic stock
compensation on failure. Every write path is idempotent.

## Problem → solution mapping

- **Problem 1 → Redis Cache.** `GET /api/products` uses a cache-aside strategy
  (`products:all`, 60 s TTL). Reads hit Redis first; the cache is invalidated on every
  stock change.
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

- **Next.js Frontend** — App Router storefront. Renders the product grid and drives the
  checkout flow. Talks to the backend over HTTP using a typed API client.
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

# Running the Project

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
- **No MongoDB transactions.** Docker Compose runs a standalone `mongod` (no replica set),
  so multi-document transactions are unavailable. Stock compensation is therefore
  best-effort `$inc` rather than transactional.

---

# Future Improvements

- **Queue-based ERP processing** — move ERP calls to an async worker (Kafka/RabbitMQ/BullMQ)
  for retries and back-pressure.
- **Cloud deployment** — containers on AWS/Azure/GCP with managed MongoDB and Redis.
- **Distributed cache invalidation** — Redis pub/sub or keyspace notifications for
  multi-instance backends.
- **MongoDB replica set transactions** — make stock reservation and compensation fully
  transactional.
- **CI/CD pipeline** — automated lint, test, build, and image publishing on every push.

---

For architecture diagrams and the modular-monolith decision record, see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/ADR-001-monolito-modular.md](docs/ADR-001-monolito-modular.md).
