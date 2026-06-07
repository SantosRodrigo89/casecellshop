# ADR-001: Modular Monolith instead of Real Microservices

**Status:** Accepted
**Date:** 2026-06-06  
**Updated:** 2026-06-07

## Context

The job description lists microservices as part of the stack. The challenge itself asks
for a small, synchronous checkout flow (product listing + purchase) with a short delivery
window. We must decide how to structure the backend.

**Additional context (2026-06-07):** The target role requires proficiency in MongoDB
(NoSQL), Redis, NestJS, Next.js, and Docker. The challenge describes an ERP as the
source of truth with read-only access constraints.

## Decision

Build a **modular monolith** with NestJS, using clear per-domain boundaries (`products`,
`orders`, `erp`, `health`, `shared`) and no inter-process communication. Each module owns
its schema, service, controller, and DTOs, and exposes a narrow public interface.

## Why a modular monolith

- **Fits the scope.** The domain is two collections and one synchronous checkout flow.
  Module boundaries already express the domain clearly; separate processes would add
  ceremony without adding capability.
- **Faster, more reliable delivery.** No service discovery, network contracts, or
  multi-service CI to maintain within the delivery window.
- **Maximum testability.** Unit and E2E tests run against a single process; no
  orchestration of multiple services is required.
- **Extraction-ready.** Because each module communicates only through its public
  interface, any module (e.g. `orders` or `erp`) can be lifted into a standalone service
  later without rewriting its callers.

## Why not microservices

Real microservices would introduce inter-service networking, distributed tracing,
independent deployments, and separate pipelines — operational overhead that the scope does
not justify and that would consume delivery time without improving correctness. The
`ErpModule` already simulates the boundary of an external service, demonstrating where a
split would occur.

## Consequences

**Positive:**
- Faster, more reliable delivery within the deadline.
- High testability without multi-service orchestration in CI.
- Module boundaries demonstrate domain knowledge and cohesion.
- Ready for extraction into microservices when scale demands it.

**Negative / mitigation:**
- Does not demonstrate real inter-service communication (HTTP/gRPC/messaging).
- *Mitigation:* documented as a future evolution in the README; `ErpModule` simulates the
  external-service boundary.

## Related decisions

- **No Kafka / RabbitMQ.** The checkout flow is synchronous; messaging would add
  operational overhead and disproportionate test complexity. Listed in the README as a
  future path for asynchronous, at-scale order processing.
- **No Kubernetes.** Docker Compose covers development and demo. K8s is noted in the README
  as the natural production target.
- **No CQRS / Event Sourcing.** Data volume and query complexity do not justify separate
  read/write models; a simple Mongoose repository pattern is sufficient and more readable.

## MongoDB as Operational Store (Added 2026-06-07)

**Decision:** Use MongoDB for both products and orders, making it the operational store
for this implementation.

**Rationale:**
- The target role explicitly requires MongoDB (NoSQL) proficiency
- Enables demonstration of advanced MongoDB patterns: atomic operations (`$gte` + `$inc`),
  unique indexes for idempotency, conditional updates
- Simplifies demo setup (no external ERP integration required)
- Orders are a natural fit for document store (single-item model, status transitions)

**Trade-offs introduced:**
- **Challenge alignment:** The challenge describes the ERP as the "source of truth" with
  read-only access. Using MongoDB as the operational store creates a data synchronization
  gap if a real ERP exists.
- **Production path:** Would require CDC pipeline (Debezium), Kafka event streaming, and
  reconciliation jobs to keep MongoDB in sync with ERP changes. See `docs/SYNC_STRATEGY.md`
  for details.
- **Incremental evolution:** The challenge emphasizes "incremental" solutions "without
  rewriting the ERP." MongoDB introduction is more of a platform addition than a pure
  incremental cache layer.

**Alternative considered:**
- **Hybrid approach:** MongoDB for orders only (demonstrates NoSQL), ERP for products via
  Redis cache-aside. This would better align with "incremental evolution" but demonstrate
  fewer MongoDB capabilities (no atomic stock operations).
- **Reason not chosen:** Atomic stock control (`findOneAndUpdate` with conditional `$gte`)
  is a compelling demonstration of NoSQL proficiency and solves the overselling problem
  elegantly without distributed locks.

**Evaluation note:** This decision prioritizes **stack demonstration** (role requirement)
over **literal constraint adherence** (challenge specification). The trade-off is
documented in `README.md` and `docs/SYNC_STRATEGY.md` for evaluator transparency.
