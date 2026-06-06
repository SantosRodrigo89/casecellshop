# CaseCellShop — Project Status

> **Purpose:** Single source of truth for any AI assistant or developer picking up this project.
> No prior conversation context is required to continue work from this document.
>
> **Last updated:** 2026-06-06 (Phase 8) | **Author:** AI-assisted development session

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
- `ErpModule`: `FakeErpService` — configurable latency, timeout, and failure modes; fully implemented in Phase 7b.

### Frontend (Next.js)
- App Router, TypeScript, Tailwind CSS.
- `src/types/index.ts` — `Product`, `Order`, `OrderStatus`, `ApiError` interfaces.
- `src/lib/api/index.ts` — typed HTTP client (`api.products.list`, `api.orders.create`, `api.orders.findOne`, `api.health.check`).
- `src/components/ProductCard.tsx` — Client Component: quantity selector, buy button, loading/disabled states, success card (order ID + status), error messages.
- `src/app/page.tsx` — Client Component: fetches product list, renders responsive product grid, loading and error states.
- Phase 8 complete. Phase 9 merged into Phase 8 (checkout flow implemented on same page).

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

**Post-review improvements (same phase):**
- `common/dto/error-response.dto.ts` created — documents the `HttpExceptionFilter` envelope `{ statusCode, message, path, timestamp }`.
- All error responses on `POST /api/orders` and `GET /api/orders/:id` now expose `type: ErrorResponseDto` in Swagger (400, 404, 409 body schemas visible in the UI).
- `@ApiOperation.description` on `POST /api/orders` updated to mention the atomic stock reservation and the 409 condition.
- `findOneAndUpdate` options made explicit: `{ new: false }` documents that the pre-update document is intentionally returned.
- Exception message strings now asserted in tests (not just exception class).
- Concurrency test description corrected to "sequential exhaustion simulation" — it tests deterministic event-loop interleaving, not true DB-level race conditions.
- `OrderResponseDto.createdAt` / `updatedAt` now have `description` fields.

**Status:** ✅ Complete. 0 lint errors, 0 lint warnings, 27/27 tests pass, `tsc` clean.

**Dependencies:** Phase 5 complete.

---

### Phase 7 — Idempotency ✅
**Goal:** Enforce `Idempotency-Key` header on `POST /api/orders`; deduplicate concurrent retries.

**Deliverables:**
- `Idempotency-Key` header enforced on `POST /api/orders` — HTTP 400 if missing.
- `@IdempotencyKey()` param decorator (scaffolded in Phase 1) wired into `OrdersController.create()`.
- `randomUUID()` placeholder removed from `OrdersService.create()`; header value used directly.
- `orderModel.create()` wrapped in try/catch: `E11000` (code 11000) → `findOne({ idempotencyKey })` → existing order returned.
- Non-E11000 errors re-thrown unchanged.
- `@ApiHeader` added to Swagger for the `POST /api/orders` endpoint.
- `@ApiOperation.description` updated to document the 400 header condition and E11000 deduplication.
- `@ApiCreatedResponse.description` updated to cover the duplicate-key return case.
- `@ApiBadRequestResponse.description` updated to mention the missing header trigger.
- Unit tests added (2 new): E11000 deduplication + non-E11000 error propagation.
- All existing `service.create(dto)` calls in tests updated to `service.create(dto, key)`.
- `mockOrderModel.findOne` added to the test mock.

**Status:** ✅ Complete. 0 lint errors, 0 lint warnings, 29/29 tests pass, `tsc` clean, `nest build` clean.

**Dependencies:** Phase 6 complete.

---

### Phase 7b — ERP Resilience + Order Status + E2E ✅
**Goal:** Implement the full ERP simulation, order lifecycle, stock compensation, and 6-scenario E2E suite.

**Deliverables:**
- `FakeErpService` fully implemented: configurable latency, timeout, failure modes (`never`/`always`/`rate`). Reads from `ConfigService` (env vars). ERP is replaced in E2E tests via `overrideProvider()`.
- `ProductsService.incrementStock(id, quantity)`: atomic `$inc` for stock compensation.
- `OrdersService.create()` rewritten — full 8-step checkout flow:
  1. Validate product (404).
  2. Pre-check idempotency key → return existing order if found (no stock touched).
  3. Atomic stock reserve (409 if insufficient).
  4. Create order as `PENDING` (unique index as last-resort race guard; on E11000 → restore stock + return winning order).
  5. Transition to `PROCESSING`.
  6. Call `FakeErpService.processOrder()`.
  7. On success: transition to `COMPLETED`.
  8. On failure: transition to `FAILED` + `incrementStock` (compensation). Returns FAILED order (HTTP 201).
- `OrdersModule` imports `ErpModule` to make `FakeErpService` injectable.
- `OrdersController` Swagger updated: step-by-step description, COMPLETED/FAILED examples, `@ApiOperation` with full lifecycle, updated `@ApiCreatedResponse` to cover FAILED case.
- `test/orders.e2e-spec.ts`: 6 mandatory business scenarios (Supertest, real MongoDB, mutable ERP stub):
  1. Successful purchase → 201 COMPLETED, stock decremented, GET /api/orders/:id returns COMPLETED.
  2. Invalid quantity → 400.
  3. Product not found → 404.
  4. Insufficient stock → 409.
  5. Duplicate `Idempotency-Key` → same order returned, countDocuments = 1.
  6. ERP failure → 201 FAILED, failureReason set, stock fully restored.
- `test/jest-e2e.json`: `"forceExit": true` added (prevents ioredis open-handle warning).
- Unit tests updated: `mockErpService`, `mockOrderModel.updateOne`, idempotency pre-check test, ERP failure + stock compensation test, E11000 race compensation test.
- `products.service.spec.ts`: 2 new tests for `incrementStock`.

**Status:** ✅ Complete. 0 lint errors, 0 warnings, 33/33 unit tests pass, 7/7 E2E tests pass, `tsc` clean, `nest build` clean.

**Dependencies:** Phase 7 complete.

---

### Phase 8 — Frontend MVP ✅
**Goal:** Next.js product listing page with integrated checkout flow.

**Deliverables:**
- `src/types/index.ts`: `Product`, `Order`, `OrderStatus`, `ApiError` interfaces.
- `src/lib/api/index.ts`: Updated with fully-typed API methods.
- `src/components/ProductCard.tsx` (Client Component):
  - Displays product name, price, stock count.
  - Quantity input (min 1, max = stock, disabled when out of stock or loading).
  - Buy Now button — disabled during loading and when out of stock.
  - `crypto.randomUUID()` generates a fresh `Idempotency-Key` per attempt.
  - Success state: order ID, status (COMPLETED / FAILED), total, failure reason.
  - Error messages: 400 (invalid request), 404 (product not found), 409 (insufficient stock), 5xx (temporary failure).
  - "Buy again" button resets the card to idle state.
- `src/app/page.tsx` (Client Component): product grid with loading and error states.
- `src/app/layout.tsx`: metadata updated to "CaseCellShop".
- 0 lint errors, 0 lint warnings, `next build` passes (TypeScript clean, static generation).

**Dependencies:** Phase 7b complete.

---

### Phase 9 — Frontend Checkout
**Goal:** Merged into Phase 8 — checkout flow implemented on the product card.

**Status:** ✅ Complete (delivered as part of Phase 8 MVP).

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

### Unit tests (33 passing, 4 suites)

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
- `create() > should run the full checkout flow and return a COMPLETED order`
- `create() > should return existing order without touching stock on idempotency pre-check`
- `create() > should return FAILED order and compensate stock when ERP fails`
- `create() > should restore stock and return winning order on E11000 race`
- `create() > should re-throw non-E11000 errors from orderModel.create`
- `findOne() > should return the order when found`
- `findOne() > should throw NotFoundException when the order does not exist`
- `findOne() > should throw NotFoundException for an invalid ObjectId`

### E2E tests (7 passing, 2 suites)

**AppModule smoke test** (`test/app.e2e-spec.ts`)
- `GET /api/health should return 200 with status ok`

**Orders business scenarios** (`test/orders.e2e-spec.ts`)
- `Scenario 1 — successful purchase: order COMPLETED and stock decremented`
- `Scenario 2 — invalid quantity: HTTP 400`
- `Scenario 3 — product not found: HTTP 404`
- `Scenario 4 — insufficient stock: HTTP 409`
- `Scenario 5 — duplicate Idempotency-Key: same order returned, no duplicate created`
- `Scenario 6 — ERP failure: order FAILED and stock fully restored`

All E2E tests require `docker compose up` (MongoDB on port 27017, Redis on port 6379).
The orders suite uses the `casecellshop-e2e` database and cleans up after itself.
`FakeErpService` is replaced by a mutable Jest stub via `overrideProvider`.

---

## Known Limitations

| Limitation | Reason | Resolution |
|---|---|---|
| No Redis cache for products | Phase 10 bonus | Phase 10 |
| Stock compensation is non-transactional | No replica set in Docker Compose; compensate with `$inc` on ERP failure — documented ADR trade-off | Accepted |
| `GET /api/products` has no cache | Redis cache is a Phase 10 bonus | Phase 10 |
| ERP `rate` mode uses `Math.random()` | Non-deterministic by design; tests always use `overrideProvider` stub | Accepted |
| No production Dockerfiles | Phase 11 | Phase 11 |
| Stock compensation is non-transactional | No replica set in Docker Compose; compensate with `$inc` on ERP failure | Known — documented in ADR |
| `GET /api/products` has no cache | Redis cache is a Phase 10 bonus | Phase 10 |

---

## Recommended Next Step

**Phase 7b — E2E Tests + ERP Integration**

### Technical rationale
With idempotency complete, the next step is to cover all 6 mandatory business scenarios with real integration/E2E tests using `mongodb-memory-server`, and to implement the `FakeErpService` (timeout + configurable failure + stock compensation → FAILED/503).

### Expected outcomes after Phase 7b
- Supertest E2E suite with all 6 business scenarios passing.
- `FakeErpService` triggerable via `ERP_FAILURE_MODE=always` env var.
- Stock compensation on ERP failure (atomic `$inc` to restore stock).
- Order status transitions: `PENDING → PROCESSING → COMPLETED | FAILED`.

---

## Delivery Readiness

### Already production-like
- Environment validation on boot (fail-fast, no silent misconfiguration).
- Structured JSON logging (pino — production-grade).
- `GET /api/health` with real dependency checks.
- MongoDB unique indexes defined on `slug` (products) and `idempotencyKey` (orders).
- Docker Compose with healthchecks and persistent volumes.
- Swagger with full lifecycle documentation (`@ApiHeader`, step-by-step description, COMPLETED/FAILED examples).
- Code: English-only, 0 lint errors/warnings, 33/33 unit tests green, 7/7 E2E tests green, `tsc` clean.
- Idempotency: `Idempotency-Key` header enforced; pre-check + E11000 deduplication.
- ERP simulation: `FakeErpService` with latency/timeout/failure modes; stock compensation on failure.
- Full order lifecycle: `PENDING → PROCESSING → COMPLETED | FAILED`.
- Frontend MVP: product grid, quantity selector, checkout with idempotency, all error states (400/404/409/5xx), order confirmation with ID and status.

### Still missing for a complete delivery
- Redis cache-aside for `GET /api/products` (Phase 10 bonus).
- Production Dockerfiles + full-stack compose (Phase 11).
- Final README with cloud deployment notes (Phase 12).

### Main risks
1. **Stock compensation is non-transactional** — In the absence of a replica set, `$inc` on ERP failure is best-effort; a crash between the ERP call and the compensation creates a stock inconsistency. Documented as a known trade-off.
2. **Disk space** — Previous sessions hit 100% disk usage during npm installs. Monitor when adding new packages.

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

**Last Completed Phase:** Phase 8 — Frontend MVP

**Next Phase:** Phase 10 — Redis Cache (bonus) or Phase 11 — Production Dockerfiles

**Do Not Start:**
- Redis cache (Phase 10) — bonus, after core features
- Production Dockerfiles (Phase 11) — after all features complete
