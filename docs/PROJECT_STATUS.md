# CaseCellShop — Project Status

> **Purpose:** Single source of truth for any AI assistant or developer picking up this project.
> No prior conversation context is required to continue work from this document.
>
> **Last updated:** 2026-06-06 | **Author:** AI-assisted development session

---

## Project Overview

**Name:** CaseCellShop

**Challenge summary:** Full-stack technical assessment for a Senior Fullstack Engineer position. The required stack is NestJS, Next.js, MongoDB, Redis, Docker, and TypeScript. The deliverable is a functional checkout mini-flow for a phone case store.

**Business problem:** Build a system that reliably handles three core concerns:
1. **Storefront performance** — product listing with eventual cache support.
2. **Stock consistency** — prevent overselling under concurrent requests.
3. **Checkout resilience** — handle ERP failures gracefully with stock compensation.

---

## Current Architecture

### Pattern
**Modular monolith** — NestJS modules with clear domain boundaries (`products`, `orders`, `erp`, `health`, `shared`). Each module owns its schema, service, controller, and DTOs. Boundaries are designed so any module can be extracted into a standalone microservice without changing its public interface.

### Backend (NestJS)
- `SharedModule` (@Global): wires `ConfigModule`, `MongooseModule`, `LoggerModule` (pino), and the Redis provider. All domain modules inherit these without re-importing.
- `HealthModule`: `GET /api/health` via `@nestjs/terminus`, pings both MongoDB and Redis.
- `ProductsModule`: `GET /api/products`, auto-seed on first boot.
- `OrdersModule`: `POST /api/orders` and `GET /api/orders/:id`. Checkout core logic lives here.
- `ErpModule`: `FakeErpService` stub — full implementation (timeout + failure + compensation) is Phase 6.

### Frontend (Next.js)
- Scaffolded with App Router, TypeScript, and Tailwind CSS.
- `src/lib/api/index.ts` — typed HTTP client pointing to the backend.
- `src/components/` — reserved for Phase 8 UI components.
- **Not implemented yet.** Phase 8 and 9.

### Database (MongoDB via Mongoose)
- `products` collection: name, slug (unique), price, stock, imageUrl, timestamps.
- `orders` collection: productId (ref), quantity, unitPrice, total, status (enum), idempotencyKey (unique index), failureReason, timestamps.
- `toJSON` transform on both schemas: exposes `id` (string) instead of `_id` (ObjectId).

### Cache / Key-Value (Redis via ioredis)
- Currently used for: health check ping (`GET /api/health`).
- Planned (Phase 10 bonus): cache-aside for `GET /api/products` with TTL + invalidation on write.
- **No Redis lock for idempotency** — deduplication relies on the MongoDB unique index on `idempotencyKey`.

### Infrastructure (Docker Compose)
- Services: `mongo` (mongo:7) and `redis` (redis:7-alpine).
- Both configured with healthchecks and named persistent volumes.
- Backend and frontend Docker images: Phase 11.

### API Documentation (Swagger)
- Available at `GET /api/docs` (Swagger UI) and `GET /api/docs-json` (OpenAPI JSON).
- All endpoints documented with `@ApiTags`, `@ApiOperation`, and typed response schemas.

### Logging
- Structured JSON logs via `nestjs-pino` / `pino-http`.
- Level: `debug` in development, `info` in production.

### Testing strategy
- **Unit tests** (Jest + `@nestjs/testing`): service logic, DTO validation, seed behaviour.
- **E2E tests** (Supertest): 6 mandatory business scenarios — Phase 7.
- Dependencies mocked via `getModelToken` and `overrideProvider`; no in-memory database at unit level.
- `mongodb-memory-server` planned for integration tests in Phase 7.

---

## Technology Stack

| Technology | Version | Purpose |
|---|---|---|
| TypeScript | ^5.7 | Language |
| NestJS | ^11.0 | Backend framework |
| Next.js | 16.2 | Frontend framework |
| MongoDB | 7 (Docker) | Primary database |
| Mongoose | ^8.24 | ODM for MongoDB |
| ioredis | ^5.11 | Redis client |
| Redis | 7-alpine (Docker) | Cache / health check |
| `@nestjs/config` | ^4.0 | Environment config with validation |
| `@nestjs/swagger` | ^11.4 | OpenAPI documentation |
| `@nestjs/terminus` | ^11.1 | Health checks |
| `nestjs-pino` + `pino` | ^4.6 / ^10.3 | Structured logging |
| `class-validator` | ^0.15 | DTO validation |
| `class-transformer` | ^0.5 | DTO transformation |
| Jest | ^30.0 | Test runner |
| Supertest | ^7.0 | HTTP E2E testing |
| Docker Compose | v2.30 | Local infrastructure |
| ESLint + Prettier | ^9 / ^3 | Code quality |
| Tailwind CSS | ^4 | Frontend styling |

---

## Completed Phases

### Phase 1 — Bootstrap
**Objective:** Set up the monorepo, tooling, and folder structure.

**Deliverables:**
- Root `package.json` with cross-app scripts (`dev:backend`, `dev:frontend`, `test`, `lint`, `build`).
- NestJS 11 backend scaffolded in `apps/backend/` (TypeScript, ESLint, Prettier, Jest).
- Next.js 16 frontend scaffolded in `apps/frontend/` (TypeScript, Tailwind, App Router).
- Module skeleton: `health`, `products`, `orders`, `erp`, `shared`, `config`, `common`.
- `HttpExceptionFilter` and `@IdempotencyKey` decorator created.
- `.env.example`, `.prettierrc`, `.editorconfig` at root.
- `docs/ADR-001-monolito-modular.md` — architectural decision record.

**Status:** ✅ Complete. `tsc`, lint, and unit tests all pass.

---

### Phase 2 — Dev Infrastructure
**Objective:** Functional Docker Compose for local development.

**Deliverables:**
- `docker-compose.yml` with `mongo` (port 27017) and `redis` (port 6379).
- Named volumes: `mongo-data`, `redis-data`.
- Native healthchecks on both services.
- Ports parametrised via env vars (`MONGO_PORT`, `REDIS_PORT`).
- `apps/backend/.env` (gitignored) copied from `.env.example`.

**Status:** ✅ Complete. Both containers reach `(healthy)` state.

---

### Phase 3 — NestJS Infrastructure Skeleton
**Objective:** Wire all infrastructure into the running application.

**Deliverables:**
- `SharedModule` (@Global): `ConfigModule.forRoot` (with env validation), `MongooseModule.forRootAsync`, `LoggerModule.forRootAsync`, `RedisProvider`.
- `config/env.validation.ts`: fail-fast schema using `class-validator` (all env vars validated on boot).
- `shared/redis.provider.ts`: ioredis client injectable via `REDIS_CLIENT` token.
- `health/redis.health.ts`: custom `HealthIndicatorService` for Redis PING (terminus has no built-in Redis indicator).
- `GET /api/health`: aggregates `mongodb` and `redis` status via terminus.
- Swagger at `GET /api/docs` (UI) and `GET /api/docs-json`.
- `ValidationPipe` (whitelist + transform) registered globally.
- `HttpExceptionFilter` registered globally.
- Shutdown hooks enabled.

**Status:** ✅ Complete. Health check returns `{ status: "ok", info: { mongodb: { status: "up" }, redis: { status: "up" } } }`.

---

### Phase 4 — Products Module
**Objective:** Product catalogue with automatic seed.

**Deliverables:**
- `Product` schema (Mongoose): `name`, `slug` (unique), `price`, `stock`, `imageUrl?`, timestamps.
- `toJSON` transform: exposes `id` (string) instead of `_id`.
- `PRODUCT_SEEDS`: 5 phone case products (Capinha iPhone 15, Galaxy S25, Moto G, Redmi Note, iPhone 14 Pro).
- `ProductsSeedService` (`OnModuleInit`): inserts seed data only when the collection is empty — idempotent across restarts.
- `GET /api/products`: returns all products sorted by name.
- `ProductsService.findById(id)`: used by `OrdersService` to validate products; guards against invalid ObjectIds.
- Swagger: `@ApiTags('products')`, `@ApiOkResponse({ type: [ProductResponseDto] })`.

**Status:** ✅ Complete. Seed runs automatically after `docker compose up`. Endpoint verified live.

---

### Phase 5 — Orders Core
**Objective:** Checkout creation and order lookup — without stock reservation, idempotency, or ERP yet.

**Deliverables:**
- `Order` schema: `productId` (ObjectId ref), `quantity`, `unitPrice`, `total`, `status` (enum), `idempotencyKey` (unique), `failureReason?`, timestamps.
- `OrderStatus` enum: `PENDING | PROCESSING | COMPLETED | FAILED`.
- `CreateOrderDto`: `@IsMongoId`, `@IsInt`, `@Min(1)` validators with English messages.
- `POST /api/orders`: validates product existence (404), quantity (400), calculates total (`unitPrice × quantity` with float precision fix), creates order with `PENDING` status. `idempotencyKey` is a UUID placeholder until Phase 6.
- `GET /api/orders/:id`: returns the order (404 if not found or invalid ObjectId).
- Swagger: `@ApiCreatedResponse`, `@ApiBadRequestResponse`, `@ApiNotFoundResponse`.

**Status:** ✅ Complete. All edge cases verified live (201 / 400 / 404).

---

### Quality Review (between Phase 5 and 6)
**Objective:** Standardise the codebase before adding more features.

**Changes applied:**
- All source code, tests, Swagger descriptions, exception messages, and log messages standardised to **English**.
- Removed comments explaining obvious code.
- Removed phase-reference comments from production code (`"Phase 5: ..."`, `"arrives in Phase 6"`, etc.).
- Kept architectural/non-obvious comments (e.g. `FakeErpService` env var table, `idempotencyKey` deduplication note, seed idempotency note).
- All `describe`/`it` blocks in test files translated to English.

**Status:** ✅ Complete. `tsc` clean, lint clean (0 errors, 0 warnings), 22/22 tests pass.

---

## Pending Phases

### Phase 6 — Atomic Stock Control ✅
**Goal:** Prevent overselling using atomic MongoDB operations.

**Deliverables:**
- `ProductsService.decrementStock(id, quantity)`: single atomic `findOneAndUpdate({ _id, stock: { $gte: quantity } }, { $inc: { stock: -quantity } })` — returns the pre-update document on success, `null` when stock is insufficient.
- `OrdersService.create()` updated: (1) validate product → 404; (2) atomic decrement → 409 `ConflictException`; (3) create order → 201 PENDING.
- `ConflictException` (HTTP 409) with clear English message: `"Insufficient stock for product: <id>"`.
- `@ApiConflictResponse` documented in Swagger.
- `OrderResponseDto` descriptions updated to English.
- Unit tests: success + stock decrement verified, 404 (product not found), 409 (insufficient stock), concurrency simulation (10 requests, stock=5, exactly 5 succeed, stock=0 after).

**Not implemented in this phase (deferred):**
- Idempotency (`Idempotency-Key` header and duplicate order detection).
- ERP integration (`FakeErpService` and failure compensation).

**Status:** ✅ Complete. 0 lint errors, 0 lint warnings, 27/27 tests pass, `tsc` clean.

**Dependencies:** Phase 5 complete.

---

### Phase 7 — Idempotency
**Goal:** Enforce `Idempotency-Key` header on `POST /api/orders`; deduplicate concurrent retries.

**Expected deliverables:**
- Validate `Idempotency-Key` header on `POST /api/orders` — 400 if missing.
- Catch `E11000` (MongoDB unique index violation on `orders.idempotencyKey`) → return the existing order (no duplicate created).
- Replace the `randomUUID()` placeholder with the actual header value.
- Unit + E2E tests for duplicate-key scenario.

**Dependencies:** Phase 6 complete.

---

### Phase 7b — E2E Tests + Concurrency (was Phase 7)
**Goal:** Cover all 6 mandatory business scenarios with integration/E2E tests.

**Expected deliverables:**
- Supertest E2E suite (`test/app.e2e-spec.ts`) covering:
  1. Successful purchase → 201 PENDING.
  2. Insufficient stock → 409.
  3. Invalid quantity → 400.
  4. Duplicate `Idempotency-Key` → same order returned.
  5. ERP unavailable → 503 + stock compensated (via `overrideProvider`).
  6. Concurrent requests → N simultaneous orders, zero overselling.
- `mongodb-memory-server` for E2E test database isolation.
- `FakeErpService` replaced by a deterministic stub for tests 5 and 6.
- Coverage report targeting business-rule files.

**Dependencies:** Phase 6 complete.

---

### Phase 8 — Frontend Storefront
**Goal:** Next.js product listing page.

**Expected deliverables:**
- `GET /api/products` consumed and rendered as a product card grid.
- Responsive layout with Tailwind CSS.
- Loading and error states.
- Product detail page (optional).

**Dependencies:** Phase 4 complete (independent of Phase 6/7).

---

### Phase 9 — Frontend Checkout
**Goal:** Next.js checkout flow connected to the backend.

**Expected deliverables:**
- "Buy" button on product card triggers `POST /api/orders`.
- Auto-generated `Idempotency-Key` per attempt (UUID, stored in component state).
- Handles all error states: 400 (invalid), 409 (out of stock), 503 (ERP down), duplicate key (same order shown).
- Polls or navigates to `GET /api/orders/:id` to display order status cycle.

**Dependencies:** Phase 6 complete (needs real checkout behaviour).

---

### Phase 10 — Redis Cache (Bonus)
**Goal:** Cache-aside layer for `GET /api/products`.

**Expected deliverables:**
- Products cached in Redis on first fetch with a short TTL.
- Cache invalidated when product stock changes.
- Demonstrable cache HIT vs MISS in logs.

**Dependencies:** Phase 6 (stock changes must invalidate the cache).

---

### Phase 11 — Production Dockerfiles
**Goal:** Multi-stage Docker images for backend and frontend; full-stack Docker Compose.

**Expected deliverables:**
- `apps/backend/Dockerfile`: build stage (`nest build`) + production stage (`node dist/main`).
- `apps/frontend/Dockerfile`: build stage (`next build`) + production stage.
- `docker-compose.yml` updated with `backend` and `frontend` services.
- Environment variables properly passed at container level.

**Dependencies:** All feature phases complete.

---

### Phase 12 — Documentation
**Goal:** Final README and ADRs ready for evaluator handoff.

**Expected deliverables:**
- `README.md`: setup instructions, seed explanation, environment variables table, endpoint list, test commands, trade-offs section, future evolution paths.
- Cloud deployment notes (AWS/Azure/GCP) — documented, not implemented.
- `PROMPTS.md`: up to date with all session prompts.
- `docs/ARCHITECTURE.md`: final architecture with flow diagram.

**Dependencies:** All phases complete.

---

## Architectural Decisions

### Modular monolith instead of microservices
The challenge involves two collections and a synchronous checkout flow. A modular monolith delivers clear domain boundaries and high testability without the operational overhead of inter-service networking, distributed tracing, or separate CI pipelines. Each NestJS module is already structured to be extracted into an independent service if needed.
> See `docs/ADR-001-monolito-modular.md`

### No Kafka, RabbitMQ, CQRS, or Event Sourcing
The checkout flow is synchronous and simple. Messaging infrastructure would add complexity without improving correctness for this scope. Mentioned as a future evolution path in `README.md`.

### Single-item Order model
The domain is purchasing phone cases — inherently a single-item selection. Multi-item orders would add a compensation loop with no new architectural concept demonstrated.

### Idempotency via MongoDB unique index (no Redis lock)
The MongoDB unique index on `orders.idempotencyKey` is the source of truth. A concurrent insert with the same key triggers `E11000`, which is caught and resolved by returning the existing order. A Redis lock would add infrastructure complexity and a failure mode (orphaned lock) without meaningful benefit at this scale.

### Stock control via atomic `findOneAndUpdate`
Single-document atomic operations in MongoDB (`$gte` + `$inc` in one operation) prevent overselling without requiring a replica set or distributed transaction. The trade-off (non-transactional compensation on ERP failure) is documented as a known limitation.

### ERP failure is deterministic in tests
`FakeErpService` is injected via NestJS DI. E2E tests replace it with `overrideProvider()` — no `Math.random()`, no fake timers, zero flakiness. For manual demo, `ERP_FAILURE_MODE=always` forces failures.

### Redis used for health check (not just cache)
Ensures Redis is a real runtime dependency, not decorative. This keeps the Redis connection live and tested regardless of whether the cache layer (Phase 10) is implemented.

### Swagger configured early
The API is documented from Phase 3. Every new endpoint added its Swagger decorators immediately, keeping the docs accurate and useful for the evaluator at any point in development.

### Environment validation on boot (fail-fast)
`config/env.validation.ts` uses `class-validator` to validate all required environment variables at startup. The application refuses to start if a required variable is missing or malformatted, preventing silent misconfigurations in production.

---

## Existing Endpoints

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Health check: pings MongoDB and Redis via terminus |
| `GET` | `/api/docs` | Swagger UI — interactive API documentation |
| `GET` | `/api/docs-json` | OpenAPI JSON spec — import into Postman / Insomnia |
| `GET` | `/api/products` | Product catalogue, sorted by name |
| `POST` | `/api/orders` | Create order (validates product + quantity; returns PENDING) |
| `GET` | `/api/orders/:id` | Get order by ID (shows status cycle) |

---

## Existing Tests

### Unit tests (27 passing, 4 suites)

**HealthController** (`health.controller.spec.ts`)
- `should be defined`
- `should aggregate mongodb and redis health indicators`

**ProductsService** (`products.service.spec.ts`)
- `should be defined`
- `findAll() > should return products sorted by name`
- `findAll() > should call find().sort({ name: 1 }).exec()`
- `findById() > should return null for an invalid ObjectId`
- `findById() > should query the model with a valid ObjectId`
- `decrementStock() > should return null for an invalid ObjectId without querying the model`
- `decrementStock() > should return the pre-update document when stock is sufficient`
- `decrementStock() > should return null when stock is insufficient (model returns null)`

**ProductsSeedService** (`products-seed.service.spec.ts`)
- `should be defined`
- `runSeed() > should insert seed data when the collection is empty`
- `runSeed() > should skip the insert when products already exist`
- `runSeed() > seed data should contain 5 products with all required fields`

**OrdersService** (`orders.service.spec.ts`)
- `should be defined`
- `CreateOrderDto > should fail when productId is missing`
- `CreateOrderDto > should fail when productId is not a valid ObjectId`
- `CreateOrderDto > should fail when quantity is less than 1`
- `CreateOrderDto > should fail when quantity is not an integer`
- `CreateOrderDto > should pass with valid data`
- `create() > should atomically decrement stock and return a PENDING order with the correct total`
- `create() > should throw NotFoundException when the product does not exist`
- `create() > should throw ConflictException when stock is insufficient`
- `create() - overselling prevention > should allow exactly 5 of 10 concurrent requests when stock=5`
- `findOne() > should return the order when found`
- `findOne() > should throw NotFoundException when the order does not exist`
- `findOne() > should throw NotFoundException for an invalid ObjectId`

### Integration tests
None yet. Planned for Phase 7 using `mongodb-memory-server`.

### E2E tests (`test/app.e2e-spec.ts`)
One bootstrap smoke test: `GET /api/health should return 200 with status ok`.
The 6 mandatory business-scenario E2E tests arrive in Phase 7.

---

## Known Limitations

| Limitation | Reason | Resolution |
|---|---|---|
| `idempotencyKey` is a random UUID, not from request header | Placeholder — real idempotency logic is Phase 7 | Phase 7 |
| No ERP call in `POST /api/orders` | `FakeErpService` is a stub — Phase 7 | Phase 7 |
| Stock compensation not implemented | Depends on ERP integration | Phase 7 |
| No frontend implementation | Phase 8 and 9 | Phase 8–9 |
| E2E test suite incomplete | Only bootstrap test exists | Phase 7 |
| No concurrency test | Requires full checkout flow | Phase 7 |
| No production Dockerfiles | Phase 11 | Phase 11 |
| Stock compensation is non-transactional | No replica set in Docker Compose; compensate with `$inc` on ERP failure | Known — documented in ADR |
| `GET /api/products` has no cache | Redis cache is a Phase 10 bonus | Phase 10 |

---

## Recommended Next Step

**Phase 7 — Idempotency**

### Technical rationale
Phase 7 deduplicates checkout retries: the `Idempotency-Key` header becomes mandatory on `POST /api/orders`, and a MongoDB `E11000` collision returns the existing order rather than creating a duplicate. This closes the last gap before ERP integration.

### Expected outcomes after Phase 7
- `POST /api/orders` without `Idempotency-Key` header → HTTP 400.
- Repeated `POST /api/orders` with the same `Idempotency-Key` → same order returned (no duplicate created).
- Unit + E2E tests for duplicate-key scenario.

---

## Delivery Readiness

### Already production-like
- Environment validation on boot (fail-fast, no silent misconfiguration).
- Structured JSON logging (pino — production-grade).
- `GET /api/health` with real dependency checks.
- MongoDB unique indexes defined on `slug` (products) and `idempotencyKey` (orders).
- Docker Compose with healthchecks and persistent volumes.
- Swagger with full request/response schemas.
- Code: English-only, 0 lint errors/warnings, 27/27 tests green, `tsc` clean.

### Still missing for a complete delivery
- Idempotency header + ERP simulation (Phase 7).
- 6 mandatory E2E scenarios (Phase 7b).
- Frontend UI (Phase 8–9).
- Production Dockerfiles + full-stack compose (Phase 11).
- Final README with cloud deployment notes (Phase 12).

### Main risks
1. **Phase 6 complexity** — Three features (stock, idempotency, ERP) must work together correctly; this is the highest-risk phase.
2. **Concurrency test reliability** — Parallel HTTP requests in Jest require careful setup; `mongodb-memory-server` with replica set support may be needed.
3. **Disk space** — Previous sessions hit 100% disk usage during npm installs. Monitor when adding new packages.

### Recommended execution order
1. Phase 6 (stock + idempotency + ERP) — core checkout correctness.
2. Phase 7 (E2E + concurrency) — validates Phase 6 under all scenarios.
3. Phase 8 (frontend storefront) — can start in parallel with Phase 7.
4. Phase 9 (frontend checkout) — depends on Phase 6 being complete.
5. Phase 11 (production Docker) — final packaging.
6. Phase 10 (Redis cache, bonus) — only if time allows.
7. Phase 12 (documentation) — finalise README and ADRs last.

---

## Current Progress

**Last Completed Phase:** Phase 6 — Atomic Stock Control

**Next Phase:** Phase 7 — Idempotency

**Phase 7 Objective:** Enforce `Idempotency-Key` header on `POST /api/orders` and deduplicate retries using the MongoDB unique index on `orders.idempotencyKey`.

**Do Not Start:**
- ERP integration (`FakeErpService` implementation and failure compensation)
- Frontend (Phase 8 and 9)
